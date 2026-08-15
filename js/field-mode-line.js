(() => {
  'use strict';

  function loadOnce(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  loadOnce('js/field-mode-area.js?v=3', 'data-field-area-loader');
  loadOnce('js/field-mode-eraser.js?v=2', 'data-field-eraser-loader');
  loadOnce('js/field-mode-tool-return.js?v=3', 'data-field-tool-return-loader');
  loadOnce('js/field-mode-distance-tool.js?v=3', 'data-field-distance-tool-loader');
  loadOnce('js/field-mode-circle-options.js?v=5', 'data-field-circle-options-loader');
  loadOnce('js/field-mode-session-30m.js?v=2', 'data-field-session-circles-loader');
  loadOnce('js/field-mode-map-first.js?v=1', 'data-field-map-first-loader');
  loadOnce('js/field-mode-basemap-switch.js?v=1', 'data-field-basemap-switch-loader');
  loadOnce('js/field-mode-apac-v4.js?v=1', 'data-field-apac-v4-loader');

  function syncFinishLabel() {
    const button = document.getElementById('fieldModeSaveButton');
    const note = document.getElementById('fieldModeSaveNote');
    if (!button) return false;
    const label = '設計完成：KMZ＋但し書きを出力';
    if (button.textContent !== label) button.textContent = label;
    button.setAttribute('aria-label', '完成KMZと必要な50m未満但し書きを端末へ出力');
    if (note) note.textContent = button.disabled
      ? 'ゲームスポットを読み込むと設計データを出力できます。'
      : '完成KMZを生成し、50m未満がある場合は但し書きTXTも同時生成します。';
    return true;
  }

  const finishTimer = setInterval(() => {
    if (!syncFinishLabel()) return;
    const button = document.getElementById('fieldModeSaveButton');
    new MutationObserver(syncFinishLabel).observe(button, {
      attributes: true,
      attributeFilter: ['disabled'],
      childList: true,
      subtree: true,
      characterData: true
    });
    clearInterval(finishTimer);
  }, 50);
  setTimeout(() => clearInterval(finishTimer), 10000);

  if (new URLSearchParams(window.location.search).has('handoff')) {
    loadOnce('js/field-mode-handoff.js?v=1', 'data-field-handoff-loader');
  }
})();
