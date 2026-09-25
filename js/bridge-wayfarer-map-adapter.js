(() => {
  'use strict';

  const VERSION = '1.0.0';
  const HOST_SELECTOR = 'app-wf-base-map';
  const CONTEXT_ENTRY_LIMIT = 128;

  if (window.__campsiteBridgeWayfarerMapAdapterInstalled) return;
  window.__campsiteBridgeWayfarerMapAdapterInstalled = true;

  const diagnostics = {
    searches: 0,
    hostsFound: 0,
    contextEntriesInspected: 0,
    componentMatches: 0,
    componentGetMapErrors: 0,
    mapMatches: 0,
    failures: 0,
    lastResolution: 'not-run'
  };

  function looksLikeGoogleMap(value) {
    return Boolean(
      value &&
      typeof value === 'object' &&
      typeof value.getBounds === 'function' &&
      typeof value.getCenter === 'function' &&
      typeof value.getZoom === 'function' &&
      typeof value.getDiv === 'function' &&
      typeof value.addListener === 'function'
    );
  }

  function looksLikeMapViewComponent(value) {
    return Boolean(
      value &&
      (typeof value === 'object' || typeof value === 'function') &&
      typeof value.getMap === 'function' &&
      typeof value.setCustomLayers === 'function'
    );
  }

  function readContext(host, limit = CONTEXT_ENTRY_LIMIT) {
    const context = host?.__ngContext__;
    if (!context || typeof context.length !== 'number') return [];
    const safeLimit = Math.max(0, Math.min(Number(limit) || 0, context.length));
    const entries = [];
    for (let index = 0; index < safeLimit; index += 1) {
      entries.push(context[index]);
    }
    return entries;
  }

  function findMapViewComponent(host) {
    if (!host) return null;
    for (const entry of readContext(host)) {
      diagnostics.contextEntriesInspected += 1;
      if (!looksLikeMapViewComponent(entry)) continue;
      diagnostics.componentMatches += 1;
      return entry;
    }
    return null;
  }

  function findMapContext(root = document) {
    diagnostics.searches += 1;

    let host = null;
    try {
      host = root?.querySelector?.(HOST_SELECTOR) || null;
    } catch (_) {
      host = null;
    }

    if (!host) {
      diagnostics.failures += 1;
      diagnostics.lastResolution = 'host-not-found';
      return null;
    }
    diagnostics.hostsFound += 1;

    const component = findMapViewComponent(host);
    if (!component) {
      diagnostics.failures += 1;
      diagnostics.lastResolution = 'component-not-found';
      return null;
    }

    let map = null;
    try {
      map = component.getMap();
    } catch (_) {
      diagnostics.componentGetMapErrors += 1;
      diagnostics.failures += 1;
      diagnostics.lastResolution = 'component-get-map-error';
      return null;
    }

    if (!looksLikeGoogleMap(map)) {
      diagnostics.failures += 1;
      diagnostics.lastResolution = 'invalid-map';
      return null;
    }

    diagnostics.mapMatches += 1;
    diagnostics.lastResolution = 'mapview-component';
    return {
      map,
      host,
      component,
      surface: 'mapview',
      adapter: 'wfmm-mapview-component',
      resolution: 'component',
      capabilities: {
        customLayers: true
      }
    };
  }

  function findMap(root = document) {
    return findMapContext(root)?.map || null;
  }

  function getDiagnostics() {
    return {
      version: VERSION,
      hostSelector: HOST_SELECTOR,
      contextEntryLimit: CONTEXT_ENTRY_LIMIT,
      ...diagnostics
    };
  }

  window.CampsiteBridgeWayfarerMapAdapter = Object.freeze({
    version: VERSION,
    hostSelector: HOST_SELECTOR,
    contextEntryLimit: CONTEXT_ENTRY_LIMIT,
    looksLikeGoogleMap,
    looksLikeMapViewComponent,
    findMapViewComponent,
    findMapContext,
    findMap,
    getDiagnostics
  });
})();
