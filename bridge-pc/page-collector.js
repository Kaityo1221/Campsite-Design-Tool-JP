(() => {
  'use strict';

  const VERSION = '0.1.0';
  const MAP_DATA_PATH = '/api/v1/vault/mapview/gcs';
  const REQUEST_EVENT = 'campsite-bridge-pc:collect';
  const RESPONSE_EVENT = 'campsite-bridge-pc:response';
  const START_EVENT = 'campsite-bridge-pc:start';
  const STATUS_EVENT = 'campsite-bridge-pc:status';
  const RECEIVER_ORIGIN = 'https://kaityo1221.github.io';
  const RECEIVER_BASE = RECEIVER_ORIGIN + '/Campsite-Design-Tool-JP/bridge-receiver.html';
  const READY_TIMEOUT_MS = 12000;
  const ACK_TIMEOUT_MS = 6500;

  if (window.__campsiteBridgePcCollectorInstalled) return;
  window.__campsiteBridgePcCollectorInstalled = true;

  function parserApi() {
    const parser = window.CampsiteBridgePoiParser;
    if (!parser?.parsePoi || !parser?.parsePayload) {
      throw new Error('Campsite Bridge POI Parserを読み込めませんでした。拡張機能を再読み込みしてください。');
    }
    return parser;
  }

  function classifierApi() {
    const classifier = window.CampsiteBridgePoiClassifier;
    if (!classifier?.classifyPoi || !classifier?.run) {
      throw new Error('Campsite Bridge POI分類Engineを読み込めませんでした。拡張機能を再読み込みしてください。');
    }
    return classifier;
  }

  function referenceLayerApi() {
    const layer = window.CampsiteBridgePoiReferenceLayer;
    if (!layer?.splitClassified) {
      throw new Error('Campsite Bridge Reference Layerを読み込めませんでした。拡張機能を再読み込みしてください。');
    }
    return layer;
  }

  function diagnosticsApi() {
    const diagnostics = window.CampsiteBridgePoiDiagnostics;
    if (!diagnostics?.build || !diagnostics?.summary) {
      throw new Error('Campsite Bridge POI診断を読み込めませんでした。拡張機能を再読み込みしてください。');
    }
    return diagnostics;
  }

  function exporterApi() {
    const exporter = window.CampsiteBridgeV1Exporter;
    if (!exporter?.makePayload || !exporter?.exportPois || !exporter?.exportReferencePois) {
      throw new Error('Campsite Bridge V1出力Adapterを読み込めませんでした。拡張機能を再読み込みしてください。');
    }
    return exporter;
  }

  function mapAdapterApi() {
    const adapter = window.CampsiteBridgeWayfarerMapAdapter;
    if (!adapter?.findMap || !adapter?.findMapContext) return null;
    return adapter;
  }

  function numberFrom(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function coordinate(point, key) {
    if (!point) return null;
    try {
      const value = point[key];
      return numberFrom(typeof value === 'function' ? value.call(point) : value);
    } catch (_) {
      return null;
    }
  }

  function findMap() {
    const adapter = mapAdapterApi();
    if (!adapter) return null;
    try {
      return adapter.findMap(document);
    } catch (_) {
      return null;
    }
  }

  function serializeBounds(map) {
    if (!map || typeof map.getBounds !== 'function') return null;
    const bounds = map.getBounds();
    if (!bounds) return null;

    const sw = bounds.getSouthWest?.();
    const ne = bounds.getNorthEast?.();
    const swLat = coordinate(sw, 'lat');
    const swLng = coordinate(sw, 'lng');
    const neLat = coordinate(ne, 'lat');
    const neLng = coordinate(ne, 'lng');
    const zoom = numberFrom(map.getZoom?.());

    if (![swLat, swLng, neLat, neLng].every(Number.isFinite)) return null;

    let centerLat = (swLat + neLat) / 2;
    let centerLng = (swLng + neLng) / 2;
    try {
      const center = map.getCenter?.();
      const mapLat = coordinate(center, 'lat');
      const mapLng = coordinate(center, 'lng');
      if (Number.isFinite(mapLat)) centerLat = mapLat;
      if (Number.isFinite(mapLng)) centerLng = mapLng;
    } catch (_) {}

    return {
      swLat,
      swLng,
      neLat,
      neLng,
      zoom: Number.isFinite(zoom) ? zoom : null,
      center: { lat: centerLat, lng: centerLng }
    };
  }

  function normalizePoi(raw) {
    const parsed = parserApi().parsePoi(raw);
    if (!parsed?.ok) return null;
    const classified = classifierApi().classifyPoi(parsed.poi);
    const routed = referenceLayerApi().splitClassified([classified]);
    if (routed.activeEnginePois.length !== 1) return null;
    return exporterApi().normalizePoi(routed.activeEnginePois[0]);
  }

  function parseMapData(payload) {
    return parserApi().parsePayload(payload);
  }

  function classifyMapData(payload) {
    return classifierApi().run(parseMapData(payload));
  }

  function normalizeMapData(payload) {
    const classified = classifyMapData(payload);
    const routed = referenceLayerApi().splitClassified(classified.pois);
    return exporterApi().exportPois({ enginePois: routed.activeEnginePois });
  }

  function buildDiagnosticReport(parsed, classified) {
    return diagnosticsApi().build(parsed, classified);
  }

  function selectedBounds(bounds) {
    if (!bounds) return null;
    return {
      center: {
        lat: Number(bounds.center?.lat),
        lng: Number(bounds.center?.lng)
      },
      zoom: Number.isFinite(Number(bounds.zoom)) ? Number(bounds.zoom) : null,
      sw: { lat: bounds.swLat, lng: bounds.swLng },
      ne: { lat: bounds.neLat, lng: bounds.neLng }
    };
  }

  async function collect() {
    const map = findMap();
    if (!map) throw new Error('Wayfarer Mapを確認できませんでした。');

    const bounds = serializeBounds(map);
    if (!bounds) throw new Error('Wayfarer Mapの表示範囲を取得できませんでした。');

    const query =
      'ne=(' + bounds.neLat + ',' + bounds.neLng + ')' +
      '&sw=(' + bounds.swLat + ',' + bounds.swLng + ')' +
      '&cellLevel=14';

    const response = await fetch(MAP_DATA_PATH + '?' + query, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error('Wayfarer Mapデータ取得に失敗しました (' + response.status + ')');
    }

    const payload = await response.json();
    const parsed = parseMapData(payload);
    const classified = classifierApi().run(parsed);
    const routed = referenceLayerApi().splitClassified(classified.pois);
    const activePois = exporterApi().exportPois({ enginePois: routed.activeEnginePois });
    const diagnosticReport = buildDiagnosticReport(parsed, classified);

    return {
      pois: activePois,
      referencePois: routed.referencePois,
      enginePois: classified.pois,
      diagnostics: parsed.diagnostics,
      classificationDiagnostics: classified.classificationDiagnostics,
      diagnosticReport,
      engineStats: classified.diagnostics,
      parserStats: {
        sourceCount: parsed.sourceCount,
        parsedCount: parsed.parsedCount,
        duplicateCount: parsed.duplicateCount,
        failedCount: parsed.failedCount
      },
      selectedBounds: selectedBounds(bounds),
      sourcePath: MAP_DATA_PATH
    };
  }

  function dispatchResponse(detail) {
    window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
      detail: JSON.stringify(detail)
    }));
  }

  function dispatchStatus(detail) {
    window.dispatchEvent(new CustomEvent(STATUS_EVENT, {
      detail: JSON.stringify(detail)
    }));
  }

  function createId(prefix) {
    try {
      if (typeof crypto?.randomUUID === 'function') return prefix + '-' + crypto.randomUUID();
    } catch (_) {}
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function writePreparingPage(popup) {
    try {
      popup.document.open();
      popup.document.write(
        '<!doctype html><meta charset="utf-8"><title>Campsite Bridge</title>' +
        '<body style="margin:0;background:#020617;color:#e2e8f0;font-family:system-ui;display:grid;place-items:center;min-height:100vh">' +
        '<div style="text-align:center"><div style="font-size:42px">🌉</div><strong>Campsite Bridge</strong>' +
        '<div style="margin-top:8px;color:#94a3b8;font-size:13px">WayfarerからPOIを準備しています…</div></div></body>'
      );
      popup.document.close();
    } catch (_) {}
  }

  function makePayload(snapshot, handshakeId) {
    return exporterApi().makePayload(snapshot, handshakeId, {
      bridgeVersion: VERSION,
      autoContinue: true
    });
  }

  function handoffToReceiver(popup, payload, handshakeId) {
    return new Promise((resolve, reject) => {
      let readyTimer = null;
      let ackTimer = null;
      const resendTimers = [];

      const cleanup = () => {
        clearTimeout(readyTimer);
        clearTimeout(ackTimer);
        resendTimers.splice(0).forEach(clearTimeout);
        window.removeEventListener('message', onMessage);
      };

      const fail = message => {
        cleanup();
        reject(new Error(message));
      };

      const sendPayload = () => {
        try { popup.postMessage(payload, RECEIVER_ORIGIN); }
        catch (_) {}
      };

      const onMessage = event => {
        if (event.origin !== RECEIVER_ORIGIN) return;
        if (event.source !== popup) return;
        const data = event.data || {};
        if (String(data.handshakeId || '') !== handshakeId) return;

        if (data.type === 'CAMPSITE_BRIDGE_READY_V1') {
          clearTimeout(readyTimer);
          sendPayload();
          resendTimers.push(setTimeout(sendPayload, 800));
          resendTimers.push(setTimeout(sendPayload, 1800));
          clearTimeout(ackTimer);
          ackTimer = setTimeout(() => {
            fail('Campsiteから受信確認が返りませんでした。もう一度お試しください。');
          }, ACK_TIMEOUT_MS);
          return;
        }

        if (data.type === 'CAMPSITE_BRIDGE_ACK_V1') {
          if (data.accepted !== true) {
            fail('CampsiteがPOIを受け付けられませんでした。Wayfarer Mapを更新して再試行してください。');
            return;
          }
          cleanup();
          resolve({
            count: Number(data.count || 0),
            sourceCount: Number(data.sourceCount || payload.pois.length || 0)
          });
        }
      };

      window.addEventListener('message', onMessage);
      readyTimer = setTimeout(() => {
        fail('Campsite Bridge Receiverへ接続できませんでした。ポップアップ設定を確認して再試行してください。');
      }, READY_TIMEOUT_MS);

      const receiverUrl =
        RECEIVER_BASE +
        '?campsiteBridgeDev=1&handshake=' +
        encodeURIComponent(handshakeId);

      try { popup.location.href = receiverUrl; }
      catch (_) { fail('Campsite Bridge Receiverを開けませんでした。'); }
    });
  }

  async function startBridge() {
    const handshakeId = createId('pc');
    let popup = null;
    let diagnosticReport = null;

    try {
      popup = window.open('about:blank', 'CampsiteBridgeReceiver_' + handshakeId, 'popup,width=560,height=820');
    } catch (_) {}

    if (!popup) {
      dispatchStatus({
        state: 'error',
        code: 'popup-blocked',
        message: 'ポップアップがブロックされました。Wayfarerでポップアップを許可して再試行してください。'
      });
      return;
    }

    writePreparingPage(popup);
    dispatchStatus({ state: 'busy', message: 'Wayfarer MapからPOIを取得しています…', diagnosticReport: null });

    try {
      const snapshot = await collect();
      diagnosticReport = snapshot.diagnosticReport;
      const payload = makePayload(snapshot, handshakeId);
      const pois = payload.pois;
      if (!pois.length) {
        try { popup.close(); } catch (_) {}
        throw new Error('POIを取得できませんでした。Wayfarer Mapを表示してからもう一度お試しください。');
      }

      dispatchStatus({
        state: 'busy',
        count: pois.length,
        diagnosticReport,
        message: pois.length.toLocaleString('ja-JP') + '件をCampsiteへ送信しています…'
      });

      const result = await handoffToReceiver(popup, payload, handshakeId);

      dispatchStatus({
        state: 'success',
        count: result.count,
        sourceCount: result.sourceCount,
        diagnosticReport,
        message: result.count.toLocaleString('ja-JP') + '件をCampsiteへ渡しました。Wayfarerはこのまま使えます。'
      });
    } catch (error) {
      dispatchStatus({
        state: 'error',
        diagnosticReport,
        message: String(error?.message || error || 'Bridge送信に失敗しました。')
      });
    }
  }

  window.addEventListener(START_EVENT, () => {
    void startBridge();
  });

  window.addEventListener(REQUEST_EVENT, event => {
    let requestId = '';
    try {
      requestId = String(JSON.parse(String(event.detail || '{}')).requestId || '');
    } catch (_) {}
    if (!requestId) return;

    collect()
      .then(result => dispatchResponse({
        requestId,
        ok: true,
        ...result
      }))
      .catch(error => dispatchResponse({
        requestId,
        ok: false,
        error: String(error?.message || error || 'POI取得に失敗しました。')
      }));
  });

  window.CampsiteBridgePcCollector = Object.freeze({
    version: VERSION,
    mapDataPath: MAP_DATA_PATH,
    findMap,
    serializeBounds,
    normalizePoi,
    normalizeMapData,
    parseMapData,
    classifyMapData,
    buildDiagnosticReport,
    makePayload,
    collect,
    startBridge
  });
})();
