/* Campsite create/update file guide */
(() => {
  const STYLE_ID = 'campsiteFileGuideStyles';
  const SPONSOR_SCRIPT_ID = 'campsiteSponsorPoiScript';
  const POWERSPOT_STATUS_NOTICE_CLASS = 'campsite-powerspot-status-notice';

  const CURRENT_SPONSORS = [
    'ナムコ',
    '日本コカ・コーラ',
    'マクドナルド',
    'アピタ',
    'ピアゴ',
    'ユーストア',
    'ファミリーマート',
    'ドン・キホーテ',
    '住友生命',
    'GUCCI',
    '小田急グループ',
    'ソフトバンク'
  ];

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
      #tool .${POWERSPOT_STATUS_NOTICE_CLASS}{display:none;margin:10px 0 0;padding:12px 14px;border-radius:12px;font-size:13px;line-height:1.7}
      #tool .${POWERSPOT_STATUS_NOTICE_CLASS}.is-warning{display:block;border:1px solid rgba(245,158,11,.56);background:rgba(245,158,11,.12);color:#fde68a}
      #tool .${POWERSPOT_STATUS_NOTICE_CLASS}.is-ok{display:block;border:1px solid rgba(34,197,94,.42);background:rgba(34,197,94,.09);color:#bbf7d0}
      #tool.csv-mode-update .campsite-file-guide-card.update{border-color:rgba(167,139,250,.72);box-shadow:0 0 0 1px rgba(167,139,250,.16) inset}
      .campsite-csv-choice-button.campsite-update-choice{border-color:rgba(167,139,250,.45);background:rgba(124,58,237,.11)}
    `;
    document.head.appendChild(style);
  }

  function syncSponsorOptions() {
    const select = document.getElementById('sponsorPoiSponsor');
    if (!select) return false;

    const previousValue = select.value;
    const options = [
      '<option value="">未選択</option>',
      ...CURRENT_SPONSORS.map(name => `<option value="${name}">${name}</option>`),
      '<option value="__other__">その他</option>'
    ];

    select.innerHTML = options.join('');

    const values = Array.from(select.options).map(option => option.value);
    if (values.includes(previousValue)) {
      select.value = previousValue;
    }

    select.dataset.sponsorListUpdated = '2026-08-19';
    return true;
  }

  function scheduleSponsorOptionSync() {
    [0, 150, 400, 900, 1600].forEach(delay => {
      setTimeout(syncSponsorOptions, delay);
    });
  }

  function ensureSponsorPoiScript() {
    const existing = document.getElementById(SPONSOR_SCRIPT_ID);
    if (existing) {
      scheduleSponsorOptionSync();
      return;
    }

    const script = document.createElement('script');
    script.id = SPONSOR_SCRIPT_ID;
    script.src = 'js/sponsor-poi.js?v=1';
    script.async = true;
    script.addEventListener('load', scheduleSponsorOptionSync, { once: true });
    document.head.appendChild(script);
  }

  function normalizeCsvHeader(value) {
    return String(value || '')
      .replace(/^\uFEFF/, '')
      .normalize('NFKC')
      .trim()
      .toLowerCase()
      .replace(/[\s_-]+/g, '');
  }

  function csvHasGameStatusColumn(text) {
    if (typeof parseCSVRows !== 'function') return false;

    const rows = parseCSVRows(text);
    if (rows.length === 0) return false;

    return rows[0].some(header => normalizeCsvHeader(header) === 'gamestatus');
  }

  function isPowerSpotType(value) {
    const normalized = String(value || '')
      .normalize('NFKC')
      .trim()
      .toUpperCase()
      .replace(/[\s_-]+/g, '');

    return normalized === 'POWERSPOT' ||
      normalized === 'パワースポット' ||
      normalized === 'パワスポ';
  }

  async function summarizePowerSpotCsv(files) {
    const summary = {
      statusAwareFiles: 0,
      powerTotal: 0,
      active: 0,
      inactive: 0,
      otherStatus: 0
    };

    if (typeof parseCSV !== 'function') return summary;

    for (const file of files) {
      if (!String(file?.name || '').toLowerCase().endsWith('.csv')) continue;

      const text = await file.text();
      if (!csvHasGameStatusColumn(text)) continue;

      summary.statusAwareFiles++;

      parseCSV(text).forEach(point => {
        if (!isPowerSpotType(point?.type)) return;

        summary.powerTotal++;
        const status = String(point?.gameStatus || '').trim().toUpperCase();

        if (status === 'INACTIVE') {
          summary.inactive++;
        } else if (status === 'ACTIVE') {
          summary.active++;
        } else {
          summary.otherStatus++;
        }
      });
    }

    return summary;
  }

  async function updatePowerSpotCsvNotice(input, notice) {
    const files = Array.from(input.files || []);
    notice.classList.remove('is-warning', 'is-ok');
    notice.textContent = '';

    if (files.length === 0) return;

    try {
      const summary = await summarizePowerSpotCsv(files);

      if (summary.statusAwareFiles === 0 || summary.powerTotal === 0) {
        return;
      }

      if (summary.inactive === 0) {
        notice.classList.add('is-warning');
        notice.innerHTML = '⚠️ INACTIVE Power Spotが0件です。Wayfarer Map Modsの<strong>「Display inactive Power Spots the same as active」</strong>をONにして、Nearby WayspotsからCSVを再出力したか確認してください。<br><small>※抽出範囲によっては実際に0件の場合もあります。</small>';
        return;
      }

      notice.classList.add('is-ok');
      notice.textContent = `✓ Power Spotを確認：ACTIVE ${summary.active}件 / INACTIVE ${summary.inactive}件。INACTIVEも既存PowerSpotとして取り込みます。`;
    } catch (error) {
      console.warn('Power Spot CSV status check failed', error);
    }
  }

  function setupPowerSpotCsvCheck(input, step) {
    let notice = step.querySelector(`:scope > .${POWERSPOT_STATUS_NOTICE_CLASS}`);

    if (!notice) {
      notice = document.createElement('div');
      notice.className = POWERSPOT_STATUS_NOTICE_CLASS;
      const warning = step.querySelector(':scope > .campsite-file-guide-warning');
      (warning || input).insertAdjacentElement('afterend', notice);
    }

    if (input.dataset.powerSpotStatusCheckBound === '1') return;

    input.dataset.powerSpotStatusCheckBound = '1';
    input.addEventListener('change', () => {
      void updatePowerSpotCsvNotice(input, notice);
    });
  }

  function setupFileGuide() {
    const input = document.getElementById('fileInput');
    const step = input?.closest('.step');
    if (!input || !step) return;

    step.classList.add('campsite-file-input-step');

    Array.from(step.children).forEach(el => {
      if (
        el === input ||
        el.matches?.(`h3,.step-no,.campsite-file-guide,.campsite-file-guide-warning,.${POWERSPOT_STATUS_NOTICE_CLASS}`)
      ) return;

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
        Wayfarer Mapから抽出したCSV、または自作CSVを選択してください。<br>
        Wayfarer Map Modsを使う場合は、<strong>「Display inactive Power Spots the same as active」をON</strong>にしてから Nearby Wayspots でCSVを出力してください。
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
    setupPowerSpotCsvCheck(input, step);
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
        scheduleSponsorOptionSync();
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
      scheduleSponsorOptionSync();
    };
  }

  function setup() {
    ensureStyles();
    setupStartModal();
    setupFileGuide();
    ensureSponsorPoiScript();
    scheduleSponsorOptionSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }

  setTimeout(setup, 0);
  setTimeout(setupFileGuide, 500);
})();
