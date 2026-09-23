(() => {
  'use strict';

  const VERSION = '0.1.0';
  const START_EVENT = 'campsite-bridge-pc:start';
  const STATUS_EVENT = 'campsite-bridge-pc:status';

  if (window.__campsiteBridgePcContentInstalled) return;
  window.__campsiteBridgePcContentInstalled = true;

  let host = null;
  let shadow = null;
  let button = null;
  let buttonLabel = null;
  let countBadge = null;
  let status = null;
  let busy = false;
  let lastCount = 0;

  function isVisibleElement(element) {
    if (!element?.getBoundingClientRect) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.right > 0;
  }

  function findSidebarCommunityAnchor() {
    let best = null;
    let bestScore = Infinity;
    for (const element of document.querySelectorAll('button,[role="button"],a,li,div')) {
      if (!isVisibleElement(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.left > 240 || rect.width < 54 || rect.width > 230 || rect.height < 24 || rect.height > 90) continue;

      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      const label = [
        element.getAttribute?.('aria-label') || '',
        element.getAttribute?.('title') || '',
        text
      ].join(' ').replace(/\s+/g, ' ').trim();
      if (!/(^|\s)(コミュニティ|Community)(\s|$)/i.test(label)) continue;

      const exactText = /^(コミュニティ|Community)$/i.test(text);
      const score = Math.abs(rect.height - 44) + Math.abs(rect.left - 8) * 0.15 + (exactText ? 0 : 35);
      if (score < bestScore) {
        best = element;
        bestScore = score;
      }
    }
    return best;
  }

  function positionHost() {
    if (!host || !mapPresent()) return;
    const anchor = findSidebarCommunityAnchor();
    if (!anchor) {
      host.style.visibility = 'hidden';
      host.dataset.anchor = 'waiting-community';
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const edge = 6;
    const left = Math.max(edge, Math.round(rect.left));
    const width = Math.max(92, Math.min(190, Math.round(rect.width)));
    const top = Math.max(edge, Math.round(rect.bottom + 6));

    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';
    host.style.width = `${width}px`;
    host.style.visibility = 'visible';
    host.dataset.anchor = 'sidebar-community';
  }

  function renderButton(state) {
    if (!button || !buttonLabel || !countBadge) return;
    button.dataset.state = state;
    button.disabled = busy;
    buttonLabel.textContent =
      state === 'busy' ? '🌉 送信中…' :
      state === 'success' ? '✅ Bridge完了' :
      state === 'error' ? '↻ Bridge再試行' :
      '🌉 Bridge';
    countBadge.textContent = lastCount.toLocaleString('ja-JP');
    countBadge.hidden = lastCount <= 0;
  }

  function setUi(state, message, count) {
    if (!button || !status) return;
    busy = state === 'busy';
    const numericCount = Number(count);
    if (Number.isFinite(numericCount) && numericCount >= 0) lastCount = numericCount;
    renderButton(state);
    status.textContent = message || '';
    status.hidden = !message;
    positionHost();
  }

  function startBridge() {
    if (busy) return;
    lastCount = 0;
    renderButton('ready');
    // Keep the CustomEvent synchronous with the button click. The MAIN-world
    // listener opens the Receiver while transient user activation is available.
    window.dispatchEvent(new CustomEvent(START_EVENT, {
      detail: JSON.stringify({ startedAt: new Date().toISOString() })
    }));
  }

  function createUi() {
    if (host && document.contains(host)) return;

    host = document.createElement('div');
    host.id = 'campsite-bridge-pc-root';
    host.style.cssText = 'position:fixed;z-index:2147483646;visibility:hidden;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host{all:initial}
        .wrap{position:relative;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;display:flex;flex-direction:column;gap:7px;width:100%}
        button{width:100%;min-height:42px;padding:0 10px;border:1px solid rgba(56,189,248,.5);border-radius:10px;background:rgba(15,23,42,.96);color:#e0f2fe;font:900 12px/1 system-ui;letter-spacing:.01em;box-shadow:0 5px 18px rgba(2,6,23,.25);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:7px}
        button:hover{filter:brightness(1.08)}
        button:disabled{cursor:progress;opacity:.78}
        button[data-state="success"]{border-color:rgba(74,222,128,.65);background:rgba(20,83,45,.96);color:#dcfce7}
        button[data-state="error"]{border-color:rgba(251,191,36,.7);background:rgba(75,50,18,.97);color:#fef3c7}
        .count{min-width:25px;padding:4px 6px;border-radius:999px;background:rgba(56,189,248,.16);border:1px solid rgba(56,189,248,.32);color:#bae6fd;font:900 10px/1 system-ui;text-align:center}
        .count[hidden]{display:none}
        .status{position:absolute;left:calc(100% + 8px);top:0;width:260px;padding:9px 11px;border:1px solid rgba(148,163,184,.26);border-radius:11px;background:rgba(2,6,23,.96);color:#dbeafe;font:700 11px/1.55 system-ui;box-shadow:0 8px 24px rgba(2,6,23,.3)}
        .status[hidden]{display:none}
      </style>
      <div class="wrap">
        <button id="bridgeButton" type="button"><span id="bridgeLabel">🌉 Bridge</span><span class="count" id="bridgeCount" hidden>0</span></button>
        <div class="status" id="status" hidden aria-live="polite"></div>
      </div>
    `;
    button = shadow.getElementById('bridgeButton');
    buttonLabel = shadow.getElementById('bridgeLabel');
    countBadge = shadow.getElementById('bridgeCount');
    status = shadow.getElementById('status');
    button.addEventListener('click', startBridge);
    document.documentElement.appendChild(host);
    renderButton('ready');
  }

  function mapPresent() {
    return Boolean(document.querySelector('app-wf-base-map'));
  }

  function syncVisibility() {
    if (!mapPresent()) {
      if (host) host.style.display = 'none';
      return;
    }
    createUi();
    host.style.display = '';
    positionHost();
  }

  window.addEventListener(STATUS_EVENT, event => {
    let detail = null;
    try { detail = JSON.parse(String(event.detail || '{}')); }
    catch (_) { return; }

    const state = String(detail?.state || 'ready');
    const message = String(detail?.message || '');
    const count = detail?.count ?? detail?.sourceCount;
    setUi(state, message, count);

    if (state === 'success') {
      setTimeout(() => {
        if (!busy) setUi('ready', '', lastCount);
      }, 3500);
    }
  });

  window.addEventListener('resize', positionHost, { passive:true });
  window.addEventListener('scroll', positionHost, { passive:true });

  syncVisibility();
  const observer = new MutationObserver(syncVisibility);
  observer.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:['class','style','aria-expanded'] });
  setInterval(syncVisibility, 1500);

  window.CampsiteBridgePcUi = Object.freeze({
    version: VERSION,
    startEvent: START_EVENT,
    statusEvent: STATUS_EVENT
  });
})();
