(() => {
  'use strict';

  const VERSION = '1.0.0';
  const PROJECT_KEY = 'campsiteProject.v1';
  const ADAPTER_KEY = 'campsiteBridgeAdapter.v0.3';
  const SELECTION_PREFIX = 'campsiteBridgeSelection.';
  const PREVIEW_KEY = 'campsiteBridgeNextPreview.v1';
  const params = new URLSearchParams(location.search);

  if (params.get('campsiteBridgeImport') !== '1') return;
  const previewEnabled = params.get('campsiteBridgeNext') === '1' || localStorage.getItem(PREVIEW_KEY) === '1';
  if (!previewEnabled) return;
  if (window.__campsiteBridgeNextFlowInstalled) return;
  window.__campsiteBridgeNextFlowInstalled = true;

  const readJson = key => {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); }
    catch (_) { return null; }
  };

  function latestSelection() {
    const candidates = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(SELECTION_PREFIX)) continue;
      const value = readJson(key);
      if (!value || !Array.isArray(value.pois) || !Array.isArray(value.polygon)) continue;
      candidates.push(value);
    }
    candidates.sort((a, b) => String(b.selectedAt || '').localeCompare(String(a.selectedAt || '')));
    return candidates[0] || null;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function buildProject(selection, adapter) {
    const sourcePois = Array.isArray(adapter?.pois) ? adapter.pois : [];
    const sourceByGuid = new Map(sourcePois.map(poi => [String(poi?.guid || ''), poi]));
    const selectedPois = selection.pois.map(poi => {
      const guid = String(poi?.guid || '');
      const source = sourceByGuid.get(guid) || {};
      return { ...clone(source), ...clone(poi) };
    });
    const polygon = selection.polygon
      .filter(point => Array.isArray(point) && point.length >= 2)
      .map(point => [Number(point[0]), Number(point[1])])
      .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));

    if (!selectedPois.length || polygon.length < 3) return null;

    const now = new Date().toISOString();
    const projectId = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `bridge-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return {
      schemaVersion: '1.0',
      projectId,
      source: 'bridge',
      receivedAt: String(adapter?.adaptedAt || now),
      createdAt: now,
      sourcePois: clone(sourcePois),
      polygon,
      selectedPois: clone(selectedPois),
      edits: [],
      currentPois: clone(selectedPois),
      addedPois: [],
      deletedPois: [],
      distanceResult: null,
      meta: {
        sourceCount: Number(selection.sourceCount || sourcePois.length || 0),
        selectedCount: selectedPois.length,
        bridgeSelectionVersion: String(selection.version || ''),
        bridgeAdapterVersion: String(adapter?.version || ''),
        nextFlowVersion: VERSION,
        preview: true
      }
    };
  }

  function showError(message) {
    const status = document.getElementById('bridgeSelectionStatus');
    if (status) status.textContent = `⚠️ ${message}`;
    console.error('[Campsite Bridge Next]', message);
  }

  function continueToCreative() {
    const selection = latestSelection();
    const adapter = readJson(ADAPTER_KEY);
    if (!selection) {
      showError('ポリゴン選択データを確認できませんでした。');
      return;
    }

    const project = buildProject(selection, adapter);
    if (!project) {
      showError('CREATIVE MODEへ渡すプロジェクトを作成できませんでした。');
      return;
    }

    try {
      sessionStorage.setItem(PROJECT_KEY, JSON.stringify(project));
    } catch (error) {
      console.error('[Campsite Bridge Next] project save failed', error);
      showError('プロジェクトの保存に失敗しました。');
      return;
    }

    window.CampsiteProject = Object.freeze(project);
    location.href = './creative/index.html?campsiteProject=bridge';
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#bridgeConfirmBtn');
    if (!button || button.disabled) return;
    // The button's own Bridge-selection listener runs first, saves the
    // polygon snapshot, and skips only the legacy CSV handoff in preview mode.
    setTimeout(continueToCreative, 0);
  });

  window.CampsiteBridgeNextFlow = Object.freeze({
    version: VERSION,
    projectKey: PROJECT_KEY,
    previewKey: PREVIEW_KEY,
    buildProject
  });
})();
