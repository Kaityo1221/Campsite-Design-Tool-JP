(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('campsiteBridgeDev') !== '1') return;

  const ADAPTER_STORAGE_KEY = 'campsiteBridgeAdapter.v0.3';
  const HANDOFF_STORAGE_KEY = 'campsiteBridgeM5Handoff.v0.9';
  const ALLOWED_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const ALLOWED_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

  const button = document.getElementById('sendToCampsiteBtn');
  if (!button) return;

  function toCampsitePoi(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const guid = String(raw.guid || '').trim();
    const name = String(raw.title || raw.name || '').trim();
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const type = String(raw.gameEntity || raw.type || '').trim().toUpperCase();
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

  function getVerifiedSelection() {
    const api = window.CampsiteBridgePreview;
    if (!api || api.milestone !== 'M4' || typeof api.verifyCrop !== 'function') {
      return { ok: false, reason: 'M4確認データを取得できません', pois: [] };
    }

    const check = api.verifyCrop();
    if (!check?.ok || !Array.isArray(check.selected) || check.selected.length === 0) {
      return { ok: false, reason: '切り取りデータの整合性を確認できません', pois: [] };
    }

    const converted = check.selected.map(toCampsitePoi).filter(Boolean);
    if (converted.length !== check.selected.length) {
      return { ok: false, reason: 'Campsite形式へ変換できないPOIがあります', pois: [] };
    }

    const byGuid = new Map(converted.map(poi => [poi.guid, poi]));
    if (byGuid.size !== converted.length) {
      return { ok: false, reason: 'GUID重複が残っています', pois: [] };
    }

    return { ok: true, pois: [...byGuid.values()], state: api.state };
  }

  function refreshButton() {
    const result = getVerifiedSelection();
    button.disabled = !result.ok;
    button.classList.toggle('disabled-button', !result.ok);

    if (result.ok) {
      button.textContent = `🏕 ${result.pois.length.toLocaleString('ja-JP')}件をCampsiteへ送る`;
      button.dataset.ready = '1';
    } else {
      button.textContent = 'Campsiteへ送る準備中…';
      button.dataset.ready = '0';
    }
  }

  button.addEventListener('click', () => {
    const result = getVerifiedSelection();
    if (!result.ok) {
      alert(result.reason || 'Campsiteへ送る準備ができていません');
      refreshButton();
      return;
    }

    const state = result.state || {};
    const handoff = {
      bridge: 'Campsite Bridge',
      version: '0.9.0-m5',
      milestone: 'M5_CAMPSITE_HANDOFF',
      adaptedAt: new Date().toISOString(),
      sourceCount: Array.isArray(state.pois) ? state.pois.length : result.pois.length,
      selectedCount: result.pois.length,
      polygon: state.crop?.polygon || null,
      pois: result.pois
    };

    try {
      sessionStorage.setItem(ADAPTER_STORAGE_KEY, JSON.stringify({
        version: '0.9.0-m5',
        adaptedAt: handoff.adaptedAt,
        sourceCount: result.pois.length,
        pois: result.pois
      }));
      sessionStorage.setItem(HANDOFF_STORAGE_KEY, JSON.stringify(handoff));
    } catch (error) {
      console.error('[Campsite Bridge M5] handoff storage failed', error);
      alert('Campsiteへの受け渡しデータを保存できませんでした');
      return;
    }

    button.disabled = true;
    button.textContent = `🌉 ${result.pois.length.toLocaleString('ja-JP')}件を受け渡しています…`;

    location.href = './index.html?campsiteBridgeImport=1&campsiteBridgeDev=1';
  });

  window.CampsiteBridgeM5Handoff = Object.freeze({
    version: '0.9.0-m5',
    getVerifiedSelection,
    refresh: refreshButton
  });

  refreshButton();
})();
