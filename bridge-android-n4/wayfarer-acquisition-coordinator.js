(() => {
  'use strict';

  const VERSION = '0.1.0';
  const POLYGON_STATE_EVENT = 'campsite-bridge-android-n4:polygon-state';
  const ACQUISITION_STATE_EVENT = 'campsite-bridge-android-n4:acquisition-state';
  const PAGE_CHANNEL = 'CAMPSITE_BRIDGE_ANDROID_M24_PAGE';
  const UI_CHANNEL = 'CAMPSITE_BRIDGE_ANDROID_M24_UI';
  const OBSERVATION_EVENT = 'campsite-bridge-android-n4:observation';
  const BUFFER_METERS = 200;
  const CELL_LEVEL = 14;
  const MAX_TILE_METERS = 500;
  const MAX_TILES = 64; // Conservative Android safety bound, independent of PC geometry rules.
  const TIMEOUT_MS = 12000;

  let running = false;
  let lastCompletedSignature = '';
  let lastResult = null;
  let lastObservation = null;

  function clone(value) { return JSON.parse(JSON.stringify(value)); }

  function emit(state) {
    const detail = { version: VERSION, ...state };
    try { window.dispatchEvent(new CustomEvent(ACQUISITION_STATE_EVENT, { detail: JSON.stringify(detail) })); } catch (_) {}
  }

  function publishObservation(observation) {
    try { window.dispatchEvent(new CustomEvent(OBSERVATION_EVENT, {
      detail: JSON.stringify(observation)
    })); } catch (_) {}
    try { window.postMessage({
      source: PAGE_CHANNEL, type: 'WAYFARER_OBSERVATION',
      observation: observation ? clone(observation) : null
    }, location.origin); } catch (_) {}
  }

  function clearObservation() {
    lastObservation = null;
    lastResult = null;
    // Prevent the ISOLATED sender from using a stale successful snapshot.
    publishObservation(null);
  }

  function buildObservation(points, acquisition, allClassifiedPois) {
    const zoneApi = window.CampsiteWayfarerObservationZone;
    if (!zoneApi?.classifyPois) throw new Error('Wayfarer Observation Zone is unavailable.');
    const classified = zoneApi.classifyPois(points, allClassifiedPois);
    const observedAt = String(acquisition?.observedAt || new Date().toISOString());
    const snapshotId = 'wfobs-' + observedAt.replace(/[^0-9]/g, '') + '-' + Math.random().toString(36).slice(2, 10);
    const metadata = acquisition?.acquisition || {};
    lastObservation = Object.freeze({
      version: VERSION,
      snapshotId,
      observedAt,
      polygon: classified.polygon,
      zones: clone(classified.zones),
      counts: clone(classified.counts),
      visibleTotal: classified.visibleTotal,
      retainedTotal: classified.retainedTotal,
      excludedCount: classified.excludedCount,
      outsideCount: classified.outsideCount,
      canProceed: metadata.coverageComplete === true && classified.visibleTotal > 0,
      acquisition: Object.freeze(clone(metadata))
    });
    publishObservation(lastObservation);
    return lastObservation;
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
        // A covering URL proves which map request was observed, not GCS source completeness.
        const bodyText = String(data.bodyText || '');
        let body;
        try { body = JSON.parse(bodyText); }
        catch (_) {
          cleanup();
          reject(new Error('Wayfarer GCS response is not valid JSON.'));
          return;
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          cleanup();
          reject(new Error('Wayfarer GCS response is not a supported JSON object.'));
          return;
        }
        cleanup();
        resolve({ body, url: String(data.url || ''), capturedAt: String(data.capturedAt || '') });
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
    if (running) throw new Error('An observation is already running.');
    const engine = window.CampsiteWayfarerAcquisitionEngine;
    const mapAdapter = window.CampsiteBridgeWayfarerMapAdapter;
    const parser = window.CampsiteBridgePoiParser;
    const classifier = window.CampsiteBridgePoiClassifier;
    if (!engine?.createPlan || !engine?.executePlan) throw new Error('Wayfarer Acquisition Engine is unavailable.');
    if (!parser?.parsePayload || !classifier?.run) {
      throw new Error('PC-compatible POI normalization modules are unavailable.');
    }
    const map = mapAdapter?.findMap?.(document);
    if (!map?.fitBounds) throw new Error('Wayfarer Map acquisition control is unavailable.');
    if (!Array.isArray(points) || points.length < 3 || points.length > 30) {
      throw new Error('Design polygon must have 3 to 30 vertices.');
    }
    const polygon = points.map(point => ({ lat: Number(point[0]), lng: Number(point[1]) }));
    const plan = engine.createPlan(polygon, {
      bufferMeters: BUFFER_METERS, maxTileMeters: MAX_TILE_METERS, cellLevel: CELL_LEVEL
    });
    if (!plan.tiles?.length || plan.tiles.length > MAX_TILES) {
      throw new Error('取得範囲が大きすぎます。設計範囲を小さくしてください。');
    }
    const center = map.getCenter?.();
    const originalView = {
      center: center ? {
        lat: Number(typeof center.lat === 'function' ? center.lat() : center.lat),
        lng: Number(typeof center.lng === 'function' ? center.lng() : center.lng)
      } : null,
      zoom: Number(map.getZoom?.())
    };

    running = true;
    clearObservation();
    emit({ status: 'running', bufferMeters: plan.bufferMeters, cellLevel: plan.cellLevel, tileCount: plan.tiles.length });
    try {
      const execution = await engine.executePlan(plan, tile => requestTile(map, tile), {
        // Bounds/HTTP/JSON merely establish transport. GCS source completeness
        // has not been verified; returning true here would mislabel partial data.
        responseVerifier: () => null
      });
      const observedAt = new Date().toISOString();
      const acquisition = Object.freeze({
        engineVersion: String(execution.version || engine.version || ''),
        bufferMeters: plan.bufferMeters,
        referenceMeters: 100,
        reserveMeters: 200,
        cellLevel: plan.cellLevel,
        acquisitionBounds: clone(plan.acquisitionBounds || null),
        tileCount: plan.tiles.length,
        geometryCoverageComplete: execution.geometryCoverageComplete === true,
        transportComplete: execution.transportComplete === true,
        sourceComplete: execution.sourceComplete === true ? true : (execution.sourceComplete === false ? false : null),
        coverageComplete: execution.coverageComplete === true,
        coverageStatus: String(execution.coverageStatus || 'unverified')
      });

      if (!acquisition.transportComplete || !acquisition.geometryCoverageComplete) {
        emit({ status: 'incomplete', ...acquisition });
        throw new Error('200mの全タイルを取得できませんでした。再試行してください。');
      }

      // Each tile contributes raw GCS JSON, not the latest on-screen SYNC_STATE.
      // PC parser deduplicates by GUID across the whole acquisition envelope.
      const parsed = parser.parsePayload({ payloads: execution.payloads.map(item => item.body) });
      const classified = classifier.run(parsed);
      if (parsed.failedCount > 0) {
        emit({ status: 'unverified', ...acquisition, invalidPoiCount: parsed.failedCount });
        throw new Error('POI正規化に失敗したデータがあり、結果を確定できません。');
      }

      lastResult = Object.freeze({
        observedAt,
        acquisition,
        parserStats: Object.freeze({
          sourceCount: parsed.sourceCount,
          parsedCount: parsed.parsedCount,
          duplicateCount: parsed.duplicateCount,
          failedCount: parsed.failedCount
        }),
        // Keep no raw GCS bodies in retained state.
        classifiedCount: classified.pois.length
      });
      const observation = buildObservation(points, lastResult, classified.pois);
      emit({
        status: observation.canProceed ? 'complete' :
          acquisition.coverageStatus === 'unverified' ? 'unverified' : 'incomplete',
        ...acquisition,
        visibleTotal: observation.visibleTotal,
        retainedTotal: observation.retainedTotal,
        canProceed: observation.canProceed,
        message: acquisition.sourceComplete !== true
          ? 'POIを取得しましたが、データの完全性を確認できないためCampsiteへの送信を停止しました。'
          : ''
      });
      return lastResult;
    } finally {
      restoreView(map, originalView);
      running = false;
    }
  }

  window.addEventListener(POLYGON_STATE_EVENT, event => {
    let state = null;
    try { state = JSON.parse(String(event?.detail || '{}')); } catch (_) { return; }
    if (state?.active === true) {
      if (!running && lastObservation) clearObservation();
      lastCompletedSignature = '';
      return;
    }
    if (state?.completed !== true || !Array.isArray(state?.points) || state.points.length < 3) return;
    const signature = JSON.stringify(state.points);
    if (running || signature === lastCompletedSignature) return;
    lastCompletedSignature = signature;
    acquire(state.points).catch(error => {
      lastCompletedSignature = '';
      clearObservation();
      emit({ status: 'error', error: String(error?.message || error || 'acquisition failed') });
    });
  });

  window.CampsiteBridgeAndroidN4Acquisition = Object.freeze({
    version: VERSION,
    bufferMeters: BUFFER_METERS,
    cellLevel: CELL_LEVEL,
    maxTileMeters: MAX_TILE_METERS,
    parseBoundsFromUrl,
    covers,
    acquire,
    getLastResult: () => lastResult,
    getObservation: () => lastObservation
  });
})();
