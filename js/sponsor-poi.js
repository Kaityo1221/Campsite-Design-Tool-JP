/* Sponsor POI helper for Campsite Design Tool */
(() => {
  const STORAGE_KEY = 'campsiteSponsorPoisV1';
  const STYLE_ID = 'campsiteSponsorPoiStyles';
  const GENERATED_FILE_NAME = '__campsite_sponsor_poi__.csv';

  const TYPE_MAP = {
    PGO_POKESTOP: { value: 'pokestop', label: 'ポケストップ' },
    PGO_GYM: { value: 'gym', label: 'ジム' },
    PGO_POWERSPOT: { value: 'powerspot', label: 'パワースポット' }
  };

  let pendingPoi = null;
  let sponsorPois = loadSponsorPois();
  let generateWrapperInstalled = false;

  function loadSponsorPois() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.filter(isValidStoredPoi) : [];
    } catch (_) {
      return [];
    }
  }

  function isValidStoredPoi(poi) {
    return poi &&
      typeof poi.mapObjId === 'string' &&
      Number.isFinite(Number(poi.lat)) &&
      Number.isFinite(Number(poi.lng)) &&
      TYPE_MAP[poi.mapObjectType];
  }

  function saveSponsorPois() {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(sponsorPois));
    } catch (_) {}
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #tool .sponsor-poi-box{margin-top:18px;padding:18px;border:1px solid rgba(34,211,238,.34);border-radius:16px;background:linear-gradient(145deg,rgba(8,47,73,.28),rgba(15,23,42,.46));box-shadow:0 10px 28px rgba(2,132,199,.08)}
      #tool .sponsor-poi-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
      #tool .sponsor-poi-head h3{margin:0;color:#e0f2fe;font-size:18px}
      #tool .sponsor-poi-badge{display:inline-flex;align-items:center;padding:5px 9px;border-radius:999px;background:rgba(34,211,238,.13);border:1px solid rgba(34,211,238,.32);color:#a5f3fc;font-size:11px;font-weight:800;white-space:nowrap}
      #tool .sponsor-poi-note{margin:0 0 14px;color:#bae6fd;font-size:13px;line-height:1.75}
      #tool .sponsor-poi-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,.42fr);gap:10px 12px;align-items:end}
      #tool .sponsor-poi-field{display:grid;gap:6px}
      #tool .sponsor-poi-field.full{grid-column:1/-1}
      #tool .sponsor-poi-field label{color:#cbd5e1;font-size:12px;font-weight:800}
      #tool .sponsor-poi-field input,#tool .sponsor-poi-field select{width:100%;min-height:43px;padding:10px 12px;border:1px solid rgba(148,163,184,.32);border-radius:11px;background:#0f172a;color:#f8fafc;font:inherit;outline:none}
      #tool .sponsor-poi-field input:focus,#tool .sponsor-poi-field select:focus{border-color:#22d3ee;box-shadow:0 0 0 3px rgba(34,211,238,.10)}
      #tool .sponsor-poi-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
      #tool .sponsor-poi-button{border:0;border-radius:11px;padding:11px 15px;font-weight:900;cursor:pointer}
      #tool .sponsor-poi-button.analyze{background:#0e7490;color:#ecfeff}
      #tool .sponsor-poi-button.add{background:#16a34a;color:white}
      #tool .sponsor-poi-button:disabled{opacity:.45;cursor:not-allowed}
      #tool .sponsor-poi-result{display:none;margin-top:13px;padding:12px 14px;border-radius:12px;border:1px solid rgba(34,197,94,.28);background:rgba(22,163,74,.08);color:#dcfce7;line-height:1.7;font-size:13px}
      #tool .sponsor-poi-result.show{display:block}
      #tool .sponsor-poi-error{min-height:18px;margin-top:8px;color:#fecaca;font-size:12px;font-weight:700}
      #tool .sponsor-poi-preview{margin-top:10px;color:#f8fafc;font-weight:900}
      #tool .sponsor-poi-list{display:grid;gap:8px;margin-top:14px}
      #tool .sponsor-poi-item{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border-radius:12px;background:rgba(15,23,42,.72);border:1px solid rgba(148,163,184,.18)}
      #tool .sponsor-poi-item-main{min-width:0}
      #tool .sponsor-poi-item-name{color:#f8fafc;font-weight:900;overflow-wrap:anywhere}
      #tool .sponsor-poi-item-meta{margin-top:3px;color:#94a3b8;font-size:11px}
      #tool .sponsor-poi-remove{flex:0 0 auto;border:1px solid rgba(248,113,113,.35);border-radius:9px;background:rgba(127,29,29,.18);color:#fecaca;padding:7px 9px;cursor:pointer;font-weight:800}
      #tool .sponsor-poi-empty{padding:10px 0;color:#64748b;font-size:12px}
      #tool .sponsor-poi-security{margin-top:12px;padding:10px 12px;border-radius:11px;background:rgba(99,102,241,.08);border:1px solid rgba(129,140,248,.22);color:#c7d2fe;font-size:12px;line-height:1.65}
      @media(max-width:680px){#tool .sponsor-poi-grid{grid-template-columns:1fr}#tool .sponsor-poi-field.full{grid-column:auto}#tool .sponsor-poi-head{display:block}#tool .sponsor-poi-badge{margin-top:8px}}
    `;
    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function decodeMapObjectId(value) {
    const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    try {
      return new TextDecoder('utf-8').decode(bytes);
    } catch (_) {
      return binary;
    }
  }

  function parsePokemonGoMapUrl(rawUrl) {
    const input = String(rawUrl || '').trim();
    if (!input) throw new Error('Pokémon GO MapのURLを貼り付けてください。');

    let url;
    try {
      url = new URL(input);
    } catch (_) {
      throw new Error('URLの形式を確認してください。');
    }

    const host = url.hostname.toLowerCase();
    if (!(host === 'pokemongo.com' || host.endsWith('.pokemongo.com'))) {
      throw new Error('pokemongo.com のMap共有URLを使用してください。');
    }

    const lat = Number(url.searchParams.get('lat'));
    const lng = Number(url.searchParams.get('lng'));
    const mapObjId = url.searchParams.get('mapObjId') || '';

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      throw new Error('URLから緯度・経度を読み取れませんでした。');
    }
    if (!mapObjId) throw new Error('URLにPOI識別情報（mapObjId）がありません。');

    let decoded;
    try {
      decoded = decodeMapObjectId(mapObjId);
    } catch (_) {
      throw new Error('POI識別情報を解析できませんでした。');
    }

    const match = decoded.match(/PGO_(POKESTOP|GYM|POWERSPOT)/);
    if (!match) throw new Error('未対応のPOI種別です。');

    const mapObjectType = `PGO_${match[1]}`;
    const type = TYPE_MAP[mapObjectType];

    return {
      mapObjId,
      mapObjectType,
      type: type.value,
      typeLabel: type.label,
      lat,
      lng
    };
  }

  function getSponsorValue() {
    const select = document.getElementById('sponsorPoiSponsor');
    const other = document.getElementById('sponsorPoiSponsorOther');
    if (!select) return '';
    return select.value === '__other__'
      ? String(other?.value || '').trim()
      : String(select.value || '').trim();
  }

  function normalizeForIncludes(value) {
    return String(value || '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\s　・･\-‐‑–—_()（）]/g, '');
  }

  function buildDisplayName(sponsor, poiName, typeLabel) {
    const cleanSponsor = String(sponsor || '').trim();
    const cleanName = String(poiName || '').trim();
    let base = cleanName;

    if (cleanSponsor) {
      const sponsorKey = normalizeForIncludes(cleanSponsor);
      const nameKey = normalizeForIncludes(cleanName);
      if (!cleanName) {
        base = cleanSponsor;
      } else if (!nameKey.includes(sponsorKey)) {
        base = `${cleanSponsor} ${cleanName}`;
      }
    }

    if (!base) return '';
    return `${base}（${typeLabel}）`;
  }

  function csvEscape(value) {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }

  function makeSponsorCsvFile() {
    const rows = [['name', 'latitude', 'longitude', 'type']];
    sponsorPois.forEach(poi => {
      rows.push([
        poi.displayName,
        Number(poi.lat).toFixed(7),
        Number(poi.lng).toFixed(7),
        TYPE_MAP[poi.mapObjectType]?.value || poi.type || ''
      ]);
    });

    const csv = '\uFEFF' + rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
    return new File([csv], GENERATED_FILE_NAME, { type: 'text/csv;charset=utf-8' });
  }

  function replaceFileInputTemporarily() {
    const input = document.getElementById('fileInput');
    if (!input || sponsorPois.length === 0) return () => {};

    if (typeof DataTransfer === 'undefined' || typeof File === 'undefined') {
      throw new Error('このブラウザではスポンサーPOIの一時CSV合流を利用できません。');
    }

    const originalFiles = Array.from(input.files || []).filter(file => file.name !== GENERATED_FILE_NAME);
    const transfer = new DataTransfer();
    originalFiles.forEach(file => transfer.items.add(file));
    transfer.items.add(makeSponsorCsvFile());
    input.files = transfer.files;

    return () => {
      try {
        const restore = new DataTransfer();
        originalFiles.forEach(file => restore.items.add(file));
        input.files = restore.files;
      } catch (_) {}
    };
  }

  function installGenerateWrapper() {
    if (generateWrapperInstalled) return true;
    const originalGenerateKMZ = window.generateKMZ;
    if (typeof originalGenerateKMZ !== 'function') return false;

    window.generateKMZ = async function(...args) {
      if (sponsorPois.length === 0) {
        return originalGenerateKMZ.apply(this, args);
      }

      let restore = () => {};
      let promise;
      try {
        restore = replaceFileInputTemporarily();
        promise = originalGenerateKMZ.apply(this, args);
      } catch (error) {
        console.error('[sponsor-poi] merge failed', error);
        alert(error?.message || 'スポンサーPOIの追加処理に失敗しました。');
        return;
      } finally {
        restore();
      }

      return await promise;
    };

    generateWrapperInstalled = true;
    return true;
  }

  function updateOtherSponsorVisibility() {
    const select = document.getElementById('sponsorPoiSponsor');
    const field = document.getElementById('sponsorPoiSponsorOtherField');
    if (!select || !field) return;
    field.style.display = select.value === '__other__' ? 'grid' : 'none';
    updatePreview();
  }

  function setError(message = '') {
    const error = document.getElementById('sponsorPoiError');
    if (error) error.textContent = message;
  }

  function renderAnalysis() {
    const result = document.getElementById('sponsorPoiResult');
    const type = document.getElementById('sponsorPoiDetectedType');
    const coords = document.getElementById('sponsorPoiDetectedCoords');
    const addButton = document.getElementById('sponsorPoiAddButton');

    if (!result) return;
    if (!pendingPoi) {
      result.classList.remove('show');
      if (addButton) addButton.disabled = true;
      return;
    }

    if (type) type.textContent = pendingPoi.typeLabel;
    if (coords) coords.textContent = `${pendingPoi.lat.toFixed(7)}, ${pendingPoi.lng.toFixed(7)}`;
    result.classList.add('show');
    if (addButton) addButton.disabled = false;
    updatePreview();
  }

  function updatePreview() {
    const preview = document.getElementById('sponsorPoiPreview');
    if (!preview || !pendingPoi) return;

    const sponsor = getSponsorValue();
    const poiName = document.getElementById('sponsorPoiName')?.value || '';
    const displayName = buildDisplayName(sponsor, poiName, pendingPoi.typeLabel);
    preview.textContent = displayName ? `出力名：${displayName}` : 'スポンサーまたは名称を入力してください。';
  }

  function analyzeUrl() {
    const urlInput = document.getElementById('sponsorPoiUrl');
    setError('');
    pendingPoi = null;

    try {
      pendingPoi = parsePokemonGoMapUrl(urlInput?.value || '');
      renderAnalysis();
    } catch (error) {
      renderAnalysis();
      setError(error?.message || 'URLを解析できませんでした。');
    }
  }

  function addSponsorPoi() {
    setError('');
    if (!pendingPoi) {
      setError('先にPokémon GO Map URLを解析してください。');
      return;
    }

    const sponsor = getSponsorValue();
    const poiName = String(document.getElementById('sponsorPoiName')?.value || '').trim();
    const displayName = buildDisplayName(sponsor, poiName, pendingPoi.typeLabel);

    if (!displayName) {
      setError('スポンサーまたはPOI名称を入力してください。');
      return;
    }

    const duplicate = sponsorPois.some(poi =>
      poi.mapObjId === pendingPoi.mapObjId ||
      (Math.abs(Number(poi.lat) - pendingPoi.lat) < 1e-7 && Math.abs(Number(poi.lng) - pendingPoi.lng) < 1e-7)
    );

    if (duplicate) {
      setError('このPOIはすでに追加されています。');
      return;
    }

    sponsorPois.push({
      mapObjId: pendingPoi.mapObjId,
      mapObjectType: pendingPoi.mapObjectType,
      type: pendingPoi.type,
      typeLabel: pendingPoi.typeLabel,
      lat: pendingPoi.lat,
      lng: pendingPoi.lng,
      sponsor,
      poiName,
      displayName
    });

    saveSponsorPois();
    renderList();

    const urlInput = document.getElementById('sponsorPoiUrl');
    const nameInput = document.getElementById('sponsorPoiName');
    if (urlInput) urlInput.value = '';
    if (nameInput) nameInput.value = '';
    pendingPoi = null;
    renderAnalysis();
  }

  function removeSponsorPoi(index) {
    sponsorPois.splice(index, 1);
    saveSponsorPois();
    renderList();
  }

  function renderList() {
    const list = document.getElementById('sponsorPoiList');
    const count = document.getElementById('sponsorPoiCount');
    if (!list) return;

    if (count) count.textContent = `${sponsorPois.length}件`;

    if (sponsorPois.length === 0) {
      list.innerHTML = '<div class="sponsor-poi-empty">追加済みのスポンサーPOIはありません。</div>';
      return;
    }

    list.innerHTML = sponsorPois.map((poi, index) => `
      <div class="sponsor-poi-item">
        <div class="sponsor-poi-item-main">
          <div class="sponsor-poi-item-name">${escapeHtml(poi.displayName)}</div>
          <div class="sponsor-poi-item-meta">${escapeHtml(poi.typeLabel || TYPE_MAP[poi.mapObjectType]?.label || '')} / ${Number(poi.lat).toFixed(7)}, ${Number(poi.lng).toFixed(7)}</div>
        </div>
        <button type="button" class="sponsor-poi-remove" data-sponsor-poi-remove="${index}">削除</button>
      </div>
    `).join('');

    list.querySelectorAll('[data-sponsor-poi-remove]').forEach(button => {
      button.addEventListener('click', () => removeSponsorPoi(Number(button.dataset.sponsorPoiRemove)));
    });
  }

  function setupUi() {
    if (document.getElementById('sponsorPoiBox')) return;

    const input = document.getElementById('fileInput');
    const step = input?.closest('.step');
    if (!input || !step) return;

    const box = document.createElement('div');
    box.id = 'sponsorPoiBox';
    box.className = 'sponsor-poi-box';
    box.innerHTML = `
      <div class="sponsor-poi-head">
        <div><h3>🏪 スポンサーPOI追加（任意）</h3></div>
        <span class="sponsor-poi-badge" id="sponsorPoiCount">0件</span>
      </div>
      <p class="sponsor-poi-note">Pokémon GO MapのPOI共有URLから、座標と種別を自動で読み取ります。追加したPOIはKMZ生成時に<strong>既存POI</strong>として自動分類されます。</p>
      <div class="sponsor-poi-grid">
        <div class="sponsor-poi-field full">
          <label for="sponsorPoiUrl">Pokémon GO Map URL</label>
          <input id="sponsorPoiUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://pokemongo.com/map?...">
        </div>
        <div class="sponsor-poi-field">
          <label for="sponsorPoiSponsor">スポンサー</label>
          <select id="sponsorPoiSponsor">
            <option value="">未選択</option>
            <option value="マクドナルド">マクドナルド</option>
            <option value="ファミリーマート">ファミリーマート</option>
            <option value="ローソン">ローソン</option>
            <option value="セブン‐イレブン">セブン‐イレブン</option>
            <option value="ソフトバンク">ソフトバンク</option>
            <option value="伊藤園">伊藤園</option>
            <option value="__other__">その他</option>
          </select>
        </div>
        <div class="sponsor-poi-field" id="sponsorPoiSponsorOtherField" style="display:none;">
          <label for="sponsorPoiSponsorOther">その他のスポンサー名</label>
          <input id="sponsorPoiSponsorOther" type="text" autocomplete="off" placeholder="スポンサー名">
        </div>
        <div class="sponsor-poi-field full">
          <label for="sponsorPoiName">店舗・施設名（任意）</label>
          <input id="sponsorPoiName" type="text" autocomplete="off" placeholder="例：新小岩南店（スポンサー名を含めてもOK）">
        </div>
      </div>
      <div class="sponsor-poi-actions">
        <button type="button" class="sponsor-poi-button analyze" id="sponsorPoiAnalyzeButton">URLを解析</button>
        <button type="button" class="sponsor-poi-button add" id="sponsorPoiAddButton" disabled>＋ POIを追加</button>
      </div>
      <div id="sponsorPoiError" class="sponsor-poi-error"></div>
      <div id="sponsorPoiResult" class="sponsor-poi-result">
        <div>種別：<strong id="sponsorPoiDetectedType"></strong></div>
        <div>座標：<strong id="sponsorPoiDetectedCoords"></strong></div>
        <div id="sponsorPoiPreview" class="sponsor-poi-preview"></div>
      </div>
      <div id="sponsorPoiList" class="sponsor-poi-list"></div>
      <div class="sponsor-poi-security">🔒 Nianticの認証APIやBearerトークンは使用しません。共有URLに含まれる座標・種別情報だけを端末内で解析します。</div>
    `;

    const warning = step.querySelector(':scope > .campsite-file-guide-warning');
    if (warning) warning.insertAdjacentElement('afterend', box);
    else input.insertAdjacentElement('afterend', box);

    document.getElementById('sponsorPoiAnalyzeButton')?.addEventListener('click', analyzeUrl);
    document.getElementById('sponsorPoiAddButton')?.addEventListener('click', addSponsorPoi);
    document.getElementById('sponsorPoiSponsor')?.addEventListener('change', updateOtherSponsorVisibility);
    document.getElementById('sponsorPoiSponsorOther')?.addEventListener('input', updatePreview);
    document.getElementById('sponsorPoiName')?.addEventListener('input', updatePreview);
    document.getElementById('sponsorPoiUrl')?.addEventListener('keydown', event => {
      if (event.key === 'Enter') {
        event.preventDefault();
        analyzeUrl();
      }
    });

    updateOtherSponsorVisibility();
    renderList();
    renderAnalysis();
  }

  function setup() {
    ensureStyles();
    setupUi();
    if (!installGenerateWrapper()) {
      setTimeout(installGenerateWrapper, 0);
      setTimeout(installGenerateWrapper, 300);
      setTimeout(installGenerateWrapper, 1000);
    }
  }

  window.CampsiteSponsorPoi = {
    parsePokemonGoMapUrl,
    getItems: () => sponsorPois.map(item => ({ ...item }))
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup, { once: true });
  } else {
    setup();
  }
})();
