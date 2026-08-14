(() => {
  'use strict';

  function makeHeaderLink({ id, href, text, ariaLabel, border, background, color }) {
    const entry = document.createElement('a');
    entry.id = id;
    entry.href = href;
    entry.textContent = text;
    entry.setAttribute('aria-label', ariaLabel);
    entry.style.cssText = [
      'display:inline-flex',
      'align-items:center',
      'justify-content:center',
      'gap:5px',
      'margin-left:8px',
      'padding:7px 12px',
      'min-height:34px',
      `border:1px solid ${border}`,
      'border-radius:999px',
      `background:${background}`,
      `color:${color}`,
      'text-decoration:none',
      'font-size:12px',
      'font-weight:900',
      'box-shadow:0 3px 10px rgba(47,42,34,.12)',
      '-webkit-tap-highlight-color:transparent'
    ].join(';');
    return entry;
  }

  function addLabHeaderEntries() {
    const header = document.querySelector('.lab-standalone-header');
    if (!header) return;

    const fieldLink = header.querySelector('a[href="field-mode.html"]');
    header.style.position = 'relative';

    if (!document.getElementById('labPoiReviewEntry')) {
      const reviewEntry = makeHeaderLink({
        id: 'labPoiReviewEntry',
        href: 'poi-review-preview.html',
        text: '🧩 POIレビュー PREVIEW',
        ariaLabel: '未分類POIレビュープレビューを開く',
        border: '#5b78a6',
        background: 'linear-gradient(180deg,#eef6ff,#dcecff)',
        color: '#243b62'
      });
      reviewEntry.style.position = 'absolute';
      reviewEntry.style.top = '0';
      reviewEntry.style.right = '0';
      reviewEntry.style.marginLeft = '0';
      reviewEntry.style.zIndex = '4';
      reviewEntry.style.maxWidth = '48vw';
      reviewEntry.style.whiteSpace = 'nowrap';
      header.appendChild(reviewEntry);
    }

    if (!document.getElementById('labFieldPrepEntry')) {
      const prepEntry = makeHeaderLink({
        id: 'labFieldPrepEntry',
        href: 'field-prep.html',
        text: '🧭 現地準備',
        ariaLabel: '現地モード準備を開く',
        border: '#6f7c57',
        background: 'linear-gradient(180deg,#f5f0df,#e5dcc4)',
        color: '#39422f'
      });
      if (fieldLink) fieldLink.insertAdjacentElement('beforebegin', prepEntry);
      else header.prepend(prepEntry);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addLabHeaderEntries, { once: true });
  } else {
    addLabHeaderEntries();
  }
})();
