(() => {
  'use strict';

  const VERSION = '0.1.0';
  const STORAGE_KEY = 'campsite.wayfarerPolygonDraft.v1';
  const COMMAND_EVENT = 'campsite-bridge-pc:polygon-command';
  const STATE_EVENT = 'campsite-bridge-pc:polygon-state';
  const MAX_POINTS = 30;
  const MOBILE_WIDTH_MAX = 820;

  if (window.__campsiteWayfarerPolygonControllerInstalled) return;
  window.__campsiteWayfarerPolygonControllerInstalled = true;

  let points = [];
  let active = false;
  let completed = false;
  let paused = false;
  let currentMap = null;
  let mapClickListener = null;
  let mapDomClickHandler = null;
  let mapDomClickTarget = null;
  let pollTimer = null;
  let overlays = [];
  let draftAvailable = false;

  function mapAdapterApi() {
    const adapter = window.CampsiteBridgeWayfarerMapAdapter;
    if (!adapter?.findMap) throw new Error('Wayfarer Map Adapterを読み込めませんでした。');
    return adapter;
  }

  function pointFrom(value) {
    if (!Array.isArray(value) || value.length < 2) return null;
    const lat = Number(value[0]);
    const lng = Number(value[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return [lat, lng];
  }

  function clonePoints(values) {
    return (Array.isArray(values) ? values : []).map(pointFrom).filter(Boolean);
  }

  function samePoint(a, b) {
    return Boolean(a && b && Math.abs(a[0] - b[0]) < 1e-12 && Math.abs(a[1] - b[1]) < 1e-12);
  }

  function orientation(a, b, c) {
    const value = (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
    if (Math.abs(value) < 1e-12) return 0;
    return value > 0 ? 1 : 2;
  }

  function onSegment(a, b, c) {
    return (
      b[0] <= Math.max(a[0], c[0]) + 1e-12 &&
      b[0] + 1e-12 >= Math.min(a[0], c[0]) &&
      b[1] <= Math.max(a[1], c[1]) + 1e-12 &&
      b[1] + 1e-12 >= Math.min(a[1], c[1])
    );
  }

  function segmentsIntersect(a, b, c, d) {
    const o1 = orientation(a, b, c);
    const o2 = orientation(a, b, d);
    const o3 = orientation(c, d, a);
    const o4 = orientation(c, d, b);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(a, c, b)) return true;
    if (o2 === 0 && onSegment(a, d, b)) return true;
    if (o3 === 0 && onSegment(c, a, d)) return true;
    if (o4 === 0 && onSegment(c, b, d)) return true;
    return false;
  }

  function edgePairs(values, closed) {
    const result = [];
    for (let i = 0; i < values.length - 1; i += 1) {
      result.push({ index: i, a: values[i], b: values[i + 1] });
    }
    if (closed && values.length >= 3) {
      result.push({ index: values.length - 1, a: values[values.length - 1], b: values[0] });
    }
    return result;
  }

  function findSelfIntersections(values, closed = true) {
    const clean = clonePoints(values);
    const edges = edgePairs(clean, closed && clean.length >= 3);
    const invalid = new Set();

    for (let i = 0; i < edges.length; i += 1) {
      for (let j = i + 1; j < edges.length; j += 1) {
        const left = edges[i];
        const right = edges[j];
        const adjacent = Math.abs(left.index - right.index) === 1;
        const closingAdjacent =
          closed &&
          clean.length >= 3 &&
          ((left.index === 0 && right.index === clean.length - 1) ||
            (right.index === 0 && left.index === clean.length - 1));
        if (adjacent || closingAdjacent) continue;
        if (!segmentsIntersect(left.a, left.b, right.a, right.b)) continue;
        invalid.add(left.index);
        invalid.add(right.index);
      }
    }
    return [...invalid].sort((a, b) => a - b);
  }

  function interactionMode() {
    let coarse = false;
    try { coarse = window.matchMedia?.('(pointer: coarse)')?.matches === true; } catch (_) {}
    const narrow = Number(window.innerWidth || 0) > 0 && Number(window.innerWidth) <= MOBILE_WIDTH_MAX;
    return coarse || narrow ? 'mobile' : 'pc';
  }

  function readDraft() {
    try {
      const raw = window.localStorage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const savedPoints = clonePoints(parsed?.points);
      if (!savedPoints.length || savedPoints.length > MAX_POINTS) return null;
      return {
        version: String(parsed?.version || ''),
        points: savedPoints,
        completed: parsed?.completed === true,
        updatedAt: String(parsed?.updatedAt || '')
      };
    } catch (_) {
      return null;
    }
  }

  function saveDraft() {
    if (!points.length) {
      try { window.localStorage?.removeItem(STORAGE_KEY); } catch (_) {}
      draftAvailable = false;
      return;
    }
    const draft = {
      version: VERSION,
      points: clonePoints(points),
      completed,
      updatedAt: new Date().toISOString()
    };
    try { window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch (_) {}
    draftAvailable = true;
  }

  function clearDraftStorage() {
    try { window.localStorage?.removeItem(STORAGE_KEY); } catch (_) {}
    draftAvailable = false;
  }

  function validation() {
    const invalidEdgeIndexes = findSelfIntersections(points, points.length >= 3);
    return {
      selfIntersects: invalidEdgeIndexes.length > 0,
      invalidEdgeIndexes,
      canComplete:
        active &&
        !completed &&
        points.length >= 3 &&
        points.length <= MAX_POINTS &&
        invalidEdgeIndexes.length === 0
    };
  }

  function instructionFor(mode, state) {
    if (!active) return '範囲を決めてから拠点内を観察します。';
    if (completed) return '範囲を確定しました。次の観察Phaseでこの範囲を使用します。';
    if (state.selfIntersects) return '線が交差しています。交差を解消してから範囲を確定してください。';
    if (mode === 'mobile') return '中央の十字を頂点に合わせて「頂点を追加」を押してください。';
    return '地図上をクリックして頂点を追加してください。';
  }

  function getState() {
    const mode = interactionMode();
    const state = validation();
    return {
      version: VERSION,
      storageKey: STORAGE_KEY,
      active,
      completed,
      paused,
      mode,
      pointCount: points.length,
      maxPoints: MAX_POINTS,
      points: clonePoints(points),
      draftAvailable,
      selfIntersects: state.selfIntersects,
      invalidEdgeIndexes: [...state.invalidEdgeIndexes],
      canComplete: state.canComplete,
      canUndo: active && points.length > 0,
      instruction: instructionFor(mode, state),
      message: ''
    };
  }

  function dispatchState(extra = {}) {
    try {
      window.dispatchEvent(new CustomEvent(STATE_EVENT, {
        detail: JSON.stringify({ ...getState(), ...extra })
      }));
    } catch (_) {}
  }

  function removeMapClickListener() {
    if (mapDomClickHandler && mapDomClickTarget) {
      try { mapDomClickTarget.removeEventListener?.('click', mapDomClickHandler, true); } catch (_) {}
    }
    mapDomClickHandler = null;
    mapDomClickTarget = null;

    if (!mapClickListener) return;
    try {
      if (typeof mapClickListener.remove === 'function') mapClickListener.remove();
      else window.google?.maps?.event?.removeListener?.(mapClickListener);
    } catch (_) {}
    mapClickListener = null;
  }

  function clearOverlays() {
    overlays.splice(0).forEach(item => {
      try { item?.setMap?.(null); } catch (_) {}
    });
  }

  function latLngObject(point) {
    return { lat: point[0], lng: point[1] };
  }

  function renderOverlays() {
    clearOverlays();
    const map = currentMap;
    const maps = window.google?.maps;
    if (!map || !maps || !points.length) return;

    const path = points.map(latLngObject);
    const state = validation();

    if (points.length >= 3 && typeof maps.Polygon === 'function') {
      overlays.push(new maps.Polygon({
        map,
        paths: path,
        clickable: false,
        strokeColor: '#16a34a',
        strokeOpacity: 0.95,
        strokeWeight: 3,
        fillColor: '#22c55e',
        fillOpacity: 0.10
      }));
    } else if (points.length >= 2 && typeof maps.Polyline === 'function') {
      overlays.push(new maps.Polyline({
        map,
        path,
        clickable: false,
        strokeColor: '#16a34a',
        strokeOpacity: 0.95,
        strokeWeight: 3
      }));
    }

    if (typeof maps.Circle === 'function') {
      points.forEach(point => {
        overlays.push(new maps.Circle({
          map,
          center: latLngObject(point),
          radius: 3,
          clickable: false,
          strokeColor: '#166534',
          strokeOpacity: 1,
          strokeWeight: 2,
          fillColor: '#dcfce7',
          fillOpacity: 1
        }));
      });
    }

    if (state.invalidEdgeIndexes.length && typeof maps.Polyline === 'function') {
      const edges = edgePairs(points, points.length >= 3);
      state.invalidEdgeIndexes.forEach(index => {
        const edge = edges.find(item => item.index === index);
        if (!edge) return;
        overlays.push(new maps.Polyline({
          map,
          path: [latLngObject(edge.a), latLngObject(edge.b)],
          clickable: false,
          strokeColor: '#dc2626',
          strokeOpacity: 1,
          strokeWeight: 5
        }));
      });
    }
  }

  function resolveMap() {
    try { return mapAdapterApi().findMap(document) || null; }
    catch (_) { return null; }
  }

  function addPoint(value) {
    if (!active || completed) return false;
    if (points.length >= MAX_POINTS) {
      dispatchState({ message: '頂点は最大30点です。' });
      return false;
    }

    const point = pointFrom(value);
    if (!point) {
      dispatchState({ message: '頂点の座標を取得できませんでした。' });
      return false;
    }
    if (points.some(existing => samePoint(existing, point))) {
      dispatchState({ message: '同じ頂点は追加できません。' });
      return false;
    }

    points.push(point);
    saveDraft();
    renderOverlays();
    dispatchState();
    return true;
  }

  function handleMapClick(event) {
    const latLng = event?.latLng;
    if (!latLng) return;
    const lat = Number(typeof latLng.lat === 'function' ? latLng.lat() : latLng.lat);
    const lng = Number(typeof latLng.lng === 'function' ? latLng.lng() : latLng.lng);
    addPoint([lat, lng]);
  }

  function coordinateValue(point, key) {
    try {
      const value = point?.[key];
      const number = Number(typeof value === 'function' ? value.call(point) : value);
      return Number.isFinite(number) ? number : null;
    } catch (_) {
      return null;
    }
  }

  function mercatorY(lat) {
    const safeLat = Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
    const sin = Math.sin(safeLat * Math.PI / 180);
    return 0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI);
  }

  function latitudeFromMercatorY(y) {
    const n = Math.PI - 2 * Math.PI * Number(y);
    return 180 / Math.PI * Math.atan(Math.sinh(n));
  }

  function pointFromClientPosition(map, clientX, clientY) {
    let mapDiv = null;
    let bounds = null;
    try {
      mapDiv = map?.getDiv?.() || null;
      bounds = map?.getBounds?.() || null;
    } catch (_) {
      return null;
    }
    if (!mapDiv?.getBoundingClientRect || !bounds) return null;

    const rect = mapDiv.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return null;

    const sw = bounds.getSouthWest?.();
    const ne = bounds.getNorthEast?.();
    const south = coordinateValue(sw, 'lat');
    const west = coordinateValue(sw, 'lng');
    const north = coordinateValue(ne, 'lat');
    const east = coordinateValue(ne, 'lng');
    if (![south, west, north, east].every(Number.isFinite)) return null;

    const x = Math.max(0, Math.min(1, (Number(clientX) - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (Number(clientY) - rect.top) / rect.height));

    let lngSpan = east - west;
    if (lngSpan < 0) lngSpan += 360;
    let lng = west + lngSpan * x;
    if (lng > 180) lng -= 360;

    const northY = mercatorY(north);
    const southY = mercatorY(south);
    const lat = latitudeFromMercatorY(northY + (southY - northY) * y);
    return pointFrom([lat, lng]);
  }

  function isMapControlTarget(target) {
    try {
      return Boolean(target?.closest?.(
        '.gm-control-active,.gm-fullscreen-control,.gm-bundled-control,.gmnoprint button'
      ));
    } catch (_) {
      return false;
    }
  }

  function installPcMapClickCapture() {
    let mapDiv = null;
    try { mapDiv = currentMap?.getDiv?.() || null; } catch (_) { mapDiv = null; }
    if (!mapDiv?.contains || typeof window.addEventListener !== 'function') return false;

    const handler = event => {
      if (!active || completed || interactionMode() !== 'pc') return;
      if (event?.button != null && Number(event.button) !== 0) return;
      if (!mapDiv.contains(event?.target)) return;
      if (isMapControlTarget(event?.target)) return;

      try { event.preventDefault?.(); } catch (_) {}
      try { event.stopPropagation?.(); } catch (_) {}
      try { event.stopImmediatePropagation?.(); } catch (_) {}

      const point = pointFromClientPosition(currentMap, event?.clientX, event?.clientY);
      if (!point) {
        dispatchState({ message: 'クリック位置の座標を取得できませんでした。' });
        return;
      }
      addPoint(point);
    };

    window.addEventListener('click', handler, true);
    mapDomClickHandler = handler;
    mapDomClickTarget = window;
    mapClickListener = { remove() {} };
    return true;
  }

  function bindMap() {
    const nextMap = resolveMap();
    if (nextMap !== currentMap) {
      removeMapClickListener();
      clearOverlays();
      currentMap = nextMap;
    }
    if (!currentMap) return false;

    const shouldListen = active && !completed && interactionMode() === 'pc';
    if (shouldListen && !mapClickListener) {
      const captured = installPcMapClickCapture();
      if (!captured) {
        try { mapClickListener = currentMap.addListener('click', handleMapClick); }
        catch (_) { mapClickListener = null; }
      }
    } else if (!shouldListen && mapClickListener) {
      removeMapClickListener();
    }

    if (active) renderOverlays();
    else clearOverlays();
    return true;
  }

  function ensurePolling() {
    if (pollTimer) return;
    pollTimer = window.setInterval?.(() => {
      if (!active) return;
      bindMap();
    }, 1500) || null;
  }

  function startNew() {
    active = true;
    paused = false;
    completed = false;
    points = [];
    clearDraftStorage();
    bindMap();
    ensurePolling();
    dispatchState();
    return getState();
  }

  function resumeDraft() {
    const draft = readDraft();
    if (!draft) return startNew();
    active = true;
    paused = false;
    completed = draft.completed === true;
    points = clonePoints(draft.points);
    draftAvailable = true;
    bindMap();
    ensurePolling();
    dispatchState();
    return getState();
  }

  function addCenter() {
    if (!active || completed) return false;
    if (!bindMap()) {
      dispatchState({ message: 'Wayfarer Mapを確認できませんでした。' });
      return false;
    }
    let center = null;
    try { center = currentMap?.getCenter?.() || null; } catch (_) { center = null; }
    if (!center) {
      dispatchState({ message: '地図中央の座標を取得できませんでした。' });
      return false;
    }
    const lat = Number(typeof center.lat === 'function' ? center.lat() : center.lat);
    const lng = Number(typeof center.lng === 'function' ? center.lng() : center.lng);
    return addPoint([lat, lng]);
  }

  function undo() {
    if (!active || !points.length) return false;
    if (completed) completed = false;
    points.pop();
    saveDraft();
    bindMap();
    dispatchState();
    return true;
  }

  function reset() {
    active = true;
    paused = false;
    completed = false;
    points = [];
    clearDraftStorage();
    bindMap();
    ensurePolling();
    dispatchState();
    return getState();
  }

  function exitDrawing() {
    if (!active) return getState();
    saveDraft();
    active = false;
    paused = true;
    removeMapClickListener();
    clearOverlays();
    dispatchState({ message: '範囲の途中経過を保存してWayfarer通常表示に戻りました。' });
    return getState();
  }

  function editCompleted() {
    const draft = readDraft();
    if (!draft) return startNew();
    points = clonePoints(draft.points);
    active = true;
    paused = false;
    completed = false;
    saveDraft();
    bindMap();
    ensurePolling();
    dispatchState();
    return getState();
  }

  function complete() {
    const state = validation();
    if (!state.canComplete) {
      dispatchState({
        message: state.selfIntersects
          ? '線が交差しているため範囲を確定できません。'
          : '範囲の確定には3点以上の頂点が必要です。'
      });
      return false;
    }
    completed = true;
    paused = false;
    saveDraft();
    active = false;
    removeMapClickListener();
    clearOverlays();
    dispatchState({ message: '範囲を確定しました。必要に応じて通常表示に戻れます。' });
    return true;
  }

  function getPolygon() {
    return clonePoints(points);
  }

  function queryState() {
    const stored = readDraft();
    if (!active) {
      draftAvailable = Boolean(stored);
      if (stored) completed = stored.completed === true;
    }
    bindMap();
    dispatchState();
    return getState();
  }

  function handleCommand(event) {
    let detail = {};
    try { detail = JSON.parse(String(event?.detail || '{}')); } catch (_) {}
    const action = String(detail?.action || '');

    if (action === 'start-new') startNew();
    else if (action === 'resume-draft') resumeDraft();
    else if (action === 'add-center') addCenter();
    else if (action === 'undo') undo();
    else if (action === 'reset') reset();
    else if (action === 'complete') complete();
    else if (action === 'exit-drawing') exitDrawing();
    else if (action === 'edit-completed') editCompleted();
    else if (action === 'query-state') queryState();
  }

  const stored = readDraft();
  draftAvailable = Boolean(stored);
  window.addEventListener(COMMAND_EVENT, handleCommand);
  window.addEventListener('resize', () => {
    if (!active) return;
    bindMap();
    dispatchState();
  }, { passive: true });

  window.CampsiteWayfarerPolygonController = Object.freeze({
    version: VERSION,
    storageKey: STORAGE_KEY,
    maxPoints: MAX_POINTS,
    pointFrom,
    segmentsIntersect,
    findSelfIntersections,
    interactionMode,
    getState,
    getPolygon,
    startNew,
    resumeDraft,
    addPoint,
    addCenter,
    pointFromClientPosition,
    undo,
    reset,
    complete,
    exitDrawing,
    editCompleted,
    queryState
  });

  window.setTimeout?.(() => queryState(), 300);
})();