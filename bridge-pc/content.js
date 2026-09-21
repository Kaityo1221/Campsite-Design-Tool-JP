(() => {
  'use strict';

  const VERSION = '0.1.0';
  const SCHEMA_VERSION = '1.2';
  const REQUEST_EVENT = 'campsite-bridge-pc:collect';
  const RESPONSE_EVENT = 'campsite-bridge-pc:response';
  const RECEIVER_ORIGIN = 'https://kaityo1221.github.io';
  const RECEIVER_BASE = RECEIVER_ORIGIN + '/Campsite-Design-Tool-JP/bridge-receiver.html';
  const READY_TIMEOUT_MS = 12000;
  const ACK_TIMEOUT_MS = 6500;

  if (window.__campsiteBridgePcContentInstalled) return;
  window.__campsiteBridgePcContentInstalled = true;

  let host = null;
  let shadow = null;
  let button = null;
  let status = null;
  let busy = false;

  function id(prefix) {
    try {
      if (typeof crypto?.randomUUID === 'function') return prefix + '-' + crypto.randomUUID();
    } catch (_) {}
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function setUi(state, message) {
    if (!button || !status) return;
    button.dataset.state = state;
    button.disabled = state === 'busy';
    button.textContent =
      state === 'busy' ? '🌉 送信中…' :
      state === 'success' ? '✅ Bridge完了' :
      state === 'error' ? '↻ Bridge再試行' :
      '🌉 Bridge';
    status.textContent = message || '';
    status.hidden = !message;
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

  function collectSnapshot(requestId) {
    return new Promise((resolve, reject) => {
      let done = false;
      const finish = (fn, value) => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        window.removeEventListener(RESPONSE_EVENT, onResponse);
        fn(value);
      };
      const onResponse = event => {
        let detail = null;
        try { detail = JSON.parse(String(event.detail || '{}')); }
        catch (_) { return; }
        if (String(detail?.requestId || '') !== requestId) return;
        if (!detail.ok) {
          finish(reject, new Error(String(detail.error || 'POI取得に失敗しました。')));
          return;
        }
        finish(resolve, detail);
      };
      const timer = setTimeout(() => {
        finish(reject, new Error('Wayfarer Mapからの応答がありませんでした。'));
      }, 10000);

      window.addEventListener(RESPONSE_EVENT, onResponse);
      window.dispatchEvent(new CustomEvent(REQUEST_EVENT, {
        detail: JSON.stringify({ requestId })
      }));
    });
  }

  function writePreparingPage(popup) {
    try {
      popup.document.open();
      popup.document.write(
        '<!doctype html><meta charset="utf-8"><title>Campsite Bridge</title>' +
        '<body style="margin:0;background:#020617;color:#e2e8f0;font-family:system-ui;display:grid;place-items:center;min-height:100vh">' +
        '<div style="text-align:center"><div style="font-size:42px">🌉</div><strong>Campsite Bridge</strong><div style="margin-top:8px;color:#94a3b8;font-size:13px">WayfarerからPOIを準備しています…</div></div></body>'
      );
      popup.document.close();
    } catch (_) {}
  }

  function makePayload(snapshot, handshakeId) {
    return {
      type: 'CAMPSITE_BRIDGE_POI_V1',
      bridgeVersion: VERSION,
      schemaVersion: SCHEMA_VERSION,
      handshakeId,
      selectedBounds: snapshot.selectedBounds || null,
      autoContinue: true,
      pois: Array.isArray(snapshot.pois) ? snapshot.pois : []
    };
  }

  function runHandoff(popup, payload, handshakeId) {
    return new Promise((resolve, reject) => {
      let readyTimer = null;
      let ackTimer = null;
      let resendTimers = [];

      const cleanup = () => {
        clearTimeout(readyTimer);
        clearTimeout(ackTimer);
        resendTimers.forEach(clearTimeout);
        resendTimers = [];
        window.removeEventListener('message', onMessage);
      };

      const fail = message => {
        cleanup();
        reject(new Error(message));
      };

      const sendPayload = () => {
        try {
          popup.postMessage(payload, RECEIVER_ORIGIN);
        } catch (_) {}
      };

      const onMessage = event => {
        if (event.origin !== RECEIVER_ORIGIN) return;
        if (event.source && event.source !== popup) return;
        const data = event.data || {};
        if (String(data.handshakeId || '') !== handshakeId) return;

        if (data.type === 'CAMPSITE_BRIDGE_READY_V1') {
          clearTimeout(readyTimer);
          sendPayload();
          resendTimers.push(setTimeout(sendPayload, 800));
          resendTimers.push(setTimeout(sendPayload, 1800));
          clearTimeout(ackTimer);
          ackTimer = setTimeout(() => {
            fail('Campsiteから受信確認が返りませんでした。もう一度お試しください。');
          }, ACK_TIMEOUT_MS);
          return;
        }

        if (data.type === 'CAMPSITE_BRIDGE_ACK_V1') {
          if (data.accepted !== true) {
            fail('CampsiteがPOIを受け付けられませんでした。Wayfarer Mapを更新して再試行してください。');
            return;
          }
          cleanup();
          resolve({
            count: Number(data.count || 0),
            sourceCount: Number(data.sourceCount || payload.pois.length || 0)
          });
        }
      };

      window.addEventListener('message', onMessage);
      readyTimer = setTimeout(() => {
        fail('Campsite Bridge Receiverへ接続できませんでした。ポップアップ設定を確認して再試行してください。');
      }, READY_TIMEOUT_MS);

      const receiverUrl =
        RECEIVER_BASE +
        '?campsiteBridgeDev=1&handshake=' +
        encodeURIComponent(handshakeId);
      try {
        popup.location.href = receiverUrl;
      } catch (_) {
        fail('Campsite Bridge Receiverを開けませんでした。');
      }
    });
  }

  async function startBridge() {
    if (busy) return;
    busy = true;
    setUi('busy', 'Wayfarer MapからPOIを取得しています…');

    const handshakeId = id('pc');
    const requestId = id('collect');

    let popup = null;
    try {
      popup = window.open('about:blank', 'CampsiteBridgeReceiver_' + handshakeId, 'popup,width=560,height=820');
    } catch (_) {}

    if (!popup) {
      busy = false;
      setUi('error', 'ポップアップがブロックされました。Wayfarerでポップアップを許可して再試行してください。');
      return;
    }
    writePreparingPage(popup);

    try {
      const snapshot = await collectSnapshot(requestId);
      const pois = Array.isArray(snapshot.pois) ? snapshot.pois : [];
      if (!pois.length) {
        try { popup.close(); } catch (_) {}
        throw new Error('POIを取得できませんでした。Wayfarer Mapを表示してからもう一度お試しください。');
      }

      setUi('busy', pois.length.toLocaleString('ja-JP') + '件をCampsiteへ送信しています…');
      const payload = makePayload(snapshot, handshakeId);
      const result = await runHandoff(popup, payload, handshakeId);

      setUi('success', result.count.toLocaleString('ja-JP') + '件をCampsiteへ渡しました。Wayfarerはこのまま使えます。');
      setTimeout(() => {
        if (!busy) setUi('ready', '');
      }, 3500);
    } catch (error) {
      try {
        if (popup && !popup.closed && popup.location?.href === 'about:blank') popup.close();
      } catch (_) {}
      setUi('error', String(error?.message || error || 'Bridge送信に失敗しました。'));
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  syncVisibility();
  const observer = new MutationObserver(syncVisibility);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  setInterval(syncVisibility, 1500);

  window.CampsiteBridgePc = Object.freeze({
    version: VERSION,
    schemaVersion: SCHEMA_VERSION,
    receiver: RECEIVER_BASE
  });
})();
