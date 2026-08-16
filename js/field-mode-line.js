(() => {
  'use strict';

  function loadOnce(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  function installCreativeLayoutFix() {
    if (document.querySelector('style[data-field-creative-layout-fix]')) return;
    const style = document.createElement('style');
    style.dataset.fieldCreativeLayoutFix = '1';
    style.textContent = `
      /* CREATIVE MODE manual-test polish: keep primary controls clear of Leaflet and the history bar. */
      .field-mode-entry-started .field-mode-creative-launcher{
        left:12px!important;
        top:108px!important;
        z-index:780!important;
      }
      .field-mode-entry-started .field-location-badge{
        left:12px!important;
        bottom:76px!important;
        z-index:760!important;
        max-width:min(230px,52vw)!important;
        pointer-events:auto!important;
      }
      .field-mode-entry-started:not(.field-creative-active) .field-mode-poi-controls{
        display:none!important;
      }
      .field-mode-entry-started.field-creative-active .field-mode-poi-controls{
        display:none!important;
      }
      .field-mode-entry-started.field-creative-active.field-creative-tool-poi .field-mode-poi-controls{
        display:flex!important;
        right:12px!important;
        bottom:96px!important;
        z-index:780!important;
      }
      .field-mode-entry-started.field-creative-active .field-location-badge{
        bottom:96px!important;
      }
      .field-mode-entry-started.field-creative-active.field-creative-menu-open .field-location-badge{
        bottom:148px!important;
      }
      @media(max-width:520px){
        .field-mode-entry-started .field-mode-creative-launcher{left:10px!important;top:104px!important}
        .field-mode-entry-started .field-location-badge{left:10px!important;bottom:74px!important;max-width:min(220px,58vw)!important}
        .field-mode-entry-started.field-creative-active .field-location-badge{bottom:94px!important}
        .field-mode-entry-started.field-creative-active.field-creative-menu-open .field-location-badge{bottom:144px!important}
        .field-mode-entry-started.field-creative-active.field-creative-tool-poi .field-mode-poi-controls{right:10px!important;bottom:94px!important}
      }
    `;
    document.head.appendChild(style);
  }

  installCreativeLayoutFix();

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