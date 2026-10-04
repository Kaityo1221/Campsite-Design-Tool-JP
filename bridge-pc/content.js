(() => {
  'use strict';

  const VERSION = '0.2.0';
  const START_EVENT = 'campsite-bridge-pc:start';
  const STATUS_EVENT = 'campsite-bridge-pc:status';
  const POLYGON_COMMAND_EVENT = 'campsite-bridge-pc:polygon-command';
  const POLYGON_STATE_EVENT = 'campsite-bridge-pc:polygon-state';

  if (window.__campsiteBridgePcContentInstalled) return;
  window.__campsiteBridgePcContentInstalled = true;

  let host = null;
  let shadow = null;
  let bridgeButton = null;
  let panel = null;
  let primaryButton = null;
  let secondaryButton = null;
  let tertiaryButton = null;
  let stateText = null;
  let helperText = null;
  let progressText = null;
  let diagnosticButton = null;
  let diagnosticPanel = null;

  let panelOpen = false;
  let busy = false;
  let bridgeStatus = 'ready';
  let bridgeMessage = '';
  let lastCount = 0;
  let polygonState = {
    active: false,
    completed: false,
    paused: false,
    draftAvailable: false,
    pointCount: 0,
    mode: 'pc'
  };

  function isVisibleElement(element) {
    if (!element?.getBoundingClientRect) return false;
    const style = getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1 && rect.bottom > 0 && rect.right > 0;
  }

  function findSidebarCommunityAnchor() {
    let best = null;
    let bestScore = Infinity;
    for (const element of document.querySelectorAll('button,[role="button"],a,li,div')) {
      if (!isVisibleElement(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.left > 240 || rect.width < 54 || rect.width > 230 || rect.height < 24 || rect.height > 90) continue;
      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      const label = [element.getAttribute?.('aria-label') || '', element.getAttribute?.('title') || '', text]
        .join(' ').replace(/\s+/g, ' ').trim();
      if (!/(^|\s)(コミュニティ|Community)(\s|$)/i.test(label)) continue;
      const exactText = /^(コミュニティ|Community)$/i.test(text);
      const score = Math.abs(rect.height - 44) + Math.abs(rect.left - 8) * 0.15 + (exactText ? 0 : 35);
      if (score < bestScore) {
        best = element;
        bestScore = score;
      }
    }
    return best;
  }

  function mapPresent() {
    return Boolean(document.querySelector('app-wf-base-map'));
  }

  function positionHost() {
    if (!host || !mapPresent()) return;
    const anchor = findSidebarCommunityAnchor();
    if (!anchor) {
      host.style.visibility = 'hidden';
      host.dataset.anchor = 'waiting-community';
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const edge = 6;
    host.style.left = `${Math.max(edge, Math.round(rect.left))}px`;
    host.style.top = `${Math.max(edge, Math.round(rect.bottom + 6))}px`;
    host.style.right = 'auto';
    host.style.bottom = 'auto';
    host.style.width = `${Math.max(92, Math.min(190, Math.round(rect.width)))}px`;
    host.style.visibility = 'visible';
    host.dataset.anchor = 'sidebar-community';
  }

  function sendPolygon(action) {
    window.dispatchEvent(new CustomEvent(POLYGON_COMMAND_EVENT, {
      detail: JSON.stringify({ action, sentAt: new Date().toISOString(), source: 'bridge-panel' })
    }));
  }

  function closePanel() {
    panelOpen = false;
    render();
  }

  function togglePanel() {
    panelOpen = !panelOpen;
    render();
  }

  function startNewRange() {
    panelOpen = false;
    sendPolygon('start-new');
    render();
  }

  function resumeRange() {
    panelOpen = false;
    sendPolygon('resume-draft');
    render();
  }

  function editRange() {
    panelOpen = false;
    sendPolygon('edit-completed');
    render();
  }

  function startBridge() {
    if (busy || polygonState.completed !== true || polygonState.active === true) return;
    busy = true;
    bridgeStatus = 'busy';
    bridgeMessage = 'WayfarerからPOIを準備しています…';
    lastCount = 0;
    renderDiagnostics(null);
    render();
    window.dispatchEvent(new CustomEvent(START_EVENT, {
      detail: JSON.stringify({ startedAt: new Date().toISOString(), source: 'bridge-panel' })
    }));
  }

  function addDiagnosticRow(container, label, value) {
    const count = Number(value || 0);
    if (!Number.isFinite(count) || count <= 0) return;
    const row = document.createElement('div');
    row.className = 'diagRow';
    const name = document.createElement('span');
    name.textContent = label;
    const number = document.createElement('strong');
    number.textContent = count.toLocaleString('ja-JP');
    row.append(name, number);
    container.appendChild(row);
  }

  function renderDiagnostics(report) {
    if (!diagnosticButton || !diagnosticPanel) return;
    const issueCount = Number(report?.issueCount || 0);
    const hasIssues = report?.hasIssues === true && issueCount > 0;
    diagnosticButton.hidden = !hasIssues;
    diagnosticPanel.hidden = true;
    diagnosticPanel.replaceChildren();
    if (!hasIssues) return;

    diagnosticButton.textContent = `⚠ 診断 ${issueCount.toLocaleString('ja-JP')}`;

    const title = document.createElement('div');
    title.className = 'diagTitle';
    title.textContent = 'POI診断';
    diagnosticPanel.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'diagGrid';
    const counts = report.counts || {};
    addDiagnosticRow(grid, 'GUID欠損', counts.missingGuid);
    addDiagnosticRow(grid, '座標不正', counts.invalidCoordinates);
    addDiagnosticRow(grid, '入力形式不正', counts.invalidObject);
    addDiagnosticRow(grid, '分類不能', counts.unknown);
    addDiagnosticRow(grid, 'GUID重複', counts.duplicateGuid);
    diagnosticPanel.appendChild(grid);

    const items = Array.isArray(report.items) ? report.items.slice(0, 8) : [];
    if (items.length) {
      const list = document.createElement('div');
      list.className = 'diagItems';
      for (const item of items) {
        const row = document.createElement('div');
        row.className = 'diagItem';
        const identity = String(item?.title || item?.guid || '識別子なし').trim();
        row.textContent = `${String(item?.label || '要確認')}：${identity}`;
        list.appendChild(row);
      }
      diagnosticPanel.appendChild(list);
    }
  }

  function renderPanelContent() {
    if (!panel || !primaryButton || !secondaryButton || !tertiaryButton || !stateText || !helperText || !progressText) return;

    const drawing = polygonState.active === true;
    const ready = polygonState.completed === true && !drawing;
    const resumable = polygonState.draftAvailable === true && polygonState.completed !== true && !drawing;

    primaryButton.hidden = false;
    secondaryButton.hidden = true;
    tertiaryButton.hidden = true;
    progressText.hidden = true;
    diagnosticButton.hidden = true;
    diagnosticPanel.hidden = true;

    if (drawing) {
      stateText.textContent = '📐 設計範囲を編集中';
      helperText.textContent = '地図上で範囲を編集してください。範囲確定後、このパネルを自動で開きます。';
      primaryButton.textContent = '編集中です';
      primaryButton.disabled = true;
      return;
    }

    if (ready) {
      stateText.textContent = '✅ 設計範囲を設定済み';
      helperText.textContent = '設定した範囲内のPOIをCampsiteへ送ります。';
      primaryButton.textContent =
        busy ? '🌉 Campsiteへ送信中…' :
        bridgeStatus === 'success' ? '✅ Campsiteへ送りました' :
        bridgeStatus === 'error' ? '↻ もう一度Campsiteへ送る' :
        '🌉 Campsiteへ送信！';
      primaryButton.disabled = busy;
      primaryButton.onclick = startBridge;

      secondaryButton.hidden = false;
      secondaryButton.textContent = '📐 範囲を編集';
      secondaryButton.disabled = busy;
      secondaryButton.onclick = editRange;

      if (bridgeMessage) {
        progressText.textContent = bridgeMessage;
        progressText.hidden = false;
      }
      if (lastCount > 0 && bridgeStatus === 'success') {
        helperText.textContent = `送信したPOI：${lastCount.toLocaleString('ja-JP')}件`;
      }
      return;
    }

    if (resumable || polygonState.paused === true) {
      stateText.textContent = '📐 作成途中の設計範囲があります';
      helperText.textContent = '続きから再開するか、新しく作り直せます。';
      primaryButton.textContent = '📐 範囲選択を再開';
      primaryButton.disabled = false;
      primaryButton.onclick = resumeRange;

      secondaryButton.hidden = false;
      secondaryButton.textContent = '最初からやり直す';
      secondaryButton.disabled = false;
      secondaryButton.onclick = startNewRange;
      return;
    }

    stateText.textContent = '設計範囲はまだありません';
    helperText.textContent = 'Campsiteで設計する範囲をWayfarer上で決めます。';
    primaryButton.textContent = '📐 設計範囲を決める';
    primaryButton.disabled = false;
    primaryButton.onclick = startNewRange;
  }

  function render() {
    if (!host || !shadow) return;
    bridgeButton.dataset.open = panelOpen ? 'true' : 'false';
    bridgeButton.setAttribute('aria-expanded', panelOpen ? 'true' : 'false');
    panel.hidden = !panelOpen;
    renderPanelContent();
    positionHost();
  }

  function createUi() {
    if (host && document.contains(host)) return;

    host = document.createElement('div');
    host.id = 'campsite-bridge-pc-root';
    host.style.cssText = 'position:fixed;z-index:2147483646;visibility:hidden;';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        :host{all:initial}
        .wrap{position:relative;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;width:100%}
        button{font-family:inherit}
        .bridgeButton{width:100%;min-height:42px;padding:0 10px;border:1px solid rgba(56,189,248,.5);border-radius:10px;background:rgba(15,23,42,.96);color:#e0f2fe;font:900 12px/1 system-ui;box-shadow:0 5px 18px rgba(2,6,23,.25);cursor:pointer;display:flex;align-items:center;justify-content:flex-start;gap:7px}
        .bridgeButton:hover{filter:brightness(1.08)}
        .bridgeButton[data-open="true"]{border-color:rgba(56,189,248,.9);background:rgba(15,43,69,.98)}
        .panel{position:absolute;left:calc(100% + 8px);top:0;width:310px;max-height:min(440px,calc(100vh - 24px));overflow:auto;padding:14px;border:1px solid rgba(148,163,184,.28);border-radius:14px;background:rgba(15,23,42,.98);color:#f8fafc;box-shadow:0 14px 36px rgba(2,6,23,.36)}
        .panel[hidden]{display:none}
        .panelHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
        .panelTitle{font:900 14px/1.2 system-ui}.close{width:30px;height:30px;border:0;border-radius:8px;background:rgba(51,65,85,.85);color:#e2e8f0;font:900 18px/1 system-ui;cursor:pointer}
        .state{font:900 12px/1.4 system-ui;color:#dcfce7;margin-bottom:6px}
        .helper{font:700 11px/1.55 system-ui;color:#cbd5e1;margin-bottom:12px}
        .action{width:100%;min-height:46px;border:1px solid rgba(74,222,128,.58);border-radius:10px;background:rgba(20,83,45,.98);color:#dcfce7;font:900 12px/1.2 system-ui;cursor:pointer;padding:0 12px}
        .action:hover{filter:brightness(1.08)}.action:disabled{opacity:.55;cursor:progress}
        .secondary{width:100%;min-height:38px;margin-top:8px;border:1px solid rgba(148,163,184,.34);border-radius:9px;background:rgba(30,41,59,.96);color:#e2e8f0;font:800 11px/1.2 system-ui;cursor:pointer}
        .secondary[hidden]{display:none}.secondary:disabled{opacity:.5;cursor:progress}
        .tertiary{width:100%;min-height:34px;margin-top:6px;border:0;border-radius:8px;background:transparent;color:#94a3b8;font:800 10.5px/1.2 system-ui;cursor:pointer}.tertiary[hidden]{display:none}
        .progress{margin-top:10px;padding:9px 10px;border-radius:9px;background:rgba(30,41,59,.82);color:#dbeafe;font:800 10.5px/1.5 system-ui}.progress[hidden]{display:none}
        .diagButton{width:100%;min-height:32px;margin-top:8px;border:1px solid rgba(251,191,36,.62);border-radius:9px;background:rgba(69,45,10,.96);color:#fef3c7;font:900 10.5px/1 system-ui;cursor:pointer}.diagButton[hidden]{display:none}
        .diagPanel{margin-top:8px;padding:10px;border:1px solid rgba(251,191,36,.34);border-radius:10px;background:rgba(17,24,39,.98);color:#f8fafc;font:700 10.5px/1.5 system-ui}.diagPanel[hidden]{display:none}
        .diagTitle{font:900 11px/1.3 system-ui;color:#fde68a;margin-bottom:6px}.diagGrid{display:grid;gap:4px}.diagRow{display:flex;justify-content:space-between;gap:18px}.diagRow strong{color:#fde68a}.diagItems{margin-top:8px;padding-top:7px;border-top:1px solid rgba(148,163,184,.18);display:grid;gap:4px}.diagItem{overflow-wrap:anywhere}
      </style>
      <div class="wrap">
        <button class="bridgeButton" id="bridgeButton" type="button" aria-expanded="false">🌉 Bridge</button>
        <section class="panel" id="panel" hidden>
          <div class="panelHead"><div class="panelTitle">🌉 Campsite Bridge</div><button class="close" id="closeButton" type="button" aria-label="閉じる">×</button></div>
          <div class="state" id="stateText"></div>
          <div class="helper" id="helperText"></div>
          <button class="action" id="primaryButton" type="button"></button>
          <button class="secondary" id="secondaryButton" type="button" hidden></button>
          <button class="tertiary" id="tertiaryButton" type="button" hidden></button>
          <div class="progress" id="progressText" hidden aria-live="polite"></div>
          <button class="diagButton" id="diagnosticButton" type="button" hidden>⚠ 診断</button>
          <div class="diagPanel" id="diagnosticPanel" hidden></div>
        </section>
      </div>`;

    bridgeButton = shadow.getElementById('bridgeButton');
    panel = shadow.getElementById('panel');
    primaryButton = shadow.getElementById('primaryButton');
    secondaryButton = shadow.getElementById('secondaryButton');
    tertiaryButton = shadow.getElementById('tertiaryButton');
    stateText = shadow.getElementById('stateText');
    helperText = shadow.getElementById('helperText');
    progressText = shadow.getElementById('progressText');
    diagnosticButton = shadow.getElementById('diagnosticButton');
    diagnosticPanel = shadow.getElementById('diagnosticPanel');

    bridgeButton.addEventListener('click', togglePanel);
    shadow.getElementById('closeButton').addEventListener('click', closePanel);
    diagnosticButton.addEventListener('click', () => {
      diagnosticPanel.hidden = !diagnosticPanel.hidden;
      positionHost();
    });

    document.documentElement.appendChild(host);
    render();
  }

  function syncVisibility() {
    if (!mapPresent()) {
      if (host) host.style.display = 'none';
      return;
    }
    createUi();
    host.style.display = '';
    positionHost();
  }

  window.addEventListener(POLYGON_STATE_EVENT, event => {
    let next = null;
    try { next = JSON.parse(String(event.detail || '{}')); }
    catch (_) { return; }
    if (!next || typeof next !== 'object') return;

    const wasDrawing = polygonState.active === true;
    polygonState = { ...polygonState, ...next };

    if (polygonState.active === true) {
      panelOpen = false;
    } else if (wasDrawing && (polygonState.completed === true || polygonState.paused === true)) {
      panelOpen = true;
    }
    render();
  });

  window.addEventListener(STATUS_EVENT, event => {
    let detail = null;
    try { detail = JSON.parse(String(event.detail || '{}')); }
    catch (_) { return; }

    bridgeStatus = String(detail?.state || 'ready');
    busy = bridgeStatus === 'busy';
    bridgeMessage = String(detail?.message || '');
    const count = Number(detail?.count ?? detail?.sourceCount);
    if (Number.isFinite(count) && count >= 0) lastCount = count;

    if (detail && Object.prototype.hasOwnProperty.call(detail, 'diagnosticReport')) {
      renderDiagnostics(detail.diagnosticReport);
    }
    panelOpen = true;
    render();
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || !panelOpen) return;
    closePanel();
  }, true);

  document.addEventListener('pointerdown', event => {
    if (!panelOpen || !host) return;
    const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
    if (path.includes(host)) return;
    closePanel();
  }, true);

  window.addEventListener('resize', positionHost, { passive:true });
  window.addEventListener('scroll', positionHost, { passive:true });

  syncVisibility();
  const observer = new MutationObserver(syncVisibility);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  setInterval(syncVisibility, 1500);

  window.dispatchEvent(new CustomEvent(POLYGON_COMMAND_EVENT, {
    detail: JSON.stringify({ action:'query-state', sentAt:new Date().toISOString(), source:'bridge-panel-init' })
  }));

  window.CampsiteBridgePcUi = Object.freeze({
    version: VERSION,
    startEvent: START_EVENT,
    statusEvent: STATUS_EVENT,
    polygonCommandEvent: POLYGON_COMMAND_EVENT,
    polygonStateEvent: POLYGON_STATE_EVENT
  });
})();
