(() => {
  'use strict';
  if(document.querySelector('script[data-field-area-loader]'))return;
  const script=document.createElement('script');
  script.src='js/field-mode-area.js?v=1';
  script.dataset.fieldAreaLoader='1';
  document.head.appendChild(script);
})();
