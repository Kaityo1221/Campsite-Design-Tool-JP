    ...(() => {
      // iPhone/Safari final POI color renderer.
      // This deliberately uses only public Bridge state + the latest Wayfarer
      // GCS request bounds, avoiding Safari's unreliable Google OverlayView
      // stacking path. It is the visual authority on iPhone when WFMM is absent.
      const ua = String(navigator?.userAgent || '');
      if (!/iPhone|iPad|iPod/i.test(ua)) return {};

      const ROOT_ID = 'campsite-bridge-iphone-forced-poi-colors';
      const GCS_PATH = '/api/v1/vault/mapview/gcs';
      let root = null;
      let timer = null;
      let touchActive = false;
      let touchTimer = null;
      let lastKey = '';

      function latestGcsUrl() {
        try {
          const entries = performance?.getEntriesByType?.('resource') || [];
          for (let i = entries.length - 1; i >= 0; i -= 1) {
            const name = String(entries[i]?.name || '');
            if (name.includes(GCS_PATH)) return name;
          }
        } catch (_) {}
        return '';
      }

      function parsePair(value) {
        const match = String(value || '').trim().match(/^\(?\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)\s*\)?$/);
        if (!match) return null;
        const lat = Number(match[1]);
        const lng = Number(match[2]);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      }

      function boundsFromUrl(url) {
        if (!url) return null;
        try {
          const parsed = new URL(url, location.href);
          const ne = parsePair(parsed.searchParams.get('ne'));
          const sw = parsePair(parsed.searchParams.get('sw'));
          if (!ne || !sw || !(ne.lat > sw.lat)) return null;
          return { neLat: ne.lat, neLng: ne.lng, swLat: sw.lat, swLng: sw.lng };
        } catch (_) {
          return null;
        }
      }

      function mapRect() {
        const candidates = [
          document.querySelector('.gm-style'),
          document.querySelector('app-wf-base-map'),
          document.querySelector('google-map')
        ].filter(Boolean);
        let best = null;
        for (const element of candidates) {
          let rect = null;
          try { rect = element.getBoundingClientRect(); } catch (_) { rect = null; }
          if (!rect || rect.width < 120 || rect.height < 120) continue;
          if (!best || rect.width * rect.height > best.width * best.height) best = rect;
        }
        return best;
      }

      function visibleDetailSheet() {
        const selectors = [
          'mat-bottom-sheet-container',
          '.mat-bottom-sheet-container',
          '.mat-mdc-dialog-container',
          '[aria-modal="true"]'
        ];
        for (const selector of selectors) {
          let elements = [];
          try { elements = [...document.querySelectorAll(selector)]; } catch (_) { continue; }
          for (const element of elements) {
            let rect = null;
            let style = null;
            try {
              rect = element.getBoundingClientRect();
              style = getComputedStyle(element);
            } catch (_) {
              continue;
            }
            if (!rect || !style) continue;
            if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) continue;
            if (rect.width >= innerWidth * 0.72 && rect.height >= 120 && rect.bottom >= innerHeight * 0.82) return true;
          }
        }
        return false;
      }

      function mercatorY(lat) {
        const limited = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
        const radians = limited * Math.PI / 180;
        return Math.log(Math.tan(Math.PI / 4 + radians / 2));
      }

      function project(bounds, rect, lat, lng) {
        const latitude = Number(lat);
        let longitude = Number(lng);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
        if (latitude < bounds.swLat || latitude > bounds.neLat) return null;

        let west = bounds.swLng;
        let east = bounds.neLng;
        if (east < west) east += 360;
        if (longitude < west) longitude += 360;
        if (longitude < west || longitude > east) return null;

        const xSpan = east - west;
        const northY = mercatorY(bounds.neLat);
        const southY = mercatorY(bounds.swLat);
        const ySpan = northY - southY;
        if (!(xSpan > 0) || !(ySpan > 0)) return null;

        const x = ((longitude - west) / xSpan) * rect.width;
        const y = ((northY - mercatorY(latitude)) / ySpan) * rect.height;
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        return { x, y };
      }

      function ensureRoot(rect) {
        if (!root || !root.isConnected) {
          root = document.getElementById(ROOT_ID) || document.createElement('div');
          root.id = ROOT_ID;
          root.setAttribute('aria-hidden', 'true');
          if (!root.isConnected) document.body.appendChild(root);
        }
        Object.assign(root.style, {
          position: 'fixed',
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: '2147483644',
          display: touchActive || visibleDetailSheet() ? 'none' : 'block'
        });
        return root;
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
        const entity = String(poi?.gameEntity || '').toUpperCase();
        const status = String(poi?.gameStatus || '').toUpperCase();
        const inactive = entity === 'POWERSPOT' && status === 'INACTIVE';
        if (inactive && !showInactivePowerSpots) return null;

        if (entity === 'POKESTOP') {
          const marker = baseMarker(point, 22);
          marker.dataset.cbsForcedEntity = entity;
          Object.assign(marker.style, {
            borderRadius: '50%',
            background: '#22b8f0',
            border: '3px solid #1748b8',
            boxShadow: '0 0 0 1px rgba(255,255,255,.96),0 2px 5px rgba(0,0,0,.34)'
          });
          return marker;
        }

        if (entity === 'GYM') {
          const marker = baseMarker(point, 28);
          marker.dataset.cbsForcedEntity = entity;
          marker.style.clipPath = 'polygon(50% 0,100% 100%,0 100%)';
          marker.style.background = '#b91c3c';
          const inner = document.createElement('div');
          Object.assign(inner.style, {
            position: 'absolute',
            left: '4px',
            top: '5px',
            width: '20px',
            height: '19px',
            clipPath: 'polygon(50% 0,100% 100%,0 100%)',
            background: '#f04463'
          });
          marker.appendChild(inner);
          return marker;
        }

        if (entity === 'POWERSPOT') {
          const marker = baseMarker(point, 24);
          marker.dataset.cbsForcedEntity = entity;
          Object.assign(marker.style, {
            transform: 'translate(-50%,-50%) rotate(45deg) translateZ(0)',
            borderRadius: '4px',
            background: '#c026d3',
            border: '3px solid #7e22ce',
            boxShadow: '0 0 0 1px rgba(255,255,255,.96),0 2px 5px rgba(0,0,0,.34)',
            opacity: inactive ? '.38' : '1',
            filter: inactive ? 'grayscale(1) drop-shadow(0 2px 3px rgba(0,0,0,.34))' : 'drop-shadow(0 2px 3px rgba(0,0,0,.34))'
          });
          return marker;
        }

        return null;
      }

      function suppressOlderIphoneRenderers() {
        for (const id of ['campsite-bridge-iphone-latest-colors', 'campsite-bridge-iphone-dom-overlay']) {
          const element = document.getElementById(id);
          if (element) element.style.setProperty('display', 'none', 'important');
        }
        try { window.CampsiteBridgeIPhoneFallbackAuthority?.refresh?.(); } catch (_) {}
      }

      function renderForced(force = false) {
        const api = window.CampsiteBridgeShortcut;
        if (!api?.getPois || api?.isWfmmPresent?.()) {
          if (root) root.style.display = 'none';
          return 0;
        }

        const url = latestGcsUrl();
        const bounds = boundsFromUrl(url);
        const rect = mapRect();
        if (!bounds || !rect) {
          if (root) root.style.display = 'none';
          return 0;
        }

        suppressOlderIphoneRenderers();

        const pois = api.getPois() || [];
        const displayState = api.getDisplayState?.() || {};
        const showInactivePowerSpots = displayState.showInactivePowerSpots !== false;
        const key = [
          url,
          pois.length,
          showInactivePowerSpots ? '1' : '0',
          Math.round(rect.left),
          Math.round(rect.top),
          Math.round(rect.width),
          Math.round(rect.height),
          touchActive ? 'touch' : 'idle',
          visibleDetailSheet() ? 'sheet' : 'map'
        ].join('|');

        const target = ensureRoot(rect);
        if (!force && key === lastKey && target.childNodes.length) return target.childNodes.length;

        const fragment = document.createDocumentFragment();
        let drawn = 0;
        for (const poi of pois) {
          const point = project(bounds, rect, poi?.lat, poi?.lng);
          if (!point) continue;
          const marker = makeMarker(poi, point, showInactivePowerSpots);
          if (!marker) continue;
          fragment.appendChild(marker);
          drawn += 1;
        }
        target.replaceChildren(fragment);
        lastKey = key;
        return drawn;
      }

      function schedule(force = true, delay = 120) {
        setTimeout(() => renderForced(force), delay);
      }

      window.addEventListener('touchstart', event => {
        try {
          if (!event.target?.closest?.('.gm-style, app-wf-base-map, google-map')) return;
        } catch (_) { return; }
        touchActive = true;
        if (root) root.style.display = 'none';
        if (touchTimer) clearTimeout(touchTimer);
      }, { passive: true, capture: true });

      const releaseTouch = () => {
        if (touchTimer) clearTimeout(touchTimer);
        touchTimer = setTimeout(() => {
          touchTimer = null;
          touchActive = false;
          schedule(true, 180);
        }, 100);
      };
      window.addEventListener('touchend', releaseTouch, { passive: true, capture: true });
      window.addEventListener('touchcancel', releaseTouch, { passive: true, capture: true });
      window.addEventListener('resize', () => schedule(true, 60), { passive: true });
      window.addEventListener('scroll', () => schedule(true, 60), { passive: true });

      timer = setInterval(() => renderForced(false), 350);
      for (const delay of [0, 180, 500, 1000, 1800]) schedule(true, delay);

      window.CampsiteBridgeIPhoneForcedColors = Object.freeze({
        refresh: () => renderForced(true),
        getState: () => ({
          active: Boolean(root?.isConnected && root.style.display !== 'none'),
          drawn: root?.childNodes?.length || 0,
          boundsFound: Boolean(boundsFromUrl(latestGcsUrl())),
          mapRectFound: Boolean(mapRect()),
          touchActive
        })
      });

      window.addEventListener('pagehide', () => {
        if (timer) clearInterval(timer);
        timer = null;
        if (touchTimer) clearTimeout(touchTimer);
        touchTimer = null;
        try { root?.remove?.(); } catch (_) {}
        root = null;
      }, { once: true });

      return {};
    })(),
