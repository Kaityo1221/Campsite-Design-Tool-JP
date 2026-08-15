(() => {
  'use strict';

  function makeHeaderLink({ id, href, text, ariaLabel, border, background, color }) {
    const entry = document.createElement('a');
    entry.id = id;
    entry.href = href;
    entry.textContent = text;
    entry.setAttribute('aria-label', ariaLabel);
    entry.style.cssText = [
      'display:inline-flex','align-items:center','justify-content:center','gap:5px','padding:7px 12px','min-height:34px',
      `border:1px solid ${border}`,'border-radius:999px',`background:${background}`,`color:${color}`,'text-decoration:none',
      'font-size:12px','font-weight:900','box-shadow:0 3px 10px rgba(47,42,34,.12)','-webkit-tap-highlight-color:transparent'
    ].join(';');
    return entry;
  }

  function placeRightStack(entry, topPx, maxWidth) {
    entry.style.position = 'absolute';
    entry.style.top = `${topPx}px`;
    entry.style.right = '0';
    entry.style.margin = '0';
    entry.style.zIndex = '4';
    entry.style.maxWidth = maxWidth;
    entry.style.whiteSpace = 'nowrap';
  }

  function placeFieldEntry(header) {
    const fieldEntry = header.querySelector('a[href="field-mode.html"]');
    if (!fieldEntry) return;

    // FIELDは右側のPOIレビュー群から切り離し、左側の独立した段に置く。
    fieldEntry.style.display = 'flex';
    fieldEntry.style.width = 'fit-content';
    fieldEntry.style.margin = '74px 0 0';
    fieldEntry.style.position = 'relative';
    fieldEntry.style.left = '0';
    fieldEntry.style.top = '0';
    fieldEntry.style.zIndex = '2';
  }

  function addLabHeaderEntries() {
    const header = document.querySelector('.lab-standalone-header');
    if (!header) return;
    header.style.position = 'relative';

    let prepEntry = document.getElementById('labFieldPrepEntry');
    if (!prepEntry) {
      prepEntry = makeHeaderLink({id:'labFieldPrepEntry',href:'field-prep.html',text:'🧭 現地準備',ariaLabel:'現地モード準備を開く',border:'#6f7c57',background:'linear-gradient(180deg,#f5f0df,#e5dcc4)',color:'#39422f'});
      header.appendChild(prepEntry);
    }
    placeRightStack(prepEntry, 0, '46vw');

    let reviewEntry = document.getElementById('labPoiReviewEntry');
    if (!reviewEntry) {
      reviewEntry = makeHeaderLink({id:'labPoiReviewEntry',href:'poi-review.html',text:'🧩 POIレビュー',ariaLabel:'未分類POIレビューを開く',border:'#5b78a6',background:'linear-gradient(180deg,#eef6ff,#dcecff)',color:'#243b62'});
      header.appendChild(reviewEntry);
    }
    placeRightStack(reviewEntry, 42, '48vw');

    placeFieldEntry(header);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addLabHeaderEntries, { once: true });
  else addLabHeaderEntries();
})();
