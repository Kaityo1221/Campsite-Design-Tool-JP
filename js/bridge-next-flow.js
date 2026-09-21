(() => {
  'use strict';

  const VERSION = '1.1.0';
  const PROJECT_SCHEMA_VERSION = '1.0';
  const PROJECT_SOURCE = 'bridge';
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

  function adapterHandoffId(adapter) {
    const explicit = String(adapter?.handoffId || '').trim();
    if (explicit) return explicit;
    const adaptedAt = String(adapter?.adaptedAt || '').trim();
    return adaptedAt ? `adapted:${adaptedAt}` : '';
  }

  function clearStaleBridgeProject(adapter) {
    const incomingHandoffId = adapterHandoffId(adapter);
    if (!incomingHandoffId) return false;
    const current = readJson(PROJECT_KEY);
    if (!current || current.source !== PROJECT_SOURCE) return false;
    const currentHandoffId = String(current?.meta?.bridgeHandoffId || '').trim();
    if (currentHandoffId === incomingHandoffId) return false;
    sessionStorage.removeItem(PROJECT_KEY);
    try { delete window.CampsiteProject; } catch (_) {}
    return true;
  }

  function latestSelection(expectedHandoffId = '') {
    const candidates = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(SELECTION_PREFIX)) continue;
      const value = readJson(key);
      if (!value || !Array.isArray(value.pois) || !Array.isArray(value.polygon)) continue;
      if (expectedHandoffId && String(value.handoffId || '').trim() !== expectedHandoffId) continue;
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
      const merged = { ...clone(source), ...clone(poi) };
      merged.role = merged.role === 'added' ? 'added' : 'existing';
      return merged;
    });
    const polygon = selection.polygon
      .filter(point => Array.isArray(point) && point.length >= 2)
      .map(point => [Number(point[0]), Number(point[1])])
      .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));
    const circleRadii = [50, 40, 30];

    if (!selectedPois.length || polygon.length < 3) return null;

    const now = new Date().toISOString();
    const projectId = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `bridge-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    return {
      schemaVersion: PROJECT_SCHEMA_VERSION,
      projectId,
      source: PROJECT_SOURCE,
      receivedAt: String(adapter?.adaptedAt || now),
      createdAt: now,
      sourcePois: clone(sourcePois),
      polygon,
      selectedPois: clone(selectedPois),
      circleRadii,
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
        bridgeHandoffId: adapterHandoffId(adapter),
        projectContract: PROJECT_KEY,
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
    const adapter = readJson(ADAPTER_KEY);
    const handoffId = adapterHandoffId(adapter);
    const selection = latestSelection(handoffId);
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

  clearStaleBridgeProject(readJson(ADAPTER_KEY));

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
    projectSchemaVersion: PROJECT_SCHEMA_VERSION,
    previewKey: PREVIEW_KEY,
    adapterHandoffId,
    clearStaleBridgeProject,
    buildProject
  });
})();
