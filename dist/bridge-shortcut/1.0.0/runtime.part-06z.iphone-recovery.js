    ...(() => {
      // iPhone/Safari recovery layer. This fragment is intentionally a spread
      // expression because runtime.part-06.js ends inside Object.assign(..., {
      // and runtime.part-07.js continues that object literal.
      const IPHONE_GCS_PATH = '/api/v1/vault/mapview/gcs';
      const IPHONE_COLOR_ROOT_ID = 'campsite-bridge-iphone-latest-colors';
      let visiblePoiRefreshTimer = null;
      let visiblePoiRefreshInFlight = false;
      let lastVisiblePoiBoundsKey = '';
      let performanceReplayTimer = null;
      let performanceReplayInFlight = false;
      let lastPerformanceGcsUrl = '';
      let latestRangeBounds = null;
      let latestRangeUrl = '';
      let latestRangePois = new Map();

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

      function numberFromMapValue(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      }

      function coordinateFromMapPoint(point, key) {
        if (!point) return null;
        try {
          const value = point[key];
          return numberFromMapValue(typeof value === 'function' ? value.call(point) : value);
        } catch (_) {
          return null;
        }
      }

      function currentMapBoundsSnapshot(map) {
        if (!looksLikeGoogleMap(map) || typeof map.getBounds !== 'function') return null;
        let bounds = null;
        try { bounds = map.getBounds(); } catch (_) { bounds = null; }
        if (!bounds) return null;

        const sw = bounds.getSouthWest?.();
        const ne = bounds.getNorthEast?.();
        const swLat = coordinateFromMapPoint(sw, 'lat');
        const swLng = coordinateFromMapPoint(sw, 'lng');
        const neLat = coordinateFromMapPoint(ne, 'lat');
        const neLng = coordinateFromMapPoint(ne, 'lng');
        if (![swLat, swLng, neLat, neLng].every(Number.isFinite)) return null;

        return { swLat, swLng, neLat, neLng };
      }

      function parsePair(value) {
        const match = String(value || '').trim().match(/^\(\s*([-+0-9.eE]+)\s*,\s*([-+0-9.eE]+)\s*\)$/);
        if (!match) return null;
        const lat = Number(match[1]);
        const lng = Number(match[2]);
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
      }

      function boundsFromGcsUrl(url) {
        try {
          const parsed = new URL(String(url || ''), location.href);
          const sw = parsePair(parsed.searchParams.get('sw'));
          const ne = parsePair(parsed.searchParams.get('ne'));
          if (!sw || !ne) return null;
          return { swLat: sw.lat, swLng: sw.lng, neLat: ne.lat, neLng: ne.lng };
        } catch (_) {
          return null;
        }
      }

      function collectLatestRangePois(root) {
        const byGuid = new Map();
        const stack = [root];
        const seen = new WeakSet();
        while (stack.length) {
          const node = stack.pop();
          if (!node || typeof node !== 'object') continue;
          if (!Array.isArray(node)) {
            if (seen.has(node)) continue;
            seen.add(node);
            let poi = null;
            try { poi = candidateFromGcsObject(node); } catch (_) { poi = null; }
            if (poi?.guid) byGuid.set(String(poi.guid), poi);
          }
          let values = [];
          try { values = Object.values(node); } catch (_) { values = []; }
          for (const value of values) {
            if (value && typeof value === 'object') stack.push(value);
          }
        }
        return byGuid;
      }

      function getWayfarerMapRect() {
        const candidates = [
          document.querySelector('.gm-style'),
          document.querySelector('app-wf-base-map'),
          document.querySelector('google-map')
        ].filter(Boolean);
        for (const element of candidates) {
          let rect = null;
          try { rect = element.getBoundingClientRect(); } catch (_) { rect = null; }
          if (!rect || rect.width < 100 || rect.height < 100) continue;
          return rect;
        }
        return null;
      }

      function mercatorX(lng) {
        return (Number(lng) + 180) / 360;
      }

      function mercatorY(lat) {
        const clamped = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
        const sin = Math.sin(clamped * Math.PI / 180);
        return 0.5 - (Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI));
      }

      function viewportPointForPoi(poi, bounds, rect) {
        if (!poi || !bounds || !rect) return null;
        let swX = mercatorX(bounds.swLng);
        let neX = mercatorX(bounds.neLng);
        let poiX = mercatorX(poi.lng);
        if (neX < swX) neX += 1;
        if (poiX < swX) poiX += 1;
        const northY = mercatorY(bounds.neLat);
        const southY = mercatorY(bounds.swLat);
        const poiY = mercatorY(poi.lat);
        const spanX = neX - swX;
        const spanY = southY - northY;
        if (!(spanX > 0) || !(spanY > 0)) return null;
        const rx = (poiX - swX) / spanX;
        const ry = (poiY - northY) / spanY;
        if (rx < -0.02 || rx > 1.02 || ry < -0.02 || ry > 1.02) return null;
        return {
          x: rect.left + (rx * rect.width),
          y: rect.top + (ry * rect.height)
        };
      }

      function ensureIphoneColorRoot() {
        let root = document.getElementById(IPHONE_COLOR_ROOT_ID);
        if (root) return root;
        root = document.createElement('div');
        root.id = IPHONE_COLOR_ROOT_ID;
        Object.assign(root.style, {
          position: 'fixed',
          left: '0',
          top: '0',
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: '2147483645'
        });
        document.documentElement.appendChild(root);
        return root;
      }

      function makeIphoneColorMarker(poi, point) {
        const entity = normalizeEntity(poi?.gameEntity);
        const style = entity === 'POKESTOP'
          ? { fill: '#22b8f0', border: '#1748b8' }
          : entity === 'GYM'
            ? { fill: '#f04463', border: '#b91c3c' }
            : entity === 'POWERSPOT'
              ? { fill: POWERSPOT_FILL, border: POWERSPOT_BORDER }
              : null;
        if (!style || !point) return null;
        const marker = document.createElement('div');
        marker.dataset.cbsIphoneLatestEntity = entity;
        Object.assign(marker.style, {
          position: 'fixed',
          left: `${point.x}px`,
          top: `${point.y}px`,
          transform: 'translate(-50%,-50%) translateZ(0)',
          width: '22px',
          height: '22px',
          borderRadius: '50%',
          boxSizing: 'border-box',
          background: style.fill,
          border: `3px solid ${style.border}`,
          boxShadow: '0 0 0 1px rgba(255,255,255,.94),0 2px 5px rgba(0,0,0,.36)',
          pointerEvents: 'none'
        });
        marker.setAttribute('aria-hidden', 'true');
        return marker;
      }

      function renderLatestRangeFallback() {
        const root = ensureIphoneColorRoot();
        if (isWfmmPresent() || bridgeMap || !latestRangeBounds || !latestRangePois.size) {
          root.style.display = 'none';
          root.replaceChildren();
          return;
        }
        const rect = getWayfarerMapRect();
        if (!rect) {
          root.style.display = 'none';
          root.replaceChildren();
          return;
        }
        root.style.display = '';
        const fragment = document.createDocumentFragment();
        for (const poi of latestRangePois.values()) {
          if (normalizeStatus(poi?.gameStatus) === 'INACTIVE') continue;
          const point = viewportPointForPoi(poi, latestRangeBounds, rect);
          const marker = makeIphoneColorMarker(poi, point);
          if (marker) fragment.appendChild(marker);
        }
        root.replaceChildren(fragment);
      }

      function setLatestRange(url, payload) {
        const bounds = boundsFromGcsUrl(url);
        if (!bounds) return false;
        latestRangeBounds = bounds;
        latestRangeUrl = String(url || '');
        latestRangePois = collectLatestRangePois(payload);
        renderLatestRangeFallback();
        return true;
      }

      async function refreshVisibleWayfarerPois(force = false) {
        if (visiblePoiRefreshInFlight || !nativeFetch) return false;
        const snapshot = currentMapBoundsSnapshot(bridgeMap);
        if (!snapshot) return false;

        const boundsKey = [
          snapshot.swLat.toFixed(6),
          snapshot.swLng.toFixed(6),
          snapshot.neLat.toFixed(6),
          snapshot.neLng.toFixed(6)
        ].join(':');
        if (!force && boundsKey === lastVisiblePoiBoundsKey) return false;

        visiblePoiRefreshInFlight = true;
        try {
          const query =
            'ne=(' + snapshot.neLat + ',' + snapshot.neLng + ')' +
            '&sw=(' + snapshot.swLat + ',' + snapshot.swLng + ')' +
            '&cellLevel=14';
          const url = IPHONE_GCS_PATH + '?' + query;
          const response = await nativeFetch(url, {
            credentials: 'include',
            cache: 'no-store'
          });
          if (!response.ok) throw new Error('GCS HTTP ' + response.status);
          const payload = await response.json();
          stats.gcs += 1;
          scanJson(payload);
          setLatestRange(url, payload);
          lastVisiblePoiBoundsKey = boundsKey;
          scheduleRender();
          return true;
        } catch (error) {
          stats.parseErrors += 1;
          console.warn('[Campsite Bridge Shortcut] visible POI refresh failed', error);
          scheduleRender();
          return false;
        } finally {
          visiblePoiRefreshInFlight = false;
        }
      }

      function scheduleVisiblePoiRefresh(force = false, delay = 100) {
        if (visiblePoiRefreshTimer) clearTimeout(visiblePoiRefreshTimer);
        visiblePoiRefreshTimer = setTimeout(() => {
          visiblePoiRefreshTimer = null;
          void refreshVisibleWayfarerPois(force);
        }, delay);
      }

      function latestPerformanceGcsUrl() {
        try {
          const entries = performance?.getEntriesByType?.('resource') || [];
          for (let index = entries.length - 1; index >= 0; index -= 1) {
            const name = String(entries[index]?.name || '');
            if (name.includes(IPHONE_GCS_PATH)) return name;
          }
        } catch (_) {}
        return '';
      }

      async function replayLatestPerformanceGcs(force = false) {
        if (performanceReplayInFlight || !nativeFetch) return false;
        const url = latestPerformanceGcsUrl();
        if (!url) return false;
        if (!force && url === lastPerformanceGcsUrl) return false;

        performanceReplayInFlight = true;
        try {
          const response = await nativeFetch(url, {
            credentials: 'include',
            cache: 'no-store'
          });
          if (!response.ok) throw new Error('GCS replay HTTP ' + response.status);
          const payload = await response.json();
          stats.gcs += 1;
          scanJson(payload);
          setLatestRange(url, payload);
          lastPerformanceGcsUrl = url;
          scheduleRender();
          return true;
        } catch (error) {
          stats.parseErrors += 1;
          console.warn('[Campsite Bridge Shortcut] performance GCS replay failed', error);
          scheduleRender();
          return false;
        } finally {
          performanceReplayInFlight = false;
        }
      }

      const baseCaptureBridgeMap = captureBridgeMap;
      captureBridgeMap = function(map) {
        const captured = baseCaptureBridgeMap(map);
        if (captured) scheduleVisiblePoiRefresh(false, bridgeMap === map ? 100 : 40);
        renderLatestRangeFallback();
        return captured;
      };

      const baseDiscoverExistingGoogleMap = discoverExistingGoogleMap;
      discoverExistingGoogleMap = function() {
        try {
          const wfmmMap = window.WFMM?.map?.get?.();
          if (captureBridgeMap(wfmmMap)) return bridgeMap;
        } catch (_) {}

        if (captureBridgeMap(window.__campsiteBridgeGoogleMap)) return bridgeMap;

        const angularMap = findMapFromAngular();
        if (captureBridgeMap(angularMap)) return bridgeMap;

        const fallback = baseDiscoverExistingGoogleMap();
        if (fallback) scheduleVisiblePoiRefresh(false, 100);
        return fallback;
      };

      if (typeof window.fetch === 'function' && !window.fetch.__campsiteBridgeShortcutFetchPatched) {
        const originalFetch = window.fetch.bind(window);
        const wrappedFetch = async function(input, init) {
          const response = await originalFetch(input, init);
          const url = typeof input === 'string'
            ? input
            : String(input?.url || response?.url || '');
          if (url.includes(IPHONE_GCS_PATH)) {
            stats.gcs += 1;
            try {
              const clone = response.clone();
              clone.json()
                .then(json => {
                  scanJson(json);
                  setLatestRange(url, json);
                })
                .catch(() => { stats.parseErrors += 1; scheduleRender(); });
            } catch (_) {
              stats.parseErrors += 1;
            }
          }
          return response;
        };
        try {
          Object.defineProperty(wrappedFetch, '__campsiteBridgeShortcutFetchPatched', { value: true });
        } catch (_) {}
        window.fetch = wrappedFetch;
      }

      const baseRenderForIphoneRecovery = render;
      render = function() {
        baseRenderForIphoneRecovery();
        const counts = getCounts();
        const ready = document.getElementById('cbs-ready');
        if (ready) {
          ready.textContent = counts.total > 0
            ? `● 自動記録中：${counts.total.toLocaleString('ja-JP')}件記録済み`
            : '● 自動記録中：地図を動かすと記録します';
          ready.style.color = '#bbf7d0';
        }
        const diag = document.getElementById('cbs-diagnostics');
        if (diag && diag.style.display !== 'none') {
          const markerCount = document.querySelectorAll(`#${IPHONE_COLOR_ROOT_ID} [data-cbs-iphone-latest-entity]`).length;
          diag.insertAdjacentHTML('beforeend',
            `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12);font-weight:800">iPhone latest-range</div>` +
            `<div>Latest POI ${latestRangePois.size} / painted ${markerCount}</div>` +
            `<div>GCS bounds ${latestRangeBounds ? 'ready' : 'waiting'} / performance URL ${latestPerformanceGcsUrl() ? 'yes' : 'no'}</div>`
          );
        }
        renderLatestRangeFallback();
      };

      const baseResetForIphoneRecovery = reset;
      reset = function() {
        baseResetForIphoneRecovery();
        latestRangeBounds = null;
        latestRangeUrl = '';
        latestRangePois.clear();
        lastPerformanceGcsUrl = '';
        const root = document.getElementById(IPHONE_COLOR_ROOT_ID);
        root?.replaceChildren?.();
        if (root) root.style.display = 'none';
      };

      setTimeout(() => {
        try { discoverExistingGoogleMap(); } catch (_) {}
        scheduleVisiblePoiRefresh(true, 160);
        void replayLatestPerformanceGcs(true);
      }, 0);

      performanceReplayTimer = setInterval(() => {
        void replayLatestPerformanceGcs(false);
      }, 1200);

      window.addEventListener('resize', renderLatestRangeFallback, { passive: true });

      window.CampsiteBridgeIPhoneRecovery = Object.freeze({
        replayLatestPerformanceGcs: () => replayLatestPerformanceGcs(true),
        repaintLatestRange: renderLatestRangeFallback,
        getState: () => ({
          performanceUrlFound: Boolean(latestPerformanceGcsUrl()),
          lastPerformanceGcsUrl,
          latestRangeUrl,
          latestRangeCount: latestRangePois.size,
          latestRangeBounds: latestRangeBounds ? { ...latestRangeBounds } : null,
          mapCaptured: Boolean(bridgeMap),
          poiCount: poiByGuid.size
        })
      });

      window.addEventListener('pagehide', () => {
        if (visiblePoiRefreshTimer) clearTimeout(visiblePoiRefreshTimer);
        visiblePoiRefreshTimer = null;
        if (performanceReplayTimer) clearInterval(performanceReplayTimer);
        performanceReplayTimer = null;
        window.removeEventListener('resize', renderLatestRangeFallback);
        document.getElementById(IPHONE_COLOR_ROOT_ID)?.remove?.();
      }, { once: true });

      return {};
    })(),
