(() => {
  'use strict';

  const VERSION = '1.0.0';
  const DECK_SELECTOR = 'canvas#deckgl-overlay';
  const OWNERS = Object.freeze({
    WAYFARER: 'WAYFARER',
    WFMM: 'WFMM',
    NONE: 'NONE'
  });

  if (window.__campsiteBridgeWayfarerDisplayOwnerInstalled) return;
  window.__campsiteBridgeWayfarerDisplayOwnerInstalled = true;

  let lastDiagnostics = null;

  function mapAdapterApi() {
    return window.CampsiteBridgeWayfarerMapAdapter || null;
  }

  function looksLikeGoogleMap(value) {
    const adapter = mapAdapterApi();
    if (typeof adapter?.looksLikeGoogleMap === 'function') {
      return adapter.looksLikeGoogleMap(value);
    }
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

  function resolveWayfarerContext(root = document) {
    const adapter = mapAdapterApi();
    if (typeof adapter?.findMapContext !== 'function') return null;
    try {
      return adapter.findMapContext(root) || null;
    } catch (_) {
      return null;
    }
  }

  function resolveWfmmMap() {
    const wfmm = window.WFMM;
    if (!wfmm || typeof wfmm?.map?.get !== 'function') {
      return { present: Boolean(wfmm), map: null, error: false };
    }
    try {
      const map = wfmm.map.get();
      return {
        present: true,
        map: looksLikeGoogleMap(map) ? map : null,
        error: false
      };
    } catch (_) {
      return { present: true, map: null, error: true };
    }
  }

  function findDeckCanvases(map) {
    if (!looksLikeGoogleMap(map)) return [];
    let mapDiv = null;
    try { mapDiv = map.getDiv(); } catch (_) { return []; }
    if (!mapDiv || typeof mapDiv.querySelectorAll !== 'function') return [];
    try {
      return Array.from(mapDiv.querySelectorAll(DECK_SELECTOR));
    } catch (_) {
      return [];
    }
  }

  function pointerEventsOf(canvas) {
    try {
      if (typeof window.getComputedStyle === 'function') {
        return String(window.getComputedStyle(canvas)?.pointerEvents || '');
      }
    } catch (_) {}
    try { return String(canvas?.style?.pointerEvents || ''); } catch (_) { return ''; }
  }

  function connectionState(node) {
    if (!node || typeof node !== 'object') return null;
    return typeof node.isConnected === 'boolean' ? node.isConnected : null;
  }

  function inspectDeck(map) {
    const canvases = findDeckCanvases(map);
    let interactiveCount = 0;
    let passiveCount = 0;
    let unknownPointerEventsCount = 0;

    const items = canvases.map((canvas, index) => {
      const pointerEvents = pointerEventsOf(canvas);
      if (pointerEvents === 'none') passiveCount += 1;
      else if (pointerEvents) interactiveCount += 1;
      else unknownPointerEventsCount += 1;
      return {
        index,
        id: String(canvas?.id || ''),
        pointerEvents: pointerEvents || null,
        connected: connectionState(canvas)
      };
    });

    return {
      selector: DECK_SELECTOR,
      canvasCount: canvases.length,
      interactiveCount,
      passiveCount,
      unknownPointerEventsCount,
      items
    };
  }

  function ownerFrom(wayfarerMap, wfmmMap) {
    if (looksLikeGoogleMap(wfmmMap)) return OWNERS.WFMM;
    if (looksLikeGoogleMap(wayfarerMap)) return OWNERS.WAYFARER;
    return OWNERS.NONE;
  }

  function resolve(root = document) {
    const wayfarerContext = resolveWayfarerContext(root);
    const wayfarerMap = looksLikeGoogleMap(wayfarerContext?.map) ? wayfarerContext.map : null;
    const wfmm = resolveWfmmMap();
    const wfmmMap = wfmm.map;
    const owner = ownerFrom(wayfarerMap, wfmmMap);
    const map = owner === OWNERS.WFMM ? wfmmMap : wayfarerMap;
    const deck = inspectDeck(map);

    let mapDiv = null;
    try { mapDiv = map?.getDiv?.() || null; } catch (_) { mapDiv = null; }

    const diagnostics = {
      version: VERSION,
      owner,
      readOnly: true,
      map: {
        resolved: Boolean(map),
        wayfarerResolved: Boolean(wayfarerMap),
        wfmmPresent: wfmm.present,
        wfmmResolved: Boolean(wfmmMap),
        wfmmGetError: wfmm.error,
        sameMap: wayfarerMap && wfmmMap ? wayfarerMap === wfmmMap : null,
        hostConnected: connectionState(wayfarerContext?.host),
        mapDivConnected: connectionState(mapDiv),
        adapter: wayfarerContext?.adapter || null,
        surface: wayfarerContext?.surface || null
      },
      deck
    };

    lastDiagnostics = diagnostics;
    return {
      owner,
      map,
      wayfarerContext,
      wayfarerMap,
      wfmmMap,
      deckCanvases: findDeckCanvases(map),
      diagnostics
    };
  }

  function diagnose(root = document) {
    return resolve(root).diagnostics;
  }

  function getLastDiagnostics() {
    return lastDiagnostics ? JSON.parse(JSON.stringify(lastDiagnostics)) : null;
  }

  window.CampsiteBridgeWayfarerDisplayOwner = Object.freeze({
    version: VERSION,
    owners: OWNERS,
    deckSelector: DECK_SELECTOR,
    looksLikeGoogleMap,
    resolveWayfarerContext,
    resolveWfmmMap,
    findDeckCanvases,
    inspectDeck,
    ownerFrom,
    resolve,
    diagnose,
    getLastDiagnostics
  });
})();
