(() => {
  'use strict';

  const FROM_MAIN = 'CAMPSITE_CREATIVE_MAIN_TO_EXTENSION_V1';
  const CREATIVE_REQUEST = 'CAMPSITE_CREATIVE_RELAY_REQUEST_V1';
  const TO_CREATIVE = 'CAMPSITE_RELAY_TO_CREATIVE_ISOLATED_V1';
  const TO_MAIN = 'CAMPSITE_EXTENSION_TO_CREATIVE_MAIN_V1';

  function forwardFromMain(event) {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data || {};
    if (data.type !== FROM_MAIN) return;
    const relayId = String(data.relayId || '');
    if (!relayId) return;
    try {
      chrome.runtime.sendMessage({
        type: CREATIVE_REQUEST,
        relayId,
        payload: data.payload || {}
      }, response => {
        const err = chrome.runtime.lastError;
        if (err) {
          window.postMessage({
            type: TO_MAIN,
            relayId,
            payload: {
              relayError: 'Creative Relayから拡張機能へ接続できませんでした。拡張機能を再読み込みしてください。'
            }
          }, location.origin);
          return;
        }
        if (response?.ok === false && response?.mapTabCount === 0) {
          window.postMessage({
            type: TO_MAIN,
            relayId,
            payload: {
              relayError: '開いているWayfarer Mapを確認できません。Wayfarer Mapを1タブ開いて再読み込みしてください。'
            }
          }, location.origin);
        }
      });
    } catch (_) {
      try {
        window.postMessage({
          type: TO_MAIN,
          relayId,
          payload: {
            relayError: 'Creative Relayの送信に失敗しました。拡張機能を再読み込みしてください。'
          }
        }, location.origin);
      } catch (_) {}
    }
  }

  function ensureWindowListener() {
    try {
      window.removeEventListener('message', forwardFromMain);
      window.addEventListener('message', forwardFromMain);
      return true;
    } catch (_) {
      return false;
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const data = message || {};
    if (data.type !== TO_CREATIVE) return false;
    const relayId = String(data.relayId || '');
    if (!relayId) return false;
    window.postMessage({
      type: TO_MAIN,
      relayId,
      payload: data.payload || {}
    }, location.origin);
    sendResponse?.({ ok:true });
    return false;
  });

  ensureWindowListener();

  // Creative rewrites the document during boot. document.open()/close() can
  // drop window message listeners even though the isolated extension context
  // itself survives, so re-attach the bridge for a short boot window.
  let checks = 0;
  const timer = setInterval(() => {
    checks += 1;
    ensureWindowListener();
    if (checks >= 80) clearInterval(timer);
  }, 250);

  try {
    window.addEventListener('pageshow', ensureWindowListener);
  } catch (_) {}
})();