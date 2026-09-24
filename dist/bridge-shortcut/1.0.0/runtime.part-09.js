
(() => {
  'use strict';

  const INSTALL_KEY = '__campsiteBridgePoiColorDiagInstalled';
  if (window[INSTALL_KEY]) return;
  window[INSTALL_KEY] = true;

  let diagOverlay = null;
  let diagMap = null;
  let timer = null;
  let state = {
    projectionReady: false,
    candidateCount: 0,
    validPointCount: 0,
    invalidPointCount: 0,
    markerCount: 0,
    rootReady: false,
    rootConnected: false,
    rootDisplay: 'n/a',
    rootVisibility: 'n/a',
    v2Installed: false
  };

  function looksLikeGoogleMap(value) {
    return Boolean(
      value && typeof value === 'object' &&
      typeof value.getCenter === 'function' &&
      typeof value.getZoom === 'function' &&
      typeof value.getDiv === 'function' &&
      typeof value.addListener === 'function'
    );
  }

  function getMap() {
    let map = null;
    try { map = window.WFMM?.map?.get?.() || null; } catch (_) {}
    if (!looksLikeGoogleMap(map)) map = window.__campsiteBridgeGoogleMap || null;
    return looksLikeGoogleMap(map) ? map : null;
  }

  function getPois() {
    try {
      const list = window.CampsiteBridgeShortcut?.getPois?.() || [];
      return Array.isArray(list) ? list : [];
    } catch (_) {
      return [];
    }
  }

  function normalizeEntity(value) {
    const text = String(value || '').toUpperCase().replace(/[\s_-]/g, '');
    return text === 'POKESTOP' || text === 'GYM' || text === 'POWERSPOT' ? text : '';
  }

  function ensureDiagOverlay(map) {
    if (!looksLikeGoogleMap(map)) return null;
    if (diagMap === map && diagOverlay) return diagOverlay;
    if (diagOverlay) {
      try { diagOverlay.setMap(null); } catch (_) {}
    }
    diagOverlay = null;
    diagMap = map;

    const OverlayView = window.google?.maps?.OverlayView;
    if (!OverlayView) return null;
    const overlay = new OverlayView();
    overlay.onAdd = function() {};
    overlay.draw = function() {
      if (isDiagVisible()) refreshState();
    };
    overlay.onRemove = function() {};
    try {
      overlay.setMap(map);
      diagOverlay = overlay;
      return overlay;
    } catch (_) {
      return null;
    }
  }

  function isDiagVisible() {
    const box = document.getElementById('cbs-diagnostics');
    return Boolean(box && box.style.display !== 'none');
  }

  function refreshState() {
    const map = getMap();
    if (map) ensureDiagOverlay(map);

    const root = document.getElementById('campsite-bridge-native-poi-colors-v2');
    const list = getPois().filter(poi => Boolean(normalizeEntity(poi?.gameEntity)));
    let projection = null;
    try { projection = diagOverlay?.getProjection?.() || null; } catch (_) {}

    let validPointCount = 0;
    let invalidPointCount = 0;
    const LatLng = window.google?.maps?.LatLng;
    if (projection?.fromLatLngToDivPixel && LatLng) {
      for (const poi of list) {
        const lat = Number(poi?.lat);
        const lng = Number(poi?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          invalidPointCount += 1;
          continue;
        }
        try {
          const point = projection.fromLatLngToDivPixel(new LatLng(lat, lng));
          if (point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y))) validPointCount += 1;
          else invalidPointCount += 1;
        } catch (_) {
          invalidPointCount += 1;
        }
      }
    } else {
      invalidPointCount = list.length;
    }

    let rootDisplay = 'n/a';
    let rootVisibility = 'n/a';
    if (root) {
      try {
        const style = getComputedStyle(root);
        rootDisplay = style.display || root.style.display || 'default';
        rootVisibility = style.visibility || root.style.visibility || 'default';
      } catch (_) {
        rootDisplay = root.style.display || 'default';
        rootVisibility = root.style.visibility || 'default';
      }
    }

    state = {
      projectionReady: Boolean(projection?.fromLatLngToDivPixel && LatLng),
      candidateCount: list.length,
      validPointCount,
      invalidPointCount,
      markerCount: root?.querySelectorAll?.('[data-campsite-bridge-native-poi-color]')?.length || 0,
      rootReady: Boolean(root),
      rootConnected: Boolean(root?.isConnected),
      rootDisplay,
      rootVisibility,
      v2Installed: Boolean(window.CampsiteBridgeNativePoiColorsV2)
    };

    renderDiagLine();
  }

  function renderDiagLine() {
    const box = document.getElementById('cbs-diagnostics');
    if (!box || box.style.display === 'none') return;
    let line = box.querySelector('[data-cbs-poi-color-diag="1"]');
    if (!line) {
      line = document.createElement('div');
      line.dataset.cbsPoiColorDiag = '1';
      line.style.marginTop = '4px';
      line.style.paddingTop = '4px';
      line.style.borderTop = '1px solid rgba(255,255,255,.12)';
      box.appendChild(line);
    }
    line.innerHTML = [
      `<div>ColorV2 ${state.v2Installed ? 'yes' : 'no'} / Root ${state.rootReady ? 'yes' : 'no'} / Connected ${state.rootConnected ? 'yes' : 'no'}</div>`,
      `<div>Marker ${state.markerCount}/${state.candidateCount} / Projection ${state.validPointCount}/${state.candidateCount} / invalid ${state.invalidPointCount}</div>`,
      `<div>Display ${state.rootDisplay} / Visibility ${state.rootVisibility}</div>`
    ].join('');
  }

  function tick() {
    if (!isDiagVisible()) return;
    refreshState();
  }

  timer = setInterval(tick, 650);

  window.CampsiteBridgePoiColorDiagnostics = Object.freeze({
    refresh: refreshState,
    getState: () => ({ ...state })
  });

  window.addEventListener('pagehide', () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (diagOverlay) {
      try { diagOverlay.setMap(null); } catch (_) {}
    }
    diagOverlay = null;
    diagMap = null;
  }, { once: true });
})();
