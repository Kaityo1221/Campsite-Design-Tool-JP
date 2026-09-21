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
  let status = null;
  let busy = false;

  function setUi(state, message) {
    if (!button || !status) return;
    busy = state === 'busy';
    button.dataset.state = state;
    button.disabled = busy;
    button.textContent =
      state === 'busy' ? '🌉 送信中…' :
      state === 'success' ? '✅ Bridge完了' :
      state === 'error' ? '↻ Bridge再試行' :
      '🌉 Bridge';
    status.textContent = message || '';
    status.hidden = !message;
  }

  function startBridge() {
    if (busy) return;
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
    host.style.cssText = 'position:fixed;right:18px;bottom:18px;z-index:2147483646;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host{all:initial}
        .wrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;display:flex;flex-direction:column;align-items:flex-end;gap:8px}
        button{min-width:116px;min-height:44px;padding:0 15px;border:1px solid rgba(56,189,248,.72);border-radius:14px;background:linear-gradient(180deg,#0f2940,#071827);color:#e0f2fe;font:900 13px/1 system-ui;letter-spacing:.01em;box-shadow:0 8px 24px rgba(2,6,23,.34);cursor:pointer}
        button:hover{filter:brightness(1.08)}
        button:disabled{cursor:progress;opacity:.78}
        button[data-state="success"]{border-color:rgba(74,222,128,.75);background:linear-gradient(180deg,#14532d,#052e16);color:#dcfce7}
        button[data-state="error"]{border-color:rgba(251,191,36,.76);background:linear-gradient(180deg,#4b3212,#241707);color:#fef3c7}
        .status{max-width:320px;padding:9px 11px;border:1px solid rgba(148,163,184,.26);border-radius:11px;background:rgba(2,6,23,.94);color:#dbeafe;font:700 11px/1.55 system-ui;box-shadow:0 8px 24px rgba(2,6,23,.3)}
        .status[hidden]{display:none}
      </style>
      <div class="wrap">
        <div class="status" id="status" hidden aria-live="polite"></div>
        <button id="bridgeButton" type="button">🌉 Bridge</button>
      </div>
    `;
    button = shadow.getElementById('bridgeButton');
    status = shadow.getElementById('status');
    button.addEventListener('click', startBridge);
    document.documentElement.appendChild(host);
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
  }

  window.addEventListener(STATUS_EVENT, event => {
    let detail = null;
    try { detail = JSON.parse(String(event.detail || '{}')); }
    catch (_) { return; }

    const state = String(detail?.state || 'ready');
    const message = String(detail?.message || '');
    setUi(state, message);

    if (state === 'success') {
      setTimeout(() => {
        if (!busy) setUi('ready', '');
      }, 3500);
    }
  });

  syncVisibility();
  const observer = new MutationObserver(syncVisibility);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(syncVisibility, 1500);

  window.CampsiteBridgePcUi = Object.freeze({
    version: VERSION,
    startEvent: START_EVENT,
    statusEvent: STATUS_EVENT
  });
})();
