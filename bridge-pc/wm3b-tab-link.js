(() => {
  'use strict';

  const VERSION = '0.1.0';
  const CHANNEL_NAME = 'campsite-wayfarer-observe-tabs-v1';
  const PING_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_PING_V1';
  const PONG_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_PONG_V1';
  const CREATIVE_ORIGINS = new Set([
    'https://kaityo1221.github.io'
  ]);

  if (window.__campsiteWm3bTabLinkInstalled) return;
  window.__campsiteWm3bTabLinkInstalled = true;

  function createId(prefix) {
    try {
      if (typeof crypto?.randomUUID === 'function') return prefix + '-' + crypto.randomUUID();
    } catch (_) {}
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  const TAB_ID = createId('wf-tab');
  const pending = new Map();
  let channel = null;

  function mapPresent() {
    return Boolean(document.querySelector('app-wf-base-map'));
  }

  function snapshot() {
    return {
      tabId: TAB_ID,
      mapPresent: mapPresent(),
      href: String(location.href || ''),
      visibility: String(document.visibilityState || 'unknown')
    };
  }

  function finishProbe(probeId) {
    const entry = pending.get(probeId);
    if (!entry) return null;
    pending.delete(probeId);
    clearTimeout(entry.timer);

    const tabs = [...entry.tabs.values()];
    const mapTabs = tabs.filter(tab => tab.mapPresent === true);
    const result = {
      verified: Boolean(channel),
      totalWayfarerTabs: tabs.length,
      mapTabCount: mapTabs.length,
      duplicateMapTabs: mapTabs.length > 1,
      tabs
    };
    entry.resolve(result);
    return result;
  }

  function probeMapTabs(timeoutMs = 220) {
    const self = snapshot();
    if (!channel) {
      return Promise.resolve({
        verified: false,
        totalWayfarerTabs: 1,
        mapTabCount: self.mapPresent ? 1 : 0,
        duplicateMapTabs: false,
        tabs: [self]
      });
    }

    const probeId = createId('probe');
    return new Promise(resolve => {
      const entry = {
        resolve,
        tabs: new Map([[TAB_ID, self]]),
        timer: null
      };
      entry.timer = setTimeout(() => finishProbe(probeId), Math.max(40, Number(timeoutMs) || 220));
      pending.set(probeId, entry);
      try {
        channel.postMessage({
          type: 'CAMPSITE_WAYFARER_TAB_PROBE_V1',
          probeId,
          fromTabId: TAB_ID
        });
      } catch (_) {
        finishProbe(probeId);
      }
    });
  }

  function installChannel() {
    if (typeof BroadcastChannel !== 'function') return null;
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = event => {
        const data = event?.data || {};
        if (data.type === 'CAMPSITE_WAYFARER_TAB_PROBE_V1') {
          if (String(data.fromTabId || '') === TAB_ID) return;
          try {
            channel.postMessage({
              type: 'CAMPSITE_WAYFARER_TAB_PRESENCE_V1',
              probeId: String(data.probeId || ''),
              tab: snapshot()
            });
          } catch (_) {}
          return;
        }

        if (data.type !== 'CAMPSITE_WAYFARER_TAB_PRESENCE_V1') return;
        const probeId = String(data.probeId || '');
        const entry = pending.get(probeId);
        const tab = data.tab && typeof data.tab === 'object' ? data.tab : null;
        const tabId = String(tab?.tabId || '');
        if (!entry || !tabId) return;
        entry.tabs.set(tabId, {
          tabId,
          mapPresent: tab?.mapPresent === true,
          href: String(tab?.href || ''),
          visibility: String(tab?.visibility || 'unknown')
        });
      };
    } catch (_) {
      channel = null;
    }
    return channel;
  }

  async function replyToCreative(event, data) {
    if (!CREATIVE_ORIGINS.has(event.origin)) return false;
    if (!event.source || typeof event.source.postMessage !== 'function') return false;

    const requestId = String(data?.requestId || '');
    if (!requestId) return false;

    const tabs = await probeMapTabs();
    const duplicateMessage = tabs.duplicateMapTabs
      ? 'Wayfarer Mapが複数タブで開いています。1つだけ残してから再確認してください。'
      : '';

    try {
      event.source.postMessage({
        type: PONG_TYPE,
        requestId,
        bridgeVersion: VERSION,
        wayfarerOrigin: String(location.origin || ''),
        mapPresent: mapPresent(),
        tabCountVerified: tabs.verified,
        totalWayfarerTabs: tabs.totalWayfarerTabs,
        mapTabCount: tabs.mapTabCount,
        duplicateMapTabs: tabs.duplicateMapTabs,
        warning: duplicateMessage
      }, event.origin);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function onMessage(event) {
    if (!CREATIVE_ORIGINS.has(event.origin)) return;
    const data = event.data || {};
    if (data.type !== PING_TYPE) return;
    await replyToCreative(event, data);
  }

  installChannel();
  window.addEventListener('message', event => {
    void onMessage(event);
  });

  window.CampsiteWayfarerTabLink = Object.freeze({
    version: VERSION,
    channelName: CHANNEL_NAME,
    pingType: PING_TYPE,
    pongType: PONG_TYPE,
    tabId: TAB_ID,
    mapPresent,
    probeMapTabs
  });
})();