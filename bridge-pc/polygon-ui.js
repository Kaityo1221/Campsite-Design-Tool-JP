(() => {
  'use strict';

  const VERSION = '0.1.0';
  const COMMAND_EVENT = 'campsite-bridge-pc:polygon-command';
  const STATE_EVENT = 'campsite-bridge-pc:polygon-state';

  if (window.__campsiteWm2PolygonUiInstalled) return;
  window.__campsiteWm2PolygonUiInstalled = true;

  let host = null;
  let shadow = null;
  let crosshair = null;
  let state = {
    active: false,
    completed: false,
    mode: 'pc',
    pointCount: 0,
    maxPoints: 30,
    draftAvailable: false,
    selfIntersects: false,
    canComplete: false,
    canUndo: false,
    instruction: ''
  };
  let draftPrompted = false;
  const hiddenWayfarerControls = new Map();

  function visibleElement(element) {
    if (!element?.getBoundingClientRect) return false;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 1 || rect.height <= 1 || rect.bottom <= 0 || rect.right <= 0) return false;
    const style = window.getComputedStyle?.(element);
    return style?.display !== 'none' && style?.visibility !== 'hidden';
  }

  function compactControlShell(element) {
    if (!element?.getBoundingClientRect) return element;
    let best = element;
    let node = element.parentElement;
    for (let depth = 0; depth < 4 && node; depth += 1, node = node.parentElement) {
      const rect = node.getBoundingClientRect?.();
      if (!rect) break;
      if (rect.width > 680 || rect.height > 90) break;
      if (rect.width >= 80 && rect.height >= 24 && rect.top < 340) best = node;
    }
    return best;
  }

  function findWayfarerDrawingObstructions() {
    const found = [];

    const searchInput = Array.from(document.querySelectorAll('input')).find(input => {
      const placeholder = String(input.getAttribute?.('placeholder') || '').trim();
      return visibleElement(input) && /位置を検索|search/i.test(placeholder);
    });
    if (searchInput) found.push(compactControlShell(searchInput));

    const categoryLabels = new Set([
      'ポケストップ',
      'ジム',
      'パワースポット',
      'PokéStop',
      'PokeStop',
      'Gym',
      'Power Spot',
      'PowerSpot'
    ]);
    for (const element of document.querySelectorAll('button,[role="button"]')) {
      if (!visibleElement(element)) continue;
      const text = String(element.textContent || '').replace(/\s+/g, ' ').trim();
      if (!categoryLabels.has(text)) continue;
      found.push(element);
    }

    return [...new Set(found.filter(Boolean))];
  }

  function hideWayfarerControl(element) {
    if (!element || hiddenWayfarerControls.has(element)) return;
    hiddenWayfarerControls.set(element, {
      visibility: element.style.visibility,
      pointerEvents: element.style.pointerEvents
    });
    element.dataset.campsiteWm2Hidden = 'true';
    element.style.visibility = 'hidden';
    element.style.pointerEvents = 'none';
  }

  function restoreWayfarerDrawingControls() {
    for (const [element, previous] of hiddenWayfarerControls.entries()) {
      try {
        element.style.visibility = previous.visibility;
        element.style.pointerEvents = previous.pointerEvents;
        delete element.dataset.campsiteWm2Hidden;
      } catch (_) {}
    }
    hiddenWayfarerControls.clear();
  }

  function syncWayfarerDrawingControls() {
    const drawing = state.active === true && state.completed !== true;
    if (!drawing) {
      restoreWayfarerDrawingControls();
      return;
    }
    findWayfarerDrawingObstructions().forEach(hideWayfarerControl);
  }

  function mapHost() {
    return document.querySelector('app-wf-base-map');
  }

  function send(action) {
    window.dispatchEvent(new CustomEvent(COMMAND_EVENT, {
      detail: JSON.stringify({ action, sentAt: new Date().toISOString() })
    }));
  }

  function positionCrosshair() {
    if (!crosshair) return;
    const map = mapHost();
    const visible =
      Boolean(map) &&
      state.active === true &&
      state.completed !== true &&
      state.mode === 'mobile';

    crosshair.hidden = !visible;
    if (!visible) return;

    const rect = map.getBoundingClientRect();
    crosshair.style.left = Math.round(rect.left + rect.width / 2) + 'px';
    crosshair.style.top = Math.round(rect.top + rect.height / 2) + 'px';
  }

  function askResumeDraft() {
    if (draftPrompted || !state.draftAvailable || state.active) return;
    draftPrompted = true;
    window.setTimeout(() => {
      const resume = window.confirm('前回の作成途中があります。再開しますか？');
      send(resume ? 'resume-draft' : 'start-new');
    }, 0);
  }

  function createUi() {
    if (host && document.contains(host)) return;

    host = document.createElement('div');
    host.id = 'campsite-wm2-polygon-ui';
    host.style.cssText =
      'position:fixed;left:50%;bottom:18px;transform:translateX(-50%);' +
      'z-index:2147483645;width:min(440px,calc(100vw - 24px));pointer-events:auto;';

    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = [
      '<style>',
      ':host{all:initial}',
      '.card{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif;',
      'background:rgba(15,23,42,.96);color:#f8fafc;border:1px solid rgba(148,163,184,.3);',
      'border-radius:14px;box-shadow:0 10px 32px rgba(2,6,23,.32);padding:10px;display:grid;gap:8px}',
      '.top{display:flex;align-items:center;justify-content:space-between;gap:10px}',
      '.title{font:900 13px/1.2 system-ui}.count{font:900 11px/1 system-ui;color:#bbf7d0}',
      '.instruction{font:700 11px/1.45 system-ui;color:#dbeafe}',
      '.warning{font:900 11px/1.45 system-ui;color:#fecaca;background:rgba(127,29,29,.45);',
      'border:1px solid rgba(248,113,113,.45);border-radius:9px;padding:7px 9px}',
      '.message{font:800 11px/1.45 system-ui;color:#fde68a}',
      '.row{display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px}',
      'button{min-height:40px;border:1px solid rgba(148,163,184,.35);border-radius:10px;',
      'background:rgba(30,41,59,.98);color:#f8fafc;font:900 11px/1.15 system-ui;cursor:pointer;padding:0 9px}',
      'button:hover{filter:brightness(1.08)}button:disabled{opacity:.42;cursor:not-allowed}',
      '.primary{border-color:rgba(74,222,128,.6);background:rgba(20,83,45,.98);color:#dcfce7}',
      '.add{width:100%;border-color:rgba(56,189,248,.62);background:rgba(12,74,110,.98);color:#e0f2fe}',
      '.start{width:100%;min-height:46px;font-size:12px}',
      '.done{color:#bbf7d0;font:900 11px/1.4 system-ui}',
      '[hidden]{display:none!important}',
      '@media(max-width:620px){.row{grid-template-columns:1fr 1fr}.row .primary{grid-column:1 / -1}}',
      '</style>',
      '<div class="card">',
      '<button id="start" class="start primary" type="button">📐 範囲を決める</button>',
      '<div id="active" hidden>',
      '<div class="top"><div class="title">📐 設計範囲</div><div id="count" class="count">頂点 0 / 30</div></div>',
      '<div id="instruction" class="instruction"></div>',
      '<div id="warning" class="warning" hidden>⚠ 線が交差しています。赤い辺を修正してください。</div>',
      '<div id="message" class="message" hidden></div>',
      '<div id="done" class="done" hidden>✅ 範囲を確定しました。</div>',
      '<button id="addCenter" class="add" type="button" hidden>＋ 頂点を追加</button>',
      '<div class="row">',
      '<button id="undo" type="button">↶ 1つ戻す</button>',
      '<button id="reset" type="button">最初からやり直す</button>',
      '<button id="complete" class="primary" type="button">範囲を確定</button>',
      '</div>',
      '</div>',
      '</div>'
    ].join('');

    shadow.getElementById('start').addEventListener('click', () => {
      if (state.draftAvailable) {
        const resume = window.confirm('前回の作成途中があります。再開しますか？');
        draftPrompted = true;
        send(resume ? 'resume-draft' : 'start-new');
      } else {
        send('start-new');
      }
    });

    shadow.getElementById('addCenter').addEventListener('click', () => send('add-center'));
    shadow.getElementById('undo').addEventListener('click', () => send('undo'));
    shadow.getElementById('reset').addEventListener('click', () => {
      if (!window.confirm('範囲を最初からやり直しますか？')) return;
      send('reset');
    });
    shadow.getElementById('complete').addEventListener('click', () => send('complete'));

    document.documentElement.appendChild(host);

    crosshair = document.createElement('div');
    crosshair.id = 'campsite-wm2-crosshair';
    crosshair.setAttribute('aria-hidden', 'true');
    crosshair.style.cssText =
      'position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;z-index:2147483644;' +
      'pointer-events:none;display:grid;place-items:center;color:#0f172a;font:900 30px/34px system-ui;' +
      'text-shadow:0 0 2px white,0 0 5px white;';
    crosshair.textContent = '+';
    crosshair.hidden = true;
    document.documentElement.appendChild(crosshair);
  }

  function render() {
    const map = mapHost();
    if (!map) {
      restoreWayfarerDrawingControls();
      if (host) host.style.display = 'none';
      if (crosshair) crosshair.hidden = true;
      return;
    }

    createUi();
    host.style.display = '';

    const start = shadow.getElementById('start');
    const activePanel = shadow.getElementById('active');
    const count = shadow.getElementById('count');
    const instruction = shadow.getElementById('instruction');
    const warning = shadow.getElementById('warning');
    const message = shadow.getElementById('message');
    const done = shadow.getElementById('done');
    const addCenter = shadow.getElementById('addCenter');
    const undo = shadow.getElementById('undo');
    const reset = shadow.getElementById('reset');
    const complete = shadow.getElementById('complete');

    start.hidden = state.active === true;
    activePanel.hidden = state.active !== true;

    if (state.active) {
      count.textContent = '頂点 ' + Number(state.pointCount || 0) + ' / ' + Number(state.maxPoints || 30);
      instruction.textContent = String(state.instruction || '');
      warning.hidden = state.selfIntersects !== true;
      message.textContent = String(state.message || '');
      message.hidden = !state.message;
      done.hidden = state.completed !== true;
      addCenter.hidden = !(state.mode === 'mobile' && state.completed !== true);
      undo.disabled = state.canUndo !== true;
      reset.disabled = false;
      complete.disabled = state.canComplete !== true;
      complete.textContent = state.completed ? '確定済み' : '範囲を確定';
    }

    syncWayfarerDrawingControls();
    positionCrosshair();
    askResumeDraft();
  }

  window.addEventListener(STATE_EVENT, event => {
    let next = null;
    try { next = JSON.parse(String(event?.detail || '{}')); } catch (_) { return; }
    if (!next || typeof next !== 'object') return;
    state = { ...state, ...next };
    render();
  });

  window.addEventListener('resize', () => {
    positionCrosshair();
  }, { passive: true });

  const observer = new MutationObserver(() => render());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  createUi();
  render();
  send('query-state');

  window.CampsiteWm2PolygonUi = Object.freeze({
    version: VERSION,
    query() { send('query-state'); },
    syncWayfarerDrawingControls,
    restoreWayfarerDrawingControls
  });
})();