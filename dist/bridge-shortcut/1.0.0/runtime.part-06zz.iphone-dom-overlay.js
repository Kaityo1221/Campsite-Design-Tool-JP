    ...(() => {
      // iPhone/Safari DOM overlay fallback.
      // When Safari Shortcuts can read GCS payloads but cannot reach the live
      // Google Map instance, use the latest Wayfarer GCS request bounds as the
      // projection source and paint directly over the visible map DOM.
      const IPHONE_DOM_GCS_PATH = '/api/v1/vault/mapview/gcs';
      const FALLBACK_ROOT_ID = 'campsite-bridge-iphone-dom-overlay';
      let fallbackTimer = null;
      let fallbackRoot = null;
      let lastFallbackKey = '';
      let touchActive = false;
      let touchReleaseTimer = null;

      function latestDomGcsUrl() {
        try {
          const entries = performance?.getEntriesByType?.('resource') || [];
          for (let index = entries.length - 1; index >= 0; index -= 1) {
            const name = String(entries[index]?.name || '');
            if (name.includes(IPHONE_DOM_GCS_PATH)) return name;
          }
        } catch (_) {}
        return '';
      }

      function parseLatLngPair(value) {
        const text = String(value || '').trim();
        const match = text.match(/^\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)?$/);
        if (!match) return null;
        const lat = Number(match[1]);
        const lng = Number(match[2]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
      }

      function boundsFromGcsUrl(url) {
        if (!url) return null;
        try {
          const parsed = new URL(url, location.href);
          const ne = parseLatLngPair(parsed.searchParams.get('ne'));
          const sw = parseLatLngPair(parsed.searchParams.get('sw'));
          if (!ne || !sw) return null;
          if (!(ne.lat > sw.lat)) return null;
          return { neLat: ne.lat, neLng: ne.lng, swLat: sw.lat, swLng: sw.lng };
        } catch (_) {
          return null;
        }
      }

      function visibleMapRect() {
        const candidates = [
          document.querySelector('.gm-style'),
          document.querySelector('app-wf-base-map')
        ].filter(Boolean);
        let best = null;
        for (const element of candidates) {
          let rect = null;
          try { rect = element.getBoundingClientRect(); } catch (_) { rect = null; }
          if (!rect || rect.width < 120 || rect.height < 120) continue;
          if (!best || (rect.width * rect.height) > (best.rect.width * best.rect.height)) {
            best = { element, rect };
          }
        }
        return best;
      }

      function isWayfarerDetailSheetOpen() {
        const selectors = [
          'mat-bottom-sheet-container',
          '.mat-bottom-sheet-container',
          '.mat-mdc-dialog-container',
          '[role="dialog"]',
          '[aria-modal="true"]',
          '.cdk-overlay-pane'
        ];
        const seen = new Set();
        for (const selector of selectors) {
          let elements = [];
          try { elements = [...document.querySelectorAll(selector)]; } catch (_) { continue; }
          for (const element of elements) {
            if (!element || seen.has(element)) continue;
            seen.add(element);
            if (element.id === FALLBACK_ROOT_ID || element.closest?.(`#${FALLBACK_ROOT_ID}`)) continue;
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
            if (rect.width < innerWidth * 0.84 || rect.height < innerHeight * 0.24) continue;
            if (rect.bottom < innerHeight * 0.88) continue;
            if (rect.top > innerHeight * 0.78) continue;
            return true;
          }
        }
        return false;
      }

      function mercatorY(lat) {
        const limited = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
        const radians = limited * Math.PI / 180;
        return Math.log(Math.tan((Math.PI / 4) + (radians / 2)));
      }

      function projectFromBounds(bounds, rect, lat, lng) {
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

      function ensureFallbackRoot(rect) {
        let root = fallbackRoot || document.getElementById(FALLBACK_ROOT_ID);
        if (!root) {
          root = document.createElement('div');
          root.id = FALLBACK_ROOT_ID;
          root.setAttribute('aria-hidden', 'true');
          Object.assign(root.style, {
            position: 'fixed',
            pointerEvents: 'none',
            overflow: 'hidden',
            zIndex: '1200',
            isolation: 'isolate'
          });
          document.body.appendChild(root);
        }
        fallbackRoot = root;
        Object.assign(root.style, {
          left: `${rect.left}px`,
          top: `${rect.top}px`,
          width: `${rect.width}px`,
          height: `${rect.height}px`,
          display: touchActive || isWayfarerDetailSheetOpen() ? 'none' : ''
        });
        return root;
      }

      function removeFallbackRoot() {
        try { fallbackRoot?.remove?.(); } catch (_) {}
        fallbackRoot = null;
        lastFallbackKey = '';
      }

      function updateFallbackDiagnostics(root, firstMarker, firstPoint) {
        try {
          gameOverlayDiag.rootConnected = root?.isConnected === true;
          gameOverlayDiag.rootChildNodes = root?.childNodes?.length || 0;
          gameOverlayDiag.rootDisplay = root ? getComputedStyle(root).display : '';
          gameOverlayDiag.rootVisibility = root ? getComputedStyle(root).visibility : '';
          gameOverlayDiag.rootOpacity = root ? getComputedStyle(root).opacity : '';
          gameOverlayDiag.rootZIndex = root ? getComputedStyle(root).zIndex : '';
          if (firstMarker && firstPoint) {
            const rect = firstMarker.getBoundingClientRect();
            const style = getComputedStyle(firstMarker);
            gameOverlayDiag.first = {
              entity: firstMarker.dataset?.cbsGameEntity || '',
              x: Number(firstPoint.x),
              y: Number(firstPoint.y),
              left: Number(rect.left),
              top: Number(rect.top),
              width: Number(rect.width),
              height: Number(rect.height),
              display: style.display,
              visibility: style.visibility,
              opacity: style.opacity,
              zIndex: style.zIndex,
              inViewport: rect.right >= 0 && rect.bottom >= 0 && rect.left <= innerWidth && rect.top <= innerHeight,
              hit: 'iphone-dom-fallback',
              hitIsMarker: false
            };
          }
        } catch (_) {}
      }

      function renderDomFallback(force = false) {
        if (bridgeOverlayRoot || bridgeMap || isWfmmPresent()) {
          removeFallbackRoot();
          return 0;
        }

        const url = latestDomGcsUrl();
        const bounds = boundsFromGcsUrl(url);
        const mapInfo = visibleMapRect();
        if (!bounds || !mapInfo) {
          removeFallbackRoot();
          return 0;
        }

        const detailSheetOpen = isWayfarerDetailSheetOpen();
        if (fallbackRoot) fallbackRoot.style.display = touchActive || detailSheetOpen ? 'none' : '';
        if (detailSheetOpen) return 0;

        const rect = mapInfo.rect;
        const key = [
          url,
          poiByGuid.size,
          Math.round(rect.left),
          Math.round(rect.top),
          Math.round(rect.width),
          Math.round(rect.height),
          showInactivePowerSpots ? '1' : '0'
        ].join('|');
        if (!force && key === lastFallbackKey && fallbackRoot?.isConnected) return fallbackRoot.childNodes.length;

        const root = ensureFallbackRoot(rect);
        const fragment = document.createDocumentFragment();
        resetGameOverlayDiagnostics(false);
        let firstMarker = null;
        let firstPoint = null;

        for (const poi of poiByGuid.values()) {
          const point = projectFromBounds(bounds, rect, poi?.lat, poi?.lng);
          if (!point) {
            gameOverlayDiag.projectionInvalid += 1;
            continue;
          }
          gameOverlayDiag.projectionValid += 1;
          gameOverlayDiag.createCalls += 1;
          const marker = createGameEntityOverlay(poi, point);
          if (!marker) continue;
          fragment.appendChild(marker);
          gameOverlayDiag.created += 1;
          const entity = marker.dataset?.cbsGameEntity || '';
          if (entity === 'POKESTOP') gameOverlayDiag.pokestop += 1;
          else if (entity === 'GYM') gameOverlayDiag.gym += 1;
          else if (entity === 'POWERSPOT') gameOverlayDiag.powerspot += 1;
          if (!firstMarker) {
            firstMarker = marker;
            firstPoint = point;
          }
        }

        root.replaceChildren(fragment);
        lastFallbackKey = key;
        requestAnimationFrame(() => {
          updateFallbackDiagnostics(root, firstMarker, firstPoint);
          try { render(); } catch (_) {}
        });
        return gameOverlayDiag.created;
      }

      function scheduleDomFallback(force = false, delay = 80) {
        setTimeout(() => renderDomFallback(force), delay);
      }

      fallbackTimer = setInterval(() => {
        renderDomFallback(false);
      }, 900);

      window.addEventListener('resize', () => scheduleDomFallback(true, 60), { passive: true });
      window.addEventListener('scroll', () => scheduleDomFallback(true, 60), { passive: true });

      window.addEventListener('touchstart', event => {
        try {
          if (!event.target?.closest?.('.gm-style, app-wf-base-map')) return;
        } catch (_) { return; }
        touchActive = true;
        if (fallbackRoot) fallbackRoot.style.display = 'none';
        if (touchReleaseTimer) clearTimeout(touchReleaseTimer);
      }, { passive: true, capture: true });

      const releaseTouch = () => {
        if (touchReleaseTimer) clearTimeout(touchReleaseTimer);
        touchReleaseTimer = setTimeout(() => {
          touchReleaseTimer = null;
          touchActive = false;
          scheduleDomFallback(true, 220);
        }, 120);
      };
      window.addEventListener('touchend', releaseTouch, { passive: true, capture: true });
      window.addEventListener('touchcancel', releaseTouch, { passive: true, capture: true });

      setTimeout(() => renderDomFallback(true), 180);

      window.CampsiteBridgeIPhoneDomOverlay = Object.freeze({
        refresh: () => renderDomFallback(true),
        getState: () => ({
          active: Boolean(fallbackRoot?.isConnected),
          drawn: fallbackRoot?.childNodes?.length || 0,
          boundsFound: Boolean(boundsFromGcsUrl(latestDomGcsUrl())),
          mapRectFound: Boolean(visibleMapRect()),
          detailSheetOpen: isWayfarerDetailSheetOpen()
        })
      });

      window.addEventListener('pagehide', () => {
        if (fallbackTimer) clearInterval(fallbackTimer);
        fallbackTimer = null;
        if (touchReleaseTimer) clearTimeout(touchReleaseTimer);
        touchReleaseTimer = null;
        removeFallbackRoot();
      }, { once: true });

      return {};
    })(),
