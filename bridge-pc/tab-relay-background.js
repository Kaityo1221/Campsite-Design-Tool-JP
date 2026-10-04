(() => {
  'use strict';

  const REGISTER = 'CAMPSITE_WAYFARER_RELAY_REGISTER_V1';
  const CREATIVE_REQUEST = 'CAMPSITE_CREATIVE_RELAY_REQUEST_V1';
  const TO_WAYFARER = 'CAMPSITE_RELAY_TO_WAYFARER_ISOLATED_V1';
  const WAYFARER_RESPONSE = 'CAMPSITE_WAYFARER_RELAY_RESPONSE_V1';
  const TO_CREATIVE = 'CAMPSITE_RELAY_TO_CREATIVE_ISOLATED_V1';
  const OBSERVE_ACCEPTED_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1';
  const OBSERVE_RESULT_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_RESULT_V1';
  const FRESH_MS = 5000;
  const ROUTE_TTL_MS = 15000;
  const OBSERVE_ROUTE_TTL_MS = 120000;

  const wayfarerTabs = new Map();
  const routes = new Map();

  function now() { return Date.now(); }

  function isWayfarerUrl(url) {
    return /^https:\/\/wayfarer\.(?:scopely\.com|nianticlabs\.com)\//.test(String(url || ''));
  }

  function isCreativeUrl(url) {
    return /^https:\/\/kaityo1221\.github\.io\/Campsite-Design-Tool-JP\/creative\//.test(String(url || ''));
  }

  function cleanup() {
    const t = now();
    for (const [tabId, entry] of wayfarerTabs) {
      if (t - entry.lastSeen > FRESH_MS * 2) wayfarerTabs.delete(tabId);
    }
    for (const [relayId, route] of routes) {
      if (route.expiresAt <= t) routes.delete(relayId);
    }
  }

  function activeMapTabs() {
    cleanup();
    const t = now();
    return [...wayfarerTabs.entries()]
      .filter(([, entry]) => entry.mapPresent === true && t - entry.lastSeen <= FRESH_MS)
      .map(([tabId, entry]) => ({ tabId, ...entry }));
  }

  function deliverToCreative(tabId, relayId, payload) {
    try {
      chrome.tabs.sendMessage(tabId, { type: TO_CREATIVE, relayId, payload }, () => {
        void chrome.runtime.lastError;
      });
    } catch (_) {}
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const data = message || {};

    if (data.type === REGISTER) {
      const tabId = sender.tab?.id;
      if (!Number.isInteger(tabId) || !isWayfarerUrl(sender.url)) return false;
      wayfarerTabs.set(tabId, {
        mapPresent: data.mapPresent === true,
        url: String(sender.url || ''),
        lastSeen: now()
      });
      sendResponse?.({ ok:true });
      return false;
    }

    if (data.type === CREATIVE_REQUEST) {
      const creativeTabId = sender.tab?.id;
      const relayId = String(data.relayId || '');
      if (!Number.isInteger(creativeTabId) || !isCreativeUrl(sender.url) || !relayId) return false;

      const tabs = activeMapTabs();
      if (tabs.length !== 1) {
        deliverToCreative(creativeTabId, relayId, {
          relayError: tabs.length > 1
            ? 'Wayfarer Mapが複数タブで開いています。1つだけ残してください。'
            : '開いているWayfarer Mapを確認できません。Wayfarer Mapを1タブ開いてください。',
          mapTabCount: tabs.length
        });
        sendResponse?.({ ok:false, mapTabCount:tabs.length });
        return false;
      }

      routes.set(relayId, {
        creativeTabId,
        wayfarerTabId: tabs[0].tabId,
        expiresAt: now() + ROUTE_TTL_MS
      });

      try {
        chrome.tabs.sendMessage(tabs[0].tabId, {
          type: TO_WAYFARER,
          relayId,
          payload: data.payload || {}
        }, () => {
          const err = chrome.runtime.lastError;
          if (err) {
            routes.delete(relayId);
            deliverToCreative(creativeTabId, relayId, {
              relayError: 'Wayfarer Mapへの中継に失敗しました。タブを再読み込みしてください。'
            });
          }
        });
        sendResponse?.({ ok:true, mapTabCount:1 });
      } catch (_) {
        routes.delete(relayId);
        deliverToCreative(creativeTabId, relayId, {
          relayError: 'Wayfarer Mapへの中継に失敗しました。'
        });
        sendResponse?.({ ok:false, mapTabCount:1 });
      }
      return false;
    }

    if (data.type === WAYFARER_RESPONSE) {
      const relayId = String(data.relayId || '');
      const route = routes.get(relayId);
      const tabId = sender.tab?.id;
      if (!route || !Number.isInteger(tabId) || tabId !== route.wayfarerTabId || !isWayfarerUrl(sender.url)) return false;

      const payload = data.payload || {};
      const keepForObservationResult =
        payload.type === OBSERVE_ACCEPTED_TYPE &&
        payload.accepted === true;

      if (keepForObservationResult) {
        route.expiresAt = now() + OBSERVE_ROUTE_TTL_MS;
        routes.set(relayId, route);
      } else {
        routes.delete(relayId);
      }

      deliverToCreative(route.creativeTabId, relayId, payload);
      sendResponse?.({
        ok:true,
        retained:keepForObservationResult,
        final:payload.type === OBSERVE_RESULT_TYPE || !keepForObservationResult
      });
      return false;
    }

    return false;
  });

  try {
    chrome.tabs.onRemoved.addListener(tabId => {
      wayfarerTabs.delete(tabId);
      for (const [relayId, route] of routes) {
        if (route.creativeTabId === tabId || route.wayfarerTabId === tabId) routes.delete(relayId);
      }
    });
  } catch (_) {}
})();