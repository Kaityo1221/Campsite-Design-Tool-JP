;(() => {
  // iPhone native Wayfarer marker policy.
  // Primary path: inspect Wayfarer's Angular marker groups and hide native
  // Wayspot markers that do not correspond to any Pokémon GO POI Bridge knows.
  // This avoids guessing marker appearance from DOM/CSS pixels.
  const ua = String(navigator?.userAgent || '');
  if (!/iPhone|iPad|iPod/i.test(ua)) return;

  const HOST_SELECTOR = 'app-wf-base-map, nia-map, google-map, agm-map';
  const COORD_MATCH_METERS = 12;
  const MAX_GRAPH_NODES = 1000;
  const MAX_ARRAY_LENGTH = 700;
  const MAX_OBJECT_KEYS = 56;

  let scanTimer = 0;
  let nativeGroupsFound = 0;
  let nativeMarkersSeen = 0;
  let nativeMarkersHidden = 0;
  let lastBridgePoiCount = 0;
  const hiddenControls = new Map();

  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function distanceMeters(aLat, aLng, bLat, bLng) {
    const R = 6371000;
    const toRad = value => value * Math.PI / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
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
    try { if (typeof marker.getPosition === 'function') positions.push(marker.getPosition()); } catch (_) {}
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

  function bridgeGamePoiCoords() {
    const coords = [];
    let pois = [];
    try { pois = window.CampsiteBridgeShortcut?.getPois?.() || []; } catch (_) { pois = []; }
    lastBridgePoiCount = Array.isArray(pois) ? pois.length : 0;
    if (!Array.isArray(pois)) return coords;

    for (const poi of pois) {
      const lat = finite(poi?.lat);
      const lng = finite(poi?.lng);
      if (lat === null || lng === null) continue;
      coords.push({ lat, lng });
    }
    return coords;
  }

  function hasBridgeGamePoi(coords, gameCoords) {
    if (!coords || !gameCoords.length) return false;
    for (const poi of gameCoords) {
      if (distanceMeters(coords.lat, coords.lng, poi.lat, poi.lng) <= COORD_MATCH_METERS) return true;
    }
    return false;
  }

  function objectShowsPokemonGoEvidence(root) {
    if (!root || typeof root !== 'object') return false;
    const queue = [{ value: root, depth: 0 }];
    const seen = new WeakSet();
    let visited = 0;

    while (queue.length && visited < 90) {
      const { value, depth } = queue.shift();
      if (!value || typeof value !== 'object') continue;
      if (seen.has(value)) continue;
      seen.add(value);
      visited += 1;

      try {
        const brand = String(value.gameBrand || value.brand || '').toUpperCase();
        if (brand === 'HOLOHOLO' || brand.includes('POKEMON')) return true;
        const entity = String(value.gameEntity || value.entity || value.poiKind || value.type || '').toUpperCase().replace(/[\s_-]/g, '');
        if (entity === 'POKESTOP' || entity === 'GYM' || entity === 'POWERSPOT' || entity === 'PGOPOKESTOP' || entity === 'PGOGYM') return true;
      } catch (_) {}

      if (depth >= 3) continue;
      let keys = [];
      try { keys = Object.keys(value).slice(0, 28); } catch (_) { keys = []; }
      for (const key of keys) {
        if (!/gmo|game|brand|entity|poi|data|info|marker/i.test(key)) continue;
        let child = null;
        try { child = value[key]; } catch (_) { child = null; }
        if (child && typeof child === 'object') queue.push({ value: child, depth: depth + 1 });
      }
    }
    return false;
  }

  function findMarkerControl(root) {
    if (!root || typeof root !== 'object') return null;
    const queue = [{ value: root, depth: 0 }];
    const seen = new WeakSet();
    let visited = 0;

    while (queue.length && visited < 70) {
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
        try { originalMap = typeof value.getMap === 'function' ? value.getMap() : value.map || null; } catch (_) {}
        if (originalMap) return { target: value, mode: 'setMap', originalMap };
      }
      if (markerish && value.content instanceof HTMLElement) {
        return { target: value.content, mode: 'content' };
      }
      if (markerish && 'map' in value && /AdvancedMarker/i.test(ctor)) {
        let originalMap = null;
        try { originalMap = value.map || null; } catch (_) {}
        if (originalMap) return { target: value, mode: 'advancedMap', originalMap };
      }

      if (depth >= 3) continue;
      let keys = [];
      try { keys = Object.keys(value).slice(0, 26); } catch (_) { keys = []; }
      for (const key of keys) {
        if (!/marker|component|ref|native|google|map|content/i.test(key)) continue;
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
      else if (control.mode === 'setMap') target.setMap(control.originalMap);
      else if (control.mode === 'content') target.style.removeProperty('display');
      else if (control.mode === 'advancedMap') target.map = control.originalMap;
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
          const sample = value.slice(0, Math.min(14, value.length));
          const markerCount = sample.filter(looksLikeWayfarerMarker).length;
          if (markerCount >= Math.min(2, sample.length)) arrays.push(value);
        }
        if (depth < 4) {
          for (const child of value.slice(0, 90)) {
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

  function publishState() {
    window.CampsiteBridgeWayfarerNativeMarkerPolicy = {
      mode: 'angular-marker-groups',
      hideNotInGame: true,
      bridgePoiCount: lastBridgePoiCount,
      groupsFound: nativeGroupsFound,
      markersSeen: nativeMarkersSeen,
      markersHidden: nativeMarkersHidden
    };
  }

  function updateDiagLine() {
    const diag = document.getElementById('cbs-diagnostics');
    if (!diag || diag.style.display === 'none') return;
    let line = document.getElementById('cbs-native-wayfarer-policy-diag');
    if (!line) {
      line = document.createElement('div');
      line.id = 'cbs-native-wayfarer-policy-diag';
      line.style.cssText = 'margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12);';
      diag.appendChild(line);
    }
    line.textContent = `Wayfarer native groups ${nativeGroupsFound} / seen ${nativeMarkersSeen} / hidden ${nativeMarkersHidden}`;
  }

  function applyNativeWayfarerMarkerPolicy() {
    scanTimer = 0;
    const gameCoords = bridgeGamePoiCoords();
    if (!gameCoords.length) {
      publishState();
      updateDiagLine();
      return;
    }

    const hosts = Array.from(document.querySelectorAll(HOST_SELECTOR));
    if (!hosts.length) {
      publishState();
      updateDiagLine();
      return;
    }

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

    for (const array of uniqueArrays) {
      const markers = array.filter(looksLikeWayfarerMarker);
      if (markers.length < 2) continue;

      const classified = markers.map(marker => {
        const coords = markerCoords(marker);
        const inGameByCoords = hasBridgeGamePoi(coords, gameCoords);
        const inGameByData = objectShowsPokemonGoEvidence(marker);
        return { marker, coords, inGame: inGameByCoords || inGameByData };
      });
      const matchedByCoords = classified.filter(item => hasBridgeGamePoi(item.coords, gameCoords)).length;

      // Only touch marker arrays proven to contain current Pokémon GO Wayspots.
      if (matchedByCoords < 1) continue;
      groups += 1;

      for (const item of classified) {
        seen += 1;
        const control = findMarkerControl(item.marker);
        if (!control) continue;

        if (item.inGame) {
          const hiddenState = hiddenControls.get(control.target);
          if (hiddenState) showControl(hiddenState);
        } else {
          hideControl(control);
        }
      }
    }

    nativeGroupsFound = groups;
    nativeMarkersSeen = seen;
    nativeMarkersHidden = hiddenControls.size;
    publishState();
    updateDiagLine();
  }

  function scheduleNativePolicy(delay = 120) {
    if (scanTimer) clearTimeout(scanTimer);
    scanTimer = setTimeout(applyNativeWayfarerMarkerPolicy, delay);
  }

  const observer = new MutationObserver(() => scheduleNativePolicy(180));
  observer.observe(document.documentElement, { childList: true, subtree: true });

  scheduleNativePolicy(350);
  setTimeout(() => scheduleNativePolicy(0), 1000);
  setTimeout(() => scheduleNativePolicy(0), 2200);
  setInterval(() => scheduleNativePolicy(0), 2400);
})();
