;(() => {
  // iPhone native Wayfarer marker policy.
  // DOM/pixel inspection is only a fallback. The primary path here reaches the
  // Angular map context and hides native Wayspot markers whose coordinates do
  // not correspond to any Pokémon GO entity already collected by Bridge.
  const ua = String(navigator?.userAgent || '');
  if (!/iPhone|iPad|iPod/i.test(ua)) return;

  const HOST_SELECTOR = 'app-wf-base-map, nia-map, google-map';
  const COORD_MATCH_METERS = 12;
  const MAX_GRAPH_NODES = 900;
  const MAX_ARRAY_LENGTH = 650;
  const MAX_OBJECT_KEYS = 48;

  let scanTimer = 0;
  let nativeGroupsFound = 0;
  let nativeMarkersSeen = 0;
  let nativeMarkersHidden = 0;
  const hiddenControls = new Map();

  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function readLatLngValue(point, key) {
    if (!point) return null;
    try {
      const value = point[key];
      return finite(typeof value === 'function' ? value.call(point) : value);
    } catch (_) {
      return null;
    }
  }

  function markerCoords(marker) {
    if (!marker || typeof marker !== 'object') return null;

    const directLat = finite(marker.latitude ?? marker.lat);
    const directLng = finite(marker.longitude ?? marker.lng);
    if (directLat !== null && directLng !== null) return { lat: directLat, lng: directLng };

    const positions = [];
    try {
      if (typeof marker.getPosition === 'function') positions.push(marker.getPosition());
    } catch (_) {}
    try { if (marker.position) positions.push(marker.position); } catch (_) {}
    try { if (marker.location) positions.push(marker.location); } catch (_) {}

    for (const point of positions) {
      const lat = readLatLngValue(point, 'lat') ?? finite(point?.latitude);
      const lng = readLatLngValue(point, 'lng') ?? finite(point?.longitude);
      if (lat !== null && lng !== null) return { lat, lng };
    }

    return null;
  }

  function looksLikeWayfarerMarker(marker) {
    if (!marker || typeof marker !== 'object') return false;
    if (!markerCoords(marker)) return false;
    if (marker.infoWindowComponentData) return true;
    if (typeof marker.setVisible === 'function' || typeof marker.setMap === 'function') return true;
    if (marker.marker || marker.mapMarker || marker.googleMarker || marker.advancedMarker) return true;
    return false;
  }

  function collectedGamePoiCoords() {
    const coords = [];
    try {
      for (const poi of poiByGuid.values()) {
        if (!GAME_ENTITIES.has(normalizeEntity(poi?.gameEntity))) continue;
        const lat = finite(poi?.lat);
        const lng = finite(poi?.lng);
        if (lat === null || lng === null) continue;
        coords.push({ lat, lng });
      }
    } catch (_) {}
    return coords;
  }

  function hasCollectedGamePoi(coords, gameCoords) {
    if (!coords || !gameCoords.length) return false;
    for (const poi of gameCoords) {
      try {
        if (distanceMeters(coords.lat, coords.lng, poi.lat, poi.lng) <= COORD_MATCH_METERS) return true;
      } catch (_) {}
    }
    return false;
  }

  function findMarkerControl(root) {
    if (!root || typeof root !== 'object') return null;
    const queue = [{ value: root, depth: 0 }];
    const seen = new WeakSet();
    let visited = 0;

    while (queue.length && visited < 60) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== 'object') continue;
      if (seen.has(value)) continue;
      seen.add(value);
      visited += 1;

      let ctor = '';
      try { ctor = String(value.constructor?.name || ''); } catch (_) {}
      const markerish = /Marker/i.test(ctor) || !!markerCoords(value) || value === root;

      if (markerish && typeof value.setVisible === 'function') {
        return { target: value, mode: 'visible' };
      }
      if (markerish && typeof value.setMap === 'function') {
        let originalMap = null;
        try { originalMap = typeof value.getMap === 'function' ? value.getMap() : value.map || bridgeMap || null; } catch (_) {}
        return { target: value, mode: 'setMap', originalMap };
      }
      if (markerish && value.content instanceof HTMLElement) {
        return { target: value.content, mode: 'content' };
      }
      if (markerish && 'map' in value && /AdvancedMarker/i.test(ctor)) {
        let originalMap = null;
        try { originalMap = value.map || bridgeMap || null; } catch (_) {}
        return { target: value, mode: 'advancedMap', originalMap };
      }

      if (depth >= 3) continue;
      let keys = [];
      try { keys = Object.keys(value).slice(0, 24); } catch (_) { keys = []; }
      for (const key of keys) {
        if (!/marker|component|ref|native|google|map/i.test(key)) continue;
        let child = null;
        try { child = value[key]; } catch (_) { child = null; }
        if (child && typeof child === 'object') queue.push({ value: child, depth: depth + 1 });
      }
    }

    return null;
  }

  function hideControl(control) {
    if (!control?.target) return false;
    const target = control.target;
    if (hiddenControls.has(target)) return true;
    try {
      if (control.mode === 'visible') target.setVisible(false);
      else if (control.mode === 'setMap') target.setMap(null);
      else if (control.mode === 'content') target.style.setProperty('display', 'none', 'important');
      else if (control.mode === 'advancedMap') target.map = null;
      else return false;
      hiddenControls.set(target, control);
      return true;
    } catch (_) {
      return false;
    }
  }

  function showControl(control) {
    if (!control?.target) return false;
    const target = control.target;
    try {
      if (control.mode === 'visible') target.setVisible(true);
      else if (control.mode === 'setMap') target.setMap(control.originalMap || bridgeMap || null);
      else if (control.mode === 'content') target.style.removeProperty('display');
      else if (control.mode === 'advancedMap') target.map = control.originalMap || bridgeMap || null;
      hiddenControls.delete(target);
      return true;
    } catch (_) {
      return false;
    }
  }

  function markerArraysFromHost(host) {
    const context = host?.__ngContext__;
    if (!Array.isArray(context)) return [];

    const arrays = [];
    const seenArrays = new WeakSet();
    const seenObjects = new WeakSet();
    const queue = context.map(value => ({ value, depth: 0 }));
    let visited = 0;

    while (queue.length && visited < MAX_GRAPH_NODES) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== 'object') continue;
      visited += 1;

      if (Array.isArray(value)) {
        if (seenArrays.has(value)) continue;
        seenArrays.add(value);
        if (value.length > 0 && value.length <= MAX_ARRAY_LENGTH) {
          const sample = value.slice(0, Math.min(12, value.length));
          const markerCount = sample.filter(looksLikeWayfarerMarker).length;
          if (markerCount >= Math.min(2, sample.length)) arrays.push(value);
        }
        if (depth < 4) {
          for (const child of value.slice(0, 80)) {
            if (child && typeof child === 'object') queue.push({ value: child, depth: depth + 1 });
          }
        }
        continue;
      }

      if (seenObjects.has(value)) continue;
      seenObjects.add(value);
      if (depth >= 5) continue;

      let keys = [];
      try { keys = Object.keys(value).slice(0, MAX_OBJECT_KEYS); } catch (_) { keys = []; }
      for (const key of keys) {
        if (depth >= 2 && !/marker|nearby|wayspot|poi|map|component|ref|data/i.test(key)) continue;
        let child = null;
        try { child = value[key]; } catch (_) { child = null; }
        if (child && typeof child === 'object') queue.push({ value: child, depth: depth + 1 });
      }
    }

    return arrays;
  }

  function applyNativeWayfarerMarkerPolicy() {
    scanTimer = 0;
    const gameCoords = collectedGamePoiCoords();
    if (!gameCoords.length) return;

    const hosts = Array.from(document.querySelectorAll(HOST_SELECTOR));
    if (!hosts.length) return;

    const uniqueArrays = [];
    const seenArrays = new WeakSet();
    for (const host of hosts) {
      for (const array of markerArraysFromHost(host)) {
        if (seenArrays.has(array)) continue;
        seenArrays.add(array);
        uniqueArrays.push(array);
      }
    }

    let groups = 0;
    let seen = 0;
    let hidden = 0;

    for (const array of uniqueArrays) {
      const markers = array.filter(looksLikeWayfarerMarker);
      if (markers.length < 2) continue;

      const classified = markers.map(marker => {
        const coords = markerCoords(marker);
        return { marker, coords, inGame: hasCollectedGamePoi(coords, gameCoords) };
      });
      const inGameCount = classified.filter(item => item.inGame).length;

      // Only act on arrays that demonstrably contain at least one marker Bridge
      // also knows as a Pokémon GO entity. This keeps unrelated Angular arrays safe.
      if (inGameCount < 1) continue;
      groups += 1;

      for (const item of classified) {
        seen += 1;
        const control = findMarkerControl(item.marker);
        if (!control) continue;

        if (item.inGame) {
          const hiddenState = hiddenControls.get(control.target);
          if (hiddenState) showControl(hiddenState);
          continue;
        }

        if (hideControl(control)) hidden += 1;
      }
    }

    nativeGroupsFound = groups;
    nativeMarkersSeen = seen;
    nativeMarkersHidden = hiddenControls.size;

    try {
      window.CampsiteBridgeWayfarerNativeMarkerPolicy = Object.freeze({
        mode: 'angular-marker-groups',
        hideNotInGame: true,
        get groupsFound() { return nativeGroupsFound; },
        get markersSeen() { return nativeMarkersSeen; },
        get markersHidden() { return nativeMarkersHidden; }
      });
    } catch (_) {}
  }

  function scheduleNativePolicy(delay = 120) {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(applyNativeWayfarerMarkerPolicy, delay);
  }

  const observer = new MutationObserver(() => scheduleNativePolicy(160));
  observer.observe(document.documentElement, { childList: true, subtree: true });

  scheduleNativePolicy(300);
  setTimeout(() => scheduleNativePolicy(0), 1000);
  setTimeout(() => scheduleNativePolicy(0), 2200);
  setInterval(() => scheduleNativePolicy(0), 2400);
})();
