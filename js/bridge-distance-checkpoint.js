(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  const CHECKPOINT_PREFIX = 'campsiteDistanceCheckpoint.v1:';

  function readProject() {
    try { return JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null'); }
    catch (_) { return null; }
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

  function readCheckpoint(workspaceId) {
    if (!workspaceId) return null;
    try { return JSON.parse(localStorage.getItem(checkpointKey(workspaceId)) || 'null'); }
    catch (_) { return null; }
  }

  function currentState() {
    const project = readProject();
    if (!project || project.source !== 'bridge') return { project: null, workspaceId: '', result: null, checkpoint: null, saved: false };
    const workspaceId = workspaceIdOf(project);
    const result = project.distanceResult || null;
    const checkpoint = readCheckpoint(workspaceId);
    const checkedAt = String(result?.checkedAt || '');
    const saved = !!(
      workspaceId &&
      checkedAt &&
      checkpoint?.workspaceId === workspaceId &&
      String(checkpoint?.distanceResult?.checkedAt || '') === checkedAt
    );
    return { project, workspaceId, result, checkpoint, saved };
  }

  function saveCheckpoint() {
    const state = currentState();
    if (!state.project || !state.workspaceId || !state.result?.checkedAt) return false;

    const savedAt = new Date().toISOString();
    const project = state.project;
    project.workspaceId = state.workspaceId;
    project.phase = 'distance';
    project.distanceCheckpoint = {
      workspaceId: state.workspaceId,
      checkedAt: String(state.result.checkedAt),
      savedAt
    };
    writeProject(project);

    const payload = {
      schemaVersion: '1.0',
      workspaceId: state.workspaceId,
      savedAt,
      distanceResult: state.result,
      project
    };
    try {
      localStorage.setItem(checkpointKey(state.workspaceId), JSON.stringify(payload));
    } catch (error) {
      console.warn('[Campsite Project] distance checkpoint local save failed', error);
      return false;
    }
    renderSaveState();
    return true;
  }

  function ensureSaveUi() {
    const result = document.getElementById('distanceResult');
    if (!result || !result.textContent.trim()) return null;

    let wrap = document.getElementById('campsiteDistanceCheckpoint');
    if (wrap) return wrap;

    wrap = document.createElement('div');
    wrap.id = 'campsiteDistanceCheckpoint';
    wrap.style.cssText = 'margin:16px 0 8px;padding:14px;border:1px solid rgba(59,130,246,.34);border-radius:14px;background:rgba(59,130,246,.08)';
    wrap.innerHTML = '<button type="button" data-distance-checkpoint-save style="width:100%;min-height:48px;padding:12px 16px;border:1px solid rgba(96,165,250,.62);border-radius:12px;background:linear-gradient(135deg,#dbeafe,#bfdbfe);color:#172554;font-size:15px;font-weight:950;cursor:pointer">💾 保存</button><div data-distance-checkpoint-status style="margin-top:8px;color:#bfdbfe;font-size:12px;line-height:1.6;text-align:center">距離チェック結果と現在の設計を、この案件のチェックポイントとして保存します。</div>';

    wrap.querySelector('[data-distance-checkpoint-save]')?.addEventListener('click', () => {
      if (!saveCheckpoint()) {
        const status = wrap.querySelector('[data-distance-checkpoint-status]');
        if (status) status.textContent = '保存できませんでした。距離チェックをもう一度実行してください。';
      }
    });

    const guide = document.querySelector('#distance .distance-checklist-guide');
    if (guide) guide.insertAdjacentElement('beforebegin', wrap);
    else result.insertAdjacentElement('afterend', wrap);
    return wrap;
  }

  function renderSaveState() {
    const wrap = ensureSaveUi();
    if (!wrap) return;
    const button = wrap.querySelector('[data-distance-checkpoint-save]');
    const status = wrap.querySelector('[data-distance-checkpoint-status]');
    if (!button || !status) return;

    const state = currentState();
    if (state.saved) {
      button.textContent = '✓ 保存済み';
      button.disabled = true;
      button.style.cursor = 'default';
      button.style.background = 'linear-gradient(135deg,#dcfce7,#bbf7d0)';
      button.style.borderColor = 'rgba(34,197,94,.55)';
      button.style.color = '#14532d';
      status.textContent = 'この距離チェック結果は保存済みです。';
      return;
    }

    button.textContent = '💾 保存';
    button.disabled = false;
    button.style.cursor = 'pointer';
    button.style.background = 'linear-gradient(135deg,#dbeafe,#bfdbfe)';
    button.style.borderColor = 'rgba(96,165,250,.62)';
    button.style.color = '#172554';
    status.textContent = '距離チェック結果と現在の設計を、この案件のチェックポイントとして保存します。';
  }

  function install() {
    const result = document.getElementById('distanceResult');
    if (!result) return false;

    const refresh = () => setTimeout(renderSaveState, 140);
    const observer = new MutationObserver(refresh);
    observer.observe(result, { childList: true, subtree: true, characterData: true });
    refresh();

    window.addEventListener('pageshow', refresh);
    window.CampsiteDistanceCheckpoint = Object.freeze({
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
