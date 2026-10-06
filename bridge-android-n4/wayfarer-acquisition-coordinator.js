(() => {
  'use strict';

  const VERSION = '0.1.0';
  const POLYGON_STATE_EVENT = 'campsite-bridge-android-n4:polygon-state';
  const ACQUISITION_STATE_EVENT = 'campsite-bridge-android-n4:acquisition-state';
  const PAGE_CHANNEL = 'CAMPSITE_BRIDGE_ANDROID_M24_PAGE';
  const BUFFER_METERS = 200;
  const CELL_LEVEL = 14;
  const TIMEOUT_MS = 12000;

  let running = false;
  let lastCompletedSignature = '';
  let lastResult = null;

  function emit(state) {
    const detail = { version: VERSION, ...state };
    try { window.dispatchEvent(new CustomEvent(ACQUISITION_STATE_EVENT, { detail: JSON.stringify(detail) })); } catch (_) {}
  }

  function parseBoundsFromUrl(value) {
    try {
      const url = new URL(String(value || ''), location.href);
      const parsePair = text => {
        const match = String(text || '').match(/^\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)$/);
        return match ? [Number(match[1]), Number(match[2])] : null;
      };
      const ne = parsePair(url.searchParams.get('ne'));
      const sw = parsePair(url.searchParams.get('sw'));
      const cellLevel = Number(url.searchParams.get('cellLevel'));
      if (!ne || !sw) return null;
      return { north: ne[0], east: ne[1], south: sw[0], west: sw[1], cellLevel };
    } catch (_) { return null; }
  }

  function covers(tile, bounds) {
    const epsilon = 1e-7;
    return Boolean(bounds &&
      bounds.cellLevel === CELL_LEVEL &&
      bounds.south <= tile.south + epsilon &&
      bounds.west <= tile.west + epsilon &&
      bounds.north >= tile.north - epsilon &&
      bounds.east >= tile.east - epsilon);
  }

  function waitForTile(tile) {
    return new Promise((resolve, reject) => {
      let timer = 0;
      const onMessage = event => {
        if (event.source !== window) return;
        const data = event.data || {};
        if (data.source !== PAGE_CHANNEL || data.type !== 'GCS_RESPONSE') return;
        const bounds = parseBoundsFromUrl(data.url);
        if (!covers(tile, bounds)) return;
        cleanup();
        resolve({ url: String(data.url || ''), capturedAt: String(data.capturedAt || ''), bodyText: String(data.bodyText || '') });
      };
      const cleanup = () => {
        window.removeEventListener('message', onMessage);
        if (timer) window.clearTimeout(timer);
      };
      window.addEventListener('message', onMessage);
      timer = window.setTimeout(() => {
        cleanup();
        reject(new Error('Wayfarer GCS response did not cover the planned 200m tile in time.'));
      }, TIMEOUT_MS);
    });
  }

  async function requestTile(map, tile) {
    const pending = waitForTile(tile);
    map.fitBounds?.({ south: tile.south, west: tile.west, north: tile.north, east: tile.east });
    return pending;
  }

  function restoreView(map, view) {
    if (!map || !view) return;
    try { if (view.center) map.setCenter?.(view.center); } catch (_) {}
    try { if (Number.isFinite(view.zoom)) map.setZoom?.(view.zoom); } catch (_) {}
  }

  async function acquire(points) {
    if (running) return null;
    const engine = window.CampsiteWayfarerAcquisitionEngine;
    const mapAdapter = window.CampsiteBridgeWayfarerMapAdapter;
    if (!engine?.createPlan || !engine?.executePlan) throw new Error('Wayfarer Acquisition Engine is unavailable.');
    const map = mapAdapter?.findMap?.(document);
    if (!map) throw new Error('Wayfarer Map is unavailable.');

    const polygon = points.map(point => ({ lat: Number(point[0]), lng: Number(point[1]) }));
    const plan = engine.createPlan(polygon, { bufferMeters: BUFFER_METERS, cellLevel: CELL_LEVEL });
    const center = map.getCenter?.();
    const originalView = {
      center: center ? {
        lat: Number(typeof center.lat === 'function' ? center.lat() : center.lat),
        lng: Number(typeof center.lng === 'function' ? center.lng() : center.lng)
      } : null,
      zoom: Number(map.getZoom?.())
    };

    running = true;
    emit({ status: 'running', bufferMeters: plan.bufferMeters, cellLevel: plan.cellLevel, tileCount: plan.tiles.length });
    try {
      const result = await engine.executePlan(plan, tile => requestTile(map, tile), {
        responseVerifier(payload, tile) {
          return Boolean(payload?.bodyText && covers(tile, parseBoundsFromUrl(payload?.url)));
        }
      });
      lastResult = Object.freeze({ ...result, observedAt: new Date().toISOString() });
      emit({
        status: result.coverageComplete ? 'complete' : 'incomplete',
        bufferMeters: plan.bufferMeters,
        cellLevel: plan.cellLevel,
        tileCount: plan.tiles.length,
        coverageComplete: result.coverageComplete,
        transportComplete: result.transportComplete,
        sourceComplete: result.sourceComplete
      });
      if (!result.coverageComplete) throw new Error('200m acquisition coverage is incomplete.');
      return lastResult;
    } finally {
      restoreView(map, originalView);
      running = false;
    }
  }

  window.addEventListener(POLYGON_STATE_EVENT, event => {
    let state = null;
    try { state = JSON.parse(String(event?.detail || '{}')); } catch (_) { return; }
    if (state?.completed !== true || state?.active !== true || !Array.isArray(state?.points) || state.points.length < 3) return;
    const signature = JSON.stringify(state.points);
    if (signature === lastCompletedSignature) return;
    lastCompletedSignature = signature;
    acquire(state.points).catch(error => {
      emit({ status: 'error', error: String(error?.message || error || 'acquisition failed') });
    });
  });

  window.CampsiteBridgeAndroidN4Acquisition = Object.freeze({
    version: VERSION,
    bufferMeters: BUFFER_METERS,
    cellLevel: CELL_LEVEL,
    parseBoundsFromUrl,
    covers,
    acquire,
    getLastResult: () => lastResult
  });
})();
