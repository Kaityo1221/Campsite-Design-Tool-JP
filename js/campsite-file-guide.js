/* Campsite create/update file guide */
(() => {
  const STYLE_ID = 'campsiteFileGuideStyles';
  const SPONSOR_SCRIPT_ID = 'campsiteSponsorPoiScript';

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #tool .campsite-file-input-step > h3{margin:0 0 14px;color:#f8fafc;font-size:22px;line-height:1.45}
      #tool .campsite-file-guide{display:grid;gap:12px;margin:0 0 14px}
      #tool .campsite-file-guide-card{padding:14px 16px;border:1px solid rgba(56,189,248,.26);border-radius:14px;background:rgba(14,165,233,.07);color:#dbeafe;line-height:1.75}
      #tool .campsite-file-guide-card.update{border-color:rgba(167,139,250,.34);background:rgba(124,58,237,.09);color:#ede9fe}
      #tool .campsite-file-guide-card strong{display:block;margin-bottom:4px;color:#f8fafc;font-size:15px}
      #tool .campsite-file-guide-warning{margin:14px 0 0;padding:12px 14px;border:1px solid rgba(245,158,11,.42);border-radius:12px;background:rgba(245,158,11,.09);color:#fde68a;font-size:13px;line-height:1.7}
      #tool.csv-mode-update .campsite-file-guide-card.update{border-color:rgba(167,139,250,.72);box-shadow:0 0 0 1px rgba(167,139,250,.16) inset}
      .campsite-csv-choice-button.campsite-update-choice{border-color:rgba(167,139,250,.45);background:rgba(124,58,237,.11)}
    `;
    document.head.appendChild(style);
  }

  function ensureSponsorPoiScript() {
    if (document.getElementById(SPONSOR_SCRIPT_ID)) return;

    const script = document.createElement('script');
    script.id = SPONSOR_SCRIPT_ID;
    script.src = 'js/sponsor-poi.js?v=1';
    script.async = true;
    document.head.appendChild(script);
  }

  function setupFileGuide() {
    const input = document.getElementById('fileInput');
    const step = input?.closest('.step');
    if (!input || !step) return;

    step.classList.add('campsite-file-input-step');

    Array.from(step.children).forEach(el => {
      if (el === input || el.matches?.('h3,.step-no,.campsite-file-guide,.campsite-file-guide-warning')) return;

      const text = String(el.textContent || '').replace(/\s+/g, ' ').trim();
      if (
        text.includes('CSV ファイルを選択します') ||
        text.includes('CSVの使用を推奨します') ||
        text.includes('KML / KMZでは分類できない場合があります') ||
        text.includes('周辺POIは広めに抽出して大丈夫です') ||
        text.includes('複数のCSVをまとめて選択しても')
      ) {
        el.style.display = 'none';
      }
    });

    let heading = Array.from(step.children).find(el => el.tagName === 'H3');
    if (!heading) {
      heading = document.createElement('h3');
      step.querySelector(':scope > .step-no')?.insertAdjacentElement('afterend', heading);
    }
    heading.textContent = 'ファイルを選択';

    let guide = step.querySelector(':scope > .campsite-file-guide');
    if (!guide) {
      guide = document.createElement('div');
      guide.className = 'campsite-file-guide';
      heading.insertAdjacentElement('afterend', guide);
    }

    guide.innerHTML = `
      <div class="campsite-file-guide-card new">
        <strong>新しくキャンプサイトを作る方</strong>
        Wayfarer Mapから抽出したCSV、または自作CSVを選択してください。
      </div>
      <div class="campsite-file-guide-card update">
        <strong>すでにあるキャンプサイトを更新する方</strong>
        Google My Mapsから地図全体をKMZで書き出し、そのKMZを選択してください。<br>
        追加したPOIに必要な、足りない円だけを追加して新しいKMZを作成します。
      </div>
    `;

    let warning = step.querySelector(':scope > .campsite-file-guide-warning');
    if (!warning) {
      warning = document.createElement('div');
      warning.className = 'campsite-file-guide-warning';
      input.insertAdjacentElement('afterend', warning);
    }

    warning.innerHTML = '⚠️ Google My Mapsから<strong>書き出したCSVは使用しないでください。</strong><br>更新するときは、地図全体のKMZを使用してください。';
  }

  function setupStartModal() {
    const modal = document.getElementById('campsiteCsvModal');
    if (!modal) return;

    const title = modal.querySelector('#campsiteCsvModalTitle');
    if (title) title.textContent = 'キャンプサイト作成・更新';

    const lead = modal.querySelector('.campsite-csv-modal-card > p.note');
    if (lead) lead.textContent = '作業方法を選んでください。';

    if (modal.querySelector('.campsite-update-choice')) return;

    const closeButton = modal.querySelector('.campsite-csv-close-button');
    if (!closeButton) return;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'campsite-csv-choice-button campsite-update-choice';
    button.onclick = () => window.selectCampsiteCsvMode?.('update');
    button.innerHTML = `
      <span class="campsite-csv-choice-icon">🔄</span>
      <span>
        <strong>既存のキャンプサイトを更新する</strong>
        <small>My Mapsから書き出した地図全体のKMZを読み込みます</small>
      </span>
    `;

    closeButton.insertAdjacentElement('beforebegin', button);
  }

  const originalApply = window.applyCampsiteCsvMode;
  if (typeof originalApply === 'function') {
    window.applyCampsiteCsvMode = function(mode) {
      const tool = document.getElementById('tool');

      if (mode !== 'update') {
        tool?.classList.remove('csv-mode-update');
        const result = originalApply(mode);
        setupFileGuide();
        return result;
      }

      window.setWorkflowStep?.('csv');

      const wayfarer = document.getElementById('wayfarerCsvStep');
      const custom = document.getElementById('customCsvStep');
      const summary = document.getElementById('csvModeSummary');
      const summaryText = document.getElementById('csvModeSummaryText');

      if (wayfarer) wayfarer.style.display = 'none';
      if (custom) custom.style.display = 'none';

      tool?.classList.add('csv-mode-extracted', 'csv-mode-update');

      if (summaryText) summaryText.textContent = '既存のキャンプサイトを更新';
      if (summary) summary.style.display = 'flex';

      window.ensureCampsiteStepNumberStyles?.();
      setupFileGuide();
    };
  }

  function setup() {
    ensureStyles();
    setupStartModal();
    setupFileGuide();
    ensureSponsorPoiScript();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }

  setTimeout(setup, 0);
  setTimeout(setupFileGuide, 500);
})();
