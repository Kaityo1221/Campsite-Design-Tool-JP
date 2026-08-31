(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('campsiteBridgeImport') !== '1') return;
  if (params.get('campsiteBridgeDev') !== '1') return;

  const ADAPTER_STORAGE_KEY = 'campsiteBridgeAdapter.v0.3';
  const HANDOFF_STORAGE_KEY = 'campsiteBridgeM5Handoff.v0.9';
  const ALLOWED_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const ALLOWED_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

  function readJson(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key) || 'null');
    } catch (_) {
      return null;
    }
  }

  function normalizePoi(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const guid = String(raw.guid || '').trim();
    const name = String(raw.name || raw.title || '').trim();
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const type = String(raw.type || raw.gameEntity || '').trim().toUpperCase();
    const gameStatus = String(raw.gameStatus || 'ACTIVE').trim().toUpperCase();

    if (!guid || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (!ALLOWED_ENTITIES.has(type) || !ALLOWED_STATUSES.has(gameStatus)) return null;

    return {
      name,
      lat,
      lng,
      type,
      gameStatus,
      guid,
      layer: 'BRIDGE'
    };
  }

  function validatedPois() {
    const adapter = readJson(ADAPTER_STORAGE_KEY);
    const input = Array.isArray(adapter?.pois) ? adapter.pois : [];
    const normalized = input.map(normalizePoi).filter(Boolean);
    const byGuid = new Map(normalized.map(poi => [poi.guid, poi]));

    if (!input.length || normalized.length !== input.length || byGuid.size !== normalized.length) {
      return [];
    }

    return [...byGuid.values()];
  }

  function csvCell(value) {
    const text = String(value ?? '');
    if (!/[",\r\n]/.test(text)) return text;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function createVirtualCsv(pois) {
    const rows = [
      ['name', 'lat', 'lng', 'type', 'gameStatus', 'guid', 'layer'],
      ...pois.map(poi => [
        poi.name,
        poi.lat,
        poi.lng,
        poi.type,
        poi.gameStatus,
        poi.guid,
        poi.layer
      ])
    ];

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

      const panel = document.querySelector('#tool .panel');
      const summary = document.getElementById('csvModeSummary');
      if (summary?.parentElement) {
        summary.insertAdjacentElement('afterend', notice);
      } else if (panel) {
        panel.prepend(notice);
      } else {
        document.body.appendChild(notice);
      }
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

  function prepareToolMode() {
    try {
      if (typeof window.applyCampsiteCsvMode === 'function') {
        window.applyCampsiteCsvMode('extracted');
      }
    } catch (error) {
      console.warn('[Campsite Bridge M5] CSV mode setup failed', error);
    }

    try {
      if (typeof window.setWorkflowStep === 'function') {
        window.setWorkflowStep('csv');
      }
    } catch (_) {}

    try {
      if (typeof window.openTab === 'function') {
        window.openTab('tool');
      }
    } catch (_) {}
  }

  function importIntoExistingFilePath() {
    const pois = validatedPois();
    if (!pois.length) {
      showNotice('⚠️ Bridgeの受け渡しデータを確認できませんでした。Previewへ戻って再送してください。', 'error');
      return false;
    }

    const input = document.getElementById('fileInput');
    if (!input) {
      showNotice('⚠️ CampsiteのPOI読込欄を見つけられませんでした。', 'error');
      return false;
    }

    const transfer = makeDataTransfer();
    if (!transfer?.items) {
      showNotice('⚠️ このブラウザではBridgeの自動ファイル受け渡しを開始できませんでした。', 'error');
      return false;
    }

    const file = createVirtualCsv(pois);

    try {
      transfer.items.add(file);
      input.files = transfer.files;
    } catch (error) {
      console.error('[Campsite Bridge M5] virtual file assignment failed', error);
      showNotice('⚠️ Bridge POIをCampsiteの読込欄へ設定できませんでした。', 'error');
      return false;
    }

    prepareToolMode();
    input.dispatchEvent(new Event('change', { bubbles: true }));

    const handoff = readJson(HANDOFF_STORAGE_KEY) || {};
    const sourceCount = Number(handoff.sourceCount) || pois.length;
    showNotice(`🌉 Bridgeから${pois.length.toLocaleString('ja-JP')}件のPOIを読込済みです。元の収集母集団 ${sourceCount.toLocaleString('ja-JP')}件から切り取りました。CSV保存・手動アップロードは不要です。`);

    window.CampsiteBridgeImport = Object.freeze({
      version: '0.9.0-m5',
      count: pois.length,
      sourceCount,
      fileName: file.name,
      pois
    });

    console.info('[Campsite Bridge M5] imported', {
      count: pois.length,
      sourceCount,
      fileName: file.name
    });

    return true;
  }

  function start() {
    const attempt = () => importIntoExistingFilePath();

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(attempt, 0);
      }, { once: true });
    } else {
      setTimeout(attempt, 0);
    }
  }

  start();
})();
