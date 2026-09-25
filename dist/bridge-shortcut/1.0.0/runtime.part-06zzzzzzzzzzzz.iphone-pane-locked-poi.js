    ...(() => {
      // iPhone/Safari geographic POI renderer.
      // During a pan, NEVER recompute screen coordinates. Google Maps moves the
      // overlay pane itself, so markers stay glued to their latitude/longitude.
      // Reproject only once the map becomes idle.
      const ua = String(navigator?.userAgent || '');
      if (!/iPhone|iPad|iPod/i.test(ua)) return {};

      const ROOT_ID = 'campsite-bridge-iphone-pane-locked-poi';
      const STYLE_ID = 'campsite-bridge-iphone-pane-locked-authority-style';
      const ACTIVE_CLASS = 'cbs-iphone-pane-locked-active';
      const ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
      let map = null;
      let overlay = null;
      let root = null;
      let timer = null;
      let raf = 0;
      let moving = false;
      let active = false;
      let lastDrawn = 0;
      let listeners = [];

      function looksLikeMap(value) {
        return Boolean(value && typeof value === 'object' &&
          typeof value.getCenter === 'function' &&
          typeof value.getZoom === 'function' &&
          typeof value.getDiv === 'function' &&
          typeof value.addListener === 'function');
      }

      function findMapFromAngular() {
        const host = document.querySelector('app-wf-base-map');
        if (!host || !Array.isArray(host.__ngContext__)) return null;
        for (const value of host.__ngContext__) {
          if (looksLikeMap(value)) return value;
          if (!value || typeof value !== 'object') continue;
          let keys = [];
          try { keys = Object.keys(value); } catch (_) { continue; }
          for (const key of keys) {
            let nested = null;
            try { nested = value[key]; } catch (_) { continue; }
            if (looksLikeMap(nested)) return nested;
          }
        }
        return null;
      }

      function discoverMap() {
        let candidate = null;
        try { candidate = window.WFMM?.map?.get?.() || null; } catch (_) {}
        if (!looksLikeMap(candidate)) candidate = window.__campsiteBridgeGoogleMap || null;
        if (!looksLikeMap(candidate)) {
          try { candidate = window.CampsiteBridgePcCollector?.findMap?.() || null; } catch (_) {}
        }
        if (!looksLikeMap(candidate)) candidate = findMapFromAngular();
        if (looksLikeMap(candidate) && candidate !== map) attach(candidate);
        return map;
      }

      function ensureAuthorityStyle() {
        let style = document.getElementById(STYLE_ID);
        if (style) return style;
        style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
          html.${ACTIVE_CLASS} #campsite-bridge-iphone-forced-poi-colors,
          html.${ACTIVE_CLASS} #campsite-bridge-iphone-latest-colors,
          html.${ACTIVE_CLASS} #campsite-bridge-iphone-dom-overlay,
          html.${ACTIVE_CLASS} #campsite-bridge-iphone-map-anchored-poi,
          html.${ACTIVE_CLASS} #campsite-bridge-poi-colors {
            display: none !important;
          }
        `;
        (document.head || document.documentElement).appendChild(style);
        return style;
      }

      function setActive(next) {
        active = Boolean(next);
        ensureAuthorityStyle();
        document.documentElement.classList.toggle(ACTIVE_CLASS, active);
      }

      function normalizeEntity(raw) {
        const text = String(raw || '').toUpperCase().replace(/[\s_-]/g, '');
        if (text === 'POKESTOP') return 'POKESTOP';
        if (text === 'GYM') return 'GYM';
        if (text === 'POWERSPOT') return 'POWERSPOT';
        return '';
      }

      function pois() {
        const api = window.CampsiteBridgeShortcut;
        if (!api?.getPois || api?.isWfmmPresent?.()) return [];
        let raw = [];
        try { raw = api.getPois() || []; } catch (_) { raw = []; }
        const out = [];
        for (const p of raw) {
          const entity = normalizeEntity(p?.gameEntity || p?.poiKind || p?.entity || p?.type);
          if (!ENTITIES.has(entity)) continue;
          const lat = Number(p?.lat ?? p?.latitude ?? (Number.isFinite(Number(p?.latE6)) ? Number(p.latE6) / 1e6 : NaN));
          const lng = Number(p?.lng ?? p?.longitude ?? (Number.isFinite(Number(p?.lngE6)) ? Number(p.lngE6) / 1e6 : NaN));
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          out.push({
            entity,
            status: String(p?.gameStatus || p?.status || 'UNKNOWN').toUpperCase(),
            lat,
            lng
          });
        }
        return out;
      }

      function displayState() {
        try { return window.CampsiteBridgeShortcut?.getDisplayState?.() || {}; }
        catch (_) { return {}; }
      }

      function pointFor(projection, poi) {
        const LatLng = window.google?.maps?.LatLng;
        if (!LatLng || !projection?.fromLatLngToDivPixel) return null;
        try {
          const point = projection.fromLatLngToDivPixel(new LatLng(poi.lat, poi.lng));
          if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
          return { x: Number(point.x), y: Number(point.y) };
        } catch (_) { return null; }
      }

      function baseMarker(point, size) {
        const marker = document.createElement('div');
        Object.assign(marker.style, {
          position: 'absolute',
          left: `${point.x}px`,
          top: `${point.y}px`,
          width: `${size}px`,
          height: `${size}px`,
          transform: 'translate(-50%,-50%) translateZ(0)',
          boxSizing: 'border-box',
          pointerEvents: 'none',
          filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.34))'
        });
        return marker;
      }

      function makeMarker(poi, point, showInactive) {
        const inactivePower = poi.entity === 'POWERSPOT' && poi.status === 'INACTIVE';
        if (poi.status === 'INACTIVE' && !inactivePower) return null;
        if (inactivePower && !showInactive) return null;

        if (poi.entity === 'POKESTOP') {
          const marker = baseMarker(point, 22);
          Object.assign(marker.style, {
            borderRadius: '50%', background: '#22b8f0', border: '3px solid #1748b8',
            boxShadow: '0 0 0 1px rgba(255,255,255,.96),0 2px 5px rgba(0,0,0,.34)'
          });
          return marker;
        }
        if (poi.entity === 'GYM') {
          const marker = baseMarker(point, 28);
          marker.style.clipPath = 'polygon(50% 0,100% 100%,0 100%)';
          marker.style.background = '#b91c3c';
          const inner = document.createElement('div');
          Object.assign(inner.style, {
            position: 'absolute', left: '4px', top: '5px', width: '20px', height: '19px',
            clipPath: 'polygon(50% 0,100% 100%,0 100%)', background: '#f04463'
          });
          marker.appendChild(inner);
          return marker;
        }
        if (poi.entity === 'POWERSPOT') {
          const marker = baseMarker(point, 24);
          Object.assign(marker.style, {
            transform: 'translate(-50%,-50%) rotate(45deg) translateZ(0)',
            borderRadius: '4px', background: '#c026d3', border: '3px solid #7e22ce',
            boxShadow: '0 0 0 1px rgba(255,255,255,.96),0 2px 5px rgba(0,0,0,.34)',
            opacity: inactivePower ? '.38' : '1',
            filter: inactivePower ? 'grayscale(1) drop-shadow(0 2px 3px rgba(0,0,0,.34))' : 'drop-shadow(0 2px 3px rgba(0,0,0,.34))'
          });
          return marker;
        }
        return null;
      }

      function renderNow() {
        raf = 0;
        if (moving || !overlay || !root || !map) return lastDrawn;
        if (window.CampsiteBridgeShortcut?.isWfmmPresent?.()) {
          root.style.display = 'none';
          root.replaceChildren();
          lastDrawn = 0;
          return 0;
        }
        root.style.display = '';
        let projection = null;
        try { projection = overlay.getProjection?.(); } catch (_) {}
        if (!projection) return lastDrawn;

        const state = displayState();
        const showInactive = state.showInactivePowerSpots !== false;
        const fragment = document.createDocumentFragment();
        let drawn = 0;
        for (const poi of pois()) {
          const point = pointFor(projection, poi);
          if (!point) continue;
          const marker = makeMarker(poi, point, showInactive);
          if (!marker) continue;
          fragment.appendChild(marker);
          drawn += 1;
        }
        root.replaceChildren(fragment);
        lastDrawn = drawn;
        return drawn;
      }

      function scheduleRender() {
        if (moving || raf) return;
        raf = requestAnimationFrame(renderNow);
      }

      function clearListeners() {
        for (const listener of listeners) {
          try { listener?.remove?.(); } catch (_) {}
        }
        listeners = [];
      }

      function detach() {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        clearListeners();
        try { overlay?.setMap?.(null); } catch (_) {}
        overlay = null;
        root = null;
        moving = false;
        setActive(false);
      }

      function attach(nextMap) {
        const OverlayView = window.google?.maps?.OverlayView;
        if (!looksLikeMap(nextMap) || !OverlayView) return false;
        if (map === nextMap && overlay) return true;
        detach();
        map = nextMap;
        if (!window.__campsiteBridgeGoogleMap) window.__campsiteBridgeGoogleMap = nextMap;

        const next = new OverlayView();
        next.onAdd = function() {
          const panes = this.getPanes?.();
          const pane = panes?.overlayLayer || panes?.overlayMouseTarget || panes?.floatPane;
          if (!pane) return;
          const node = document.createElement('div');
          node.id = ROOT_ID;
          node.setAttribute('aria-hidden', 'true');
          Object.assign(node.style, {
            position: 'absolute', left: '0', top: '0', width: '0', height: '0',
            overflow: 'visible', pointerEvents: 'none', zIndex: '100'
          });
          pane.appendChild(node);
          root = node;
          setActive(true);
          scheduleRender();
        };
        // Google calls draw repeatedly during pan. Do not recompute then: the
        // pane's own transform is the geographic movement we want to preserve.
        next.draw = function() {
          if (!moving && !root?.childNodes?.length) scheduleRender();
        };
        next.onRemove = function() {
          try { root?.remove?.(); } catch (_) {}
          root = null;
          setActive(false);
        };

        try {
          next.setMap(nextMap);
          overlay = next;
        } catch (_) {
          overlay = null;
          return false;
        }

        try {
          listeners.push(nextMap.addListener('dragstart', () => {
            moving = true;
            if (raf) cancelAnimationFrame(raf);
            raf = 0;
          }));
          listeners.push(nextMap.addListener('dragend', () => {
            // Keep moving=true through inertial motion; idle is the canonical end.
          }));
          listeners.push(nextMap.addListener('zoom_changed', () => {
            moving = true;
          }));
          listeners.push(nextMap.addListener('idle', () => {
            moving = false;
            scheduleRender();
            try { window.CampsiteBridgeIPhoneUiOcclusionGuard?.refresh?.(); } catch (_) {}
          }));
        } catch (_) {}
        return true;
      }

      function refresh() {
        discoverMap();
        if (!moving) scheduleRender();
      }

      ensureAuthorityStyle();
      timer = setInterval(refresh, 300);
      for (const delay of [0, 100, 300, 800, 1600]) setTimeout(refresh, delay);

      window.CampsiteBridgeIPhonePaneLockedPoi = Object.freeze({
        refresh,
        isActive: () => Boolean(active && root?.isConnected && overlay && map),
        getState: () => ({ active, moving, drawn: lastDrawn, mapFound: Boolean(map) })
      });

      window.addEventListener('pagehide', () => {
        if (timer) clearInterval(timer);
        timer = null;
        detach();
        map = null;
        document.documentElement.classList.remove(ACTIVE_CLASS);
        try { document.getElementById(STYLE_ID)?.remove?.(); } catch (_) {}
      }, { once: true });

      return {};
    })(),
