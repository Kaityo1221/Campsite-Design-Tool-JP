(() => {
  'use strict';

  const VERSION = '1.1.0';
  const GCS_PATH = '/api/v1/vault/mapview/gcs';
  const ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const STYLE = Object.freeze({
    POKESTOP: { fill: '#22b8f0', border: '#1738b8', size: 24, glyph: '●', glyphSize: 8 },
    GYM: { fill: '#f04463', border: '#b91c3c', size: 24, glyph: '▲', glyphSize: 10 },
    POWERSPOT: { fill: '#de65d2', border: '#9b2aa7', size: 28, glyph: '◆', glyphSize: 10 }
  });
  const SYNC_MS = 900;
  const DRAW_IDLE_MS = 120;

  if (window.__campsiteBridgePoiColorsInstalled) {
    try { window.CampsiteBridgePoiColors?.refresh?.(); } catch (_) {}
    return;
  }
  window.__campsiteBridgePoiColorsInstalled = true;

  const pois = new Map();
  let bridgeMap = null;
  let overlay = null;
  let overlayRoot = null;
  let drawTimer = null;
  let syncTimer = null;
  let lastWfmm = false;

  function normalizeEntity(value) {
    const text = String(value || '').toUpperCase().replace(/[\s_-]/g, '');
    if (text === 'POKESTOP') return 'POKESTOP';
    if (text === 'GYM') return 'GYM';
    if (text === 'POWERSPOT') return 'POWERSPOT';
    return '';
  }

  function normalizeStatus(value) {
    const text = String(value || 'UNKNOWN').toUpperCase();
    return text === 'ACTIVE' || text === 'INACTIVE' ? text : 'UNKNOWN';
  }

  function asNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function isWfmmPresent() {
    return Boolean(
      window.WFMM ||
      document.getElementById('wfmm-import-sponsored-link') ||
      document.querySelector('[id^="wfmapmods-"], [class*="wfmapmods-"]')
    );
  }

  function normalizeBridgePoi(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const entity = normalizeEntity(raw.poiKind || raw.gameEntity || raw.entity || raw.type);
    if (!ENTITIES.has(entity)) return null;
    const status = normalizeStatus(raw.gameStatus || raw.status);
    if (status === 'INACTIVE') return null;
    const lat = asNumber(raw.lat ?? raw.latitude ?? (Number.isFinite(Number(raw.latE6)) ? Number(raw.latE6) / 1e6 : null));
    const lng = asNumber(raw.lng ?? raw.longitude ?? (Number.isFinite(Number(raw.lngE6)) ? Number(raw.lngE6) / 1e6 : null));
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    const guid = String(raw.guid || raw.poiId || raw.id || `${entity}:${lat.toFixed(6)},${lng.toFixed(6)}`);
    return { guid, lat, lng, gameEntity: entity, gameStatus: status };
  }

  function candidateFromGcsObject(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const gmo = Array.isArray(raw.gmo) ? raw.gmo : [];
    let game = null;
    const priority = ['GYM', 'POKESTOP', 'POWERSPOT'];
    for (const wanted of priority) {
      game = gmo.find(item => {
        if (!item || typeof item !== 'object') return false;
        const entity = normalizeEntity(item.entity);
        const status = normalizeStatus(item.status);
        const brand = String(item.gameBrand || '').toUpperCase();
        return entity === wanted && status === 'ACTIVE' && (!brand || brand === 'HOLOHOLO');
      });
      if (game) break;
    }
    if (!game) return null;
    const latE6 = asNumber(raw.latE6);
    const lngE6 = asNumber(raw.lngE6);
    const lat = Number.isFinite(latE6) ? latE6 / 1e6 : asNumber(raw.lat);
    const lng = Number.isFinite(lngE6) ? lngE6 / 1e6 : asNumber(raw.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return normalizeBridgePoi({
      guid: raw.poiId || raw.guid || raw.id,
      lat,
      lng,
      gameEntity: game.entity,
      gameStatus: game.status
    });
  }

  function enginePoisFromGcsJson(root) {
    const parser = window.CampsiteBridgePoiParser;
    const classifier = window.CampsiteBridgePoiClassifier;
    if (!parser?.parsePayload || !classifier?.run) return null;
    try {
      const parsed = parser.parsePayload(root);
      if (!Number.isFinite(Number(parsed?.sourceCount)) || Number(parsed.sourceCount) <= 0) return null;
      const result = classifier.run(parsed);
      return (Array.isArray(result?.pois) ? result.pois : [])
        .map(normalizeBridgePoi)
        .filter(Boolean);
    } catch (_) {
      return null;
    }
  }

  function scanGcsJson(root) {
    const enginePois = enginePoisFromGcsJson(root);
    if (enginePois) return enginePois;

    const found = [];
    const stack = [root];
    const seen = new WeakSet();
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (!Array.isArray(node)) {
        if (seen.has(node)) continue;
        seen.add(node);
        const poi = candidateFromGcsObject(node);
        if (poi) found.push(poi);
      }
      for (const value of Object.values(node)) {
        if (value && typeof value === 'object') stack.push(value);
      }
    }
    return found;
  }

  function ingest(list, replace = false) {
    const next = [];
    for (const raw of Array.isArray(list) ? list : []) {
      const poi = normalizeBridgePoi(raw) || candidateFromGcsObject(raw);
      if (poi) next.push(poi);
    }
    if (replace) pois.clear();
    for (const poi of next) pois.set(poi.guid, poi);
    scheduleDraw();
    return next.length;
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

  function discoverMap() {
    let map = null;
    try { map = window.WFMM?.map?.get?.() || null; } catch (_) {}
    if (!looksLikeGoogleMap(map)) map = window.__campsiteBridgeGoogleMap || null;
    if (!looksLikeGoogleMap(map)) {
      try { map = window.CampsiteBridgePcCollector?.findMap?.() || null; } catch (_) {}
    }
    if (!looksLikeGoogleMap(map)) map = findMapFromAngular();
    if (looksLikeGoogleMap(map)) setMap(map);
    return bridgeMap;
  }

  function detachOverlay() {
    if (drawTimer) {
      clearTimeout(drawTimer);
      drawTimer = null;
    }
    if (overlay) {
      try { overlay.setMap(null); } catch (_) {}
    }
    overlay = null;
    overlayRoot = null;
  }

  function setMap(map) {
    if (!looksLikeGoogleMap(map)) return false;
    if (bridgeMap === map && overlay) return true;
    bridgeMap = map;
    if (!window.__campsiteBridgeGoogleMap) window.__campsiteBridgeGoogleMap = map;
    detachOverlay();
    ensureOverlay();
    return true;
  }

  function makePoint(projection, poi) {
    const LatLng = window.google?.maps?.LatLng;
    if (!LatLng || !projection?.fromLatLngToDivPixel) return null;
    try {
      const point = projection.fromLatLngToDivPixel(new LatLng(poi.lat, poi.lng));
      if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
      return { x: Number(point.x), y: Number(point.y) };
    } catch (_) {
      return null;
    }
  }

  function makeMarker(poi, point) {
    const style = STYLE[poi.gameEntity];
    if (!style) return null;
    const marker = document.createElement('div');
    marker.dataset.campsiteBridgePoiColor = poi.gameEntity;
    marker.dataset.campsiteBridgePoiKind = poi.gameEntity;
    Object.assign(marker.style, {
      position: 'absolute',
      left: `${point.x}px`,
      top: `${point.y}px`,
      transform: 'translate(-50%,-50%) translateZ(0)',
      width: `${style.size}px`,
      height: `${style.size}px`,
      borderRadius: '50%',
      boxSizing: 'border-box',
      background: style.fill,
      border: `3px solid ${style.border}`,
      boxShadow: '0 0 0 1px rgba(255,255,255,.92),0 2px 5px rgba(0,0,0,.34)',
      pointerEvents: 'none',
      zIndex: '2147483646',
      display: 'grid',
      placeItems: 'center'
    });

    const glyph = document.createElement('span');
    glyph.textContent = style.glyph;
    glyph.dataset.campsiteBridgePoiGlyph = poi.gameEntity;
    Object.assign(glyph.style, {
      display: 'block',
      color: '#ffffff',
      fontFamily: 'Arial,sans-serif',
      fontSize: `${style.glyphSize}px`,
      fontWeight: '900',
      lineHeight: '1',
      textShadow: '0 1px 2px rgba(0,0,0,.45)',
      transform: poi.gameEntity === 'GYM' ? 'translateY(-1px)' : 'none'
    });
    marker.appendChild(glyph);
    marker.setAttribute('aria-hidden', 'true');
    return marker;
  }

  function renderNow() {
    drawTimer = null;
    if (!overlay || !overlayRoot) return;
    const wfmm = isWfmmPresent();
    if (wfmm) {
      overlayRoot.style.display = 'none';
      overlayRoot.replaceChildren();
      lastWfmm = true;
      return;
    }
    overlayRoot.style.display = '';
    lastWfmm = false;

    let projection = null;
    try { projection = overlay.getProjection?.(); } catch (_) {}
    if (!projection) return;

    let bounds = null;
    try { bounds = bridgeMap?.getBounds?.() || null; } catch (_) {}
    const LatLng = window.google?.maps?.LatLng;

    const fragment = document.createDocumentFragment();
    for (const poi of pois.values()) {
      if (!ENTITIES.has(poi.gameEntity) || poi.gameStatus === 'INACTIVE') continue;
      if (bounds?.contains && LatLng) {
        try { if (!bounds.contains(new LatLng(poi.lat, poi.lng))) continue; } catch (_) {}
      }
      const point = makePoint(projection, poi);
      if (!point) continue;
      const marker = makeMarker(poi, point);
      if (marker) fragment.appendChild(marker);
    }
    overlayRoot.replaceChildren(fragment);
  }

  function scheduleDraw(delay = DRAW_IDLE_MS) {
    if (!overlay) {
      discoverMap();
      if (!overlay) return;
    }
    if (drawTimer) clearTimeout(drawTimer);
    drawTimer = setTimeout(renderNow, delay);
  }

  function ensureOverlay() {
    if (!bridgeMap) return null;
    if (overlay) {
      scheduleDraw();
      return overlay;
    }
    const OverlayView = window.google?.maps?.OverlayView;
    if (!OverlayView) return null;
    const next = new OverlayView();
    next.onAdd = function() {
      const panes = this.getPanes?.();
      const pane = panes?.floatPane || panes?.overlayMouseTarget || panes?.overlayLayer;
      if (!pane) return;
      const root = document.createElement('div');
      root.id = 'campsite-bridge-poi-colors';
      Object.assign(root.style, {
        position: 'absolute', left: '0', top: '0', width: '0', height: '0',
        overflow: 'visible', isolation: 'isolate',
        pointerEvents: 'none', zIndex: '2147483646'
      });
      pane.appendChild(root);
      overlayRoot = root;
      scheduleDraw(0);
    };
    next.draw = function() { scheduleDraw(); };
    next.onRemove = function() {
      overlayRoot?.remove?.();
      overlayRoot = null;
    };
    try {
      next.setMap(bridgeMap);
      overlay = next;
      return next;
    } catch (_) {
      return null;
    }
  }

  function syncKnownBridge() {
    discoverMap();
    const api = window.CampsiteBridgeShortcut;
    if (api?.getPois) {
      try { ingest(api.getPois(), true); } catch (_) {}
      return;
    }
    const androidApi = window.CampsiteBridgeAndroid || window.CampsiteBridge;
    if (androidApi?.getPois) {
      try { ingest(androidApi.getPois(), true); } catch (_) {}
    }
    const wfmm = isWfmmPresent();
    if (wfmm !== lastWfmm) scheduleDraw(0);
  }

  function installPassiveCapture() {
    const XHR = window.XMLHttpRequest;
    if (XHR?.prototype && typeof XHR.prototype.send === 'function' && !XHR.prototype.__campsiteBridgePoiColorsPatched) {
      const originalSend = XHR.prototype.send;
      try { Object.defineProperty(XHR.prototype, '__campsiteBridgePoiColorsPatched', { value: true }); } catch (_) { XHR.prototype.__campsiteBridgePoiColorsPatched = true; }
      XHR.prototype.send = function(...args) {
        this.addEventListener('load', () => {
          const url = String(this.responseURL || '');
          if (!url.includes(GCS_PATH)) return;
          try {
            const json = this.responseType === 'json' && this.response
              ? this.response
              : JSON.parse(String(this.responseText || ''));
            ingest(scanGcsJson(json), false);
          } catch (_) {}
        }, { once: true });
        return originalSend.apply(this, args);
      };
    }

    if (typeof window.fetch === 'function' && !window.fetch.__campsiteBridgePoiColorsPatched) {
      const originalFetch = window.fetch.bind(window);
      const wrapped = async function(input, init) {
        const response = await originalFetch(input, init);
        const url = typeof input === 'string' ? input : String(input?.url || response?.url || '');
        if (url.includes(GCS_PATH)) {
          try {
            const clone = response.clone();
            clone.json().then(json => ingest(scanGcsJson(json), false)).catch(() => {});
          } catch (_) {}
        }
        return response;
      };
      try { Object.defineProperty(wrapped, '__campsiteBridgePoiColorsPatched', { value: true }); } catch (_) {}
      window.fetch = wrapped;
    }
  }

  function clear() {
    pois.clear();
    scheduleDraw(0);
  }

  function refresh() {
    syncKnownBridge();
    scheduleDraw(0);
  }

  installPassiveCapture();
  syncKnownBridge();
  syncTimer = setInterval(syncKnownBridge, SYNC_MS);

  window.CampsiteBridgePoiColors = Object.freeze({
    version: VERSION,
    update(list, map) {
      if (map) setMap(map);
      ingest(Array.isArray(list) ? list : list?.pois, true);
      return pois.size;
    },
    clear,
    refresh,
    isWfmmPresent,
    getStyle(entity) {
      const key = normalizeEntity(entity);
      return STYLE[key] ? { ...STYLE[key] } : null;
    },
    getState: () => ({
      count: pois.size,
      wfmmDetected: isWfmmPresent(),
      mapCaptured: Boolean(bridgeMap),
      overlayReady: Boolean(overlayRoot),
      visibleKinds: [...ENTITIES]
    })
  });

  window.addEventListener('pagehide', () => {
    if (syncTimer) clearInterval(syncTimer);
    syncTimer = null;
    detachOverlay();
  }, { once: true });
})();
