(() => {
  'use strict';

  const VERSION = '0.2.0';
  const PROJECT_KEY = 'campsiteProject.v1';
  const WAYFARER_URL = 'https://wayfarer.scopely.com/new/mapview';
  const WAYFARER_ORIGINS = new Set([
    'https://wayfarer.scopely.com',
    'https://wayfarer.nianticlabs.com'
  ]);
  const WINDOW_NAME = 'CampsiteWayfarerObserve';
  const PING_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_PING_V1';
  const PONG_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_PONG_V1';
  const OBSERVE_REQUEST_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1';
  const OBSERVE_ACCEPTED_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1';
  const OBSERVE_RESULT_TYPE = 'CAMPSITE_WAYFARER_OBSERVE_RESULT_V1';
  const RELAY_FROM_MAIN_TYPE = 'CAMPSITE_CREATIVE_MAIN_TO_EXTENSION_V1';
  const RELAY_TO_MAIN_TYPE = 'CAMPSITE_EXTENSION_TO_CREATIVE_MAIN_V1';
  const TIMEOUT_MS = 4500;
  const OBSERVE_RESULT_TIMEOUT_MS = 120000;

  if (window.__campsiteWm3b2bCreativeTestInstalled) return;
  window.__campsiteWm3b2bCreativeTestInstalled = true;

  let wayfarerWindow = null;
  let pending = null;
  let state = {
    status: 'idle',
    connected: false,
    duplicateMapTabs: false,
    message: 'WM-3B-2 TEST 準備完了'
  };

  function createId(prefix) {
    try {
      if (typeof crypto?.randomUUID === 'function') return prefix + '-' + crypto.randomUUID();
    } catch (_) {}
    return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  function readProject() {
    try {
      const project = JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null');
      return project && project.source === 'bridge' ? project : null;
    } catch (_) {
      return null;
    }
  }

  function syncAndReadProject() {
    try {
      const current = readProject();
      if (current && typeof window.syncCampsiteProjectFromCreative === 'function') {
        window.syncCampsiteProjectFromCreative(current);
      }
    } catch (_) {}
    return readProject();
  }

  function normalizePolygon(project) {
    const raw = Array.isArray(project?.polygon) ? project.polygon : [];
    const polygon = raw.map(point => {
      if (!Array.isArray(point) || point.length < 2) return null;
      const lat = Number(point[0]);
      const lng = Number(point[1]);
      return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
    }).filter(Boolean);
    return polygon.length >= 3 && polygon.length <= 30 ? polygon : [];
  }

  function cloneJson(value, fallback) {
    try { return JSON.parse(JSON.stringify(value)); }
    catch (_) { return fallback; }
  }

  function samePolygon(a, b) {
    return JSON.stringify(normalizePolygon({ polygon:a })) ===
      JSON.stringify(normalizePolygon({ polygon:b }));
  }

  function normalizeObservationResult(raw) {
    if (!raw || typeof raw !== 'object') {
      throw new Error('Wayfarer観察結果の形式が正しくありません。');
    }
    const polygon = normalizePolygon({ polygon:raw.polygon });
    if (!polygon.length) throw new Error('Wayfarer観察結果のPolygonを確認できませんでした。');

    const zones = raw.zones && typeof raw.zones === 'object' ? raw.zones : {};
    if (
      !Array.isArray(zones.interior) ||
      !Array.isArray(zones.reference100) ||
      !Array.isArray(zones.reserve200)
    ) {
      throw new Error('Wayfarer観察結果のゾーン情報を確認できませんでした。');
    }

    return {
      version:String(raw.version || '0.1.0'),
      observedAt:String(raw.observedAt || new Date().toISOString()),
      polygon,
      counts:cloneJson(raw.counts || {}, {}),
      zones:{
        interior:cloneJson(zones.interior, []),
        reference100:cloneJson(zones.reference100, []),
        reserve200:cloneJson(zones.reserve200, [])
      },
      visibleTotal:Number(raw.visibleTotal || 0),
      retainedTotal:Number(raw.retainedTotal || 0),
      excludedCount:Number(raw.excludedCount || 0),
      outsideCount:Number(raw.outsideCount || 0),
      canProceed:raw.canProceed === true,
      acquisition:cloneJson(raw.acquisition || {}, {})
    };
  }

  function saveObservationResult(raw) {
    const project = readProject();
    if (!project) throw new Error('campsiteProject.v1 を確認できませんでした。');

    const observation = normalizeObservationResult(raw);
    if (!samePolygon(project.polygon, observation.polygon)) {
      throw new Error('観察中に設計範囲が変更されたため、古い観察結果は保存しませんでした。');
    }

    project.wayfarerObservation = observation;
    sessionStorage.setItem(PROJECT_KEY, JSON.stringify(project));
    return observation;
  }

  function ui() {
    return {
      root: document.getElementById('campsiteWm3b2bTestPanel'),
      status: document.getElementById('campsiteWm3b2bTestStatus'),
      meta: document.getElementById('campsiteWm3b2bTestMeta'),
      open: document.getElementById('campsiteWm3b2bTestOpen'),
      check: document.getElementById('campsiteWm3b2bTestCheck'),
      observe: document.getElementById('campsiteWm3b2bTestObserve')
    };
  }

  function render() {
    const view = ui();
    if (!view.root) return;
    const project = readProject();
    const polygon = normalizePolygon(project);
    if (view.status) view.status.textContent = state.message;
    if (view.status) view.status.dataset.state = state.status;
    if (view.meta) {
      view.meta.textContent = project
        ? 'Project: ' + String(project.projectId || 'unknown') + ' / Polygon: ' + polygon.length + '頂点'
        : 'campsiteProject.v1 を確認できません';
    }
    const busy = state.status === 'checking' || state.status === 'sending' || state.status === 'observing';
    if (view.open) view.open.disabled = busy;
    if (view.check) view.check.disabled = busy;
    if (view.observe) view.observe.disabled = busy || !state.connected || !polygon.length;
  }

  function setState(next) {
    state = { ...state, ...next };
    render();
    return { ...state };
  }

  function clearPending() {
    if (pending?.timer) clearTimeout(pending.timer);
    pending = null;
  }

  function fail(message, keepConnection = false) {
    clearPending();
    return setState({
      status: 'error',
      connected: keepConnection ? state.connected : false,
      message
    });
  }

  function openWayfarer() {
    const project = syncAndReadProject();
    const polygon = normalizePolygon(project);
    if (!project || !polygon.length) {
      return fail('Bridge ProjectまたはPolygonを確認できませんでした。');
    }
    wayfarerWindow = null;
    return setState({
      status: 'waiting',
      connected: false,
      duplicateMapTabs: false,
      message: '既に開いているWayfarer Map 1タブを使用します。Mapを1タブだけ開いた状態で「接続確認」を押してください。'
    });
  }

  function postToWayfarer(message) {
    try {
      window.postMessage({
        type: RELAY_FROM_MAIN_TYPE,
        relayId: String(message?.requestId || ''),
        payload: message
      }, location.origin);
      return true;
    } catch (_) {
      return false;
    }
  }

  function checkConnection() {
    ensureMessageListener();
    syncAndReadProject();
    clearPending();
    const requestId = createId('wm3b2b-connect');
    setState({ status:'checking', connected:false, message:'Wayfarer Mapへ接続確認中…' });

    return new Promise(resolve => {
      const timer = setTimeout(() => {
        resolve(fail('Wayfarer Mapと接続できませんでした。Bridge拡張機能とMap画面を確認してください。'));
      }, TIMEOUT_MS);
      pending = { kind:'connect', requestId, resolve, timer };

      const sent = postToWayfarer({
        type: PING_TYPE,
        requestId,
        sentAt: new Date().toISOString()
      });
      if (!sent) resolve(fail('Wayfarer MapへPINGを送信できませんでした。'));
    });
  }

  function startObservation() {
    ensureMessageListener();
    const project = syncAndReadProject();
    const polygon = normalizePolygon(project);
    if (!state.connected || state.duplicateMapTabs) {
      return Promise.resolve(fail('先に接続確認を完了してください。'));
    }
    if (!polygon.length) return Promise.resolve(fail('Creativeの最新Polygonを確認できませんでした。', true));

    clearPending();
    const requestId = createId('wm3b2b-observe');
    setState({
      status:'sending',
      connected:true,
      message:'Creativeの最新Polygon ' + polygon.length + '頂点をWayfarerへ送信中…'
    });

    return new Promise(resolve => {
      const timer = setTimeout(() => {
        resolve(fail('WayfarerがPolygonを受信したことを確認できませんでした。', true));
      }, TIMEOUT_MS);
      pending = { kind:'observe', requestId, resolve, timer, stage:'await-accepted' };

      const sent = postToWayfarer({
        type: OBSERVE_REQUEST_TYPE,
        requestId,
        sentAt: new Date().toISOString(),
        polygon
      });
      if (!sent) resolve(fail('WayfarerへPolygonを送信できませんでした。', true));
    });
  }

  function onMessage(event) {
    let data = event.data || {};

    if (
      event.source === window &&
      event.origin === location.origin &&
      data.type === RELAY_TO_MAIN_TYPE
    ) {
      const relayId = String(data.relayId || '');
      if (!pending || relayId !== pending.requestId) return;
      data = data.payload && typeof data.payload === 'object' ? data.payload : {};
      if (data.relayError) {
        const resolve = pending.resolve;
        const next = fail(String(data.relayError), pending.kind === 'observe');
        if (typeof resolve === 'function') resolve(next);
        return;
      }
    } else {
      if (!WAYFARER_ORIGINS.has(event.origin)) return;
      if (wayfarerWindow && event.source !== wayfarerWindow) return;
      if (!pending || String(data.requestId || '') !== pending.requestId) return;
    }

    if (pending.kind === 'connect' && data.type === PONG_TYPE) {
      const resolve = pending.resolve;
      const mapTabCount = Number(data.mapTabCount || 0);
      const duplicate = data.duplicateMapTabs === true || mapTabCount > 1;
      const verified = data.tabCountVerified === true;
      const mapPresent = data.mapPresent === true;
      clearPending();

      let next;
      if (duplicate) {
        next = setState({
          status:'warning',
          connected:false,
          duplicateMapTabs:true,
          message:'Wayfarer Mapが複数タブで開いています。1つだけ残して再確認してください。'
        });
      } else if (!verified) {
        next = setState({
          status:'warning',
          connected:false,
          duplicateMapTabs:false,
          message:'Wayfarer Mapには接続しましたが、タブ数を確認できませんでした。'
        });
      } else if (!mapPresent) {
        next = setState({
          status:'warning',
          connected:false,
          duplicateMapTabs:false,
          message:'Wayfarer Map画面を表示してから再確認してください。'
        });
      } else {
        next = setState({
          status:'success',
          connected:true,
          duplicateMapTabs:false,
          message:'接続OK。CreativeのPolygonを送信できます。'
        });
      }
      if (typeof resolve === 'function') resolve(next);
      return;
    }

    if (
      pending.kind === 'observe' &&
      pending.stage === 'await-accepted' &&
      data.type === OBSERVE_ACCEPTED_TYPE
    ) {
      const resolve = pending.resolve;
      const accepted = data.accepted === true;
      if (!accepted) {
        const next = fail(
          String(data.error || data.warning || 'WayfarerがPolygonを受理できませんでした。'),
          true
        );
        if (typeof resolve === 'function') resolve(next);
        return;
      }

      if (pending.timer) clearTimeout(pending.timer);
      pending.stage = 'await-result';
      pending.timer = setTimeout(() => {
        const finish = pending?.resolve;
        const next = fail('Wayfarerの観察結果を受信できませんでした。', true);
        if (typeof finish === 'function') finish(next);
      }, OBSERVE_RESULT_TIMEOUT_MS);

      setState({
        status:'observing',
        connected:true,
        duplicateMapTabs:false,
        message:'Wayfarerで観察中です…'
      });
      return;
    }

    if (
      pending.kind === 'observe' &&
      pending.stage === 'await-result' &&
      data.type === OBSERVE_RESULT_TYPE
    ) {
      const resolve = pending.resolve;
      if (data.ok !== true) {
        const next = fail(String(data.error || 'Wayfarer観察に失敗しました。'), true);
        if (typeof resolve === 'function') resolve(next);
        return;
      }

      try {
        const observation = saveObservationResult(data.result);
        const inside = Number(observation.counts?.interior?.total || observation.zones.interior.length || 0);
        const outer = Number(observation.counts?.reference100?.total || observation.zones.reference100.length || 0);
        clearPending();
        const next = setState({
          status:'success',
          connected:true,
          duplicateMapTabs:false,
          message:'観察結果をProjectへ保存しました。設計範囲内 ' + inside + '件 / 外周100m ' + outer + '件'
        });
        if (typeof resolve === 'function') resolve(next);
      } catch (error) {
        const next = fail(String(error?.message || error || '観察結果を保存できませんでした。'), true);
        if (typeof resolve === 'function') resolve(next);
      }
    }
  }

  function ensureMessageListener() {
    try {
      window.removeEventListener('message', onMessage);
      window.addEventListener('message', onMessage);
      return true;
    } catch (_) {
      return false;
    }
  }

  function install() {
    if (!location.pathname.includes('/Campsite-Design-Tool-JP/creative/')) return false;
    if (document.getElementById('campsiteWm3b2bTestPanel')) return true;

    const root = document.createElement('div');
    root.id = 'campsiteWm3b2bTestPanel';
    root.style.cssText =
      'position:fixed;right:12px;bottom:14px;z-index:2147483000;width:min(360px,calc(100vw - 24px));' +
      'padding:14px;border:2px solid #9a6a18;border-radius:16px;background:rgba(255,249,229,.98);' +
      'box-shadow:0 12px 34px rgba(0,0,0,.28);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;color:#3f3526';
    root.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
        '<div style="font-size:14px;font-weight:950">🧪 WM-3B-2 TEST</div>' +
        '<div style="font-size:10px;font-weight:800;color:#8a6b31">Production Creative未変更</div>' +
      '</div>' +
      '<div id="campsiteWm3b2bTestMeta" style="margin-top:7px;font-size:10px;line-height:1.5;color:#716143"></div>' +
      '<div id="campsiteWm3b2bTestStatus" style="margin-top:8px;padding:9px 10px;border-radius:10px;background:#f0eadf;font-size:11px;line-height:1.55;font-weight:800"></div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:9px">' +
        '<button id="campsiteWm3b2bTestOpen" type="button" style="min-height:40px;border:1px solid #5276a4;border-radius:10px;background:#e9f2ff;color:#24476f;font-weight:900">Wayfarer Mapを確認</button>' +
        '<button id="campsiteWm3b2bTestCheck" type="button" style="min-height:40px;border:1px solid #5d7353;border-radius:10px;background:#edf7e8;color:#294227;font-weight:900">接続確認</button>' +
      '</div>' +
      '<button id="campsiteWm3b2bTestObserve" type="button" style="margin-top:7px;width:100%;min-height:42px;border:1px solid #8a6b31;border-radius:10px;background:#ffe9a8;color:#4b3715;font-weight:950">この範囲を観察</button>';

    document.body.appendChild(root);
    document.getElementById('campsiteWm3b2bTestOpen').onclick = () => { openWayfarer(); };
    document.getElementById('campsiteWm3b2bTestCheck').onclick = () => { void checkConnection(); };
    document.getElementById('campsiteWm3b2bTestObserve').onclick = () => { void startObservation(); };
    render();
    return true;
  }

  ensureMessageListener();

  // Creative boots by rewriting the whole document more than once.
  // Re-install the TEST panel after each document.close() without touching
  // Production Creative source files.
  try {
    const nativeClose = document.close.bind(document);
    document.close = function(...args) {
      const result = nativeClose(...args);
      setTimeout(() => {
        try { ensureMessageListener(); install(); render(); } catch (_) {}
      }, 0);
      setTimeout(() => {
        try { ensureMessageListener(); install(); render(); } catch (_) {}
      }, 250);
      return result;
    };
  } catch (_) {}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once:true });
  } else {
    setTimeout(install, 0);
  }

  // Short-lived fallback for the nested runtime document rewrite.
  // It stops automatically and exists only in this TEST extension.
  let reinstallChecks = 0;
  const reinstallTimer = setInterval(() => {
    reinstallChecks += 1;
    try { ensureMessageListener(); install(); render(); } catch (_) {}
    if (reinstallChecks >= 40) clearInterval(reinstallTimer);
  }, 500);

  window.CampsiteWm3b2bCreativeTest = Object.freeze({
    version: VERSION,
    readProject,
    normalizePolygon,
    openWayfarer,
    checkConnection,
    startObservation,
    saveObservationResult,
    ensureMessageListener,
    getState() { return { ...state }; }
  });
})();