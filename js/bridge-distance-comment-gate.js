(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  let bypassNextClick = false;
  let activeButton = null;

  function readProject() {
    try { return JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function writeProject(project) {
    project.updatedAt = new Date().toISOString();
    sessionStorage.setItem(PROJECT_KEY, JSON.stringify(project));
  }

  function missingComments(project) {
    const items = project?.distanceResult?.missingCommentPois;
    return Array.isArray(items) ? items : [];
  }

  function closeGate() {
    document.getElementById('campsiteDistanceCommentGate')?.remove();
    activeButton = null;
  }

  function returnToCreative() {
    const latest = readProject();
    if (!latest || latest.source !== 'bridge') return;
    latest.phase = 'design';
    latest.rework = {
      requestedAt: new Date().toISOString(),
      source: 'distance-comment-warning'
    };
    writeProject(latest);
    location.href = './creative/index.html?campsiteProject=bridge';
  }

  function continueToPreSubmit() {
    const button = activeButton;
    closeGate();
    if (!button?.isConnected) return;
    bypassNextClick = true;
    button.click();
  }

  function showGate(count, button) {
    closeGate();
    activeButton = button;

    const overlay = document.createElement('div');
    overlay.id = 'campsiteDistanceCommentGate';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'campsiteDistanceCommentGateTitle');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(2,6,23,.72);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)';
    overlay.innerHTML = `
      <div style="width:min(380px,100%);padding:24px 20px 18px;border:1px solid rgba(245,158,11,.52);border-radius:22px;background:linear-gradient(180deg,#fffaf0,#fff2d2);box-shadow:0 22px 60px rgba(0,0,0,.36);color:#493514;text-align:center">
        <div style="font-size:34px;line-height:1;margin-bottom:12px">⚠️</div>
        <div id="campsiteDistanceCommentGateTitle" style="font-size:19px;font-weight:950;line-height:1.55">コメントのない50m未満があります。</div>
        <div style="margin:10px 0 18px;font-size:13px;font-weight:700;line-height:1.75;color:#76591f">50m未満の新規候補でコメント未入力が${count}件あります。<br>CREATIVE MODEに戻って確認しますか？<br><span style="font-weight:600;color:#8b7446">コメントは必須ではありません。</span></div>
        <button type="button" data-comment-gate-back style="width:100%;min-height:48px;border:1px solid #a9791f;border-radius:13px;background:linear-gradient(180deg,#f8dc83,#d9a83c);color:#493514;font-size:15px;font-weight:950;cursor:pointer">戻って確認</button>
        <button type="button" data-comment-gate-continue style="width:100%;min-height:46px;margin-top:9px;border:1px solid rgba(73,53,20,.22);border-radius:13px;background:#fffaf0;color:#675635;font-size:14px;font-weight:850;cursor:pointer">このまま進む</button>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('[data-comment-gate-back]')?.addEventListener('click', returnToCreative);
    overlay.querySelector('[data-comment-gate-continue]')?.addEventListener('click', continueToPreSubmit);
  }

  function onPreSubmitClick(event) {
    const button = event.target.closest?.('[data-go-pre-submit]');
    if (!button) return;

    if (bypassNextClick) {
      bypassNextClick = false;
      return;
    }

    const project = readProject();
    if (!project || project.source !== 'bridge') return;
    const missing = missingComments(project);
    if (!missing.length) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showGate(missing.length, button);
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get('campsiteProject') !== 'bridge') return;
    document.addEventListener('click', onPreSubmitClick, true);
    window.CampsiteDistanceCommentGate = Object.freeze({
      getMissingCount: () => missingComments(readProject()).length,
      close: closeGate
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
