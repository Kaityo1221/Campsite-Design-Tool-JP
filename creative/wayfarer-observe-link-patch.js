(() => {
  'use strict';

  function runtimeBootstrap() {
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
    const OBSERVATION_SAVED_EVENT = 'campsite:wayfarer-observation-saved';
    const REFERENCE_STATE_EVENT = 'campsite:wayfarer-reference-state';
    const PROJECT_KEY = 'campsiteProject.v1';
    const RELAY_FROM_MAIN_TYPE = 'CAMPSITE_CREATIVE_MAIN_TO_EXTENSION_V1';
    const RELAY_TO_MAIN_TYPE = 'CAMPSITE_EXTENSION_TO_CREATIVE_MAIN_V1';
    const CONNECT_TIMEOUT_MS = 4200;
    const OBSERVE_RESULT_TIMEOUT_MS = 120000;

    let wayfarerWindow = null;
    let pendingRequestId = '';
    let pendingTimer = null;
    let pendingObserveRequestId = '';
    let pendingObserveTimer = null;
    let pendingObserveResolve = null;
    let pendingObserveStage = '';
    let linkState = {
      status: 'idle',
      connected: false,
      duplicateMapTabs: false,
      mapTabCount: 0,
      tabCountVerified: false,
      reacquireRequired: false,
      message: '未接続'
    };

    function createId(prefix) {
      try {
        if (typeof crypto?.randomUUID === 'function') return prefix + '-' + crypto.randomUUID();
      } catch (_) {}
      return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    }

    function ui() {
      return {
        button: document.getElementById('campsiteWayfarerObserveButton'),
        overlay: document.getElementById('campsiteWayfarerObserveOverlay'),
        status: document.getElementById('campsiteWayfarerObserveStatus'),
        open: document.getElementById('campsiteWayfarerObserveOpen'),
        check: document.getElementById('campsiteWayfarerObserveCheck'),
        observe: document.getElementById('campsiteWayfarerObserveRun')
      };
    }

    function renderState() {
      const view = ui();
      if (!view.status) return;
      const state = linkState.status;
      view.status.dataset.state = state;
      view.status.textContent = linkState.message || '未接続';
      const reacquire = linkState.reacquireRequired === true;
      if (view.button) {
        view.button.dataset.reacquire = reacquire ? '1' : '0';
        view.button.textContent = reacquire ? 'Wayfarerで再取得' : '🔭 Wayfarer観察';
        view.button.style.background = reacquire ? 'rgba(255,241,201,.98)' : 'rgba(238,247,231,.96)';
        view.button.style.borderColor = reacquire ? '#a9791f' : '#5d7353';
        view.button.style.color = reacquire ? '#4b3715' : '#294227';
        view.button.title = reacquire ? '現在の設計範囲は前回のWayfarer取得範囲を超えています' : '';
      }
      if (view.check) view.check.disabled = state === 'checking' || state === 'sending' || state === 'observing';
      if (view.open) view.open.disabled = state === 'checking' || state === 'sending' || state === 'observing';
      if (view.observe) {
        view.observe.disabled = !linkState.connected || state === 'checking' || state === 'sending' || state === 'observing';
        view.observe.textContent = reacquire ? 'Wayfarerで再取得' : 'この範囲を観察';
      }
    }

    function setState(next) {
      linkState = { ...linkState, ...next };
      renderState();
      return { ...linkState };
    }

    function syncReacquireState(detail) {
      let referenceState = detail && typeof detail === 'object' ? detail : null;
      if (!referenceState) {
        try { referenceState = window.__cmWayfarerReference?.getState?.() || null; } catch (_) {}
      }
      const required = referenceState?.localCanUse === false &&
        String(referenceState?.localReason || '') === 'REACQUIRE_REQUIRED';
      const wasRequired = linkState.reacquireRequired === true;
      linkState = { ...linkState, reacquireRequired: required };
      if (required && !wasRequired && linkState.status === 'idle') {
        linkState.message = '設計範囲が前回の取得範囲を超えています。Wayfarerで再取得してください。';
      } else if (!required && wasRequired &&
                 linkState.status === 'idle' &&
                 String(linkState.message || '').includes('Wayfarerで再取得')) {
        linkState.message = '未接続';
      }
      renderState();
      return required;
    }

    function syncProject(project) {
      try {
        if (typeof syncCampsiteProjectFromCreative === 'function') {
          syncCampsiteProjectFromCreative(project);
        }
      } catch (_) {}
    }

    function openWayfarer(project) {
      syncProject(project);
      wayfarerWindow = null;
      setState({
        status: 'waiting',
        connected: false,
        duplicateMapTabs: false,
        message: '既に開いているWayfarer Map 1タブを使用します。Wayfarer Mapを1タブだけ開いた状態で「接続確認」を押してください。'
      });
      return null;
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

    function clearPending() {
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = null;
      pendingRequestId = '';
    }

    function failConnection(message) {
      clearPending();
      return setState({
        status: 'error',
        connected: false,
        message
      });
    }

    function checkConnection(project) {
      syncProject(project);
      clearPending();
      const requestId = createId('creative-wayfarer');
      pendingRequestId = requestId;
      setState({
        status: 'checking',
        connected: false,
        duplicateMapTabs: false,
        message: 'Wayfarer Mapへ接続確認中…'
      });

      return new Promise(resolve => {
        const finish = result => {
          clearPending();
          resolve(result);
        };

        pendingTimer = setTimeout(() => {
          finish(failConnection(
            'Wayfarer Mapと接続できませんでした。Map画面とBridge拡張機能を確認して再試行してください。'
          ));
        }, CONNECT_TIMEOUT_MS);

        window.__campsiteWayfarerObserveResolve = finish;

        const sent = postToWayfarer({
          type: PING_TYPE,
          requestId,
          sentAt: new Date().toISOString()
        });
        if (!sent) {
          finish(failConnection('Wayfarer Mapへ接続確認を送信できませんでした。'));
        }
      });
    }

    function normalizeProjectPolygon(project) {
      const polygon = Array.isArray(project?.polygon) ? project.polygon : [];
      const normalized = polygon.map(point => {
        if (!Array.isArray(point) || point.length < 2) return null;
        const lat = Number(point[0]);
        const lng = Number(point[1]);
        return Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : null;
      }).filter(Boolean);
      return normalized.length >= 3 && normalized.length <= 30 ? normalized : [];
    }

    function readCurrentProject() {
      try {
        const project = JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null');
        return project && project.source === 'bridge' ? project : null;
      } catch (_) {
        return null;
      }
    }

    function cloneJson(value, fallback) {
      try { return JSON.parse(JSON.stringify(value)); }
      catch (_) { return fallback; }
    }

    function samePolygon(a, b) {
      return JSON.stringify(normalizeProjectPolygon({ polygon: a })) ===
        JSON.stringify(normalizeProjectPolygon({ polygon: b }));
    }

    function normalizeObservationResult(raw) {
      if (!raw || typeof raw !== 'object') {
        throw new Error('Wayfarer観察結果の形式が正しくありません。');
      }
      const polygon = normalizeProjectPolygon({ polygon: raw.polygon });
      if (!polygon.length) {
        throw new Error('Wayfarer観察結果のPolygonを確認できませんでした。');
      }
      const zones = raw.zones && typeof raw.zones === 'object' ? raw.zones : {};
      if (
        !Array.isArray(zones.interior) ||
        !Array.isArray(zones.reference100) ||
        !Array.isArray(zones.reserve200)
      ) {
        throw new Error('Wayfarer観察結果のゾーン情報を確認できませんでした。');
      }

      const observedAt = String(raw.observedAt || new Date().toISOString());
      return {
        version: String(raw.version || '0.1.0'),
        snapshotId: String(raw.snapshotId || ('wm3:' + observedAt)),
        observedAt,
        polygon,
        counts: cloneJson(raw.counts || {}, {}),
        zones: {
          interior: cloneJson(zones.interior, []),
          reference100: cloneJson(zones.reference100, []),
          reserve200: cloneJson(zones.reserve200, [])
        },
        visibleTotal: Number(raw.visibleTotal || 0),
        retainedTotal: Number(raw.retainedTotal || 0),
        excludedCount: Number(raw.excludedCount || 0),
        outsideCount: Number(raw.outsideCount || 0),
        canProceed: raw.canProceed === true,
        acquisition: cloneJson(raw.acquisition || {}, {})
      };
    }

    function saveObservationResult(raw) {
      const project = readCurrentProject();
      if (!project) {
        throw new Error('campsiteProject.v1 を確認できませんでした。');
      }
      const observation = normalizeObservationResult(raw);
      if (!samePolygon(project.polygon, observation.polygon)) {
        throw new Error('観察中に設計範囲が変更されたため、古い観察結果は保存しませんでした。');
      }

      project.wayfarerObservation = observation;
      sessionStorage.setItem(PROJECT_KEY, JSON.stringify(project));
      try {
        window.dispatchEvent(new CustomEvent(OBSERVATION_SAVED_EVENT, { detail: { observedAt: observation.observedAt } }));
      } catch (_) {}
      return observation;
    }

    function clearObservePending() {
      if (pendingObserveTimer) clearTimeout(pendingObserveTimer);
      pendingObserveTimer = null;
      pendingObserveRequestId = '';
      pendingObserveResolve = null;
      pendingObserveStage = '';
    }

    function failObservation(message) {
      const connected = linkState.connected === true;
      clearObservePending();
      return setState({
        status: 'error',
        connected,
        message
      });
    }

    function startObservation(project) {
      syncProject(project);
      if (!linkState.connected || linkState.duplicateMapTabs) {
        return Promise.resolve(failObservation('先にWayfarer Mapとの接続確認を完了してください。'));
      }
      const currentProject = readCurrentProject() || project;
      const polygon = normalizeProjectPolygon(currentProject);
      if (!polygon.length) {
        return Promise.resolve(failObservation('Creative Modeの設計範囲を確認できませんでした。'));
      }

      clearObservePending();
      const requestId = createId('creative-observe');
      pendingObserveRequestId = requestId;
      pendingObserveStage = 'await-accepted';
      setState({
        status: 'sending',
        connected: true,
        message: '最新の設計範囲をWayfarerへ送信しています…'
      });

      return new Promise(resolve => {
        pendingObserveResolve = resolve;
        pendingObserveTimer = setTimeout(() => {
          resolve(failObservation('Wayfarerが設計範囲を受信したことを確認できませんでした。'));
        }, CONNECT_TIMEOUT_MS);

        const sent = postToWayfarer({
          type: OBSERVE_REQUEST_TYPE,
          requestId,
          sentAt: new Date().toISOString(),
          polygon
        });
        if (!sent) {
          resolve(failObservation('Wayfarerへ設計範囲を送信できませんでした。'));
        }
      });
    }

    function handlePong(event) {
      let data = event.data || {};
      let relayedId = '';
      if (event.source === window && event.origin === location.origin && data.type === RELAY_TO_MAIN_TYPE) {
        relayedId = String(data.relayId || '');
        data = data.payload && typeof data.payload === 'object' ? data.payload : {};
        if (!pendingRequestId || relayedId !== pendingRequestId) return;
        if (data.relayError) {
          const finish = window.__campsiteWayfarerObserveResolve;
          const next = failConnection(String(data.relayError));
          if (typeof finish === 'function') finish(next);
          return;
        }
      } else {
        if (!WAYFARER_ORIGINS.has(event.origin)) return;
        if (wayfarerWindow && event.source !== wayfarerWindow) return;
        if (!pendingRequestId || String(data.requestId || '') !== pendingRequestId) return;
      }
      if (data.type !== PONG_TYPE) return;

      const finish = window.__campsiteWayfarerObserveResolve;
      const mapTabCount = Number(data.mapTabCount || 0);
      const duplicate = data.duplicateMapTabs === true || mapTabCount > 1;
      const mapPresent = data.mapPresent === true;
      const verified = data.tabCountVerified === true;

      let next;
      if (duplicate) {
        next = setState({
          status: 'warning',
          connected: false,
          duplicateMapTabs: true,
          mapTabCount,
          tabCountVerified: verified,
          message: 'Wayfarer Mapが複数タブで開いています。1つだけ残してから再確認してください。'
        });
      } else if (!mapPresent) {
        next = setState({
          status: 'warning',
          connected: false,
          duplicateMapTabs: false,
          mapTabCount,
          tabCountVerified: verified,
          message: 'Wayfarer Map画面を開いてから再確認してください。'
        });
      } else if (!verified) {
        next = setState({
          status: 'warning',
          connected: false,
          duplicateMapTabs: false,
          mapTabCount,
          tabCountVerified: false,
          message: 'Wayfarer Mapには接続できましたが、タブ数を確認できませんでした。'
        });
      } else {
        next = setState({
          status: 'success',
          connected: true,
          duplicateMapTabs: false,
          mapTabCount: 1,
          tabCountVerified: true,
          message: 'Wayfarer Mapに接続できました。'
        });
      }

      clearPending();
      if (typeof finish === 'function') {
        delete window.__campsiteWayfarerObserveResolve;
        finish(next);
      }
    }

    function handleObserveAccepted(event) {
      let data = event.data || {};
      let relayedId = '';
      if (event.source === window && event.origin === location.origin && data.type === RELAY_TO_MAIN_TYPE) {
        relayedId = String(data.relayId || '');
        data = data.payload && typeof data.payload === 'object' ? data.payload : {};
        if (!pendingObserveRequestId || relayedId !== pendingObserveRequestId) return;
        if (data.relayError) {
          if (pendingObserveStage !== 'await-accepted') return;
          const resolve = pendingObserveResolve;
          const next = failObservation(String(data.relayError));
          if (typeof resolve === 'function') resolve(next);
          return;
        }
      } else {
        if (!WAYFARER_ORIGINS.has(event.origin)) return;
        if (wayfarerWindow && event.source !== wayfarerWindow) return;
        if (!pendingObserveRequestId || String(data.requestId || '') !== pendingObserveRequestId) return;
      }
      if (data.type !== OBSERVE_ACCEPTED_TYPE || pendingObserveStage !== 'await-accepted') return;

      const resolve = pendingObserveResolve;
      const accepted = data.accepted === true;
      if (!accepted) {
        const next = failObservation(String(data.error || data.warning || 'Wayfarerが設計範囲を受け取れませんでした。'));
        if (typeof resolve === 'function') resolve(next);
        return;
      }

      if (pendingObserveTimer) clearTimeout(pendingObserveTimer);
      pendingObserveStage = 'await-result';
      pendingObserveTimer = setTimeout(() => {
        const finish = pendingObserveResolve;
        const next = failObservation('Wayfarerの観察結果を受信できませんでした。');
        if (typeof finish === 'function') finish(next);
      }, OBSERVE_RESULT_TIMEOUT_MS);

      setState({
        status: 'observing',
        connected: true,
        duplicateMapTabs: false,
        message: 'Wayfarerで観察中です…'
      });
    }

    function handleObserveResult(event) {
      let data = event.data || {};
      let relayedId = '';
      if (event.source === window && event.origin === location.origin && data.type === RELAY_TO_MAIN_TYPE) {
        relayedId = String(data.relayId || '');
        data = data.payload && typeof data.payload === 'object' ? data.payload : {};
        if (!pendingObserveRequestId || relayedId !== pendingObserveRequestId) return;
        if (data.relayError) {
          if (pendingObserveStage !== 'await-result') return;
          const resolve = pendingObserveResolve;
          const next = failObservation(String(data.relayError));
          if (typeof resolve === 'function') resolve(next);
          return;
        }
      } else {
        if (!WAYFARER_ORIGINS.has(event.origin)) return;
        if (wayfarerWindow && event.source !== wayfarerWindow) return;
        if (!pendingObserveRequestId || String(data.requestId || '') !== pendingObserveRequestId) return;
      }
      if (data.type !== OBSERVE_RESULT_TYPE || pendingObserveStage !== 'await-result') return;

      const resolve = pendingObserveResolve;
      if (data.ok !== true) {
        const next = failObservation(String(data.error || 'Wayfarer観察に失敗しました。'));
        if (typeof resolve === 'function') resolve(next);
        return;
      }

      try {
        const observation = saveObservationResult(data.result);
        const inside = Number(observation.counts?.interior?.total || observation.zones.interior.length || 0);
        const outer = Number(observation.counts?.reference100?.total || observation.zones.reference100.length || 0);
        clearObservePending();
        const next = setState({
          status: 'success',
          connected: true,
          duplicateMapTabs: false,
          message: '観察結果をProjectへ保存しました。設計範囲内 ' + inside + '件 / 外周100m ' + outer + '件'
        });
        if (typeof resolve === 'function') resolve(next);
      } catch (error) {
        const next = failObservation(String(error?.message || error || '観察結果を保存できませんでした。'));
        if (typeof resolve === 'function') resolve(next);
      }
    }

    function installUi(project) {
      if (document.getElementById('campsiteWayfarerObserveButton')) return;

      const button = document.createElement('button');
      button.id = 'campsiteWayfarerObserveButton';
      button.type = 'button';
      button.textContent = '🔭 Wayfarer観察';
      button.style.cssText =
        'position:fixed;right:12px;bottom:92px;z-index:1350;min-height:42px;padding:0 13px;' +
        'border:1px solid #5d7353;border-radius:13px;background:rgba(238,247,231,.96);color:#294227;' +
        'font:900 12px/1 system-ui;box-shadow:0 4px 14px rgba(0,0,0,.22);cursor:pointer';

      const overlay = document.createElement('div');
      overlay.id = 'campsiteWayfarerObserveOverlay';
      overlay.style.cssText =
        'display:none;position:fixed;inset:0;z-index:4900;align-items:center;justify-content:center;padding:20px;' +
        'background:rgba(20,25,18,.58);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)';
      overlay.innerHTML =
        '<div style="width:min(390px,100%);padding:22px;border-radius:22px;background:#fffaf0;color:#3f3526;' +
        'box-shadow:0 22px 58px rgba(0,0,0,.32);font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif">' +
        '<div style="font-size:21px;font-weight:950">🔭 Wayfarerで観察</div>' +
        '<div style="margin-top:8px;font-size:12px;line-height:1.65;color:#6b5b42">' +
        '既に開いているWayfarer Mapを使用します。Wayfarer Mapは1タブだけにしてください。</div>' +
        '<div id="campsiteWayfarerObserveStatus" data-state="idle" style="margin-top:14px;padding:10px 12px;' +
        'border-radius:12px;background:#f0eadf;font-size:12px;line-height:1.55;font-weight:800">未接続</div>' +
        '<button id="campsiteWayfarerObserveOpen" type="button" style="margin-top:14px;width:100%;min-height:46px;' +
        'border:1px solid #5276a4;border-radius:13px;background:#e9f2ff;color:#24476f;font:900 13px/1 system-ui">' +
        'Wayfarer Mapを確認</button>' +
        '<button id="campsiteWayfarerObserveCheck" type="button" style="margin-top:9px;width:100%;min-height:46px;' +
        'border:1px solid #5d7353;border-radius:13px;background:#edf7e8;color:#294227;font:900 13px/1 system-ui">' +
        '接続確認</button>' +
        '<button id="campsiteWayfarerObserveRun" type="button" style="margin-top:9px;width:100%;min-height:46px;' +
        'border:1px solid #8a6b31;border-radius:13px;background:#fff1c9;color:#4b3715;font:900 13px/1 system-ui">' +
        'この範囲を観察</button>' +
        '<button id="campsiteWayfarerObserveClose" type="button" style="margin-top:8px;width:100%;min-height:40px;' +
        'border:0;background:transparent;color:#756a59;font:800 12px/1 system-ui">閉じる</button>' +
        '</div>';

      document.body.append(button, overlay);

      const openButton = document.getElementById('campsiteWayfarerObserveOpen');
      const checkButton = document.getElementById('campsiteWayfarerObserveCheck');
      const observeButton = document.getElementById('campsiteWayfarerObserveRun');
      const closeButton = document.getElementById('campsiteWayfarerObserveClose');

      button.onclick = () => {
        overlay.style.display = 'flex';
        renderState();
      };
      openButton.onclick = () => openWayfarer(project);
      checkButton.onclick = () => { void checkConnection(project); };
      observeButton.onclick = () => { void startObservation(project); };
      closeButton.onclick = () => { overlay.style.display = 'none'; };
      overlay.addEventListener('click', event => {
        if (event.target === overlay) overlay.style.display = 'none';
      });

      syncReacquireState();
      renderState();
    }

    window.addEventListener(REFERENCE_STATE_EVENT, event => syncReacquireState(event?.detail));
    window.addEventListener('message', handlePong);
    window.addEventListener('message', handleObserveAccepted);
    window.addEventListener('message', handleObserveResult);

    window.installCampsiteWayfarerObserveLink = installUi;
    window.CampsiteCreativeWayfarerLink = Object.freeze({
      version: '0.4.0',
      openWayfarer,
      checkConnection,
      startObservation,
      saveObservationResult,
      syncReacquireState,
      getState() { return { ...linkState }; }
    });
  }

  function apply(src) {
    if (typeof src !== 'string') return src;
    let out = src;
    const marker = 'function loadCampsiteBridgeProject(project){';
    if (!out.includes('CampsiteCreativeWayfarerLink') && out.includes(marker)) {
      out = out.replace(marker, '(' + runtimeBootstrap.toString() + ')();' + marker);
    }
    if (!out.includes('installCampsiteWayfarerObserveLink(project);') &&
        out.includes('installCampsiteProjectNext(project);')) {
      out = out.replace(
        'installCampsiteProjectNext(project);',
        'installCampsiteProjectNext(project);installCampsiteWayfarerObserveLink(project);'
      );
    }
    return out;
  }

  window.applyCreativeWayfarerObserveLinkPatch = apply;
})();