;(() => {
  'use strict';
  if (window.__cbsI3PageWorldHostInjected) return;
  window.__cbsI3PageWorldHostInjected = true;

  function pageHost() {
    'use strict';
    if (window.__cbsI3PageWorldHost) return;
    window.__cbsI3PageWorldHost = true;

    const CMD = 'cbs-i3:cmd';
    const EVT = 'cbs-i3:evt';
    const HOST_SELECTOR = 'app-wf-base-map';
    const MAX_POINTS = 30;
    const POLL_MS = 1500;
    const STROKE = '#2563eb';
    const FILL = '#60a5fa';

    let sid = null;
    let points = [];
    let completed = false;
    let map = null;
    let mapLostSent = false;
    let shape = null;
    let circles = [];
    let zoomListener = null;
    let pollTimer = null;

    const emit = (type, data = {}) => {
      document.dispatchEvent(new CustomEvent(EVT, {
        detail: JSON.stringify({ sid, type, ...data })
      }));
    };

    function looksLikeMap(value) {
      return Boolean(value && typeof value.getCenter === 'function' &&
        typeof value.getBounds === 'function' && typeof value.getZoom === 'function' &&
        typeof value.getDiv === 'function' && typeof value.addListener === 'function');
    }

    function findMap() {
      const host = document.querySelector(HOST_SELECTOR);
      const context = host?.__ngContext__;
      if (!context || typeof context.length !== 'number') return null;
      const limit = Math.min(context.length, 128);
      for (let i = 0; i < limit; i += 1) {
        const component = context[i];
        if (!component || typeof component.getMap !== 'function') continue;
        let candidate = null;
        try { candidate = component.getMap(); } catch (_) { candidate = null; }
        if (looksLikeMap(candidate)) return candidate;
      }
      return null;
    }

    function clearOverlays() {
      try { shape?.setMap?.(null); } catch (_) {}
      shape = null;
      for (const circle of circles) {
        try { circle?.setMap?.(null); } catch (_) {}
      }
      circles = [];
    }

    function clearZoomListener() {
      try { zoomListener?.remove?.(); } catch (_) {}
      zoomListener = null;
    }

    function metersPerPixel(lat, zoom) {
      return 156543.03392 * Math.cos(Number(lat) * Math.PI / 180) / (2 ** Number(zoom));
    }

    function circleRadius(point) {
      const zoom = Number(map?.getZoom?.());
      if (!Number.isFinite(zoom)) return 1;
      const mpp = metersPerPixel(point.lat, zoom);
      return Number.isFinite(mpp) && mpp > 0 ? mpp * 3 : 1;
    }

    function updateCircleRadii() {
      circles.forEach((circle, index) => {
        const point = points[index];
        if (!point) return;
        try { circle.setRadius(circleRadius(point)); } catch (_) {}
      });
    }

    function draw() {
      clearOverlays();
      if (!map || !points.length) return;
      const maps = window.google?.maps;
      if (!maps) return;

      if (points.length === 2 && typeof maps.Polyline === 'function') {
        shape = new maps.Polyline({
          map, path: points, clickable: false,
          strokeColor: STROKE, strokeOpacity: 0.95, strokeWeight: 3
        });
      } else if (points.length >= 3 && typeof maps.Polygon === 'function') {
        shape = new maps.Polygon({
          map, paths: points, clickable: false,
          strokeColor: STROKE, strokeOpacity: 0.95, strokeWeight: 3,
          fillColor: FILL, fillOpacity: 0.16
        });
      }

      if (typeof maps.Circle === 'function') {
        circles = points.map(point => new maps.Circle({
          map, center: point, radius: circleRadius(point), clickable: false,
          strokeColor: STROKE, strokeOpacity: 0.95, strokeWeight: 3,
          fillColor: FILL, fillOpacity: 0.35
        }));
      }
    }

    function state() {
      emit('state', {
        points: points.map(point => ({ lat: point.lat, lng: point.lng })),
        completed,
        mapBound: Boolean(map)
      });
    }

    function bind(nextMap) {
      if (nextMap === map) return;
      clearOverlays();
      clearZoomListener();
      map = nextMap;
      if (!map) {
        if (!mapLostSent) {
          mapLostSent = true;
          emit('map-lost');
        }
        state();
        return;
      }
      mapLostSent = false;
      zoomListener = map.addListener('zoom_changed', updateCircleRadii);
      draw();
      emit('map-bound');
      state();
    }

    function pollMap() {
      if (document.visibilityState === 'hidden') return;
      bind(findMap());
    }

    function ensurePolling() {
      if (pollTimer) return;
      pollMap();
      pollTimer = setInterval(pollMap, POLL_MS);
    }

    function stopPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    }

    function screenToLatLng(x, y) {
      if (!map) throw new Error('MAP_UNAVAILABLE');
      const projection = map.getProjection?.();
      const center = map.getCenter?.();
      const zoom = Number(map.getZoom?.());
      const rect = map.getDiv?.()?.getBoundingClientRect?.();
      if (!projection || typeof projection.fromLatLngToPoint !== 'function' ||
          typeof projection.fromPointToLatLng !== 'function' || !center ||
          !Number.isFinite(zoom) || !rect) throw new Error('PROJECTION_UNAVAILABLE');

      const tilt = typeof map.getTilt === 'function' ? map.getTilt() : undefined;
      const heading = typeof map.getHeading === 'function' ? map.getHeading() : undefined;
      if ((typeof tilt === 'number' && Number.isFinite(tilt) && tilt !== 0) ||
          (typeof heading === 'number' && Number.isFinite(heading) && heading !== 0)) {
        throw new Error('TILT_HEADING');
      }

      const centerWorld = projection.fromLatLngToPoint(center);
      const scale = 2 ** zoom;
      const dx = Number(x) - (rect.left + rect.width / 2);
      const dy = Number(y) - (rect.top + rect.height / 2);
      const targetWorld = {
        x: centerWorld.x + dx / scale,
        y: centerWorld.y + dy / scale
      };
      const target = projection.fromPointToLatLng(targetWorld);
      const lat = Number(typeof target?.lat === 'function' ? target.lat() : target?.lat);
      const lng = Number(typeof target?.lng === 'function' ? target.lng() : target?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('INVALID_COORDINATE');
      return { lat, lng };
    }

    function resetSession(nextSid) {
      if (sid === nextSid) return;
      clearOverlays();
      clearZoomListener();
      points = [];
      completed = false;
      sid = nextSid;
      map = null;
      mapLostSent = false;
    }

    function onCommand(event) {
      let msg = null;
      try { msg = JSON.parse(event.detail); } catch (_) { return; }
      if (!msg || typeof msg.sid !== 'string' || typeof msg.cmd !== 'string') return;
      resetSession(msg.sid);

      try {
        if (msg.cmd === 'destroy') {
          clearOverlays();
          clearZoomListener();
          stopPolling();
          map = null;
          emit('state', { points: [], completed: false, mapBound: false });
          points = [];
          completed = false;
          return;
        }

        ensurePolling();

        if (msg.cmd === 'add') {
          if (completed || points.length >= MAX_POINTS) return state();
          pollMap();
          points.push(screenToLatLng(msg.x, msg.y));
          draw();
          return state();
        }
        if (msg.cmd === 'undo') {
          if (!completed && points.length) points.pop();
          draw();
          return state();
        }
        if (msg.cmd === 'restart') {
          points = [];
          completed = false;
          draw();
          return state();
        }
        if (msg.cmd === 'complete') {
          if (points.length >= 3) completed = true;
          return state();
        }
        if (msg.cmd === 'get') {
          pollMap();
          return state();
        }
      } catch (error) {
        emit('error', { code: String(error?.message || error || 'UNKNOWN') });
      }
    }

    document.addEventListener(CMD, onCommand);
    document.dispatchEvent(new CustomEvent(EVT, {
      detail: JSON.stringify({ sid: null, type: 'ready' })
    }));
  }

  const script = document.createElement('script');
  script.textContent = ';(' + pageHost.toString() + ')();';
  (document.documentElement || document.head || document.body).appendChild(script);
  script.remove();
})();