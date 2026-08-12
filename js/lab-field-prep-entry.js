(() => {
  'use strict';

  function addFieldPrepEntry() {
    const header = document.querySelector('.lab-standalone-header');
    if (!header || document.getElementById('labFieldPrepEntry')) return;

    const fieldLink = header.querySelector('a[href="field-mode.html"]');
    const entry = document.createElement('a');
    entry.id = 'labFieldPrepEntry';
    entry.href = 'field-prep.html';
    entry.textContent = '🧭 現地準備';
    entry.setAttribute('aria-label', '現地モード準備を開く');
    entry.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'gap:5px',
      'margin-left:8px',
      'padding:7px 12px',
      'min-height:34px',
      'border:1px solid #6f7c57',
      'border-radius:999px',
      'background:linear-gradient(180deg,#f5f0df,#e5dcc4)',
      'color:#39422f',
      'text-decoration:none',
      'font-size:12px',
      'font-weight:900',
      'box-shadow:0 3px 10px rgba(47,42,34,.12)',
      '-webkit-tap-highlight-color:transparent'
    ].join(';');

    if (fieldLink) fieldLink.insertAdjacentElement('beforebegin', entry);
    else header.prepend(entry);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addFieldPrepEntry, { once: true });
  } else {
    addFieldPrepEntry();
  }
})();
