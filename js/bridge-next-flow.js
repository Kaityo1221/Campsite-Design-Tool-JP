(() => {
  'use strict';

  const VERSION = '1.2.2';
  const PROJECT_SCHEMA_VERSION = '1.0';
  const PROJECT_SOURCE = 'bridge';
  const PROJECT_KEY = 'campsiteProject.v1';
  const ADAPTER_KEY = 'campsiteBridgeAdapter.v0.3';
  const PAYLOAD_KEY = 'campsiteBridgePoC.v0.3';
  const SELECTION_PREFIX = 'campsiteBridgeSelection.';
  const REVIEW_PREFIX = 'campsiteBridgeReviewMeta.';
  const PENDING_HANDOFF_KEY = 'campsiteBridgePendingHandoff.v1';
  const LEGACY_FALLBACK_KEY = 'campsiteBridgeLegacyFlow.v1';
  const params = new URLSearchParams(location.search);

  if (params.get('campsiteBridgeImport') !== '1') return;
  const legacyFallback =
    params.get('campsiteBridgeLegacy') === '1' ||
    params.get('campsiteBridgeNext') === '0' ||
    localStorage.getItem(LEGACY_FALLBACK_KEY) === '1';
  if (legacyFallback) return;
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

  function storageKeys() {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key) keys.push(key);
    }
    return keys;
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

  function clearStaleBridgeArtifacts(adapter) {
    const incomingHandoffId = adapterHandoffId(adapter);
    if (!incomingHandoffId) return;

    for (const key of storageKeys()) {
      if (!key.startsWith(SELECTION_PREFIX) && !key.startsWith(REVIEW_PREFIX)) continue;
      const value = readJson(key);
      const handoffId = String(value?.handoffId || '').trim();
      if (handoffId === incomingHandoffId) continue;
      try { sessionStorage.removeItem(key); } catch (_) {}
    }
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

  function compactSourcePoi(poi) {
    return {
      guid: String(poi?.guid || poi?.id || ''),
      title: String(poi?.title || poi?.name || ''),
      lat: Number(poi?.lat),
      lng: Number(poi?.lng),
      gameEntity: String(poi?.gameEntity || poi?.type || '').toUpperCase(),
      gameStatus: String(poi?.gameStatus || 'UNKNOWN').toUpperCase(),
      sponsored: poi?.sponsored === true,
      smr: poi?.smr === true ? true : poi?.smr === false ? false : null
    };
  }

  function buildProject(selection, adapter) {
    const rawSourcePois = Array.isArray(adapter?.pois) ? adapter.pois : [];
    const sourceByGuid = new Map(rawSourcePois.map(poi => [String(poi?.guid || ''), poi]));
    const selectedPois = selection.pois.map(poi => {
      const guid = String(poi?.guid || '');
      const source = sourceByGuid.get(guid) || {};
      const merged = { ...clone(source), ...clone(poi) };
      merged.role = merged.role === 'added' ? 'added' : 'existing';
      return merged;
    });
    const sourcePois = rawSourcePois.map(compactSourcePoi)
      .filter(poi => poi.guid && Number.isFinite(poi.lat) && Number.isFinite(poi.lng));
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
      sourcePois,
      polygon,
      selectedPois: clone(selectedPois),
      circleRadii,
      edits: [],
      currentPois: clone(selectedPois),
      addedPois: [],
      deletedPois: [],
      distanceResult: null,
      meta: {
        sourceCount: Number(selection.sourceCount || rawSourcePois.length || 0),
        selectedCount: selectedPois.length,
        sourceStorage: 'compact-v1',
        bridgeSelectionVersion: String(selection.version || ''),
        bridgeAdapterVersion: String(adapter?.version || ''),
        bridgeHandoffId: adapterHandoffId(adapter),
        bridgePlatform: String(adapter?.bridgePlatform || '').trim().toLowerCase(),
        projectContract: PROJECT_KEY,
        nextFlowVersion: VERSION,
        flowMode: 'next',
        preview: false
      }
    };
  }

  function showError(message) {
    const status = document.getElementById('bridgeSelectionStatus');
    if (status) status.textContent = `⚠️ ${message}`;
    console.error('[Campsite Bridge Next]', message);
  }

  function releaseDisposableBridgeStorage(activeHandoffId = '') {
    // Receiver raw payload and review metadata duplicate data already held by
    // the Adapter/selection snapshot. Release them before Project storage so
    // iPhone Safari never needs quota headroom for duplicate copies.
    try { sessionStorage.removeItem(PAYLOAD_KEY); } catch (_) {}

    for (const key of storageKeys()) {
      if (key.startsWith(REVIEW_PREFIX)) {
        try { sessionStorage.removeItem(key); } catch (_) {}
        continue;
      }
      if (!key.startsWith(SELECTION_PREFIX)) continue;
      const snapshot = readJson(key);
      const handoffId = String(snapshot?.handoffId || '').trim();
      if (activeHandoffId && handoffId === activeHandoffId) continue;
      try { sessionStorage.removeItem(key); } catch (_) {}
    }
  }

  function saveProject(project) {
    const serialized = JSON.stringify(project);
    const handoffId = String(project?.meta?.bridgeHandoffId || '').trim();
    const previousProject = sessionStorage.getItem(PROJECT_KEY);

    // Cleanup first, not after a failed write. WebKit can reject a replacement
    // when the old data + raw handoff backup temporarily exceed the origin quota.
    releaseDisposableBridgeStorage(handoffId);
    try { localStorage.removeItem(PENDING_HANDOFF_KEY); } catch (_) {}
    try { sessionStorage.removeItem(PROJECT_KEY); } catch (_) {}

    try {
      sessionStorage.setItem(PROJECT_KEY, serialized);
      return true;
    } catch (error) {
      console.error('[Campsite Bridge Next] project save failed after pre-cleanup', error);
      if (previousProject) {
        try { sessionStorage.setItem(PROJECT_KEY, previousProject); } catch (_) {}
      }
      return false;
    }
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

    if (!saveProject(project)) {
      showError('プロジェクトの保存に失敗しました。データ量を減らしてもう一度お試しください。');
      return;
    }

    window.CampsiteProject = Object.freeze(project);
    location.href = './creative/index.html?campsiteProject=bridge';
  }

  const activeAdapter = readJson(ADAPTER_KEY);
  clearStaleBridgeProject(activeAdapter);
  clearStaleBridgeArtifacts(activeAdapter);

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#bridgeConfirmBtn');
    if (!button || button.disabled) return;
    // The button's own Bridge-selection listener runs first, saves the
    // polygon snapshot, and skips the legacy CSV handoff in the standard flow.
    setTimeout(continueToCreative, 0);
  });

  window.CampsiteBridgeNextFlow = Object.freeze({
    version: VERSION,
    projectKey: PROJECT_KEY,
    projectSchemaVersion: PROJECT_SCHEMA_VERSION,
    legacyFallbackKey: LEGACY_FALLBACK_KEY,
    adapterHandoffId,
    clearStaleBridgeProject,
    clearStaleBridgeArtifacts,
    buildProject,
    saveProject
  });
})();