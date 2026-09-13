(() => {
  'use strict';

  function ensureStylesheet(id, href) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function ensureScript(id, src, onload = null) {
    const existing = document.getElementById(id);
    if (existing) {
      if (onload) onload();
      return;
    }

    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
    if (onload) script.addEventListener('load', onload, { once: true });
    document.head.appendChild(script);
  }

  function loadPlacementStrategyAssets() {
    ensureStylesheet(
      'placementStrategyStylesheet',
      'css/placement-strategy.css?v=20260914-v2'
    );
    ensureStylesheet(
      'placementStrategyZonesStylesheet',
      'css/placement-strategy-zones.css?v=20260914-v1'
    );

    ensureScript(
      'placementStrategyScript',
      'js/placement-strategy.js?v=20260914-v2',
      () => {
        ensureScript(
          'placementStrategyZonesScript',
          'js/placement-strategy-zones.js?v=20260914-v1'
        );
      }
    );
  }

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

  loadPlacementStrategyAssets();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addLabHeaderEntries, { once: true });
  else addLabHeaderEntries();
})();
