(() => {
  'use strict';

  const STYLE_ID = 'postCompletionHubStyles';
  const HUB_CLASS = 'post-completion-hub';
  const WORKFLOW_RESUME_KEY = 'campsiteWorkflowResumeV1';

  function clearWorkflowResumeState() {
    try {
      localStorage.removeItem(WORKFLOW_RESUME_KEY);
    } catch (_) {}
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .${HUB_CLASS}{margin:14px 0 16px;padding:14px;border:1px solid rgba(56,189,248,.28);border-radius:15px;background:linear-gradient(145deg,rgba(14,165,233,.08),rgba(99,102,241,.07));text-align:left}
      .${HUB_CLASS}-title{margin:0 0 9px;color:#e0f2fe;font-size:13px;font-weight:900;letter-spacing:.02em}
      .${HUB_CLASS}-steps{display:grid;gap:8px;margin:0;padding:0;list-style:none}
      .${HUB_CLASS}-step{display:grid;grid-template-columns:28px 1fr;gap:9px;align-items:start;padding:9px 10px;border:1px solid rgba(148,163,184,.16);border-radius:12px;background:rgba(15,23,42,.38)}
      .${HUB_CLASS}-step span{display:grid;place-items:center;width:28px;height:28px;border-radius:999px;background:rgba(56,189,248,.14);color:#7dd3fc;font-size:12px;font-weight:900}
      .${HUB_CLASS}-step strong{display:block;color:#f8fafc;font-size:12px;line-height:1.45}
      .${HUB_CLASS}-step small{display:block;margin-top:2px;color:#94a3b8;font-size:10px;line-height:1.5}
      .${HUB_CLASS}-note{margin:10px 0 0;color:#cbd5e1;font-size:10px;line-height:1.6}
      #returnModal .return-action-button.distance{order:1}
      #returnModal .return-action-button.checklist{order:2}
      #returnModal .return-action-button.continue{order:3}
      @media(max-width:520px){.${HUB_CLASS}{padding:12px}.${HUB_CLASS}-step{padding:8px 9px}}
    `;
    document.head.appendChild(style);
  }

  function enhanceReturnModal() {
    const modal = document.getElementById('returnModal');
    if (!modal || modal.dataset.postCompletionEnhanced === '1') return false;

    const message = modal.querySelector('.return-modal-message');
    const actions = modal.querySelector('.return-modal-actions');
    const continueButton = modal.querySelector('.return-action-button.continue');
    if (!message || !actions || !continueButton) return false;

    modal.dataset.postCompletionEnhanced = '1';

    message.innerHTML = `
      Google My Mapsでの設計が終わったら、<br>
      <strong>完成KMZを書き出してから</strong>次の確認へ進みます。
    `;

    const hub = document.createElement('div');
    hub.className = HUB_CLASS;
    hub.setAttribute('aria-label', '完成後の作業順');
    hub.innerHTML = `
      <p class="${HUB_CLASS}-title">完成後はこの順番です</p>
      <ol class="${HUB_CLASS}-steps">
        <li class="${HUB_CLASS}-step"><span>1</span><div><strong>完成KMZを用意</strong><small>Google My Mapsから最新の完成版を書き出します。</small></div></li>
        <li class="${HUB_CLASS}-step"><span>2</span><div><strong>距離チェック</strong><small>追加POI・活動範囲・距離条件を確認します。</small></div></li>
        <li class="${HUB_CLASS}-step"><span>3</span><div><strong>提出前確認</strong><small>チェックリストで最後の抜け漏れを確認します。</small></div></li>
      </ol>
      <p class="${HUB_CLASS}-note">まだ配置を直したい場合は、下の「My Mapsで設計を続ける」から戻れます。</p>
    `;
    actions.before(hub);

    const title = continueButton.querySelector('strong');
    const note = continueButton.querySelector('small');
    if (title) title.textContent = 'My Mapsで設計を続ける';
    if (note) note.textContent = '追加POIや活動範囲の調整へ戻ります';

    continueButton.removeAttribute('onclick');
    continueButton.addEventListener('click', () => {
      if (typeof window.openGoogleMyMaps === 'function') {
        window.openGoogleMyMaps();
      }
      if (typeof window.closeReturnModal === 'function') {
        window.closeReturnModal();
      }
    });

    return true;
  }

  function setup() {
    clearWorkflowResumeState();
    ensureStyles();
    if (enhanceReturnModal()) return;

    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      if (enhanceReturnModal() || Date.now() - startedAt > 5000) {
        window.clearInterval(timer);
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
