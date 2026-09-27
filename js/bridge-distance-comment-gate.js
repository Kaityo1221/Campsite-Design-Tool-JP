(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';

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

  function syncInlineWarning() {
    const warning = document.getElementById('campsiteDistanceCommentWarning');
    if (!warning) return;
    const title = warning.children?.[0];
    const detail = warning.children?.[1];
    if (title) {
      const project = readProject();
      const count = missingComments(project).length;
      if (count) title.textContent = `⚠️ 50m未満の候補地のうち、コメント未入力が${count}件あります。`;
    }
    if (detail) {
      detail.textContent = '50m未満の候補地には理由コメントの入力をお願いします。CREATIVE MODEに戻って、ひとこと理由を添えてください。';
    }
  }

  function showGate(count) {
    closeGate();

    const overlay = document.createElement('div');
    overlay.id = 'campsiteDistanceCommentGate';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'campsiteDistanceCommentGateTitle');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:22px;background:rgba(2,6,23,.72);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)';
    overlay.innerHTML = `
      <div style="width:min(380px,100%);padding:24px 20px 18px;border:1px solid rgba(245,158,11,.52);border-radius:22px;background:linear-gradient(180deg,#fffaf0,#fff2d2);box-shadow:0 22px 60px rgba(0,0,0,.36);color:#493514;text-align:center">
        <div style="font-size:34px;line-height:1;margin-bottom:12px">⚠️</div>
        <div id="campsiteDistanceCommentGateTitle" style="font-size:19px;font-weight:950;line-height:1.55">50m未満の候補地にはコメントが必要です。</div>
        <div style="margin:10px 0 18px;font-size:13px;font-weight:700;line-height:1.75;color:#76591f">コメント未入力が${count}件あります。<br>お手数ですが、CREATIVE MODEに戻って、ひとこと理由を添えてください。</div>
        <button type="button" data-comment-gate-back style="width:100%;min-height:48px;border:1px solid #a9791f;border-radius:13px;background:linear-gradient(180deg,#f8dc83,#d9a83c);color:#493514;font-size:15px;font-weight:950;cursor:pointer">戻ってコメントを書く</button>
      </div>`;

    document.body.appendChild(overlay);
    overlay.querySelector('[data-comment-gate-back]')?.addEventListener('click', returnToCreative);
  }

  function onPreSubmitClick(event) {
    const button = event.target.closest?.('[data-go-pre-submit]');
    if (!button) return;

    const project = readProject();
    if (!project || project.source !== 'bridge') return;
    if (project?.distanceResult?.stale === true) return;
    const missing = missingComments(project);
    if (!missing.length) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    showGate(missing.length);
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get('campsiteProject') !== 'bridge') return;
    document.addEventListener('click', onPreSubmitClick, true);
    syncInlineWarning();
    new MutationObserver(syncInlineWarning).observe(document.body, { childList: true, subtree: true });
    window.CampsiteDistanceCommentGate = Object.freeze({
      getMissingCount: () => missingComments(readProject()).length,
      close: closeGate
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
