;(() => {
  // iPhone/Safari native Google Maps POI renderer.
  // Keep POIs geographically anchored by Google Maps, but stay out of the
  // critical path while Wayfarer is loading/reloading the map.
  const ua = String(navigator?.userAgent || '');
  if (!/iPhone|iPad|iPod/i.test(ua)) return;

  const STYLE_ID = 'campsite-bridge-iphone-native-marker-authority-style';
  const ACTIVE_CLASS = 'cbs-iphone-native-marker-active';
  const ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const markers = new Map();
  let map = null;
  let discoveryTimer = null;
  let syncTimer = null;
  let listeners = [];
  let moving = false;
  let active = false;
  let lastVisible = 0;

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
    if (looksLikeMap(candidate) && candidate !== map) attachMap(candidate);
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
      html.${ACTIVE_CLASS} #campsite-bridge-iphone-pane-locked-poi,
      html.${ACTIVE_CLASS} #campsite-bridge-poi-colors {
        display: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  function setActive(next) {
    const value = Boolean(next);
    if (active === value) return;
    active = value;
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

  function displayState() {
    try { return window.CampsiteBridgeShortcut?.getDisplayState?.() || {}; }
    catch (_) { return {}; }
  }

  function currentPois() {
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
      const status = String(p?.gameStatus || p?.status || 'UNKNOWN').toUpperCase();
      const guid = String(p?.guid || p?.poiId || p?.id || `${entity}:${lat.toFixed(6)},${lng.toFixed(6)}`);
      out.push({ guid, entity, status, lat, lng });
    }
    return out;
  }

  function symbolFor(poi) {
    const g = window.google?.maps;
    if (!g) return null;
    const inactivePower = poi.entity === 'POWERSPOT' && poi.status === 'INACTIVE';
    if (poi.entity === 'POKESTOP') {
      return {
        path: g.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#22b8f0',
        fillOpacity: 1,
        strokeColor: '#1748b8',
        strokeOpacity: 1,
        strokeWeight: 3
      };
    }
    if (poi.entity === 'GYM') {
      return {
        path: 'M 0,-12 12,12 -12,12 z',
        scale: 1,
        fillColor: '#f04463',
        fillOpacity: 1,
        strokeColor: '#b91c3c',
        strokeOpacity: 1,
        strokeWeight: 3
      };
    }
    if (poi.entity === 'POWERSPOT') {
      return {
        path: 'M 0,-12 12,0 0,12 -12,0 z',
        scale: 1,
        fillColor: inactivePower ? '#a3a3a3' : '#c026d3',
        fillOpacity: inactivePower ? 0.48 : 1,
        strokeColor: inactivePower ? '#737373' : '#7e22ce',
        strokeOpacity: inactivePower ? 0.62 : 1,
        strokeWeight: 3
      };
    }
    return null;
  }

  function shouldShow(poi, showInactivePowerSpots) {
    const inactivePower = poi.entity === 'POWERSPOT' && poi.status === 'INACTIVE';
    if (poi.status === 'INACTIVE' && !inactivePower) return false;
    if (inactivePower && showInactivePowerSpots === false) return false;
    return true;
  }

  function clearMarkers() {
    for (const entry of markers.values()) {
      try { entry.marker?.setMap?.(null); } catch (_) {}
    }
    markers.clear();
    lastVisible = 0;
  }

  function markerCtor() {
    return window.google?.maps?.Marker || null;
  }

  function numericBounds() {
    try {
      const bounds = map?.getBounds?.();
      const ne = bounds?.getNorthEast?.();
      const sw = bounds?.getSouthWest?.();
      if (!ne || !sw) return null;
      const north = Number(ne.lat?.());
      const east = Number(ne.lng?.());
      const south = Number(sw.lat?.());
      const west = Number(sw.lng?.());
      if (![north, east, south, west].every(Number.isFinite)) return null;
      return { north, east, south, west };
    } catch (_) {
      return null;
    }
  }

  function insideBounds(poi, bounds) {
    if (!bounds) return true;
    if (poi.lat < bounds.south || poi.lat > bounds.north) return false;
    if (bounds.west <= bounds.east) return poi.lng >= bounds.west && poi.lng <= bounds.east;
    return poi.lng >= bounds.west || poi.lng <= bounds.east;
  }

  function syncMarkersNow() {
    syncTimer = null;
    if (!map || moving || document.hidden) return;

    const Marker = markerCtor();
    if (!Marker) {
      setActive(false);
      return;
    }

    const api = window.CampsiteBridgeShortcut;
    if (api?.isWfmmPresent?.()) {
      clearMarkers();
      setActive(false);
      return;
    }

    const bounds = numericBounds();
    if (!bounds) return;

    const showInactivePowerSpots = displayState().showInactivePowerSpots !== false;
    const wanted = new Map();
    for (const poi of currentPois()) {
      if (!shouldShow(poi, showInactivePowerSpots)) continue;
      if (!insideBounds(poi, bounds)) continue;
      wanted.set(poi.guid, poi);
    }

    for (const [guid, entry] of markers) {
      if (wanted.has(guid)) continue;
      try { entry.marker?.setMap?.(null); } catch (_) {}
      markers.delete(guid);
    }

    for (const [guid, poi] of wanted) {
      const icon = symbolFor(poi);
      if (!icon) continue;

      const existing = markers.get(guid);
      if (!existing) {
        try {
          const marker = new Marker({
            map,
            position: { lat: poi.lat, lng: poi.lng },
            icon,
            clickable: false,
            draggable: false,
            optimized: true,
            zIndex: poi.entity === 'GYM' ? 30 : poi.entity === 'POWERSPOT' ? 20 : 10
          });
          markers.set(guid, {
            marker,
            lat: poi.lat,
            lng: poi.lng,
            entity: poi.entity,
            status: poi.status
          });
        } catch (_) {}
        continue;
      }

      const positionChanged = existing.lat !== poi.lat || existing.lng !== poi.lng;
      const styleChanged = existing.entity !== poi.entity || existing.status !== poi.status;
      try {
        if (positionChanged) existing.marker?.setPosition?.({ lat: poi.lat, lng: poi.lng });
        if (styleChanged) existing.marker?.setIcon?.(icon);
        if (existing.marker?.getMap?.() !== map) existing.marker?.setMap?.(map);
      } catch (_) {}
      existing.lat = poi.lat;
      existing.lng = poi.lng;
      existing.entity = poi.entity;
      existing.status = poi.status;
    }

    lastVisible = markers.size;
    setActive(true);
  }

  function scheduleSync(delay = 90) {
    if (!map || moving) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(syncMarkersNow, Math.max(0, delay));
  }

  function clearListeners() {
    for (const listener of listeners) {
      try { listener?.remove?.(); } catch (_) {}
    }
    listeners = [];
  }

  function attachMap(nextMap) {
    clearListeners();
    clearMarkers();
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
    map = nextMap;
    moving = true;
    if (!window.__campsiteBridgeGoogleMap) window.__campsiteBridgeGoogleMap = nextMap;

    try {
      listeners.push(nextMap.addListener('dragstart', () => {
        moving = true;
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = null;
      }));
      listeners.push(nextMap.addListener('dragend', () => {}));
      listeners.push(nextMap.addListener('zoom_changed', () => {
        moving = true;
        if (syncTimer) clearTimeout(syncTimer);
        syncTimer = null;
      }));
      listeners.push(nextMap.addListener('idle', () => {
        moving = false;
        // Give Wayfarer/Google Maps the first paint. Bridge follows just after it.
        scheduleSync(80);
      }));
    } catch (_) {}

    // Fallback for cases where the map was already idle before listeners attached.
    setTimeout(() => {
      if (map !== nextMap) return;
      moving = false;
      scheduleSync(120);
    }, 700);
  }

  function refresh() {
    const found = discoverMap();
    if (found && !moving) scheduleSync(0);
  }

  ensureAuthorityStyle();

  // Keep discovery cheap. Once the map is found, Google Maps events drive POI sync.
  discoveryTimer = setInterval(() => {
    const previous = map;
    discoverMap();
    if (!previous && map) return;
  }, 2000);

  for (const delay of [250, 700, 1400]) {
    setTimeout(() => { if (!map) discoverMap(); }, delay);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    discoverMap();
    if (map && !moving) scheduleSync(140);
  });

  window.addEventListener('pageshow', () => {
    discoverMap();
    if (map && !moving) scheduleSync(140);
  });

  window.CampsiteBridgeIPhoneNativeMarkers = Object.freeze({
    refresh,
    isActive: () => Boolean(active && map && markerCtor()),
    getState: () => ({ active, moving, visible: lastVisible, mapFound: Boolean(map), markerApi: Boolean(markerCtor()) })
  });

  window.addEventListener('pagehide', () => {
    if (discoveryTimer) clearInterval(discoveryTimer);
    discoveryTimer = null;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = null;
    clearListeners();
    clearMarkers();
    map = null;
    setActive(false);
    try { document.getElementById(STYLE_ID)?.remove?.(); } catch (_) {}
  }, { once: true });
})();
