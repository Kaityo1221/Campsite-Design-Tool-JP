(() => {
  'use strict';

  const PANEL_STATE_EVENT = 'campsite-bridge-android-n4:panel-state';
  const PANEL_COMMAND_EVENT = 'campsite-bridge-android-n4:panel-command';
  const ROOT_ID = 'cbam24-body';
  const UI_ID = 'cbam24-n4-polygon-ui';

  let latest = null;
  let mounted = false;

  function send(action) {
    window.dispatchEvent(new CustomEvent(PANEL_COMMAND_EVENT, {
      detail: JSON.stringify({ action, source: 'android-bridge-panel-ui', sentAt: new Date().toISOString() })
    }));
  }

  function findRoot() {
    return document.getElementById(ROOT_ID);
  }

  function makeButton(label, action, primary) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.dataset.n4Action = action;
    button.style.cssText = [
      'width:100%','min-height:40px','margin-top:8px','border-radius:10px',
      'border:1px solid rgba(255,255,255,.18)','font:inherit','font-weight:700',
      'cursor:pointer','padding:8px 10px',
      primary ? 'background:#fff;color:#172018' : 'background:rgba(255,255,255,.08);color:inherit'
    ].join(';');
    button.addEventListener('click', () => send(action));
    return button;
  }

  function ensureUi() {
    const root = findRoot();
    if (!root) return null;
    let ui = document.getElementById(UI_ID);
    if (ui) return ui;

    ui = document.createElement('section');
    ui.id = UI_ID;
    ui.setAttribute('aria-live', 'polite');
    ui.style.cssText = 'margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.14)';
    root.insertBefore(ui, root.firstChild);
    mounted = true;
    return ui;
  }

  function render(detail) {
    latest = detail;
    const ui = ensureUi();
    if (!ui) return;

    const p = detail?.polygonState || {};
    const ready = detail?.ready === true;
    const confirmed = detail?.sessionRangeConfirmed === true;
    ui.replaceChildren();

    const status = document.createElement('div');
    status.style.cssText = 'font-weight:800;line-height:1.35';

    if (p.active === true) {
      status.textContent = '📐 設計範囲を編集中';
      ui.append(status, makeButton('編集中です', 'query-state', true));
      ui.lastElementChild.disabled = true;
      ui.lastElementChild.style.cursor = 'default';
      ui.lastElementChild.style.opacity = '.65';
      return;
    }

    if (ready && confirmed) {
      status.textContent = '✅ 設計範囲を設定済み';
      ui.append(status, makeButton('📐 範囲を編集', 'edit-completed', false));
      rootReady(true);
      return;
    }

    rootReady(false);

    if (p.draftAvailable === true || p.paused === true) {
      status.textContent = '📐 作成途中の設計範囲があります';
      ui.append(status, makeButton('📐 範囲選択を再開', 'resume-draft', true));
      return;
    }

    if (p.completed === true) {
      status.textContent = '📐 設計範囲を決めてください';
      ui.append(status, makeButton('📍 POIを集める！', 'start-new', true));
      return;
    }

    status.textContent = '設計範囲はまだありません';
    ui.append(status, makeButton('📍 POIを集める！', 'start-new', true));
  }

  function rootReady(ready) {
    const root = findRoot();
    if (!root) return;
    root.dataset.n4PolygonReady = ready ? 'true' : 'false';

    for (const child of Array.from(root.children)) {
      if (child.id === UI_ID) continue;
      child.style.display = ready ? '' : 'none';
    }

    if (!ready) return;
    const sendButton = Array.from(root.querySelectorAll('button')).find(button =>
      !button.closest('#' + UI_ID) && !button.disabled
    );
    if (sendButton && !sendButton.dataset.n4SendLabelApplied) {
      sendButton.dataset.n4SendLabelApplied = 'true';
      sendButton.textContent = '🌉 Campsiteへ送信！';
    }
  }

  window.addEventListener(PANEL_STATE_EVENT, event => {
    let detail;
    try { detail = JSON.parse(String(event.detail || '{}')); } catch (_) { return; }
    if (!detail || typeof detail !== 'object') return;
    render(detail);
  });

  const observer = new MutationObserver(() => {
    if (!mounted && latest) render(latest);
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  send('query-state');

  window.CampsiteBridgeAndroidN4PanelUi = Object.freeze({
    stateEvent: PANEL_STATE_EVENT,
    commandEvent: PANEL_COMMAND_EVENT
  });
})();
