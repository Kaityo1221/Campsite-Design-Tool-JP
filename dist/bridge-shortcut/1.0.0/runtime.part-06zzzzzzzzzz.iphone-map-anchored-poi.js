    ...(() => {
      // iPhone/Safari map-anchored POI renderer.
      // POIs live inside a Google Maps OverlayView pane, so their geographic
      // positions stay glued to the map during pan, inertia and zoom.
      const ua = String(navigator?.userAgent || '');
      if (!/iPhone|iPad|iPod/i.test(ua)) return {};

      const ROOT_ID = 'campsite-bridge-iphone-map-anchored-poi';
      const ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
      let map = null;
      let overlay = null;
      let root = null;
      let timer = null;
      let drawRaf = 0;
      let lastDrawn = 0;
      let lastMapFound = false;

      function looksLikeGoogleMap(value) {
        return Boolean(
          value && typeof value === 'object' &&
          typeof value.getCenter === 'function' &&
          typeof value.getZoom === 'function' &&
          typeof value.getDiv === 'function' &&
          typeof value.addListener === 'function'
        );
      }

      function findMapFromAngular() {
        const host = document.querySelector('app-wf-base-map');
        if (!host || !Array.isArray(host.__ngContext__)) return null;
        for (const value of host.__ngContext__) {
          if (looksLikeGoogleMap(value)) return value;
          if (!value || typeof value !== 'object') continue;
          let keys = [];
          try { keys = Object.keys(value); } catch (_) { continue; }
          for (const key of keys) {
            let nested = null;
            try { nested = value[key]; } catch (_) { continue; }
            if (looksLikeGoogleMap(nested)) return nested;
          }
        }
        return null;
      }

      function discoverMap() {
        let candidate = null;
        try { candidate = window.WFMM?.map?.get?.() || null; } catch (_) {}
        if (!looksLikeGoogleMap(candidate)) candidate = window.__campsiteBridgeGoogleMap || null;
        if (!looksLikeGoogleMap(candidate)) {
          try { candidate = window.CampsiteBridgePcCollector?.findMap?.() || null; } catch (_) {}
        }
        if (!looksLikeGoogleMap(candidate)) candidate = findMapFromAngular();
        lastMapFound = looksLikeGoogleMap(candidate);
        if (lastMapFound && candidate !== map) attach(candidate);
        return map;
      }

      function normalizeEntity(raw) {
        const text = String(raw || '').toUpperCase().replace(/[\s_-]/g, '');
        if (text === 'POKESTOP') return 'POKESTOP';
        if (text === 'GYM') return 'GYM';
        if (text === 'POWERSPOT') return 'POWERSPOT';
        return '';
      }

      function poiList() {
        const api = window.CampsiteBridgeShortcut;
        if (!api?.getPois || api?.isWfmmPresent?.()) return [];
        let raw = [];
        try { raw = api.getPois() || []; } catch (_) { raw = []; }
        const out = [];
        for (const poi of raw) {
          const entity = normalizeEntity(poi?.gameEntity || poi?.poiKind || poi?.entity || poi?.type);
          if (!ENTITIES.has(entity)) continue;
          const lat = Number(poi?.lat ?? poi?.latitude ?? (Number.isFinite(Number(poi?.latE6)) ? Number(poi.latE6) / 1e6 : NaN));
          const lng = Number(poi?.lng ?? poi?.longitude ?? (Number.isFinite(Number(poi?.lngE6)) ? Number(poi.lngE6) / 1e6 : NaN));
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const status = String(poi?.gameStatus || poi?.status || 'UNKNOWN').toUpperCase();
          out.push({
            guid: String(poi?.guid || poi?.poiId || poi?.id || `${entity}:${lat.toFixed(6)},${lng.toFixed(6)}`),
            entity,
            status,
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
          const p = projection.fromLatLngToDivPixel(new LatLng(poi.lat, poi.lng));
          if (!p || !Number.isFinite(Number(p.x)) || !Number.isFinite(Number(p.y))) return null;
          return { x: Number(p.x), y: Number(p.y) };
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

      function makeMarker(poi, point, showInactivePowerSpots) {
        const inactivePower = poi.entity === 'POWERSPOT' && poi.status === 'INACTIVE';
        if (poi.status === 'INACTIVE' && !inactivePower) return null;
        if (inactivePower && !showInactivePowerSpots) return null;

        if (poi.entity === 'POKESTOP') {
          const marker = baseMarker(point, 22);
          marker.dataset.cbsMapAnchoredEntity = poi.entity;
          Object.assign(marker.style, {
            borderRadius: '50%',
            background: '#22b8f0',
            border: '3px solid #1748b8',
            boxShadow: '0 0 0 1px rgba(255,255,255,.96),0 2px 5px rgba(0,0,0,.34)'
          });
          return marker;
        }

        if (poi.entity === 'GYM') {
          const marker = baseMarker(point, 28);
          marker.dataset.cbsMapAnchoredEntity = poi.entity;
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
          marker.dataset.cbsMapAnchoredEntity = poi.entity;
          Object.assign(marker.style, {
            transform: 'translate(-50%,-50%) rotate(45deg) translateZ(0)',
            borderRadius: '4px',
            background: '#c026d3',
            border: '3px solid #7e22ce',
            boxShadow: '0 0 0 1px rgba(255,255,255,.96),0 2px 5px rgba(0,0,0,.34)',
            opacity: inactivePower ? '.38' : '1',
            filter: inactivePower ? 'grayscale(1) drop-shadow(0 2px 3px rgba(0,0,0,.34))' : 'drop-shadow(0 2px 3px rgba(0,0,0,.34))'
          });
          return marker;
        }
        return null;
      }

      function renderNow() {
        drawRaf = 0;
        if (!overlay || !root || !map) return 0;
        if (window.CampsiteBridgeShortcut?.isWfmmPresent?.()) {
          root.style.display = 'none';
          root.replaceChildren();
          lastDrawn = 0;
          return 0;
        }
        root.style.display = '';

        let projection = null;
        try { projection = overlay.getProjection?.(); } catch (_) {}
        if (!projection) return 0;

        let bounds = null;
        try { bounds = map.getBounds?.() || null; } catch (_) {}
        const LatLng = window.google?.maps?.LatLng;
        const state = displayState();
        const showInactivePowerSpots = state.showInactivePowerSpots !== false;
        const fragment = document.createDocumentFragment();
        let drawn = 0;

        for (const poi of poiList()) {
          if (bounds?.contains && LatLng) {
            try { if (!bounds.contains(new LatLng(poi.lat, poi.lng))) continue; } catch (_) {}
          }
          const point = pointFor(projection, poi);
          if (!point) continue;
          const marker = makeMarker(poi, point, showInactivePowerSpots);
          if (!marker) continue;
          fragment.appendChild(marker);
          drawn += 1;
        }
        root.replaceChildren(fragment);
        lastDrawn = drawn;
        return drawn;
      }

      function scheduleDraw() {
        if (drawRaf) return;
        drawRaf = requestAnimationFrame(renderNow);
      }

      function detach() {
        if (drawRaf) cancelAnimationFrame(drawRaf);
        drawRaf = 0;
        try { overlay?.setMap?.(null); } catch (_) {}
        overlay = null;
        root = null;
      }

      function attach(nextMap) {
        const OverlayView = window.google?.maps?.OverlayView;
        if (!looksLikeGoogleMap(nextMap) || !OverlayView) return false;
        if (map === nextMap && overlay) return true;
        detach();
        map = nextMap;
        if (!window.__campsiteBridgeGoogleMap) window.__campsiteBridgeGoogleMap = nextMap;

        const next = new OverlayView();
        next.onAdd = function() {
          const panes = this.getPanes?.();
          // floatPane is still inside the Google map stacking context, so
          // Wayfarer's own filters and detail sheets naturally stay above it.
          const pane = panes?.floatPane || panes?.overlayMouseTarget || panes?.overlayLayer;
          if (!pane) return;
          const node = document.createElement('div');
          node.id = ROOT_ID;
          node.setAttribute('aria-hidden', 'true');
          Object.assign(node.style, {
            position: 'absolute', left: '0', top: '0', width: '0', height: '0',
            overflow: 'visible', pointerEvents: 'none', zIndex: '2147483000'
          });
          pane.appendChild(node);
          root = node;
          scheduleDraw();
        };
        next.draw = scheduleDraw;
        next.onRemove = function() {
          try { root?.remove?.(); } catch (_) {}
          root = null;
        };
        try {
          next.setMap(nextMap);
          overlay = next;
          return true;
        } catch (_) {
          overlay = null;
          return false;
        }
      }

      function refresh() {
        discoverMap();
        scheduleDraw();
      }

      timer = setInterval(refresh, 250);
      for (const delay of [0, 100, 300, 800, 1600]) setTimeout(refresh, delay);

      window.CampsiteBridgeIPhoneMapAnchoredPoi = Object.freeze({
        refresh,
        isActive: () => Boolean(root?.isConnected && overlay && map),
        getState: () => ({ active: Boolean(root?.isConnected && overlay && map), drawn: lastDrawn, mapFound: lastMapFound })
      });

      window.addEventListener('pagehide', () => {
        if (timer) clearInterval(timer);
        timer = null;
        detach();
        map = null;
      }, { once: true });

      return {};
    })(),
