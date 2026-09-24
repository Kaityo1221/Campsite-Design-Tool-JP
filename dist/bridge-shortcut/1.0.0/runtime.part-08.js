

(() => {
  'use strict';

  const INSTALL_KEY = '__campsiteBridgeNativePoiColorsV2Installed';
  const OVERLAY_ID = 'campsite-bridge-native-poi-colors-v2';
  const SYNC_MS = 700;
  const DRAW_DELAY_MS = 90;
  const STYLE = Object.freeze({
    POKESTOP: { fill: '#22b8f0', border: '#1748b8' },
    GYM: { fill: '#f04463', border: '#b91c3c' },
    POWERSPOT: { fill: '#de65d2', border: '#9b2aa7' }
  });

  if (window[INSTALL_KEY]) {
    try { window.CampsiteBridgeNativePoiColorsV2?.refresh?.(); } catch (_) {}
    return;
  }
  window[INSTALL_KEY] = true;

  let bridgeMap = null;
  let overlay = null;
  let root = null;
  let drawTimer = null;
  let syncTimer = null;

  function normalizeEntity(value) {
    const text = String(value || '').toUpperCase().replace(/[\s_-]/g, '');
    if (text === 'POKESTOP') return 'POKESTOP';
    if (text === 'GYM') return 'GYM';
    if (text === 'POWERSPOT') return 'POWERSPOT';
    return '';
  }

  function isWfmmPresent() {
    try {
      if (window.CampsiteBridgeShortcut?.isWfmmPresent?.()) return true;
    } catch (_) {}
    return Boolean(
      window.WFMM ||
      document.getElementById('wfmm-import-sponsored-link') ||
      document.querySelector('[id^="wfmapmods-"], [class*="wfmapmods-"]')
    );
  }

  function looksLikeGoogleMap(value) {
    return Boolean(
      value && typeof value === 'object' &&
      typeof value.getCenter === 'function' &&
      typeof value.getZoom === 'function' &&
      typeof value.getDiv === 'function' &&
      typeof value.addListener === 'function'
    );
  }

  function getLiveMap() {
    let map = null;
    try { map = window.WFMM?.map?.get?.() || null; } catch (_) {}
    if (!looksLikeGoogleMap(map)) map = window.__campsiteBridgeGoogleMap || null;
    return looksLikeGoogleMap(map) ? map : null;
  }

  function clearNativeGameMarkers() {
    document.querySelectorAll('#campsite-bridge-map-overlay [data-cbs-game-entity]').forEach(node => {
      try { node.remove(); } catch (_) {}
    });
  }

  function detachOverlay() {
    if (drawTimer) clearTimeout(drawTimer);
    drawTimer = null;
    if (overlay) {
      try { overlay.setMap(null); } catch (_) {}
    }
    overlay = null;
    root = null;
  }

  function setMap(map) {
    if (!looksLikeGoogleMap(map)) return false;
    if (bridgeMap === map && overlay) return true;
    bridgeMap = map;
    detachOverlay();
    ensureOverlay();
    return true;
  }

  function ensureOverlay() {
    if (!bridgeMap || overlay) return overlay;
    const OverlayView = window.google?.maps?.OverlayView;
    if (!OverlayView) return null;

    const next = new OverlayView();
    next.onAdd = function() {
      const panes = this.getPanes?.();
      const pane = panes?.floatPane || panes?.overlayMouseTarget || panes?.overlayLayer;
      if (!pane) return;
      const el = document.createElement('div');
      el.id = OVERLAY_ID;
      Object.assign(el.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '0',
        height: '0',
        pointerEvents: 'none',
        zIndex: '2147483100'
      });
      pane.appendChild(el);
      root = el;
      scheduleDraw(0);
    };
    next.draw = function() { scheduleDraw(); };
    next.onRemove = function() {
      root?.remove?.();
      root = null;
    };

    try {
      next.setMap(bridgeMap);
      overlay = next;
      return next;
    } catch (_) {
      return null;
    }
  }

  function makePoint(projection, poi) {
    const LatLng = window.google?.maps?.LatLng;
    const lat = Number(poi?.lat);
    const lng = Number(poi?.lng);
    if (!LatLng || !projection?.fromLatLngToDivPixel || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    try {
      const point = projection.fromLatLngToDivPixel(new LatLng(lat, lng));
      if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
      return { x: Number(point.x), y: Number(point.y) };
    } catch (_) {
      return null;
    }
  }

  function createMarker(entity, point) {
    const style = STYLE[entity];
    if (!style) return null;
    const marker = document.createElement('div');
    marker.dataset.campsiteBridgeNativePoiColor = entity;
    Object.assign(marker.style, {
      position: 'absolute',
      left: `${point.x}px`,
      top: `${point.y}px`,
      transform: 'translate(-50%,-50%)',
      width: '19px',
      height: '19px',
      borderRadius: '50%',
      boxSizing: 'border-box',
      background: style.fill,
      border: `3px solid ${style.border}`,
      boxShadow: '0 0 0 1px rgba(255,255,255,.94),0 1px 4px rgba(0,0,0,.32)',
      pointerEvents: 'none'
    });
    marker.setAttribute('aria-hidden', 'true');
    return marker;
  }

  function renderNow() {
    drawTimer = null;
    clearNativeGameMarkers();
    if (!root || !overlay) return;

    if (isWfmmPresent()) {
      root.style.display = 'none';
      root.replaceChildren();
      return;
    }
    root.style.display = '';

    let projection = null;
    try { projection = overlay.getProjection?.(); } catch (_) {}
    if (!projection) return;

    let list = [];
    try { list = window.CampsiteBridgeShortcut?.getPois?.() || []; } catch (_) { list = []; }

    const fragment = document.createDocumentFragment();
    for (const poi of Array.isArray(list) ? list : []) {
      const entity = normalizeEntity(poi?.gameEntity);
      // Not in Game never reaches STYLE, so it is deliberately invisible.
      if (!STYLE[entity]) continue;
      const point = makePoint(projection, poi);
      if (!point) continue;
      const marker = createMarker(entity, point);
      if (marker) fragment.appendChild(marker);
    }
    root.replaceChildren(fragment);
  }

  function scheduleDraw(delay = DRAW_DELAY_MS) {
    const map = getLiveMap();
    if (map) setMap(map);
    if (!overlay) return;
    if (drawTimer) clearTimeout(drawTimer);
    drawTimer = setTimeout(renderNow, delay);
  }

  function refresh() {
    const map = getLiveMap();
    if (map) setMap(map);
    scheduleDraw(0);
  }

  syncTimer = setInterval(refresh, SYNC_MS);
  refresh();

  window.CampsiteBridgeNativePoiColorsV2 = Object.freeze({
    refresh,
    getState: () => ({
      mapCaptured: Boolean(bridgeMap),
      overlayReady: Boolean(root),
      wfmmDetected: isWfmmPresent(),
      poiCount: (() => {
        try { return window.CampsiteBridgeShortcut?.getPois?.()?.length || 0; } catch (_) { return 0; }
      })()
    })
  });

  window.addEventListener('pagehide', () => {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
    detachOverlay();
  }, { once: true });
})();
