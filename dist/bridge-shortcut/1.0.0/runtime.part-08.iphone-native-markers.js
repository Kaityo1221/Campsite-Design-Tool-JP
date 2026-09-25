;(() => {
  // iPhone/Safari native Google Maps POI renderer.
  // Use Google Maps Marker objects so POIs are geographically anchored by
  // the map engine itself. No screen-coordinate memory, no pan reprojection.
  const ua = String(navigator?.userAgent || '');
  if (!/iPhone|iPad|iPod/i.test(ua)) return;

  const STYLE_ID = 'campsite-bridge-iphone-native-marker-authority-style';
  const ACTIVE_CLASS = 'cbs-iphone-native-marker-active';
  const ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const markers = new Map();
  let map = null;
  let timer = null;
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

  function shouldShow(poi) {
    const inactivePower = poi.entity === 'POWERSPOT' && poi.status === 'INACTIVE';
    if (poi.status === 'INACTIVE' && !inactivePower) return false;
    if (inactivePower && displayState().showInactivePowerSpots === false) return false;
    return true;
  }

  function clearMarkers() {
    for (const marker of markers.values()) {
      try { marker.setMap?.(null); } catch (_) {}
    }
    markers.clear();
    lastVisible = 0;
  }

  function markerCtor() {
    return window.google?.maps?.Marker || null;
  }

  function syncMarkers() {
    if (!map || moving) return;
    const Marker = markerCtor();
    const LatLng = window.google?.maps?.LatLng;
    if (!Marker || !LatLng) {
      setActive(false);
      return;
    }
    const api = window.CampsiteBridgeShortcut;
    if (api?.isWfmmPresent?.()) {
      clearMarkers();
      setActive(false);
      return;
    }

    let bounds = null;
    try { bounds = map.getBounds?.() || null; } catch (_) {}
    const wanted = new Map();
    for (const poi of currentPois()) {
      if (!shouldShow(poi)) continue;
      if (bounds?.contains) {
        try { if (!bounds.contains(new LatLng(poi.lat, poi.lng))) continue; } catch (_) {}
      }
      wanted.set(poi.guid, poi);
    }

    for (const [guid, marker] of markers) {
      if (wanted.has(guid)) continue;
      try { marker.setMap?.(null); } catch (_) {}
      markers.delete(guid);
    }

    for (const [guid, poi] of wanted) {
      const icon = symbolFor(poi);
      if (!icon) continue;
      let marker = markers.get(guid);
      if (!marker) {
        try {
          marker = new Marker({
            map,
            position: { lat: poi.lat, lng: poi.lng },
            icon,
            clickable: false,
            draggable: false,
            optimized: true,
            zIndex: poi.entity === 'GYM' ? 30 : poi.entity === 'POWERSPOT' ? 20 : 10
          });
          markers.set(guid, marker);
        } catch (_) {
          continue;
        }
      } else {
        try {
          marker.setPosition?.({ lat: poi.lat, lng: poi.lng });
          marker.setIcon?.(icon);
          marker.setMap?.(map);
        } catch (_) {}
      }
    }
    lastVisible = markers.size;
    setActive(true);
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
    map = nextMap;
    if (!window.__campsiteBridgeGoogleMap) window.__campsiteBridgeGoogleMap = nextMap;
    try {
      listeners.push(nextMap.addListener('dragstart', () => { moving = true; }));
      listeners.push(nextMap.addListener('dragend', () => {}));
      listeners.push(nextMap.addListener('zoom_changed', () => { moving = true; }));
      listeners.push(nextMap.addListener('idle', () => {
        moving = false;
        syncMarkers();
      }));
    } catch (_) {}
    syncMarkers();
  }

  function refresh() {
    discoverMap();
    if (!moving) syncMarkers();
  }

  ensureAuthorityStyle();
  timer = setInterval(refresh, 550);
  for (const delay of [0, 100, 300, 800, 1600]) setTimeout(refresh, delay);

  window.CampsiteBridgeIPhoneNativeMarkers = Object.freeze({
    refresh,
    isActive: () => Boolean(active && map && markerCtor()),
    getState: () => ({ active, moving, visible: lastVisible, mapFound: Boolean(map), markerApi: Boolean(markerCtor()) })
  });

  window.addEventListener('pagehide', () => {
    if (timer) clearInterval(timer);
    timer = null;
    clearListeners();
    clearMarkers();
    map = null;
    setActive(false);
    try { document.getElementById(STYLE_ID)?.remove?.(); } catch (_) {}
  }, { once: true });
})();
