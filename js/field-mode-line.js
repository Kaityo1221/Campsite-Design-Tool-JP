(() => {
  'use strict';

  function loadOnce(src, marker) {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.setAttribute(marker, '1');
    document.head.appendChild(script);
  }

  loadOnce('js/field-mode-area.js?v=1', 'data-field-area-loader');
  loadOnce('js/field-mode-eraser.js?v=1', 'data-field-eraser-loader');
  loadOnce('js/field-mode-tool-return.js?v=2', 'data-field-tool-return-loader');
  loadOnce('js/field-mode-distance-tool.js?v=1', 'data-field-distance-tool-loader');
  loadOnce('js/field-mode-circle-options.js?v=1', 'data-field-circle-options-loader');

  if (new URLSearchParams(window.location.search).has('handoff')) {
    loadOnce('js/field-mode-handoff.js?v=1', 'data-field-handoff-loader');
  }
})();
