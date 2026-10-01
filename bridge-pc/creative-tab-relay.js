(() => {
  'use strict';

  const FROM_MAIN = 'CAMPSITE_CREATIVE_MAIN_TO_EXTENSION_V1';
  const CREATIVE_REQUEST = 'CAMPSITE_CREATIVE_RELAY_REQUEST_V1';
  const TO_CREATIVE = 'CAMPSITE_RELAY_TO_CREATIVE_ISOLATED_V1';
  const TO_MAIN = 'CAMPSITE_EXTENSION_TO_CREATIVE_MAIN_V1';

  window.addEventListener('message', event => {
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
      }, () => { void chrome.runtime.lastError; });
    } catch (_) {}
  });

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
})();