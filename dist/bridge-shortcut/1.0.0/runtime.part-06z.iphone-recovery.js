    ...(() => {
      // iPhone/Safari recovery layer, data-only edition.
      // Keep GCS acquisition/recovery while retiring Bridge-owned map visuals.
      const IPHONE_GCS_PATH = '/api/v1/vault/mapview/gcs';
      let visiblePoiRefreshTimer = null;
      let visiblePoiRefreshInFlight = false;
      let lastVisiblePoiBoundsKey = '';
      let performanceReplayInFlight = false;
      let lastPerformanceGcsUrl = '';
      let latestRangeBounds = null;
      let latestRangeUrl = '';
      let latestRangePois = new Map();
      const mapIdleListeners = new Map();

      function findMapFromAngular() {
        try {
          const adapterMap = window.CampsiteBridgeWayfarerMapAdapter?.findMap?.();
          if (looksLikeGoogleMap(adapterMap)) return adapterMap;
        } catch (_) {}

        const host = document.querySelector('app-wf-base-map');
        const context = host?.__ngContext__;
        if (!context || typeof context.length !== 'number') return null;

        const limit = Math.min(context.length, 128);
        for (let index = 0; index < limit; index += 1) {
          const component = context[index];
          if (!component || (typeof component !== 'object' && typeof component !== 'function')) continue;
          if (typeof component.getMap !== 'function' || typeof component.setCustomLayers !== 'function') continue;
          try {
            const map = component.getMap();
            if (looksLikeGoogleMap(map)) return map;
          } catch (_) {}
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

      function setLatestRange(url, payload) {
        const bounds = boundsFromGcsUrl(url);
        if (!bounds) return false;
        latestRangeBounds = bounds;
        latestRangeUrl = String(url || '');
        latestRangePois = collectLatestRangePois(payload);
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
          const response = await nativeFetch(url, { credentials: 'include', cache: 'no-store' });
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
          const response = await nativeFetch(url, { credentials: 'include', cache: 'no-store' });
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

      function attachMapIdleRefresh(map) {
        if (!map || mapIdleListeners.has(map) || typeof map.addListener !== 'function') return;
        try {
          const listener = map.addListener('idle', () => scheduleVisiblePoiRefresh(false, 120));
          mapIdleListeners.set(map, listener || null);
        } catch (_) {}
      }

      const baseCaptureBridgeMap = captureBridgeMap;
      captureBridgeMap = function(map) {
        const captured = baseCaptureBridgeMap(map);
        if (captured) {
          attachMapIdleRefresh(map);
          scheduleVisiblePoiRefresh(false, bridgeMap === map ? 100 : 40);
        }
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
          const url = typeof input === 'string' ? input : String(input?.url || response?.url || '');
          if (url.includes(IPHONE_GCS_PATH)) {
            stats.gcs += 1;
            try {
              const clone = response.clone();
              clone.json()
                .then(json => {
                  scanJson(json);
                  setLatestRange(url, json);
                  scheduleRender();
                })
                .catch(() => { stats.parseErrors += 1; scheduleRender(); });
            } catch (_) {
              stats.parseErrors += 1;
            }
          }
          return response;
        };
        try { Object.defineProperty(wrappedFetch, '__campsiteBridgeShortcutFetchPatched', { value: true }); } catch (_) {}
        window.fetch = wrappedFetch;
      }

      // Retire every Bridge-owned map visual path while leaving data functions active.
      function clearBridgeMapVisuals() {
        try {
          if (bridgeOverlayRoot) {
            bridgeOverlayRoot.replaceChildren?.();
            bridgeOverlayRoot.style.display = 'none';
            bridgeOverlayRoot.style.visibility = 'hidden';
            bridgeOverlayRoot.style.pointerEvents = 'none';
          }
        } catch (_) {}
        return false;
      }
      try { createGameEntityOverlay = () => null; } catch (_) {}
      try { createSponsorRingOverlay = () => null; } catch (_) {}
      try { createSponsorPopupOverlay = () => null; } catch (_) {}
      try { renderBridgeOverlaysNow = clearBridgeMapVisuals; } catch (_) {}
      try { scheduleOverlayRender = clearBridgeMapVisuals; } catch (_) {}
      try { scheduleOverlayRenderAfterIdle = clearBridgeMapVisuals; } catch (_) {}
      try {
        if (bridgeOverlayFrame) cancelAnimationFrame(bridgeOverlayFrame);
        bridgeOverlayFrame = 0;
      } catch (_) {}
      try {
        if (sponsorRingStabilizeTimer) clearTimeout(sponsorRingStabilizeTimer);
        sponsorRingStabilizeTimer = null;
      } catch (_) {}

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
        const inactiveToggle = document.getElementById('cbs-inactive-toggle');
        if (inactiveToggle) inactiveToggle.style.display = 'none';
        const displayNote = document.getElementById('cbs-display-note');
        if (displayNote) displayNote.style.display = 'none';
        const diag = document.getElementById('cbs-diagnostics');
        if (diag && diag.style.display !== 'none') {
          diag.insertAdjacentHTML('beforeend',
            `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12);font-weight:800">iPhone data recovery</div>` +
            `<div>Latest POI ${latestRangePois.size} / visual overlay retired</div>` +
            `<div>GCS bounds ${latestRangeBounds ? 'ready' : 'waiting'} / performance URL ${latestPerformanceGcsUrl() ? 'yes' : 'no'}</div>`
          );
        }
        clearBridgeMapVisuals();
      };

      const baseResetForIphoneRecovery = reset;
      reset = function() {
        baseResetForIphoneRecovery();
        latestRangeBounds = null;
        latestRangeUrl = '';
        latestRangePois.clear();
        lastPerformanceGcsUrl = '';
        lastVisiblePoiBoundsKey = '';
        clearBridgeMapVisuals();
      };

      function resumeRecovery() {
        try { discoverExistingGoogleMap(); } catch (_) {}
        scheduleVisiblePoiRefresh(true, 160);
        void replayLatestPerformanceGcs(true);
      }

      setTimeout(resumeRecovery, 0);
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') resumeRecovery();
      };
      const onPageShow = () => resumeRecovery();
      document.addEventListener('visibilitychange', onVisibilityChange, { passive: true });
      window.addEventListener('pageshow', onPageShow, { passive: true });

      window.CampsiteBridgeIPhoneRecovery = Object.freeze({
        replayLatestPerformanceGcs: () => replayLatestPerformanceGcs(true),
        repaintLatestRange: () => false,
        getState: () => ({
          performanceUrlFound: Boolean(latestPerformanceGcsUrl()),
          lastPerformanceGcsUrl,
          latestRangeUrl,
          latestRangeCount: latestRangePois.size,
          latestRangeBounds: latestRangeBounds ? { ...latestRangeBounds } : null,
          mapCaptured: Boolean(bridgeMap),
          poiCount: poiByGuid.size,
          visualFallback: false,
          continuousPolling: false
        })
      });

      window.CampsiteBridgeIPhoneVisualPolicy = Object.freeze({
        bridgeOwnedMapVisuals: false,
        gameEntityOverlay: false,
        sponsorRingOverlay: false,
        manualViewportProjection: false,
        wayfarerDisplayUntouched: true,
        wfmmDisplayUntouched: true
      });

      window.addEventListener('pagehide', () => {
        if (visiblePoiRefreshTimer) clearTimeout(visiblePoiRefreshTimer);
        visiblePoiRefreshTimer = null;
        for (const listener of mapIdleListeners.values()) {
          try { listener?.remove?.(); } catch (_) {}
        }
        mapIdleListeners.clear();
        document.removeEventListener('visibilitychange', onVisibilityChange);
        window.removeEventListener('pageshow', onPageShow);
        clearBridgeMapVisuals();
      }, { once: true });

      return {};
    })(),