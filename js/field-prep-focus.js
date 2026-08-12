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

  const exitButton = document.createElement('button');
  exitButton.type = 'button';
  exitButton.className = 'field-prep-focus-exit';
  exitButton.setAttribute('aria-label', '地図集中モードを閉じる');
  exitButton.textContent = '×';
  surveySection.appendChild(exitButton);

  let focusActive = false;
  let pausedDraft = false;
  let returnScrollY = 0;

  function nudgeMapLayout() {
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      window.setTimeout(() => window.dispatchEvent(new Event('resize')), 120);
    });
  }

  function rememberMapPosition() {
    const rect = mapShell.getBoundingClientRect();
    returnScrollY = Math.max(0, window.scrollY + rect.top - 12);
  }

  function restoreMapPosition() {
    window.requestAnimationFrame(() => {
      window.scrollTo(0, returnScrollY);
      window.requestAnimationFrame(() => window.scrollTo(0, returnScrollY));
    });
  }

  function enterFocusMode() {
    if (focusActive) return;
    rememberMapPosition();
    focusActive = true;
    document.documentElement.classList.add('field-prep-map-focus-root');
    document.body.classList.add('field-prep-map-focus');
    nudgeMapLayout();
  }

  function exitFocusMode({ pause = false } = {}) {
    if (!focusActive) return;
    focusActive = false;
    pausedDraft = pause;
    document.documentElement.classList.remove('field-prep-map-focus-root');
    document.body.classList.remove('field-prep-map-focus');
    if (pause) startButton.textContent = '調査範囲の編集を続ける';
    nudgeMapLayout();
    restoreMapPosition();
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