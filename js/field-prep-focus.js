(() => {
  'use strict';

  const surveySection = document.getElementById('fieldPrepSurveySection');
  const mapShell = surveySection?.querySelector('.field-prep-map-shell');
  const mapElement = document.getElementById('fieldPrepMap');
  const startButton = document.getElementById('fieldPrepStartAreaButton');
  const confirmButton = document.getElementById('fieldPrepConfirmAreaButton');
  const resetButton = document.getElementById('fieldPrepResetAreaButton');
  const addVertexButton = document.getElementById('fieldPrepAddVertexButton');
  const undoVertexButton = document.getElementById('fieldPrepUndoVertexButton');

  if (!surveySection || !mapShell || !mapElement || !startButton || !confirmButton) return;

  const style = document.createElement('style');
  style.textContent = `
    .field-prep-map-gate{position:absolute;inset:0;z-index:700;display:flex;align-items:flex-end;justify-content:center;padding:0 12px 12px;touch-action:pan-y;pointer-events:auto;background:transparent}
    .field-prep-map-gate span{display:inline-flex;align-items:center;gap:6px;padding:7px 10px;border:1px solid rgba(91,78,58,.2);border-radius:999px;background:rgba(255,252,244,.9);color:#5c5141;font-size:11px;font-weight:800;box-shadow:0 3px 12px rgba(47,42,34,.12);pointer-events:none}
    body.field-prep-map-focus .field-prep-map-gate{pointer-events:none;opacity:0}
  `;
  document.head.appendChild(style);

  const gate = document.createElement('div');
  gate.className = 'field-prep-map-gate';
  gate.setAttribute('aria-hidden', 'true');
  gate.innerHTML = '<span>🗺️ 地図操作は「調査範囲を設定」から</span>';
  mapShell.appendChild(gate);

  const exitButton = document.createElement('button');
  exitButton.type = 'button';
  exitButton.className = 'field-prep-focus-exit';
  exitButton.setAttribute('aria-label', '地図集中モードを閉じる');
  exitButton.textContent = '×';
  surveySection.appendChild(exitButton);

  let focusActive = false;
  let pausedDraft = false;

  function nudgeMapLayout() {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    });
  }

  function enterFocusMode() {
    if (focusActive) return;
    focusActive = true;
    document.documentElement.classList.add('field-prep-map-focus-root');
    document.body.classList.add('field-prep-map-focus');
    gate.setAttribute('aria-hidden', 'true');
    nudgeMapLayout();
  }

  function exitFocusMode({ pause = false } = {}) {
    if (!focusActive) return;
    focusActive = false;
    pausedDraft = pause;
    document.documentElement.classList.remove('field-prep-map-focus-root');
    document.body.classList.remove('field-prep-map-focus');
    gate.setAttribute('aria-hidden', 'false');
    if (pause) startButton.textContent = '調査範囲の編集を続ける';
    nudgeMapLayout();
  }

  startButton.addEventListener('click', event => {
    if (!pausedDraft) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    pausedDraft = false;
    enterFocusMode();
  }, true);

  startButton.addEventListener('click', () => {
    if (!pausedDraft) enterFocusMode();
  });

  exitButton.addEventListener('click', () => {
    exitFocusMode({ pause: true });
  });

  confirmButton.addEventListener('click', () => {
    pausedDraft = false;
    window.setTimeout(() => {
      exitFocusMode();
      startButton.textContent = '調査範囲を編集';
    }, 0);
  });

  resetButton?.addEventListener('click', () => {
    pausedDraft = false;
    exitFocusMode();
    startButton.textContent = '調査範囲を設定';
  });

  addVertexButton?.addEventListener('click', () => {
    if (!focusActive) enterFocusMode();
  });

  undoVertexButton?.addEventListener('click', () => {
    if (!focusActive) enterFocusMode();
  });

  window.addEventListener('pagehide', () => {
    document.documentElement.classList.remove('field-prep-map-focus-root');
    document.body.classList.remove('field-prep-map-focus');
  });

  window.FieldPrepFocus = {
    enter: enterFocusMode,
    exit: () => exitFocusMode(),
    isActive: () => focusActive
  };
})();
