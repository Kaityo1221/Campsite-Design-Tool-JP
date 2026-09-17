// ==UserScript==
// @name         Campsite Bridge 0.8.9.3 Direct
// @namespace    campsite-design-tool
// @version      0.8.9.3
// @description  Wayfarer bridge with GUID cache, acquisition history, POI diffing, quality diagnostics/session export, optional WFMM reuse, and send-time Sponsored POI enrichment.
// @match        https://wayfarer.scopely.com/*
// @match        https://*.wayfarer.scopely.com/*
// @match        https://wayfarer.nianticlabs.com/*
// @match        https://*.wayfarer.nianticlabs.com/*
// @match        https://kaityo1221.github.io/Campsite-Design-Tool-JP/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  const BRIDGE_VERSION = '0.8.9.3';
  const PROTOCOL = 'CAMPSITE_BRIDGE_POI_V1';
  const RECEIVER_ORIGIN = 'https://kaityo1221.github.io';
  const RECEIVER_URL = `${RECEIVER_ORIGIN}/Campsite-Design-Tool-JP/bridge-receiver.html?campsiteBridgeDev=1`;
  const RECEIVER_WINDOW_NAME = 'campsiteBridgeReceiver';
  const CAMPSITE_ADAPTER_STORAGE_KEY = 'campsiteBridgeAdapter.v0.3';
  const CAMPSITE_ENRICHED_STORAGE_KEY = 'campsiteBridgeEnriched.v0.8.9';
  const GAME_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const GAME_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'UNKNOWN']);
  const MAX_COORD_MATCH_METERS = 12;
  const RENDER_DEBOUNCE_MS = 300;
  const PROVENANCE = Object.freeze({
    WAYFARER_PASSIVE: 'WAYFARER_PASSIVE',
    WFMM_CACHE: 'WFMM_CACHE',
    BRIDGE_ENRICHMENT: 'BRIDGE_ENRICHMENT'
  });
  const PROVENANCE_VALUES = new Set(Object.values(PROVENANCE));
  const WFMM_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
  const BRIDGE_HISTORY_STORAGE_KEY = 'campsiteBridge.history.v0.8.9';
  const BRIDGE_AREA_CACHE_STORAGE_KEY = 'campsiteBridge.areaCache.v0.8.9';
  const AREA_CACHE_TTL_MS = 48 * 60 * 60 * 1000;
  const AREA_CACHE_MAX_AREAS = 12;
  const AREA_CACHE_MAX_POIS = 1000;
  const AREA_CACHE_WRITE_DEBOUNCE_MS = 10000;
  const DIAGNOSTIC_LOG_LIMIT = 120;
  const GRID_CACHE_DEGREES = 0.02;

  // Sponsored POIs are the only data Bridge may actively ask for. WFMM cache is reused first when available.
  // Requests happen only when the user presses "Campsiteへ送る".
  // Wayfarer's observed detailed L14 cells are expanded to their four L15
  // children, and each L15 cell is queried at most once per page session.
  const SPONSOR_GRAPHQL_URL = 'https://niantic-social-api.nianticlabs.com/graphql';
  const SPONSOR_REALITY_CHANNEL_ID = 'da83476a-c4da-4312-a610-a4f2fc2c37f0';
  const SPONSOR_CELL_LEVEL = 15;
  const SPONSOR_MAP_BATCH_SIZE = 24;
  const SPONSOR_DETAIL_BATCH_SIZE = 30;
  const SPONSOR_MAX_L15_PER_SEND = 96;
  const SPONSOR_TIMEOUT_MS = 6500;
  const SPONSOR_MAP_OPERATION = 'PgoGameMapObjectsByS2CellsProvider_mapObjectsByS2Cells_Query';
  const SPONSOR_DETAILS_OPERATION = 'PgoGameMapObjectDetails';

  const SPONSOR_MAP_QUERY = `
    query ${SPONSOR_MAP_OPERATION}(
      $realityChannelMapObjectsByS2CellsInput: RealityChannelMapObjectsByS2CellsInput!
    ) {
      realityChannelMapObjectsByS2Cells(input: $realityChannelMapObjectsByS2CellsInput) {
        mapObjectsByS2CellsAndTypes {
          s2CellId
          mapObjectsByType {
            type
            mapObjects {
              id
              mapObjectType
              pgoGym {
                location { latitude longitude }
              }
              pgoPokestop {
                location { latitude longitude }
              }
            }
          }
        }
      }
    }
  `;

  const SPONSOR_DETAILS_QUERY = `
    query ${SPONSOR_DETAILS_OPERATION}($ids: [ID!]!) {
      gameMapObjectsByID(ids: $ids) {
        id
        mapObjectType
        pgoGym {
          name
          imageUrl
          location { latitude longitude }
        }
        pgoPokestop {
          name
          imageUrl
          location { latitude longitude }
        }
      }
    }
  `;

  const isWayfarer = /(^|\.)wayfarer\.(scopely\.com|nianticlabs\.com)$/i.test(location.hostname);
  const isCampsite = location.hostname === 'kaityo1221.github.io' &&
    location.pathname.startsWith('/Campsite-Design-Tool-JP/');

  if (isCampsite) {
    installCampsiteImportHelper();
    return;
  }

  if (!isWayfarer) return;
  installWayfarerBridge();

  function installCampsiteImportHelper() {
    const params = new URLSearchParams(location.search);
    const isGatewayTarget = /\/bridge-gateway\.html$/i.test(location.pathname) &&
      params.get('campsiteBridgeImport') === '1';
    const isImportTarget = /\/index\.html$/i.test(location.pathname) &&
      params.get('campsiteBridgeImport') === '1';

    if (isGatewayTarget) {
      installGatewayAutoPolygonHook();
      return;
    }
    if (!isImportTarget) return;
    if (window.__campsiteBridge089ImportInstalled) return;
    window.__campsiteBridge089ImportInstalled = true;

    const readJson = key => {
      try {
        return JSON.parse(sessionStorage.getItem(key) || 'null');
      } catch (_) {
        return null;
      }
    };

    const boolOrNull = value => {
      if (value === true || String(value).toLowerCase() === 'true') return true;
      if (value === false || String(value).toLowerCase() === 'false') return false;
      return null;
    };

    function normalizeImportedPoi(raw) {
      if (!raw || typeof raw !== 'object') return null;

      const guid = String(raw.guid || raw.sourceId || raw.id || '').trim();
      const title = String(raw.title || raw.name || '').trim();
      const lat = Number(raw.lat);
      const lng = Number(raw.lng);
      const gameEntity = normalizeEntity(raw.gameEntity || raw.type);
      const gameStatus = normalizeStatus(raw.gameStatus) || 'UNKNOWN';

      if (!guid || !Number.isFinite(lat) || !Number.isFinite(lng) || !gameEntity) return null;

      return {
        guid,
        title,
        lat,
        lng,
        gameEntity,
        gameStatus,
        sponsored: raw.sponsored === true || String(raw.sponsored).toLowerCase() === 'true',
        smr: boolOrNull(raw.smr),
        imageUrl: String(raw.imageUrl || ''),
        description: String(raw.description || ''),
        s2L14: String(raw.s2L14 || ''),
        s2L17: String(raw.s2L17 || ''),
        provenance: normalizeProvenance(raw.provenance)
      };
    }

    function csvCell(value) {
      const text = String(value ?? '');
      return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    }

    function createVirtualCsv(pois) {
      const headers = [
        'title', 'lat', 'lng', 'gameEntity', 'gameStatus', 'guid',
        'sponsored', 'smr', 'imageUrl', 'description', 's2L14', 's2L17'
      ];

      const rows = [headers];
      for (const poi of pois) {
        rows.push([
          poi.title,
          poi.lat,
          poi.lng,
          poi.gameEntity,
          poi.gameStatus,
          poi.guid,
          poi.sponsored ? 'true' : 'false',
          poi.smr === null ? '' : String(poi.smr),
          poi.imageUrl,
          poi.description,
          poi.s2L14,
          poi.s2L17
        ]);
      }

      const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
      return new File([csv], `campsite_bridge_${pois.length}_pois.csv`, {
        type: 'text/csv;charset=utf-8',
        lastModified: Date.now()
      });
    }

    function makeDataTransfer() {
      try {
        return new DataTransfer();
      } catch (_) {}

      try {
        const event = new ClipboardEvent('paste');
        if (event.clipboardData) return event.clipboardData;
      } catch (_) {}

      return null;
    }

    function showNotice(message, kind = 'ok') {
      let notice = document.getElementById('campsiteBridgeImportNotice');
      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'campsiteBridgeImportNotice';
        notice.style.cssText = [
          'margin:14px 0',
          'padding:14px 16px',
          'border-radius:14px',
          'font-weight:800',
          'line-height:1.65'
        ].join(';');

        const summary = document.getElementById('csvModeSummary');
        const panel = document.querySelector('#tool .panel');
        if (summary?.parentElement) summary.insertAdjacentElement('afterend', notice);
        else if (panel) panel.prepend(notice);
        else document.body.appendChild(notice);
      }

      if (kind === 'error') {
        notice.style.background = 'rgba(127,29,29,.35)';
        notice.style.border = '1px solid rgba(248,113,113,.55)';
        notice.style.color = '#fecaca';
      } else {
        notice.style.background = 'rgba(20,83,45,.45)';
        notice.style.border = '1px solid rgba(74,222,128,.45)';
        notice.style.color = '#dcfce7';
      }

      notice.textContent = message;
    }

    function importIntoCampsite() {
      const adapter = readJson(CAMPSITE_ADAPTER_STORAGE_KEY);
      const rawPois = Array.isArray(adapter?.pois) ? adapter.pois : [];
      const pois = rawPois.map(normalizeImportedPoi).filter(Boolean);

      if (!rawPois.length || pois.length !== rawPois.length) {
        showNotice('⚠️ Bridgeの受信データを確認できませんでした。Wayfarer Mapから再送してください。', 'error');
        return false;
      }

      const byGuid = new Map();
      for (const poi of pois) byGuid.set(poi.guid, poi);
      if (byGuid.size !== pois.length) {
        showNotice('⚠️ Bridgeデータに重複があります。Wayfarer Mapから再送してください。', 'error');
        return false;
      }

      const input = document.getElementById('fileInput');
      if (!input) return false;

      const transfer = makeDataTransfer();
      if (!transfer?.items) {
        showNotice('⚠️ このブラウザではBridgeの自動受け渡しを開始できませんでした。', 'error');
        return true;
      }

      const file = createVirtualCsv(pois);
      try {
        transfer.items.add(file);
        input.files = transfer.files;
      } catch (error) {
