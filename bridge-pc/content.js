(() => {
  'use strict';

  const VERSION = '0.1.0';
  const START_EVENT = 'campsite-bridge-pc:start';
  const STATUS_EVENT = 'campsite-bridge-pc:status';

  if (window.__campsiteBridgePcContentInstalled) return;
  window.__campsiteBridgePcContentInstalled = true;

  let host = null;
  let shadow = null;
  let button = null;
  let buttonLabel = null;
  let countBadge = null;
  let status = null;
  let diagnosticButton = null;
  let diagnosticPanel = null;
  let busy = false;
  let lastCount = 0;

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

  function renderButton(state) {
    if (!button || !buttonLabel || !countBadge) return;
    button.dataset.state = state;
    button.disabled = busy;
    buttonLabel.textContent =
      state === 'busy' ? '🌉 送信中…' :
      state === 'success' ? '✅ Bridge完了' :
      state === 'error' ? '↻ Bridge再試行' :
      '🌉 Bridge';
    countBadge.textContent = lastCount.toLocaleString('ja-JP');
    countBadge.hidden = lastCount <= 0;
  }

  function setUi(state, message, count) {
    if (!button || !status) return;
    busy = state === 'busy';
    const numericCount = Number(count);
    if (Number.isFinite(numericCount) && numericCount >= 0) lastCount = numericCount;
    renderButton(state);
    status.textContent = message || '';
    status.hidden = !message;
    positionHost();
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

    if (Number(report.notInGameCount || 0) > 0) {
      const note = document.createElement('div');
      note.className = 'diagNote';
      note.textContent = `参考：ゲーム外 ${Number(report.notInGameCount).toLocaleString('ja-JP')}件`;
      diagnosticPanel.appendChild(note);
    }
    if (report.truncated) {
      const note = document.createElement('div');
      note.className = 'diagNote';
      note.textContent = '一部のみ表示しています。';
      diagnosticPanel.appendChild(note);
    }
  }

  function startBridge() {
    if (busy) return;
    lastCount = 0;
    renderDiagnostics(null);
    renderButton('ready');
    window.dispatchEvent(new CustomEvent(START_EVENT, {
      detail: JSON.stringify({ startedAt: new Date().toISOString() })
    }));
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
        .wrap{position:relative;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;display:flex;flex-direction:column;gap:7px;width:100%}
        button{width:100%;min-height:42px;padding:0 10px;border:1px solid rgba(56,189,248,.5);border-radius:10px;background:rgba(15,23,42,.96);color:#e0f2fe;font:900 12px/1 system-ui;box-shadow:0 5px 18px rgba(2,6,23,.25);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:7px}
        button:hover{filter:brightness(1.08)} button:disabled{cursor:progress;opacity:.78}
        button[data-state="success"]{border-color:rgba(74,222,128,.65);background:rgba(20,83,45,.96);color:#dcfce7}
        button[data-state="error"]{border-color:rgba(251,191,36,.7);background:rgba(75,50,18,.97);color:#fef3c7}
        .count{min-width:25px;padding:4px 6px;border-radius:999px;background:rgba(56,189,248,.16);border:1px solid rgba(56,189,248,.32);color:#bae6fd;font:900 10px/1 system-ui;text-align:center}.count[hidden]{display:none}
        .status{position:absolute;left:calc(100% + 8px);top:0;width:260px;padding:9px 11px;border:1px solid rgba(148,163,184,.26);border-radius:11px;background:rgba(2,6,23,.96);color:#dbeafe;font:700 11px/1.55 system-ui;box-shadow:0 8px 24px rgba(2,6,23,.3)}.status[hidden]{display:none}
        .diagButton{min-height:31px;border-color:rgba(251,191,36,.62);background:rgba(69,45,10,.96);color:#fef3c7;justify-content:center;font-size:11px}.diagButton[hidden]{display:none}
        .diagPanel{position:absolute;left:calc(100% + 8px);top:50px;width:270px;padding:12px;border:1px solid rgba(251,191,36,.34);border-radius:12px;background:rgba(17,24,39,.98);color:#f8fafc;box-shadow:0 10px 30px rgba(2,6,23,.35);font:700 11px/1.5 system-ui}.diagPanel[hidden]{display:none}
        .diagTitle{font:900 12px/1.3 system-ui;color:#fde68a;margin-bottom:8px}.diagGrid{display:grid;gap:4px}.diagRow{display:flex;justify-content:space-between;gap:18px}.diagRow strong{color:#fde68a}
        .diagItems{margin-top:9px;padding-top:8px;border-top:1px solid rgba(148,163,184,.18);display:grid;gap:4px}.diagItem{overflow-wrap:anywhere}.diagNote{margin-top:8px;color:#cbd5e1;font-size:10px}
      </style>
      <div class="wrap">
        <button id="bridgeButton" type="button"><span id="bridgeLabel">🌉 Bridge</span><span class="count" id="bridgeCount" hidden>0</span></button>
        <button class="diagButton" id="diagnosticButton" type="button" hidden>⚠ 診断</button>
        <div class="status" id="status" hidden aria-live="polite"></div>
        <div class="diagPanel" id="diagnosticPanel" hidden></div>
      </div>`;
    button = shadow.getElementById('bridgeButton');
    buttonLabel = shadow.getElementById('bridgeLabel');
    countBadge = shadow.getElementById('bridgeCount');
    status = shadow.getElementById('status');
    diagnosticButton = shadow.getElementById('diagnosticButton');
    diagnosticPanel = shadow.getElementById('diagnosticPanel');
    button.addEventListener('click', startBridge);
    diagnosticButton.addEventListener('click', () => {
      diagnosticPanel.hidden = !diagnosticPanel.hidden;
      positionHost();
    });
    document.documentElement.appendChild(host);
    renderButton('ready');
  }

  function mapPresent() {
    return Boolean(document.querySelector('app-wf-base-map'));
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

  window.addEventListener(STATUS_EVENT, event => {
    let detail = null;
    try { detail = JSON.parse(String(event.detail || '{}')); }
    catch (_) { return; }
    const state = String(detail?.state || 'ready');
    const message = String(detail?.message || '');
    const count = detail?.count ?? detail?.sourceCount;
    setUi(state, message, count);
    if (detail && Object.prototype.hasOwnProperty.call(detail, 'diagnosticReport')) {
      renderDiagnostics(detail.diagnosticReport);
    }
    if (state === 'success') {
      setTimeout(() => {
        if (!busy) setUi('ready', '', lastCount);
      }, 3500);
    }
  });

  window.addEventListener('resize', positionHost, { passive:true });
  window.addEventListener('scroll', positionHost, { passive:true });
  syncVisibility();
  const observer = new MutationObserver(syncVisibility);
  observer.observe(document.documentElement, { childList:true, subtree:true });
  setInterval(syncVisibility, 1500);

  window.CampsiteBridgePcUi = Object.freeze({
    version: VERSION,
    startEvent: START_EVENT,
    statusEvent: STATUS_EVENT
  });
})();
