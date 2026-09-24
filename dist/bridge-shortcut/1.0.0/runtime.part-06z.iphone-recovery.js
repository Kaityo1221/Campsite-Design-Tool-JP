
  // iPhone/Safari recovery layer.
  // Keep this fragment before runtime.part-07.js so these later declarations
  // replace the older passive-only implementations without changing the
  // stable runtime parts.
  const IPHONE_GCS_PATH = '/api/v1/vault/mapview/gcs';
  let visiblePoiRefreshTimer = null;
  let visiblePoiRefreshInFlight = false;
  let lastVisiblePoiBoundsKey = '';

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
      stats.xhr += 1;
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

  function captureBridgeMap(map) {
    if (!looksLikeGoogleMap(map)) return false;
    const changed = bridgeMap !== map;
    if (changed) {
      bridgeMap = map;
      window.__campsiteBridgeGoogleMap = map;
      detachBridgeOverlay();
      setTimeout(ensureBridgeOverlay, 0);
    }
    scheduleVisiblePoiRefresh(false, changed ? 40 : 120);
    return true;
  }

  function discoverExistingGoogleMap() {
    try {
      const wfmmMap = window.WFMM?.map?.get?.();
      if (captureBridgeMap(wfmmMap)) return bridgeMap;
    } catch (_) {}

    if (captureBridgeMap(window.__campsiteBridgeGoogleMap)) return bridgeMap;

    const angularMap = findMapFromAngular();
    if (captureBridgeMap(angularMap)) return bridgeMap;

    const gm = document.querySelector('.gm-style');
    let node = gm;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      const found = inspectObjectForMap(node, 2, 220);
      if (captureBridgeMap(found)) return bridgeMap;
    }
    return null;
  }

  function installXhrCapture() {
    const XHR = window.XMLHttpRequest;
    if (XHR?.prototype && typeof nativeXhrSend === 'function' && !XHR.prototype.__campsiteBridgeShortcutPatched) {
      XHR.prototype.__campsiteBridgeShortcutPatched = true;
      XHR.prototype.send = function(...args) {
        this.addEventListener('load', () => {
          stats.xhr += 1;
          const url = String(this.responseURL || '');
          if (url.includes(IPHONE_GCS_PATH)) stats.gcs += 1;
          try {
            if (this.responseType === 'json' && this.response) {
              scanJson(this.response);
            } else if (!this.responseType || this.responseType === 'text') {
              const text = String(this.responseText || '');
              if (!text || (!text.includes('HOLOHOLO') && !text.includes('isMegaEnhancedEligible') && !text.includes('PGO_GYM'))) return;
              scanJson(JSON.parse(text));
            }
          } catch (_) {
            stats.parseErrors += 1;
          }
        }, { once: true });
        return nativeXhrSend.apply(this, args);
      };
    }

    if (typeof window.fetch === 'function' && !window.fetch.__campsiteBridgeShortcutPatched) {
      const originalFetch = window.fetch.bind(window);
      const wrappedFetch = async function(input, init) {
        const response = await originalFetch(input, init);
        const url = typeof input === 'string'
          ? input
          : String(input?.url || response?.url || '');
        if (url.includes(IPHONE_GCS_PATH)) {
          stats.xhr += 1;
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
        Object.defineProperty(wrappedFetch, '__campsiteBridgeShortcutPatched', { value: true });
      } catch (_) {}
      window.fetch = wrappedFetch;
    }
  }
