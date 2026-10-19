(() => {
  'use strict';
  if (window.CampsiteBridgeWayfarerMapAdapter?.findMap) return;

  function looksLikeGoogleMap(value) {
    return !!(value &&
      typeof value.getCenter === 'function' &&
      typeof value.addListener === 'function' &&
      typeof value.getDiv === 'function');
  }
  function looksLikeMapViewComponent(value) {
    return !!(value &&
      typeof value.getMap === 'function' &&
      typeof value.setCustomLayers === 'function');
  }
  function findObjectDeep(root, predicate, maxDepth = 6, maxItems = 2200) {
    const stack = [{ value: root, depth: 0 }];
    const seen = new Set();
    let inspected = 0;
    while (stack.length && inspected < maxItems) {
      const { value, depth } = stack.pop();
      inspected += 1;
      if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      try { if (predicate(value)) return value; } catch (_) {}
      if (depth >= maxDepth) continue;
      let values = [];
      try { values = Array.isArray(value) ? value : Object.values(value); } catch (_) {}
      for (const child of values) stack.push({ value: child, depth: depth + 1 });
    }
    return null;
  }
  function findMap(doc = document) {
    const exposed = window.__campsiteBridgeAndroidN4WayfarerMap;
    if (looksLikeGoogleMap(exposed)) return exposed;
    const host = doc?.querySelector?.('app-wf-base-map');
    if (!host) return null;
    const context = host.__ngContext__;
    if (context && typeof context.length === 'number') {
      const limit = Math.min(context.length, 128);
      for (let i = 0; i < limit; i += 1) {
        const entry = context[i];
        if (!looksLikeMapViewComponent(entry)) continue;
        try {
          const map = entry.getMap();
          if (looksLikeGoogleMap(map)) return map;
        } catch (_) {}
      }
    }
    const component = findObjectDeep(context, looksLikeMapViewComponent, 5, 1600);
    if (component) {
      try {
        const map = component.getMap();
        if (looksLikeGoogleMap(map)) return map;
      } catch (_) {}
    }
    return findObjectDeep(context, looksLikeGoogleMap, 6, 2200);
  }

  window.CampsiteBridgeWayfarerMapAdapter = Object.freeze({ findMap });
})();