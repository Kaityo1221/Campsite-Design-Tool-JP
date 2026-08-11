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
})();
