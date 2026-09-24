    ...(() => {
      // iPhone/Safari recovery layer. This fragment is intentionally a spread
      // expression because runtime.part-06.js ends inside Object.assign(..., {
      // and runtime.part-07.js continues that object literal.
      const IPHONE_GCS_PATH = '/api/v1/vault/mapview/gcs';
      let visiblePoiRefreshTimer = null;
      let visiblePoiRefreshInFlight = false;
      let lastVisiblePoiBoundsKey = '';
      let performanceReplayTimer = null;
      let performanceReplayInFlight = false;
      let lastPerformanceGcsUrl = '';

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
          const response = await nativeFetch(IPHONE_GCS_PATH + '?' + query, {
            credentials: 'include',
            cache: 'no-store'
          });
          if (!response.ok) throw new Error('GCS HTTP ' + response.status);
          const payload = await response.json();
          stats.gcs += 1;
          scanJson(payload);
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
                .then(json => scanJson(json))
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

      setTimeout(() => {
        try { discoverExistingGoogleMap(); } catch (_) {}
        scheduleVisiblePoiRefresh(true, 160);
        void replayLatestPerformanceGcs(true);
      }, 0);

      performanceReplayTimer = setInterval(() => {
        void replayLatestPerformanceGcs(false);
      }, 1200);

      window.CampsiteBridgeIPhoneRecovery = Object.freeze({
        replayLatestPerformanceGcs: () => replayLatestPerformanceGcs(true),
        getState: () => ({
          performanceUrlFound: Boolean(latestPerformanceGcsUrl()),
          lastPerformanceGcsUrl,
          mapCaptured: Boolean(bridgeMap),
          poiCount: poiByGuid.size
        })
      });

      window.addEventListener('pagehide', () => {
        if (visiblePoiRefreshTimer) clearTimeout(visiblePoiRefreshTimer);
        visiblePoiRefreshTimer = null;
        if (performanceReplayTimer) clearInterval(performanceReplayTimer);
        performanceReplayTimer = null;
      }, { once: true });

      return {};
    })(),
