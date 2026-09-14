(() => {
  'use strict';

  const currentPath = window.location.pathname.replace(/\/+$/, '');
  if (!currentPath.endsWith('/lab.html')) return;

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

  function injectPlacementStrategyPortal() {
    if (document.getElementById('labPlacementStrategyPortal')) return;
    const panel = document.querySelector('.lab-main-panel');
    const guide = document.querySelector('.lab-user-guide');
    if (!panel) return;

    const portal = document.createElement('a');
    portal.id = 'labPlacementStrategyPortal';
    portal.href = 'placement-strategy.html';
    portal.setAttribute('aria-label', '配置戦略・布陣図を開く');
    portal.innerHTML = `
      <span class="lab-placement-portal__icon">🏯</span>
      <span class="lab-placement-portal__body">
        <small>PLACEMENT STRATEGY</small>
        <strong>配置戦略・布陣図</strong>
        <em>50m原則・距離比較・候補配置を専用画面で検討</em>
      </span>
      <span class="lab-placement-portal__arrow">›</span>
    `;

    const style = document.createElement('style');
    style.id = 'labPlacementStrategyPortalStyle';
    style.textContent = `
      #labPlacementStrategyPortal {
        display:grid;
        grid-template-columns:auto minmax(0,1fr) auto;
        gap:12px;
        align-items:center;
        margin:16px 0 18px;
        padding:15px 16px;
        border:1px solid rgba(167,139,250,.46);
        border-radius:18px;
        background:radial-gradient(circle at 92% 8%,rgba(168,85,247,.16),transparent 34%),linear-gradient(135deg,rgba(76,29,149,.24),rgba(15,23,42,.92));
        color:#f8fafc;
        text-decoration:none;
        box-shadow:0 12px 30px rgba(15,23,42,.24),inset 0 1px 0 rgba(255,255,255,.05);
        -webkit-tap-highlight-color:transparent;
      }
      #labPlacementStrategyPortal:active { transform:translateY(1px); }
      .lab-placement-portal__icon { display:grid;place-items:center;width:46px;height:46px;border-radius:14px;background:rgba(124,58,237,.18);font-size:25px; }
      .lab-placement-portal__body { min-width:0;display:flex;flex-direction:column;gap:2px; }
      .lab-placement-portal__body small { color:#a78bfa;font-size:9px;font-weight:900;letter-spacing:.14em; }
      .lab-placement-portal__body strong { color:#f5f3ff;font-size:17px;font-weight:950; }
      .lab-placement-portal__body em { color:#cbd5e1;font-size:11px;line-height:1.5;font-style:normal; }
      .lab-placement-portal__arrow { color:#c4b5fd;font-size:30px;font-weight:300; }
    `;
    document.head.appendChild(style);

    if (guide) guide.insertAdjacentElement('beforebegin', portal);
    else panel.querySelector('.lab-secret-tag')?.insertAdjacentElement('afterend', portal);
  }

  function hideLegacyPlacementSection() {
    const heading = Array.from(document.querySelectorAll('.lab-main-panel h3')).find(node =>
      (node.textContent || '').includes('配置余地チェック')
    );
    if (!heading) return;

    let node = heading;
    let guard = 0;
    while (node && guard < 20) {
      const next = node.nextElementSibling;
      node.style.display = 'none';
      if (node.id === 'capacityResult') break;
      node = next;
      guard += 1;
    }

    const migratedPreview = document.getElementById('placementStrategyFinalPreview');
    if (migratedPreview) migratedPreview.style.display = 'none';
  }

  function initializeLabEntries() {
    addLabHeaderEntries();
    injectPlacementStrategyPortal();
    hideLegacyPlacementSection();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeLabEntries, { once: true });
  } else {
    initializeLabEntries();
  }
})();