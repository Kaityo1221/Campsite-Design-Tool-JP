(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  const MANUAL_KEY = 'campsitePreSubmitManualV2';
  const CHECKPOINT_PREFIX = 'campsitePreSubmitCheckpoint.v1:';
  let rendering = false;

  function readJson(storage, key, fallback = null) {
    try { return JSON.parse(storage.getItem(key) || 'null') ?? fallback; }
    catch (_) { return fallback; }
  }

  function readProject() {
    return readJson(sessionStorage, PROJECT_KEY, null);
  }

  function writeProject(project) {
    project.updatedAt = new Date().toISOString();
    sessionStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  }

  function workspaceIdOf(project) {
    return String(project?.workspaceId || project?.projectId || '').trim();
  }

  function checkpointKey(workspaceId) {
    return CHECKPOINT_PREFIX + workspaceId;
  }

  function readManualState() {
    return readJson(sessionStorage, MANUAL_KEY, {}) || {};
  }

  function normalizePois(project) {
    const pois = Array.isArray(project?.currentPois) ? project.currentPois : [];
    return pois.map(poi => ({
      id: String(poi?.guid || poi?.id || ''),
      lat: Number(poi?.lat),
      lng: Number(poi?.lng),
      role: String(poi?.role || ''),
      layer: String(poi?.layer || ''),
      description: String(poi?.description || poi?.memo || '')
    }));
  }

  function signatureOf(project, manualState) {
    return JSON.stringify({
      workspaceId: workspaceIdOf(project),
      distanceCheckedAt: String(project?.distanceResult?.checkedAt || ''),
      missingCommentCount: Number(project?.distanceResult?.missingCommentCount || 0),
      pois: normalizePois(project),
      polygon: Array.isArray(project?.polygon) ? project.polygon : [],
      manualState: manualState || {}
    });
  }

  function readCheckpoint(workspaceId) {
    if (!workspaceId) return null;
    return readJson(localStorage, checkpointKey(workspaceId), null);
  }

  function collectChecklist(panel) {
    return Array.from(panel?.querySelectorAll?.('.pre-submit-item') || []).map(item => {
      const input = item.querySelector?.('[data-pre-submit-manual]');
      const label = item.querySelector?.('.pre-submit-copy strong')?.textContent?.trim() || '';
      return {
        id: input?.dataset?.preSubmitManual || '',
        label,
        state: String(item.dataset?.state || ''),
        checked: input ? input.checked === true : null
      };
    });
  }

  function currentState() {
    const project = readProject();
    if (!project || project.source !== 'bridge') {
      return { project: null, workspaceId: '', manualState: {}, signature: '', checkpoint: null, saved: false };
    }
    const workspaceId = workspaceIdOf(project);
    const manualState = readManualState();
    const signature = signatureOf(project, manualState);
    const checkpoint = readCheckpoint(workspaceId);
    return {
      project,
      workspaceId,
      manualState,
      signature,
      checkpoint,
      saved: !!(workspaceId && checkpoint?.workspaceId === workspaceId && checkpoint?.signature === signature)
    };
  }

  function saveCheckpoint() {
    const state = currentState();
    const panel = document.querySelector('#check .panel');
    if (!state.project || !state.workspaceId || !panel) return false;

    const savedAt = new Date().toISOString();
    const checklist = collectChecklist(panel);
    const ready = panel.querySelector('.pre-submit-result')?.classList.contains('ready') === true;
    const missingCommentCount = Number(state.project?.distanceResult?.missingCommentCount || 0);

    state.project.phase = 'pre-submit';
    state.project.preSubmitCheckpoint = {
      workspaceId: state.workspaceId,
      savedAt,
      distanceCheckedAt: String(state.project?.distanceResult?.checkedAt || ''),
      missingCommentCount,
      ready
    };
    writeProject(state.project);

    const payload = {
      schemaVersion: '1.0',
      workspaceId: state.workspaceId,
      savedAt,
      signature: signatureOf(state.project, state.manualState),
      distanceResult: state.project.distanceResult || null,
      missingCommentCount,
      manualState: state.manualState,
      checklist,
      ready,
      project: state.project
    };

    try {
      localStorage.setItem(checkpointKey(state.workspaceId), JSON.stringify(payload));
    } catch (error) {
      console.warn('[Campsite Project] pre-submit checkpoint local save failed', error);
      return false;
    }

    renderUi();
    return true;
  }

  function ensureCommentStatus(panel, resultBox) {
    const project = readProject();
    const missing = Number(project?.distanceResult?.missingCommentCount || 0);
    let warning = panel.querySelector('#campsitePreSubmitCommentStatus');

    if (missing <= 0) {
      warning?.remove();
      return;
    }

    if (!warning) {
      warning = document.createElement('div');
      warning.id = 'campsitePreSubmitCommentStatus';
      warning.style.cssText = 'margin:0 0 14px;padding:12px 14px;border:1px solid rgba(245,158,11,.42);border-radius:12px;background:rgba(245,158,11,.08);color:#fde68a;font-size:13px;font-weight:800;line-height:1.65;text-align:center';
      resultBox?.insertAdjacentElement('beforebegin', warning);
    }
    warning.textContent = `⚠️ 50m未満・コメント未入力：${missing}件`;
  }

  function ensureSaveUi(panel, resultBox) {
    let wrap = panel.querySelector('#campsitePreSubmitCheckpoint');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.id = 'campsitePreSubmitCheckpoint';
    wrap.style.cssText = 'margin:0 0 14px;padding:14px;border:1px solid rgba(59,130,246,.34);border-radius:14px;background:rgba(59,130,246,.08)';
    wrap.innerHTML = '<button type="button" data-pre-submit-checkpoint-save style="width:100%;min-height:48px;padding:12px 16px;border:1px solid rgba(96,165,250,.62);border-radius:12px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);color:#172554;font-size:15px;font-weight:950;cursor:pointer">💾 保存</button><div data-pre-submit-checkpoint-status style="margin-top:8px;color:#bfdbfe;font-size:12px;line-height:1.6;text-align:center">距離チェック結果と最終確認の状態を、この案件に保存します。</div>';
    wrap.querySelector('[data-pre-submit-checkpoint-save]')?.addEventListener('click', () => {
      if (!saveCheckpoint()) {
        const status = wrap.querySelector('[data-pre-submit-checkpoint-status]');
        if (status) status.textContent = '保存できませんでした。画面を開き直して、もう一度お試しください。';
      }
    });
    resultBox?.insertAdjacentElement('beforebegin', wrap);
    return wrap;
  }

  function renderUi() {
    if (rendering) return;
    const section = document.getElementById('check');
    const panel = section?.querySelector('.panel');
    const resultBox = panel?.querySelector('.pre-submit-result');
    if (!panel || !resultBox) return;

    rendering = true;
    try {
      ensureCommentStatus(panel, resultBox);
      const wrap = ensureSaveUi(panel, resultBox);
      const button = wrap?.querySelector('[data-pre-submit-checkpoint-save]');
      const status = wrap?.querySelector('[data-pre-submit-checkpoint-status]');
      if (!button || !status) return;

      const state = currentState();
      if (state.saved) {
        button.textContent = '✓ 保存済み';
        button.disabled = true;
        button.style.cursor = 'default';
        button.style.background = 'linear-gradient(135deg,#dcfce7,#bbf7d0)';
        button.style.borderColor = 'rgba(34,197,94,.55)';
        button.style.color = '#14532d';
        status.textContent = 'この最終確認の状態は保存済みです。';
      } else {
        button.textContent = '💾 保存';
        button.disabled = false;
        button.style.cursor = 'pointer';
        button.style.background = 'linear-gradient(135deg,#dbeafe,#bfdbfe)';
        button.style.borderColor = 'rgba(96,165,250,.62)';
        button.style.color = '#172554';
        status.textContent = '距離チェック結果と最終確認の状態を、この案件に保存します。';
      }
    } finally {
      rendering = false;
    }
  }

  function install() {
    const section = document.getElementById('check');
    const panel = section?.querySelector('.panel');
    if (!panel) return false;

    let scheduled = false;
    const scheduleRender = () => {
      if (scheduled) return;
      scheduled = true;
      setTimeout(() => {
        scheduled = false;
        renderUi();
      }, 0);
    };

    const observer = new MutationObserver(scheduleRender);
    observer.observe(panel, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['class', 'data-state', 'checked'] });
    document.addEventListener('change', event => {
      if (event.target?.matches?.('[data-pre-submit-manual]')) scheduleRender();
    }, true);
    window.addEventListener('pageshow', scheduleRender);
    scheduleRender();

    window.CampsitePreSubmitCheckpoint = Object.freeze({
      save: saveCheckpoint,
      getState: currentState,
      keyPrefix: CHECKPOINT_PREFIX
    });
    return true;
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get('campsiteProject') !== 'bridge') return;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (install() || attempts >= 100) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
