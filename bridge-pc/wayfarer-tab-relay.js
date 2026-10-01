(() => {
  'use strict';

  const REGISTER = 'CAMPSITE_WAYFARER_RELAY_REGISTER_V1';
  const TO_WAYFARER = 'CAMPSITE_RELAY_TO_WAYFARER_ISOLATED_V1';
  const WAYFARER_RESPONSE = 'CAMPSITE_WAYFARER_RELAY_RESPONSE_V1';
  const TO_MAIN = 'CAMPSITE_EXTENSION_TO_WAYFARER_MAIN_V1';
  const FROM_MAIN = 'CAMPSITE_WAYFARER_MAIN_TO_EXTENSION_V1';

  function mapPresent() {
    return Boolean(document.querySelector('app-wf-base-map'));
  }

  function register() {
    try {
      chrome.runtime.sendMessage({ type:REGISTER, mapPresent:mapPresent() }, () => {
        void chrome.runtime.lastError;
      });
    } catch (_) {}
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const data = message || {};
    if (data.type !== TO_WAYFARER) return false;
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

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data || {};
    if (data.type !== FROM_MAIN) return;
    const relayId = String(data.relayId || '');
    if (!relayId) return;
    try {
      chrome.runtime.sendMessage({
        type: WAYFARER_RESPONSE,
        relayId,
        payload: data.payload || {}
      }, () => { void chrome.runtime.lastError; });
    } catch (_) {}
  });

  register();
  setInterval(register, 1500);
})();