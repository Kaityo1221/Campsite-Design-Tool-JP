(() => {
  'use strict';

  const VERSION = '0.2.0';
  const CHANNEL_NAME = 'campsite-wayfarer-observe-tabs-v1';
  const PING_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_PING_V1';
  const PONG_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_PONG_V1';
  const OBSERVE_REQUEST_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1';
  const OBSERVE_ACCEPTED_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1';
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
  const DIAG_ID = 'campsiteWm3bDiagBadge';

  function ensureDiagnosticBadge() {
    try {
      let badge = document.getElementById(DIAG_ID);
      if (!badge) {
        badge = document.createElement('div');
        badge.id = DIAG_ID;
        badge.style.cssText =
          'position:fixed;right:12px;bottom:84px;z-index:2147483000;padding:9px 11px;' +
          'border:2px solid #315f2f;border-radius:12px;background:rgba(238,247,231,.97);' +
          'color:#244224;font:900 11px/1.35 system-ui;box-shadow:0 6px 18px rgba(0,0,0,.24);' +
          'pointer-events:none';
        document.documentElement.appendChild(badge);
      }
      badge.textContent = '🧪 Bridge ' + VERSION + ' / 接続待受中';
      badge.dataset.state = 'listening';
      return badge;
    } catch (_) {
      return null;
    }
  }

  function setDiagnosticBadge(text, state = '') {
    const badge = ensureDiagnosticBadge();
    if (!badge) return;
    badge.textContent = text;
    badge.dataset.state = state;
  }


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

  function normalizePolygon(input) {
    const polygon = (Array.isArray(input) ? input : []).map(point => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const lat = Number(point[0]);
      const lng = Number(point[1]);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    }).filter(Boolean);
    return polygon.length >= 3 && polygon.length <= 30 ? polygon : [];
  }

  function observationApi() {
    const api = window.CampsiteWayfarerObserveController;
    return api?.runPolygon ? api : null;
  }

  function postObserveAccepted(event, requestId, payload = {}) {
    try {
      event.source.postMessage({
        type: OBSERVE_ACCEPTED_TYPE,
        requestId,
        bridgeVersion: VERSION,
        ...payload
      }, event.origin);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function handleObserveRequest(event, data) {
    if (!CREATIVE_ORIGINS.has(event.origin)) return false;
    if (!event.source || typeof event.source.postMessage !== 'function') return false;

    const requestId = String(data?.requestId || '');
    const polygon = normalizePolygon(data?.polygon);
    if (!requestId) return false;
    if (!polygon.length) {
      return postObserveAccepted(event, requestId, {
        accepted: false,
        error: 'Creative Modeの設計範囲を確認できませんでした。'
      });
    }

    const tabs = await probeMapTabs();
    if (tabs.duplicateMapTabs) {
      return postObserveAccepted(event, requestId, {
        accepted: false,
        warning: 'Wayfarer Mapが複数タブで開いています。1つだけ残してから再確認してください。'
      });
    }
    if (!tabs.verified) {
      return postObserveAccepted(event, requestId, {
        accepted: false,
        warning: 'Wayfarer Mapのタブ状態を確認できませんでした。'
      });
    }
    if (!mapPresent()) {
      return postObserveAccepted(event, requestId, {
        accepted: false,
        warning: 'Wayfarer Map画面を開いてから再確認してください。'
      });
    }

    const api = observationApi();
    if (!api) {
      return postObserveAccepted(event, requestId, {
        accepted: false,
        error: 'Wayfarer観察Engineを確認できませんでした。'
      });
    }
    if (api.getState?.().busy === true) {
      return postObserveAccepted(event, requestId, {
        accepted: false,
        warning: 'Wayfarerで別の観察処理を実行中です。'
      });
    }

    const acknowledged = postObserveAccepted(event, requestId, {
      accepted: true,
      observationStarted: true,
      polygonVertexCount: polygon.length
    });
    if (!acknowledged) return false;

    void api.runPolygon(polygon).catch(error => {
      console.error('[Campsite Wayfarer Observe] remote polygon observation failed', error);
    });
    return true;
  }

  async function replyToCreative(event, data) {
    setDiagnosticBadge('🧪 Bridge ' + VERSION + ' / PING受信', 'ping');
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
      setDiagnosticBadge('🧪 Bridge ' + VERSION + ' / PONG送信済み', 'pong');
      setTimeout(() => setDiagnosticBadge('🧪 Bridge ' + VERSION + ' / 接続待受中', 'listening'), 1600);
      return true;
    } catch (_) {
      setDiagnosticBadge('🧪 Bridge ' + VERSION + ' / PONG送信失敗', 'error');
      return false;
    }
  }

  async function onMessage(event) {
    if (!CREATIVE_ORIGINS.has(event.origin)) return;
    const data = event.data || {};
    if (data.type === PING_TYPE) {
      await replyToCreative(event, data);
      return;
    }
    if (data.type === OBSERVE_REQUEST_TYPE) {
      await handleObserveRequest(event, data);
    }
  }

  installChannel();
  ensureDiagnosticBadge();
  setTimeout(ensureDiagnosticBadge, 800);
  setTimeout(ensureDiagnosticBadge, 2500);
  window.addEventListener('message', event => {
    void onMessage(event);
  });

  window.CampsiteWayfarerTabLink = Object.freeze({
    version: VERSION,
    channelName: CHANNEL_NAME,
    pingType: PING_TYPE,
    pongType: PONG_TYPE,
    observeRequestType: OBSERVE_REQUEST_TYPE,
    observeAcceptedType: OBSERVE_ACCEPTED_TYPE,
    tabId: TAB_ID,
    mapPresent,
    probeMapTabs,
    ensureDiagnosticBadge
  });
})();