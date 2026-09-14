/* Campsite creation flow compact UI
   2026-09-14
   - Keep the existing generation logic intact.
   - Compact the start modal and preparation guide.
   - Put the main manual entry at the top of the KMZ tool.
   - Shorten STEP 1 / fold STEP 2 guidance.
   - Move Sponsor POI into a collapsed auxiliary section after KMZ generation.
*/
(() => {
  'use strict';

  const STYLE_ID = 'campsiteFlowCompactStyles';
  const MANUAL_TOP_ID = 'campsiteManualTop';
  const SPONSOR_AUX_ID = 'sponsorPoiAuxiliary';
  let applyQueued = false;

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      /* Start modal: keep the tent visible and reduce vertical occupation. */
      .campsite-csv-modal{
        align-items:flex-start!important;
        overflow-y:auto!important;
        padding:calc(12px + env(safe-area-inset-top)) 12px calc(22px + env(safe-area-inset-bottom))!important;
      }
      .campsite-csv-modal-card{
        width:min(100%,540px)!important;
        margin:6px auto 18px!important;
        padding:16px!important;
        border-radius:20px!important;
      }
      .campsite-csv-modal-icon{
        margin:0 0 3px!important;
        font-size:27px!important;
        line-height:1.1!important;
      }
      .campsite-csv-modal-card h3{
        margin:2px 0 4px!important;
        font-size:19px!important;
        line-height:1.35!important;
      }
      .campsite-csv-modal-card > p.note{
        margin:0 0 7px!important;
        font-size:12px!important;
        line-height:1.45!important;
      }
      .campsite-csv-choice-button{
        min-height:68px!important;
        margin-top:8px!important;
        padding:10px 12px!important;
        gap:10px!important;
        border-radius:14px!important;
      }
      .campsite-csv-choice-icon{
        width:28px!important;
        min-width:28px!important;
        font-size:23px!important;
        line-height:1!important;
        text-align:center!important;
      }
      .campsite-csv-choice-button span:last-child{gap:2px!important;min-width:0!important}
      .campsite-csv-choice-button strong{
        font-size:15px!important;
        line-height:1.3!important;
      }
      .campsite-csv-choice-button small{
        font-size:11px!important;
        line-height:1.35!important;
      }
      .campsite-csv-close-button{
        margin-top:10px!important;
        padding:7px 16px!important;
        font-size:12px!important;
      }

      /* Main manual: compact, first thing under the KMZ tool title. */
      #tool #${MANUAL_TOP_ID}{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        margin:0 0 12px;
        padding:10px 12px;
        border:1px solid rgba(96,165,250,.44);
        border-radius:14px;
        background:linear-gradient(135deg,rgba(37,99,235,.12),rgba(79,70,229,.12));
        box-shadow:inset 0 1px 0 rgba(255,255,255,.04);
      }
      #tool #${MANUAL_TOP_ID} .campsite-manual-top-copy{min-width:0;display:grid;gap:2px}
      #tool #${MANUAL_TOP_ID} strong{color:#f8fafc;font-size:14px;line-height:1.3}
      #tool #${MANUAL_TOP_ID} small{color:#94a3b8;font-size:10px;line-height:1.35}
      #tool #${MANUAL_TOP_ID} .campsite-manual-top-link{
        flex:0 0 auto;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:42px;
        margin:0;
        padding:9px 13px;
        border:1px solid rgba(147,197,253,.62);
        border-radius:12px;
        background:linear-gradient(180deg,#2563eb,#1d4ed8);
        color:#fff;
        font-size:13px;
        font-weight:900;
        text-decoration:none;
        box-shadow:inset 0 1px 0 rgba(255,255,255,.14),0 6px 16px rgba(29,78,216,.20);
      }

      /* STEP 1: say only what the user does. */
      #tool #wayfarerCsvStep.campsite-step-one-compact{
        padding:14px!important;
      }
      #tool #wayfarerCsvStep.campsite-step-one-compact h3::after{
        content:"POIを一括抽出"!important;
        font-size:18px!important;
      }
      #tool #wayfarerCsvStep.campsite-step-one-compact .campsite-step-brief{
        margin:4px 0 10px!important;
        color:#cbd5e1!important;
        font-size:13px!important;
        line-height:1.55!important;
      }
      #tool #wayfarerCsvStep.campsite-step-one-compact .link-btn{
        min-height:48px!important;
        margin-top:6px!important;
        padding:11px 12px!important;
        font-size:14px!important;
      }

      /* STEP 2: fold explanations instead of filling a whole screen. */
      #tool .campsite-file-guide.campsite-file-guide-compact{
        display:grid!important;
        gap:8px!important;
        margin:0 0 10px!important;
      }
      #tool .campsite-file-guide-fold{
        margin:0;
        border:1px solid rgba(56,189,248,.25);
        border-radius:12px;
        background:rgba(14,165,233,.055);
        overflow:hidden;
      }
      #tool .campsite-file-guide-fold.update{
        border-color:rgba(167,139,250,.28);
        background:rgba(124,58,237,.055);
      }
      #tool .campsite-file-guide-fold > summary{
        display:flex;
        align-items:center;
        justify-content:space-between;
        min-height:44px;
        padding:9px 12px;
        list-style:none;
        cursor:pointer;
        color:#f8fafc;
        font-size:13px;
        font-weight:900;
      }
      #tool .campsite-file-guide-fold > summary::-webkit-details-marker{display:none}
      #tool .campsite-file-guide-fold > summary::after{
        content:"＋";
        color:#7dd3fc;
        font-size:16px;
        font-weight:900;
        transition:transform .16s ease;
      }
      #tool .campsite-file-guide-fold[open] > summary::after{transform:rotate(45deg)}
      #tool .campsite-file-guide-fold > .campsite-file-guide-fold-body{
        padding:0 12px 11px;
        color:#cbd5e1;
        font-size:12px;
        line-height:1.55;
      }
      #tool .campsite-file-guide-fold-body p{margin:0}
      #tool .campsite-mods-help{
        margin-top:8px;
        border-top:1px solid rgba(148,163,184,.16);
        padding-top:7px;
      }
      #tool .campsite-mods-help > summary{
        list-style:none;
        cursor:pointer;
        color:#93c5fd;
        font-size:10px;
        font-weight:850;
        line-height:1.4;
      }
      #tool .campsite-mods-help > summary::-webkit-details-marker{display:none}
      #tool .campsite-mods-help > summary::before{content:"▶ ";font-size:9px}
      #tool .campsite-mods-help[open] > summary::before{content:"▼ ";}
      #tool .campsite-mods-help p{
        margin:6px 0 0!important;
        color:#94a3b8!important;
        font-size:10px!important;
        line-height:1.55!important;
      }
      #tool .campsite-file-guide-warning{
        margin-top:10px!important;
        padding:9px 11px!important;
        font-size:11px!important;
        line-height:1.55!important;
      }

      /* Sponsor POI: auxiliary action after KMZ generation, closed by default. */
      #tool #${SPONSOR_AUX_ID}{
        margin:10px 0 12px;
        border:1px solid rgba(34,211,238,.22);
        border-radius:14px;
        background:rgba(8,47,73,.12);
        overflow:hidden;
      }
      #tool #${SPONSOR_AUX_ID} > summary{
        display:flex;
        align-items:center;
        justify-content:space-between;
        min-height:48px;
        padding:10px 13px;
        list-style:none;
        cursor:pointer;
        color:#cffafe;
        font-size:13px;
        font-weight:900;
      }
      #tool #${SPONSOR_AUX_ID} > summary::-webkit-details-marker{display:none}
      #tool #${SPONSOR_AUX_ID} > summary::after{content:"＋";color:#67e8f9;font-size:17px}
      #tool #${SPONSOR_AUX_ID}[open] > summary::after{content:"×"}
      #tool #${SPONSOR_AUX_ID} .sponsor-poi-aux-note{
        margin:0;
        padding:0 13px 10px;
        color:#94a3b8;
        font-size:10px;
        line-height:1.5;
      }
      #tool #${SPONSOR_AUX_ID} .sponsor-poi-box{
        margin:0 10px 10px!important;
        padding:13px!important;
      }
      #tool #${SPONSOR_AUX_ID} .sponsor-poi-head h3{font-size:15px!important}
      #tool #${SPONSOR_AUX_ID} .sponsor-poi-note{font-size:11px!important;line-height:1.55!important}
      #tool #${SPONSOR_AUX_ID} .sponsor-poi-security{font-size:10px!important;line-height:1.5!important}

      /* Preparation guide: remain available, but do not consume the first screen. */
      details[data-dashboard-fold-enhanced="prep"] > summary{
        min-height:48px!important;
        padding:9px 12px!important;
      }
      details[data-dashboard-fold-enhanced="prep"] .dashboard-prep{
        padding:10px!important;
      }
      details[data-dashboard-fold-enhanced="prep"] .dashboard-prep .dashboard-list{
        display:grid!important;
        grid-template-columns:repeat(2,minmax(0,1fr))!important;
        gap:8px!important;
      }
      details[data-dashboard-fold-enhanced="prep"] .dashboard-prep .dashboard-button{
        min-height:62px!important;
        padding:9px 10px!important;
      }
      details[data-dashboard-fold-enhanced="prep"] .dashboard-manual-feature{
        grid-column:1/-1!important;
        min-height:62px!important;
        padding:10px 12px!important;
      }
      details[data-dashboard-fold-enhanced="prep"] .dashboard-manual-feature .dashboard-icon{
        width:34px!important;
        height:34px!important;
      }
      details[data-dashboard-fold-enhanced="prep"] .dashboard-manual-feature .dashboard-copy strong{font-size:14px!important}
      details[data-dashboard-fold-enhanced="prep"] .dashboard-manual-feature .dashboard-copy small{font-size:9px!important}

      @media(max-width:520px){
        .campsite-csv-modal{padding-left:10px!important;padding-right:10px!important}
        .campsite-csv-modal-card{padding:14px!important}
        .campsite-csv-choice-button{min-height:64px!important;padding:9px 10px!important}
        .campsite-csv-choice-button strong{font-size:14px!important}
        .campsite-csv-choice-button small{font-size:10.5px!important}
        #tool #${MANUAL_TOP_ID}{padding:9px 10px;gap:9px}
        #tool #${MANUAL_TOP_ID} small{display:none}
        #tool #${MANUAL_TOP_ID} .campsite-manual-top-link{min-height:40px;padding:8px 11px;font-size:12px}
        details[data-dashboard-fold-enhanced="prep"] .dashboard-prep .dashboard-list{grid-template-columns:1fr 1fr!important}
      }
    `;
    document.head.appendChild(style);
  }

  function setupTopManual() {
    const panel = document.querySelector('#tool > .panel');
    if (!panel) return;

    const originalLink = panel.querySelector('a[href*="docs/campsite-guide.pdf"]');
    const originalStep = originalLink?.closest('.step');
    if (originalStep) {
      originalStep.classList.add('campsite-original-manual-step');
      originalStep.style.setProperty('display', 'none', 'important');
    }

    if (document.getElementById(MANUAL_TOP_ID)) return;

    const box = document.createElement('div');
    box.id = MANUAL_TOP_ID;
    box.innerHTML = `
      <span class="campsite-manual-top-copy">
        <strong>📘 マニュアルPDF</strong>
        <small>初めての方は最初に確認</small>
      </span>
      <a class="campsite-manual-top-link" href="docs/campsite-guide.pdf" target="_blank" rel="noopener">開く</a>
    `;

    const heading = panel.querySelector(':scope > h2');
    if (heading) heading.insertAdjacentElement('afterend', box);
    else panel.prepend(box);
  }

  function setupStepOne() {
    const step = document.getElementById('wayfarerCsvStep');
    if (!step) return;

    step.classList.add('campsite-step-one-compact');

    const heading = step.querySelector(':scope > h3');
    if (heading && heading.textContent !== 'POIを一括抽出') {
      heading.textContent = 'POIを一括抽出';
    }

    const firstParagraph = Array.from(step.children).find(el => el.tagName === 'P' && !el.classList.contains('note'));
    if (firstParagraph) {
      firstParagraph.classList.add('campsite-step-brief');
      if (firstParagraph.textContent.trim() !== 'Wayfarer Mapから周辺POIをCSVで抽出します。') {
        firstParagraph.textContent = 'Wayfarer Mapから周辺POIをCSVで抽出します。';
      }
    }
  }

  function setupCompactFileGuide() {
    const input = document.getElementById('fileInput');
    const step = input?.closest('.step');
    const guide = step?.querySelector(':scope > .campsite-file-guide');
    if (!step || !guide) return;

    const isUpdate = document.getElementById('tool')?.classList.contains('csv-mode-update') === true;
    const mode = isUpdate ? 'update' : 'new';

    if (
      guide.dataset.compactMode === mode &&
      guide.querySelector('.campsite-file-guide-fold')
    ) {
      return;
    }

    guide.classList.add('campsite-file-guide-compact');
    guide.dataset.compactMode = mode;
    guide.innerHTML = `
      <details class="campsite-file-guide-fold new" ${isUpdate ? '' : 'open'}>
        <summary>新しくキャンプサイトを作る方</summary>
        <div class="campsite-file-guide-fold-body">
          <p>Wayfarer Mapから抽出したCSV、または自作CSVを選択します。</p>
          <details class="campsite-mods-help">
            <summary>Wayfarer Map Modsを使う場合</summary>
            <p>「Display inactive Power Spots the same as active」をONにしてから Nearby Wayspots でCSVを出力してください。</p>
          </details>
        </div>
      </details>
      <details class="campsite-file-guide-fold update" ${isUpdate ? 'open' : ''}>
        <summary>既存のキャンプサイトを更新する方</summary>
        <div class="campsite-file-guide-fold-body">
          <p>Google My Mapsから書き出した地図全体のKMZを選択します。</p>
        </div>
      </details>
    `;
  }

  function setupSponsorAuxiliary() {
    const box = document.getElementById('sponsorPoiBox');
    const generateButton = document.querySelector('#tool button.generate[onclick*="generateKMZ"]');
    const generateStep = generateButton?.closest('.step');
    if (!box || !generateStep) return;

    let details = document.getElementById(SPONSOR_AUX_ID);
    if (!details) {
      details = document.createElement('details');
      details.id = SPONSOR_AUX_ID;
      details.innerHTML = `
        <summary>🏪 スポンサーPOIを追加（必要な場合）</summary>
        <p class="sponsor-poi-aux-note">KMZ生成後の補助操作です。スポンサーPOIを追加した場合は、KMZをもう一度生成してください。</p>
      `;
      generateStep.insertAdjacentElement('afterend', details);
    } else if (details.previousElementSibling !== generateStep) {
      generateStep.insertAdjacentElement('afterend', details);
    }

    if (box.parentElement !== details) {
      details.appendChild(box);
    }
  }

  function compactPreparationGuide() {
    const details = document.querySelector('details[data-dashboard-fold-enhanced="prep"]');
    if (!details || details.dataset.compactDefaultApplied === '1') return;
    details.dataset.compactDefaultApplied = '1';
    details.open = false;
  }

  function applyCompactUi() {
    ensureStyles();
    setupTopManual();
    setupStepOne();
    setupCompactFileGuide();
    setupSponsorAuxiliary();
    compactPreparationGuide();
  }

  function queueApply() {
    if (applyQueued) return;
    applyQueued = true;
    requestAnimationFrame(() => {
      applyQueued = false;
      applyCompactUi();
    });
  }

  function wrapModeSwitch() {
    const original = window.applyCampsiteCsvMode;
    if (typeof original !== 'function' || original.__campsiteCompactWrapped) return;

    const wrapped = function(...args) {
      const result = original.apply(this, args);
      setTimeout(queueApply, 0);
      setTimeout(queueApply, 80);
      return result;
    };
    Object.defineProperty(wrapped, '__campsiteCompactWrapped', { value: true });
    window.applyCampsiteCsvMode = wrapped;
  }

  function observeUi() {
    const root = document.getElementById('tool') || document.body;
    if (!root || root.dataset.campsiteCompactObserved === '1') return;
    root.dataset.campsiteCompactObserved = '1';

    const observer = new MutationObserver(queueApply);
    observer.observe(root, { childList: true, subtree: true });
  }

  function setup() {
    applyCompactUi();
    wrapModeSwitch();
    observeUi();

    [80, 250, 600, 1200, 2200].forEach(delay => {
      setTimeout(() => {
        wrapModeSwitch();
        applyCompactUi();
      }, delay);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
