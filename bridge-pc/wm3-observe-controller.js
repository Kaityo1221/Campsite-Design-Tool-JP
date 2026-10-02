(() => {
  'use strict';

  const VERSION = '0.2.0';
  const COMMAND_EVENT = 'campsite-bridge-pc:observe-command';
  const STATE_EVENT = 'campsite-bridge-pc:observe-state';
  const BUFFER_METERS = 200;
  const MAX_TILE_METERS = 500;

  if (window.__campsiteWm3ObserveControllerInstalled) return;
  window.__campsiteWm3ObserveControllerInstalled = true;

  let busy = false;
  let lastResult = null;
  let lastError = '';

  function polygonApi() {
    const api = window.CampsiteWayfarerPolygonController;
    if (!api?.getState || !api?.getPolygon) throw new Error('確定した設計範囲を確認できませんでした。');
    return api;
  }

  function collectorApi() {
    const api = window.CampsiteBridgePcCollector;
    if (!api?.collectPolygon) throw new Error('Wayfarer取得Engineを確認できませんでした。');
    return api;
  }

  function zoneApi() {
    const api = window.CampsiteWayfarerObservationZone;
    if (!api?.classifyPois) throw new Error('観察範囲の分類Engineを確認できませんでした。');
    return api;
  }

  function summaryFrom(result) {
    if (!result) return null;
    return {
      observedAt: result.observedAt,
      visibleTotal: result.visibleTotal,
      retainedTotal: result.retainedTotal,
      canProceed: result.canProceed,
      coverageStatus: result.acquisition.coverageStatus,
      transportComplete: result.acquisition.transportComplete,
      interior: { ...result.counts.interior },
      reference100: { ...result.counts.reference100 }
    };
  }

  function state(extra = {}) {
    return {
      version: VERSION,
      busy,
      status: busy ? 'busy' : lastError ? 'error' : lastResult ? (lastResult.canProceed ? 'success' : 'empty') : 'ready',
      error: lastError,
      summary: summaryFrom(lastResult),
      ...extra
    };
  }

  function dispatch(extra = {}) {
    try {
      window.dispatchEvent(new CustomEvent(STATE_EVENT, {
        detail: JSON.stringify(state(extra))
      }));
    } catch (_) {}
  }

  function normalizePolygonInput(input) {
    const polygon = (Array.isArray(input) ? input : []).map(point => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const lat = Number(point[0]);
      const lng = Number(point[1]);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    }).filter(Boolean);
    if (polygon.length < 3 || polygon.length > 30) {
      throw new Error('観察する設計範囲を確認できませんでした。');
    }
    return polygon;
  }

  async function runPolygon(pointsInput) {
    if (busy) return lastResult;
    const points = normalizePolygonInput(pointsInput);

    busy = true;
    lastError = '';
    dispatch({ message: '確定した範囲と外周200mを観察しています…' });

    try {
      const snapshot = await collectorApi().collectPolygon(points, {
        bufferMeters: BUFFER_METERS,
        maxTileMeters: MAX_TILE_METERS
      });
      const zoning = zoneApi().classifyPois(points, snapshot.enginePois);
      const observedAt = new Date().toISOString();
      const result = {
        version: VERSION,
        snapshotId: 'wm3:' + observedAt,
        observedAt,
        polygon: zoning.polygon,
        counts: zoning.counts,
        zones: zoning.zones,
        visibleTotal: zoning.visibleTotal,
        retainedTotal: zoning.retainedTotal,
        excludedCount: zoning.excludedCount,
        outsideCount: zoning.outsideCount,
        canProceed: zoning.visibleTotal > 0,
        acquisition: {
          engineVersion: String(snapshot?.acquisition?.engineVersion || ''),
          bufferMeters: Number(snapshot?.acquisition?.bufferMeters ?? BUFFER_METERS),
          referenceMeters: 100,
          reserveMeters: 200,
          cellLevel: Number(snapshot?.acquisition?.cellLevel || 0),
          acquisitionBounds: snapshot?.acquisition?.acquisitionBounds
            ? JSON.parse(JSON.stringify(snapshot.acquisition.acquisitionBounds))
            : null,
          tileCount: Number(snapshot?.acquisition?.tileCount || 0),
          geometryCoverageComplete: snapshot?.acquisition?.geometryCoverageComplete === true,
          transportComplete: snapshot?.acquisition?.transportComplete === true,
          coverageComplete: snapshot?.acquisition?.coverageComplete === true,
          coverageStatus: String(snapshot?.acquisition?.coverageStatus || 'unverified'),
          sourceComplete: snapshot?.acquisition?.sourceComplete ?? null
        }
      };

      lastResult = result;
      lastError = '';
      busy = false;
      dispatch({
        message: result.canProceed
          ? '観察結果を取得しました。'
          : '設計範囲内と外周100mに対象POIがありません。'
      });
      return result;
    } catch (error) {
      busy = false;
      lastResult = null;
      lastError = String(error?.message || error || '拠点内の観察に失敗しました。');
      dispatch();
      throw error;
    }
  }

  async function run() {
    const polygon = polygonApi();
    const polygonState = polygon.getState();
    const points = polygon.getPolygon();

    if (polygonState.active === true || polygonState.completed !== true || points.length < 3) {
      lastError = '先に設計範囲を確定してください。';
      dispatch();
      throw new Error(lastError);
    }

    return runPolygon(points);
  }

  function getState() {
    return state();
  }

  function getLastResult() {
    return lastResult ? JSON.parse(JSON.stringify(lastResult)) : null;
  }

  function handleCommand(event) {
    let detail = {};
    try { detail = JSON.parse(String(event?.detail || '{}')); } catch (_) {}
    const action = String(detail?.action || '');
    if (action === 'run') void run().catch(() => {});
    else if (action === 'query-state') dispatch();
  }

  window.addEventListener(COMMAND_EVENT, handleCommand);

  window.CampsiteWayfarerObserveController = Object.freeze({
    version: VERSION,
    bufferMeters: BUFFER_METERS,
    maxTileMeters: MAX_TILE_METERS,
    run,
    runPolygon,
    getState,
    getLastResult
  });

  window.setTimeout?.(() => dispatch(), 350);
})();