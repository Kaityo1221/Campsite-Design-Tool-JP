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
    const CONNECT_TIMEOUT_MS = 4200;

    let wayfarerWindow = null;
    let pendingRequestId = '';
    let pendingTimer = null;
    let linkState = {
      status: 'idle',
      connected: false,
      duplicateMapTabs: false,
      mapTabCount: 0,
      tabCountVerified: false,
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
        check: document.getElementById('campsiteWayfarerObserveCheck')
      };
    }

    function renderState() {
      const view = ui();
      if (!view.status) return;
      const state = linkState.status;
      view.status.dataset.state = state;
      view.status.textContent = linkState.message || '未接続';
      if (view.check) view.check.disabled = state === 'checking';
      if (view.open) view.open.disabled = state === 'checking';
    }

    function setState(next) {
      linkState = { ...linkState, ...next };
      renderState();
      return { ...linkState };
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
      let popup = null;
      try {
        popup = window.open(WAYFARER_URL, WINDOW_NAME);
      } catch (_) {}
      if (!popup) {
        setState({
          status: 'error',
          connected: false,
          message: 'Wayfarer Mapを開けませんでした。ポップアップを許可して再試行してください。'
        });
        return null;
      }
      wayfarerWindow = popup;
      try { popup.focus(); } catch (_) {}
      setState({
        status: 'waiting',
        connected: false,
        duplicateMapTabs: false,
        message: 'Wayfarer Mapでログインし、Map画面が表示されたらCreative Modeへ戻って「接続確認」を押してください。'
      });
      return popup;
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
      if (!wayfarerWindow) {
        return Promise.resolve(failConnection('先に「Wayfarer Mapを開く」から観察用タブを開いてください。'));
      }
      try {
        if (wayfarerWindow.closed) {
          wayfarerWindow = null;
          return Promise.resolve(failConnection('観察用のWayfarer Mapが閉じています。もう一度開いてください。'));
        }
      } catch (_) {}

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

        let sent = false;
        for (const origin of WAYFARER_ORIGINS) {
          try {
            wayfarerWindow.postMessage({
              type: PING_TYPE,
              requestId,
              sentAt: new Date().toISOString()
            }, origin);
            sent = true;
          } catch (_) {}
        }
        if (!sent) {
          finish(failConnection('Wayfarer Mapへ接続確認を送信できませんでした。'));
        }
      });
    }

    function handlePong(event) {
      if (!WAYFARER_ORIGINS.has(event.origin)) return;
      if (wayfarerWindow && event.source !== wayfarerWindow) return;
      const data = event.data || {};
      if (data.type !== PONG_TYPE) return;
      if (!pendingRequestId || String(data.requestId || '') !== pendingRequestId) return;

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
        '接続にはこの画面からWayfarer Mapを開きます。Wayfarer Mapは1タブだけにしてください。</div>' +
        '<div id="campsiteWayfarerObserveStatus" data-state="idle" style="margin-top:14px;padding:10px 12px;' +
        'border-radius:12px;background:#f0eadf;font-size:12px;line-height:1.55;font-weight:800">未接続</div>' +
        '<button id="campsiteWayfarerObserveOpen" type="button" style="margin-top:14px;width:100%;min-height:46px;' +
        'border:1px solid #5276a4;border-radius:13px;background:#e9f2ff;color:#24476f;font:900 13px/1 system-ui">' +
        'Wayfarer Mapを開く</button>' +
        '<button id="campsiteWayfarerObserveCheck" type="button" style="margin-top:9px;width:100%;min-height:46px;' +
        'border:1px solid #5d7353;border-radius:13px;background:#edf7e8;color:#294227;font:900 13px/1 system-ui">' +
        '接続確認</button>' +
        '<button id="campsiteWayfarerObserveClose" type="button" style="margin-top:8px;width:100%;min-height:40px;' +
        'border:0;background:transparent;color:#756a59;font:800 12px/1 system-ui">閉じる</button>' +
        '</div>';

      document.body.append(button, overlay);

      const openButton = document.getElementById('campsiteWayfarerObserveOpen');
      const checkButton = document.getElementById('campsiteWayfarerObserveCheck');
      const closeButton = document.getElementById('campsiteWayfarerObserveClose');

      button.onclick = () => {
        overlay.style.display = 'flex';
        renderState();
      };
      openButton.onclick = () => openWayfarer(project);
      checkButton.onclick = () => { void checkConnection(project); };
      closeButton.onclick = () => { overlay.style.display = 'none'; };
      overlay.addEventListener('click', event => {
        if (event.target === overlay) overlay.style.display = 'none';
      });

      renderState();
    }

    window.addEventListener('message', handlePong);

    window.installCampsiteWayfarerObserveLink = installUi;
    window.CampsiteCreativeWayfarerLink = Object.freeze({
      version: '0.1.0',
      openWayfarer,
      checkConnection,
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