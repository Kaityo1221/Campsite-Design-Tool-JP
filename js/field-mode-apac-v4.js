(() => {
  'use strict';

  const MAX_ADDITIONAL_SPOTS = 25;
  const TARGET_METERS = Number(window.CampsitePoiSpacingPolicy?.targetMeters) || 50;
  const STORE_DB = 'campsite-field-session';
  const STORE_DB_VERSION = 1;
  const STORE_NAME = 'state';
  const STORE_KEY = 'apac-v4-exceptions-v1';
  const INSTALL_TIMEOUT_MS = 10000;

  let installed = false;
  let show50mCircles = true;
  let currentSourceKey = '';
  let restoreGeneration = 0;
  let pendingExport = null;
  let pendingTimer = 0;
  let forceFinalExport = false;
  let terminologyLock = false;
  let summaryBox = null;
  let countValue = null;
  let under50Value = null;
  let reviewValue = null;
  let circleToggle = null;
  let campsiteNameInput = null;
  let spotPanel = null;
  let spotNameInput = null;
  let spotTypeValue = null;
  let spotCoordValue = null;
  let exceptionPanel = null;
  let exceptionTitle = null;
  let exceptionCopy = null;
  let exceptionList = null;
  let exceptionReason = null;
  let exceptionReview = null;
  let exceptionConfirm = null;
  let exportOverlay = null;
  let originalChangedRecords = null;
  let originalUpdateSaveButton = null;
  let originalRenderKml = null;
  let originalSelectAddedPoi = null;
  let originalResetPoiSelection = null;
  const nativeAnchorClick = HTMLAnchorElement.prototype.click;

  function dependenciesReady() {
    try {
      return typeof poiRecords !== 'undefined'
        && typeof meters === 'function'
        && typeof changedRecords === 'function'
        && typeof updateSaveButton === 'function'
        && typeof updateDistanceStatus === 'function'
        && typeof renderKml === 'function'
        && typeof selectAddedPoi === 'function'
        && typeof resetPoiSelection === 'function'
        && !!window.FieldModeExport
        && !!window.FieldCreative
        && !!window.FieldModeSession
        && !!window.FieldModeArea;
    } catch (_) {
      return false;
    }
  }

  function setText(element, value) {
    if (element && element.textContent !== value) element.textContent = value;
  }

  function validLatLng(value) {
    return Array.isArray(value) && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
  }

  function activeRecords() {
    try {
      return (poiRecords || []).filter(record => record && !record.fieldDeleted && validLatLng(record.latlng));
    } catch (_) {
      return [];
    }
  }

  function additionalRecords() {
    return activeRecords().filter(record => !!record.added);
  }

  function additionalCount() {
    return additionalRecords().length;
  }

  function normalizedType(record) {
    const raw = String(record?.poiType || '').toLowerCase();
    const hint = `${record?.folder || ''} ${record?.name || ''}`.toLowerCase();
    if (raw === 'gym' || /ジム|\bgym\b/.test(hint)) return 'gym';
    if (raw === 'power_spot' || raw === 'power' || /パワー|power/.test(hint)) return 'power_spot';
    return 'pokestop';
  }

  function typeLabel(record) {
    const type = normalizedType(record);
    if (type === 'gym') return 'ジム';
    if (type === 'power_spot') return 'パワースポット';
    return 'ポケストップ';
  }

  function roleLabel(record) {
    return record?.added ? '追加ゲームスポット' : '既存ゲームスポット';
  }

  function stableRecordKey(record) {
    const origin = validLatLng(record?.originalLatlng) ? record.originalLatlng : record?.latlng || [];
    const lat = Number(origin[0]);
    const lng = Number(origin[1]);
    return [
      record?.added ? 'additional' : 'existing',
      record?.isNew ? 'new' : 'source',
      normalizedType(record),
      Number.isFinite(lat) ? lat.toFixed(7) : '',
      Number.isFinite(lng) ? lng.toFixed(7) : ''
    ].join('|');
  }

  function issueSignature(issues) {
    return (issues || []).map(issue => `${stableRecordKey(issue.other)}|${issue.distance.toFixed(1)}`).sort().join('||');
  }

  function safeMeters(a, b) {
    if (!validLatLng(a) || !validLatLng(b)) return Infinity;
    try {
      return Number(meters(a, b));
    } catch (_) {
      return Infinity;
    }
  }

  function issuesForPosition(position, excludedRecord = null) {
    if (!validLatLng(position)) return [];
    return activeRecords()
      .filter(record => record !== excludedRecord)
      .map(record => ({
        other: record,
        distance: safeMeters(position, record.latlng),
        role: roleLabel(record),
        type: typeLabel(record)
      }))
      .filter(issue => Number.isFinite(issue.distance) && issue.distance < TARGET_METERS)
      .sort((a, b) => a.distance - b.distance);
  }

  function recomputeAll({ render = true } = {}) {
    const additions = additionalRecords();
    for (const record of additions) {
      const issues = issuesForPosition(record.latlng, record);
      const signature = issueSignature(issues);
      record.spacingIssues = issues;
      record.spacingIssueSignature = signature;
      if (!signature) {
        record.spacingExceptionNeedsReview = false;
      } else {
        const reason = String(record.spacingExceptionReason || '').trim();
        record.spacingExceptionNeedsReview = !reason || record.spacingExceptionConfirmedSignature !== signature;
      }
    }
    sync50mCircleVisibility();
    if (render) {
      renderSummary();
      renderSpotPanel();
      renderExceptionPanel();
      syncFinalButton();
    }
    return additions;
  }

  function under50Records() {
    return additionalRecords().filter(record => (record.spacingIssues || []).length);
  }

  function reviewNeededRecords() {
    return under50Records().filter(record => record.spacingExceptionNeedsReview);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function updateDistanceStatusV4(position = null, excludedRecord = null) {
    const badge = document.getElementById('fieldModeDistanceBadge');
    if (!badge) return;
    const targetPosition = validLatLng(position) ? position : null;
    badge.className = 'field-distance-badge';
    if (!targetPosition) {
      setText(badge, '● 50m確認待ち');
      badge.dataset.distanceBand = 'waiting';
      return;
    }
    const issues = issuesForPosition(targetPosition, excludedRecord);
    if (!issues.length) {
      setText(badge, `● ${TARGET_METERS}m以上を確保`);
      badge.dataset.distanceBand = 'ok';
      return;
    }
    badge.classList.add('caution');
    badge.dataset.distanceBand = 'review';
    const nearest = issues[0];
    const extra = issues.length > 1 ? ` ／ ほか${issues.length - 1}件` : '';
    const html = `⚠ ${TARGET_METERS}m未満・要確認<br>${escapeHtml(nearest.other?.name || 'ゲームスポット')}（${nearest.role}）まで ${nearest.distance.toFixed(1)}m${extra}`;
    if (badge.innerHTML !== html) badge.innerHTML = html;
  }

  function addStyle() {
    if (document.querySelector('style[data-field-apac-v4-style]')) return;
    const style = document.createElement('style');
    style.dataset.fieldApacV4Style = '1';
    style.textContent = `
      .field-apac-summary{position:absolute;top:64px;right:10px;z-index:670;width:min(205px,54vw);padding:8px;border:1px solid rgba(73,57,30,.25);border-radius:14px;background:rgba(255,253,247,.95);box-shadow:0 4px 13px rgba(0,0,0,.15);color:#49391e;font-size:10px;line-height:1.35}
      .field-apac-summary-row{display:flex;justify-content:space-between;gap:8px;align-items:center}.field-apac-summary-row+.field-apac-summary-row{margin-top:4px}.field-apac-summary strong{font-size:11px}.field-apac-summary .is-review{color:#9a531b}.field-apac-summary .is-over{color:#a23f35}
      .field-apac-summary-actions{display:grid;grid-template-columns:1fr 1fr;gap:5px;margin-top:6px}.field-apac-summary button{min-height:30px;border:1px solid #b89a57;border-radius:9px;background:#fff8e6;color:#49391e;font-size:9px;font-weight:900}
      .field-apac-design,.field-apac-spot{margin-top:10px;padding:11px;border:1px solid #d2c39f;border-radius:13px;background:#fffaf0}.field-apac-design label,.field-apac-spot label{display:block;font-size:11px;font-weight:900;color:#49391e}.field-apac-campsite-name,.field-apac-spot-name{width:100%;margin-top:6px;padding:9px;border:1px solid #c9b993;border-radius:10px;background:#fff;color:#332b20;font:inherit;font-size:12px}.field-apac-spot{display:none}.field-apac-spot.active{display:block}.field-apac-spot-meta{margin-top:7px;font-size:10px;line-height:1.5;color:#746957}.field-apac-guidance{margin-top:9px;font-size:10px;color:#746957;line-height:1.55}.field-apac-guidance summary{cursor:pointer;font-weight:900;color:#5a482d}.field-apac-guidance ul{padding-left:18px;margin:7px 0}.field-apac-guidance p{margin:7px 0 0}
      .field-apac-exception{display:none;margin-top:10px;padding:12px;border:1px solid #d89a4e;border-radius:13px;background:#fff8e9}.field-apac-exception.active{display:block}.field-apac-exception.resolved{border-color:#91b294;background:#f3faf2}.field-apac-exception h3{margin:0;font-size:13px;color:#694315}.field-apac-exception.resolved h3{color:#3f6844}.field-apac-exception-copy{margin-top:5px;font-size:10px;line-height:1.5;color:#746957}.field-apac-exception-list{margin:8px 0;padding-left:18px;font-size:11px;line-height:1.5}.field-apac-exception textarea{width:100%;min-height:82px;margin-top:7px;padding:9px;border:1px solid #c9b993;border-radius:10px;background:#fff;color:#332b20;font:inherit;font-size:12px;resize:vertical}.field-apac-exception button{width:100%;min-height:38px;margin-top:7px;border:1px solid #96722e;border-radius:10px;background:#d8b766;color:#34260e;font-weight:900}.field-apac-review-state{margin-top:6px;font-size:10px;font-weight:800;color:#9a531b}.field-apac-review-state.ok{color:#47725c}
      .field-apac-export-overlay{position:fixed;inset:0;z-index:9000;display:none;place-items:center;padding:24px;background:rgba(30,25,19,.68);color:#fff8e8;text-align:center;font-weight:900}.field-apac-export-overlay.active{display:grid}.field-apac-export-card{width:min(100%,380px);padding:20px;border-radius:18px;background:#443725;box-shadow:0 12px 40px rgba(0,0,0,.3)}.field-apac-export-card small{display:block;margin-top:7px;font-weight:600;opacity:.8;line-height:1.5}
      @media(max-width:340px){.field-apac-summary{width:min(190px,59vw);font-size:9px}.field-apac-summary-actions{grid-template-columns:1fr}.field-apac-summary button{min-height:27px}}
    `;
    document.head.appendChild(style);
  }

  function buildUi() {
    const stage = document.querySelector('.field-mode-stage');
    const selection = document.querySelector('.field-mode-selection');
    const saveRow = document.querySelector('.field-save-row');
    if (!stage || !selection) return false;

    summaryBox = document.createElement('div');
    summaryBox.id = 'fieldModeApacSummary';
    summaryBox.className = 'field-apac-summary';
    summaryBox.innerHTML = `
      <div class="field-apac-summary-row"><strong>追加ゲームスポット</strong><span id="fieldApacCount">0 / ${MAX_ADDITIONAL_SPOTS}</span></div>
      <div class="field-apac-summary-row"><span>50m未満</span><span id="fieldApacUnder50">0</span></div>
      <div class="field-apac-summary-row"><span>但し書き要確認</span><span id="fieldApacReview">0</span></div>
      <div class="field-apac-summary-actions"><button id="fieldApacCircleToggle" type="button">50m圏：表示中</button><button id="fieldApacReviewOpen" type="button">設計チェック</button></div>`;
    stage.appendChild(summaryBox);
    countValue = summaryBox.querySelector('#fieldApacCount');
    under50Value = summaryBox.querySelector('#fieldApacUnder50');
    reviewValue = summaryBox.querySelector('#fieldApacReview');
    circleToggle = summaryBox.querySelector('#fieldApacCircleToggle');
    circleToggle.addEventListener('click', () => {
      show50mCircles = !show50mCircles;
      sync50mCircleVisibility();
      renderSummary();
      persistNow();
    });
    summaryBox.querySelector('#fieldApacReviewOpen').addEventListener('click', () => {
      window.FieldCreative?.exit?.({ cancel: false });
      document.querySelector('.field-mode-selection')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    });

    const designPanel = document.createElement('div');
    designPanel.className = 'field-apac-design';
    designPanel.innerHTML = `
      <label for="fieldApacCampsiteName">キャンプサイト名</label>
      <input id="fieldApacCampsiteName" class="field-apac-campsite-name" type="text" maxlength="100" placeholder="キャンプサイト名を入力">
      <details class="field-apac-guidance">
        <summary>設計の考え方（APAC 2026年8月）</summary>
        <ul>
          <li>ゲームスポットを一箇所へ集中させず、公園内を自然に移動できる配置を考えます。</li>
          <li>同じ種類を同じ場所へ集中させすぎず、入口や狭い通路への滞留集中を避けます。</li>
          <li>野球場・サッカー場など本来の利用者と衝突しやすい場所の中心を避け、通路・歩行ルート・待機場所を確認します。</li>
          <li>Wayfarer対象物が少ない芝生・野原・広場などの空白も、ゲーム体験を作る候補として検討できます。</li>
        </ul>
        <p><strong>活動範囲：</strong>ミートアップで想定される移動範囲であり、ひとつのキャンプサイトとして自然なまとまりを示します。広すぎる地域全体や性質の異なる複数大型施設を一括で囲うことは推奨しません。</p>
        <p>これらは設計支援の視点です。数値基準がない項目を自動NG判定しません。</p>
      </details>`;
    campsiteNameInput = designPanel.querySelector('#fieldApacCampsiteName');
    campsiteNameInput.addEventListener('input', () => persistNow());

    spotPanel = document.createElement('div');
    spotPanel.id = 'fieldModeAdditionalSpotPanel';
    spotPanel.className = 'field-apac-spot';
    spotPanel.innerHTML = `
      <label for="fieldApacSpotName">追加ゲームスポット名</label>
      <input id="fieldApacSpotName" class="field-apac-spot-name" type="text" maxlength="100">
      <div class="field-apac-spot-meta">種別：<strong id="fieldApacSpotType"></strong><br>座標：<span id="fieldApacSpotCoord"></span></div>`;
    spotNameInput = spotPanel.querySelector('#fieldApacSpotName');
    spotTypeValue = spotPanel.querySelector('#fieldApacSpotType');
    spotCoordValue = spotPanel.querySelector('#fieldApacSpotCoord');
    spotNameInput.addEventListener('input', () => {
      if (!selectedPoi?.added || !selectedPoi.isNew) return;
      const next = spotNameInput.value.trim();
      if (!next) return;
      selectedPoi.name = next;
      try {
        selectedPoi.marker?.bindPopup?.(`<strong>${escapeHtml(next)}</strong><br><small>${typeLabel(selectedPoi)}</small><br><b>追加ゲームスポット</b>`);
      } catch (_) {}
      updateSaveButton();
      recomputeAll();
      persistNow();
    });

    exceptionPanel = document.createElement('div');
    exceptionPanel.id = 'fieldModeExceptionPanel';
    exceptionPanel.className = 'field-apac-exception';
    exceptionPanel.innerHTML = `
      <h3 id="fieldExceptionTitle">⚠ 50m未満・要確認</h3>
      <div id="fieldExceptionCopy" class="field-apac-exception-copy"></div>
      <ul id="fieldExceptionList" class="field-apac-exception-list"></ul>
      <textarea id="fieldModeExceptionReason" placeholder="なぜこの位置が必要なのかを記録してください。"></textarea>
      <button id="fieldModeExceptionConfirm" type="button">この理由を確認</button>
      <div id="fieldModeExceptionReview" class="field-apac-review-state"></div>`;
    exceptionTitle = exceptionPanel.querySelector('#fieldExceptionTitle');
    exceptionCopy = exceptionPanel.querySelector('#fieldExceptionCopy');
    exceptionList = exceptionPanel.querySelector('#fieldExceptionList');
    exceptionReason = exceptionPanel.querySelector('#fieldModeExceptionReason');
    exceptionConfirm = exceptionPanel.querySelector('#fieldModeExceptionConfirm');
    exceptionReview = exceptionPanel.querySelector('#fieldModeExceptionReview');
    exceptionReason.addEventListener('input', () => {
      if (!selectedPoi?.added) return;
      selectedPoi.spacingExceptionReason = exceptionReason.value;
      selectedPoi.spacingExceptionNeedsReview = !!(selectedPoi.spacingIssues || []).length;
      renderSummary();
      renderExceptionReviewState(selectedPoi);
      persistNow();
    });
    exceptionConfirm.addEventListener('click', () => {
      if (!selectedPoi?.added || !(selectedPoi.spacingIssues || []).length) return;
      const reason = String(exceptionReason.value || '').trim();
      if (!reason) {
        setText(exceptionReview, '理由を入力すると確認できます。');
        exceptionReview.classList.remove('ok');
        exceptionReason.focus();
        return;
      }
      selectedPoi.spacingExceptionReason = reason;
      selectedPoi.spacingExceptionConfirmedSignature = selectedPoi.spacingIssueSignature || issueSignature(selectedPoi.spacingIssues || []);
      selectedPoi.spacingExceptionReviewedAt = Date.now();
      selectedPoi.spacingExceptionNeedsReview = false;
      renderExceptionReviewState(selectedPoi);
      renderSummary();
      persistNow();
      setText(modeStatus, '50m未満の理由を確認済み');
    });

    if (saveRow) {
      selection.insertBefore(designPanel, saveRow);
      selection.insertBefore(spotPanel, saveRow);
      selection.insertBefore(exceptionPanel, saveRow);
    } else {
      selection.append(designPanel, spotPanel, exceptionPanel);
    }

    exportOverlay = document.createElement('div');
    exportOverlay.id = 'fieldApacExportOverlay';
    exportOverlay.className = 'field-apac-export-overlay';
    exportOverlay.innerHTML = '<div class="field-apac-export-card">設計データを生成中…<small>同じ設計状態から完成KMZと必要な但し書きTXTを作成しています。</small></div>';
    document.body.appendChild(exportOverlay);
    return true;
  }

  function defaultCampsiteName() {
    try {
      return String(sourceFileName || 'キャンプサイト')
        .replace(/\.(kmz|kml|zip)$/i, '')
        .replace(/_現地調整.*$/i, '') || 'キャンプサイト';
    } catch (_) {
      return 'キャンプサイト';
    }
  }

  function renderSummary() {
    if (!summaryBox) return;
    const count = additionalCount();
    const under = under50Records().length;
    const needs = reviewNeededRecords().length;
    setText(countValue, `${count} / ${MAX_ADDITIONAL_SPOTS}`);
    countValue?.classList.toggle('is-over', count > MAX_ADDITIONAL_SPOTS);
    setText(under50Value, String(under));
    setText(reviewValue, String(needs));
    reviewValue?.classList.toggle('is-review', needs > 0);
    setText(circleToggle, show50mCircles ? '50m圏：表示中' : '50m圏：非表示');
    circleToggle?.setAttribute('aria-pressed', String(show50mCircles));
  }

  function renderSpotPanel() {
    if (!spotPanel) return;
    const record = selectedPoi;
    if (!record?.added || record.fieldDeleted) {
      spotPanel.classList.remove('active');
      return;
    }
    spotPanel.classList.add('active');
    spotNameInput.readOnly = !record.isNew;
    spotNameInput.title = record.isNew ? '追加ゲームスポット名を編集できます' : '読み込み済みゲームスポット名は元KMZを維持します';
    if (document.activeElement !== spotNameInput && spotNameInput.value !== (record.name || '')) spotNameInput.value = record.name || '';
    setText(spotTypeValue, typeLabel(record));
    setText(spotCoordValue, `${Number(record.latlng[0]).toFixed(7)}, ${Number(record.latlng[1]).toFixed(7)}`);
  }

  function renderExceptionReviewState(record) {
    if (!exceptionReview || !record) return;
    const issues = record.spacingIssues || [];
    if (!issues.length) {
      setText(exceptionReview, '現在は50m以上です。但し書きは最終出力対象外です。');
      exceptionReview.classList.add('ok');
      return;
    }
    const reason = String(record.spacingExceptionReason || '').trim();
    if (!reason) {
      setText(exceptionReview, '但し書き未記入です。最終出力前に未記入として分かるよう表示します。');
      exceptionReview.classList.remove('ok');
      return;
    }
    if (record.spacingExceptionConfirmedSignature !== record.spacingIssueSignature) {
      setText(exceptionReview, '位置・相手・距離条件が変わったため、理由を再確認してください。');
      exceptionReview.classList.remove('ok');
      return;
    }
    setText(exceptionReview, '✓ 現在の距離条件に対する理由を確認済みです。');
    exceptionReview.classList.add('ok');
  }

  function renderExceptionPanel() {
    if (!exceptionPanel) return;
    const record = selectedPoi;
    if (!record?.added || record.fieldDeleted) {
      exceptionPanel.classList.remove('active', 'resolved');
      return;
    }
    const issues = record.spacingIssues || [];
    const oldReason = String(record.spacingExceptionReason || '').trim();
    if (!issues.length && !oldReason) {
      exceptionPanel.classList.remove('active', 'resolved');
      return;
    }
    exceptionPanel.classList.add('active');
    if (!issues.length) {
      exceptionPanel.classList.add('resolved');
      setText(exceptionTitle, '✓ 現在は50m以上です');
      setText(exceptionCopy, '以前入力した理由は内部に保持していますが、現在の設計では但し書き対象ではないため最終TXTには出力しません。');
      if (exceptionList.innerHTML) exceptionList.innerHTML = '';
      exceptionReason.style.display = 'none';
      exceptionConfirm.style.display = 'none';
      renderExceptionReviewState(record);
      return;
    }
    exceptionPanel.classList.remove('resolved');
    setText(exceptionTitle, `⚠ 50m未満・要確認（${issues.length}件）`);
    setText(exceptionCopy, '基本ルールでは50m以上の間隔を確保します。50m未満だから自動的に設置不可・不合格とは判定しません。やむを得ない事情がある場合は、なぜこの位置が必要なのかを記録してください。最終判断は運営側が行います。');
    const listHtml = issues.map(issue => `<li>${escapeHtml(issue.other?.name || '名称なし')} ／ ${issue.role}・${issue.type} ／ <strong>${issue.distance.toFixed(1)}m</strong></li>`).join('');
    if (exceptionList.innerHTML !== listHtml) exceptionList.innerHTML = listHtml;
    exceptionReason.style.display = '';
    exceptionConfirm.style.display = '';
    if (document.activeElement !== exceptionReason && exceptionReason.value !== (record.spacingExceptionReason || '')) exceptionReason.value = record.spacingExceptionReason || '';
    setText(exceptionConfirm, record.spacingExceptionConfirmedSignature && record.spacingExceptionConfirmedSignature !== record.spacingIssueSignature ? '変更後の理由を再確認' : 'この理由を確認');
    renderExceptionReviewState(record);
  }

  function sync50mCircleVisibility() {
    if (typeof dataLayer === 'undefined') return;
    for (const record of activeRecords()) {
      const circle = record.rangeCircle;
      if (!circle) continue;
      try {
        const has = dataLayer.hasLayer(circle);
        if (show50mCircles && !has) circle.addTo(dataLayer);
        if (!show50mCircles && has) dataLayer.removeLayer(circle);
      } catch (_) {}
    }
  }

  function normalizePopup() {
    document.querySelectorAll('.leaflet-popup-content').forEach(node => {
      const html = node.innerHTML;
      const next = html
        .replace(/追加予定POI/g, '追加ゲームスポット')
        .replace(/新規追加POI/g, '追加ゲームスポット')
        .replace(/追加希望POI/g, '追加ゲームスポット')
        .replace(/追加希望ポケスト/g, '追加ゲームスポット（ポケストップ）')
        .replace(/追加希望ジム/g, '追加ゲームスポット（ジム）')
        .replace(/追加希望パワスポ/g, '追加ゲームスポット（パワースポット）')
        .replace(/現地モード：50m円を自動表示/g, 'CREATIVE MODE：50m圏を表示');
      if (next !== html) node.innerHTML = next;
    });
  }

  function normalizeKnownLeaf(element) {
    if (!element || element.children.length) return;
    const text = element.textContent || '';
    const replacements = [
      ['追加予定POIを選択してください', '追加ゲームスポットを選択してください'],
      ['地図上の黄色い追加予定POIをタップしてください。', '地図上の黄色い追加ゲームスポットをタップしてください。'],
      ['黄色いPOIをタップするか、現在地の近くなら自動で選びます。', '黄色い追加ゲームスポットをタップするか、現在地の近くなら自動で選びます。'],
      ['近くの候補を選びます', '近くの追加ゲームスポットを選びます'],
      ['追加予定POI', '追加ゲームスポット'],
      ['既存POI', '既存ゲームスポット'],
      ['新規POI', '追加ゲームスポット'],
      ['POI種類', 'ゲームスポット種類'],
      ['POIを選択', 'ゲームスポットを選択']
    ];
    let next = text;
    for (const [from, to] of replacements) next = next.split(from).join(to);
    if (next !== text) element.textContent = next;
  }

  function syncTerminology() {
    if (terminologyLock) return;
    terminologyLock = true;
    try {
      const intro = document.querySelector('.field-mode-intro');
      setText(intro?.querySelector('strong'), '既存ゲームスポットを読み込み、追加ゲームスポットと活動範囲をCREATIVE MODE内で設計します。');
      setText(intro?.querySelector('p'), '配置・50m確認・例外理由・完成KMZ／但し書き出力までを一つの設計データとして扱います。');
      setText(document.querySelector('#fieldModePlaceholder strong'), 'KMZを読み込むと、ゲームスポット設計マップを表示します。');
      setText(document.querySelector('#fieldModePlaceholder span:last-child'), '既存ゲームスポット・追加ゲームスポット・50m圏を重ねて確認します。');
      const entryLabel = document.querySelector('.field-mode-entry-file-label');
      if (entryLabel?.firstChild?.nodeType === Node.TEXT_NODE && entryLabel.firstChild.textContent !== 'ゲームスポット元データ（KMZ／KML）を選択') entryLabel.firstChild.textContent = 'ゲームスポット元データ（KMZ／KML）を選択';
      const tool = document.querySelector('#fieldModeCreativeHotbar [data-tool="poi"] small');
      setText(tool, 'ゲームスポット');
      const toolButton = tool?.closest('button');
      if (toolButton?.getAttribute('aria-label') !== '追加ゲームスポットを配置') toolButton?.setAttribute('aria-label', '追加ゲームスポットを配置');
      normalizeKnownLeaf(document.getElementById('fieldModeCreativeHint'));
      normalizeKnownLeaf(document.getElementById('fieldModeSelectionTitle'));
      normalizeKnownLeaf(document.getElementById('fieldModeSelectionDetail'));
      normalizeKnownLeaf(document.getElementById('fieldModeStatus'));
      const deleteButton = document.querySelector('.field-poi-delete');
      setText(deleteButton, '🗑 このゲームスポットを削除');
      const typeButton = document.getElementById('fieldPoiTypeButton');
      if (typeButton && typeButton.title !== 'タップするたびにゲームスポット種類を切り替えます') typeButton.title = 'タップするたびにゲームスポット種類を切り替えます';
      setText(document.querySelector('.field-circle-options-title span:last-child'), '50m 基本ルール');
      setText(document.querySelector('.field-circle-options-note'), '50mが基本ルールです。30m・40mは50m未満時の例外確認用で、通常承認基準ではありません。');
      const toggle40 = document.getElementById('fieldPoi40mToggle');
      const toggle30 = document.getElementById('fieldPoi30mToggle');
      setText(toggle40, toggle40?.classList.contains('is-on') ? '40m例外確認用：追加する ✓' : '40m例外確認用：追加しない');
      setText(toggle30, toggle30?.classList.contains('is-on') ? '30m例外確認用：追加する ✓' : '30m例外確認用：追加しない');
      normalizePopup();
    } finally {
      terminologyLock = false;
    }
  }

  function sourceIdentity() {
    let name = 'field-data';
    try { name = String(sourceFileName || name); } catch (_) {}
    const original = activeRecords().filter(record => !record.isNew).map(stableRecordKey).sort().join(';;');
    return `${name}::${original}`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(STORE_DB, STORE_DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('但し書き保存領域を開けませんでした。'));
    });
  }

  async function storeGet() {
    if (typeof indexedDB === 'undefined') return null;
    const db = await openDb();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(STORE_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error || tx.error);
      });
    } finally {
      db.close();
    }
  }

  async function storePut(value) {
    if (typeof indexedDB === 'undefined') return;
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, STORE_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  async function storeDelete() {
    if (typeof indexedDB === 'undefined') return;
    const db = await openDb();
    try {
      await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).delete(STORE_KEY);
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    } finally {
      db.close();
    }
  }

  function persistedRecords() {
    const out = {};
    for (const record of additionalRecords()) {
      const reason = String(record.spacingExceptionReason || '');
      const confirmed = String(record.spacingExceptionConfirmedSignature || '');
      if (!reason && !confirmed) continue;
      out[stableRecordKey(record)] = { reason, confirmedSignature: confirmed, reviewedAt: Number(record.spacingExceptionReviewedAt) || 0 };
    }
    return out;
  }

  async function persistNow() {
    const key = sourceIdentity();
    if (!key) return;
    try {
      await storePut({
        version: 1,
        sourceKey: key,
        campsiteName: campsiteNameInput?.value || defaultCampsiteName(),
        show50mCircles,
        records: persistedRecords(),
        savedAt: Date.now()
      });
    } catch (error) {
      console.warn('APAC Ver4 exception save failed', error);
    }
  }

  async function restoreForCurrentSource() {
    const key = sourceIdentity();
    if (!key) return;
    const generation = ++restoreGeneration;
    currentSourceKey = key;
    if (campsiteNameInput && !campsiteNameInput.value) campsiteNameInput.value = defaultCampsiteName();
    try {
      const payload = await storeGet();
      if (generation !== restoreGeneration || currentSourceKey !== key) return;
      if (payload?.version === 1 && payload.sourceKey === key) {
        if (campsiteNameInput) campsiteNameInput.value = payload.campsiteName || defaultCampsiteName();
        show50mCircles = payload.show50mCircles !== false;
        const records = payload.records || {};
        for (const record of additionalRecords()) {
          const saved = records[stableRecordKey(record)];
          if (!saved) continue;
          record.spacingExceptionReason = saved.reason || '';
          record.spacingExceptionConfirmedSignature = saved.confirmedSignature || '';
          record.spacingExceptionReviewedAt = Number(saved.reviewedAt) || 0;
        }
      } else {
        if (campsiteNameInput) campsiteNameInput.value = defaultCampsiteName();
        show50mCircles = true;
      }
      recomputeAll();
      syncTerminology();
    } catch (error) {
      console.warn('APAC Ver4 exception restore failed', error);
      recomputeAll();
    }
  }

  function scheduleRestoreAfterLoad() {
    const started = Date.now();
    const timer = setInterval(() => {
      let ready = false;
      try { ready = !!fileLoaded; } catch (_) {}
      if (ready) {
        clearInterval(timer);
        restoreForCurrentSource();
      } else if (Date.now() - started > 10000) {
        clearInterval(timer);
      }
    }, 80);
  }

  function syncFinalButton() {
    const button = document.getElementById('fieldModeSaveButton');
    const note = document.getElementById('fieldModeSaveNote');
    if (!button) return;
    let loaded = false;
    try { loaded = !!fileLoaded; } catch (_) {}
    const areaCount = window.FieldModeArea?.getRecords?.().filter(record => !record.deleted).length || 0;
    const canFinalize = loaded && (activeRecords().length > 0 || areaCount > 0);
    if (button.disabled === canFinalize) button.disabled = !canFinalize;
    setText(button, '設計完成：KMZ＋但し書きを出力');
    if (button.getAttribute('aria-label') !== '完成KMZと必要な50m未満但し書きを端末へ出力') button.setAttribute('aria-label', '完成KMZと必要な50m未満但し書きを端末へ出力');
    const under = under50Records().length;
    const needs = reviewNeededRecords().length;
    if (!canFinalize) setText(note, 'ゲームスポットを読み込むと設計データを出力できます。');
    else if (under === 0) setText(note, '50m未満はありません。完成KMZを出力します。');
    else if (needs > 0) setText(note, `50m未満 ${under}件 ／ 但し書き要確認 ${needs}件。出力前に未確認箇所を案内します。`);
    else setText(note, `50m未満 ${under}件。完成KMZ＋但し書きTXTを同じチェックIDで出力します。`);
  }

  function hashText(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0').slice(-7);
  }

  function designFingerprint() {
    const records = activeRecords().map(record => [
      roleLabel(record), typeLabel(record), record.name || '',
      Number(record.latlng[0]).toFixed(7), Number(record.latlng[1]).toFixed(7),
      record.spacingExceptionReason || ''
    ].join('|')).sort();
    const areas = (window.FieldModeArea?.getRecords?.() || [])
      .filter(record => !record.deleted)
      .map(record => `${record.name || '活動範囲'}:${(record.points || []).map(point => `${Number(point[0]).toFixed(7)},${Number(point[1]).toFixed(7)}`).join(';')}`)
      .sort();
    return [...records, ...areas].join('||');
  }

  function makeCheckId(now = new Date()) {
    const pad = value => String(value).padStart(2, '0');
    const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    return `CM-${stamp}-${hashText(designFingerprint())}`;
  }

  function checkedAtLabel(now = new Date()) {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
    return `${now.toLocaleString('ja-JP', { hour12: false })} ${zone}`;
  }

  function snapshotForExport() {
    recomputeAll();
    const now = new Date();
    const campsiteName = String(campsiteNameInput?.value || defaultCampsiteName()).trim() || defaultCampsiteName();
    const checkId = makeCheckId(now);
    const issues = under50Records().map(record => ({
      name: record.name || '名称なし',
      type: typeLabel(record),
      lat: Number(record.latlng[0]),
      lng: Number(record.latlng[1]),
      reason: String(record.spacingExceptionReason || '').trim(),
      confirmed: !record.spacingExceptionNeedsReview,
      opponents: (record.spacingIssues || []).map(issue => ({
        name: issue.other?.name || '名称なし',
        role: issue.role,
        type: issue.type,
        distance: Number(issue.distance)
      }))
    }));
    return { version: 1, campsiteName, checkedAt: checkedAtLabel(now), checkId, issues, additionalCount: additionalCount(), designHash: hashText(designFingerprint()) };
  }

  function buildExceptionText(snapshot = pendingExport) {
    if (!snapshot?.issues?.length) return '';
    const lines = [
      'Campsite Design Tool JP | CREATIVE MODE Ver4.0',
      '50m未満ゲームスポット但し書き',
      '',
      `キャンプサイト名: ${snapshot.campsiteName}`,
      `確認日時: ${snapshot.checkedAt}`,
      `チェックID: ${snapshot.checkId}`,
      `追加ゲームスポット数: ${snapshot.additionalCount} / ${MAX_ADDITIONAL_SPOTS}`,
      '',
      `基本ルール: ゲームスポット間隔は${TARGET_METERS}m以上です。${TARGET_METERS}m未満は自動的な設置不可・不合格ではなく、理由とともに運営判断の材料として整理します。`,
      ''
    ];
    snapshot.issues.forEach((item, index) => {
      lines.push(`[${index + 1}] ${item.name}`);
      lines.push(`種別: ${item.type}`);
      lines.push(`座標: ${item.lat.toFixed(7)}, ${item.lng.toFixed(7)}`);
      lines.push('50m未満となる相手ゲームスポット:');
      item.opponents.forEach(opponent => lines.push(`- ${opponent.name} / ${opponent.role} / ${opponent.type} / ${opponent.distance.toFixed(1)}m`));
      lines.push(`理由: ${item.reason || '【未記入】'}`);
      if (!item.confirmed) lines.push('確認状態: 【再確認が必要】位置・相手・距離条件に対する理由を再確認してください。');
      lines.push('');
    });
    lines.push('フォーム貼り付け用');
    snapshot.issues.forEach(item => {
      const distances = item.opponents.map(opponent => opponent.distance).filter(Number.isFinite);
      const nearest = distances.length ? Math.min(...distances) : NaN;
      lines.push(`・${item.name}（${Number.isFinite(nearest) ? nearest.toFixed(1) : '-'}m）`);
      lines.push(item.reason || '【理由未記入】');
      if (!item.confirmed) lines.push('【要再確認】');
      lines.push('');
    });
    lines.push(`チェックID: ${snapshot.checkId}`);
    return lines.join('\r\n');
  }

  function safeFileName(value) {
    return String(value || 'キャンプサイト').replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 72) || 'キャンプサイト';
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    nativeAnchorClick.call(anchor);
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function clearPendingExport(message = '') {
    forceFinalExport = false;
    pendingExport = null;
    clearTimeout(pendingTimer);
    exportOverlay?.classList.remove('active');
    recomputeAll();
    if (message) {
      setText(modeStatus, message);
      setText(document.getElementById('fieldModeSaveNote'), message);
    }
  }

  async function bundleKmzAndTxt(kmzHref, snapshot) {
    try {
      const response = await fetch(kmzHref);
      if (!response.ok) throw new Error('完成KMZを束ねられませんでした。');
      const kmzBlob = await response.blob();
      const bundle = new JSZip();
      const base = safeFileName(snapshot.campsiteName);
      bundle.file(`${base}_完成_${snapshot.checkId}.kmz`, kmzBlob);
      bundle.file(`${base}_50m未満ゲームスポット但し書き_${snapshot.checkId}.txt`, `\uFEFF${buildExceptionText(snapshot)}`);
      const zipBlob = await bundle.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
      downloadBlob(zipBlob, `${base}_提出用設計データ_${snapshot.checkId}.zip`);
      clearPendingExport('設計データ出力完了：完成KMZ＋但し書きTXT');
    } catch (error) {
      console.error('APAC Ver4 bundle export failed', error);
      clearPendingExport(`⚠ 出力失敗：${error.message || '設計データを出力できませんでした。'}`);
    }
  }

  function installDownloadInterceptor() {
    if (HTMLAnchorElement.prototype.click.__fieldApacV4Patched) return;
    const patched = function patchedAnchorClick() {
      if (!pendingExport || !/\.kmz$/i.test(this.download || '')) return nativeAnchorClick.call(this);
      const snapshot = pendingExport;
      const base = safeFileName(snapshot.campsiteName);
      if (!snapshot.issues.length) {
        this.download = `${base}_完成_${snapshot.checkId}.kmz`;
        const result = nativeAnchorClick.call(this);
        setTimeout(() => clearPendingExport('設計データ出力完了：完成KMZ'), 0);
        return result;
      }
      bundleKmzAndTxt(this.href, snapshot);
      return undefined;
    };
    patched.__fieldApacV4Patched = true;
    HTMLAnchorElement.prototype.click = patched;
  }

  function prepareFinalExport(event) {
    if (event.target !== document.getElementById('fieldModeSaveButton')) return;
    recomputeAll();
    if (additionalCount() > MAX_ADDITIONAL_SPOTS) {
      const proceed = window.confirm(`追加ゲームスポットが${additionalCount()}個あります。CREATIVE MODEの上限は${MAX_ADDITIONAL_SPOTS}個です。\n読み込み済み設計を自動削除はしません。このまま確認用データを出力しますか？`);
      if (!proceed) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
    const needs = reviewNeededRecords();
    if (needs.length) {
      const names = needs.slice(0, 6).map(record => `・${record.name}`).join('\n');
      const more = needs.length > 6 ? `\nほか${needs.length - 6}件` : '';
      const proceed = window.confirm(`50m未満の追加ゲームスポットに、但し書き未記入または再確認が必要な箇所が${needs.length}件あります。\n${names}${more}\n\n未確認箇所はTXTに【未記入】または【要再確認】と明記されます。このまま出力しますか？`);
      if (!proceed) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
    pendingExport = snapshotForExport();
    forceFinalExport = true;
    exportOverlay?.classList.add('active');
    pendingTimer = setTimeout(() => {
      if (pendingExport) clearPendingExport('⚠ 出力が完了しませんでした。もう一度お試しください。');
    }, 20000);
  }

  function installMax25Guard() {
    document.addEventListener('click', event => {
      const button = event.target?.closest?.('#fieldModeNewPoiButton');
      if (!button || additionalCount() < MAX_ADDITIONAL_SPOTS) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      setText(modeStatus, `追加ゲームスポットは最大${MAX_ADDITIONAL_SPOTS}個までです`);
      setText(document.getElementById('fieldModeSelectionDetail'), `現在 ${additionalCount()}個です。追加ゲームスポットは最大${MAX_ADDITIONAL_SPOTS}個までです。`);
      renderSummary();
    }, true);
  }

  function wrapCoreFunctions() {
    originalChangedRecords = changedRecords;
    changedRecords = function apacV4ChangedRecords(...args) {
      const base = Array.from(new Set(originalChangedRecords(...args) || []));
      if (forceFinalExport && !base.length) {
        const seed = activeRecords()[0];
        if (seed) base.push(seed);
      }
      return base;
    };

    originalUpdateSaveButton = updateSaveButton;
    updateSaveButton = function apacV4UpdateSaveButton(...args) {
      const result = originalUpdateSaveButton(...args);
      recomputeAll({ render: false });
      renderSummary();
      renderSpotPanel();
      renderExceptionPanel();
      syncFinalButton();
      return result;
    };

    updateDistanceStatus = function apacV4DistanceStatus(position = currentPosition, excludedRecord = null) {
      return updateDistanceStatusV4(position, excludedRecord);
    };

    originalRenderKml = renderKml;
    renderKml = function apacV4RenderKml(...args) {
      const result = originalRenderKml(...args);
      setTimeout(() => {
        syncTerminology();
        restoreForCurrentSource();
        recomputeAll();
      }, 0);
      return result;
    };

    originalSelectAddedPoi = selectAddedPoi;
    selectAddedPoi = function apacV4SelectAddedPoi(record) {
      const result = originalSelectAddedPoi(record);
      recomputeAll({ render: false });
      renderSpotPanel();
      renderExceptionPanel();
      syncTerminology();
      return result;
    };

    originalResetPoiSelection = resetPoiSelection;
    resetPoiSelection = function apacV4ResetPoiSelection(...args) {
      const result = originalResetPoiSelection(...args);
      renderSpotPanel();
      renderExceptionPanel();
      syncTerminology();
      return result;
    };
  }

  function installObservers() {
    const saveButton = document.getElementById('fieldModeSaveButton');
    if (saveButton) new MutationObserver(syncFinalButton).observe(saveButton, { attributes: true, attributeFilter: ['disabled'], childList: true, subtree: true, characterData: true });
    new MutationObserver(syncTerminology).observe(document.body, { childList: true, subtree: true, characterData: true });
    const status = document.getElementById('fieldModeStatus');
    if (status) {
      new MutationObserver(() => {
        const text = status.textContent || '';
        if (/復元|読込済|読み込み/.test(text)) {
          recomputeAll();
          syncTerminology();
        }
      }).observe(status, { childList: true, subtree: true, characterData: true });
    }
    try { map.on('popupopen', normalizePopup); } catch (_) {}
    document.getElementById('fieldModeFile')?.addEventListener('change', () => {
      currentSourceKey = '';
      scheduleRestoreAfterLoad();
    });
    document.getElementById('fieldModeDiscardSessionButton')?.addEventListener('click', () => storeDelete().catch(() => {}));
  }

  function install() {
    if (installed || !dependenciesReady()) return false;
    addStyle();
    if (!buildUi()) return false;
    installed = true;
    wrapCoreFunctions();
    installDownloadInterceptor();
    installMax25Guard();
    document.addEventListener('click', prepareFinalExport, true);
    installObservers();
    if (campsiteNameInput && !campsiteNameInput.value) campsiteNameInput.value = defaultCampsiteName();
    syncTerminology();
    recomputeAll();
    syncFinalButton();
    let alreadyLoaded = false;
    try { alreadyLoaded = !!fileLoaded; } catch (_) {}
    if (alreadyLoaded) restoreForCurrentSource();

    window.FieldModeApacV4 = {
      MAX_ADDITIONAL_SPOTS,
      TARGET_METERS,
      recompute: () => recomputeAll(),
      additionalCount,
      under50Count: () => under50Records().length,
      reviewNeededCount: () => reviewNeededRecords().length,
      snapshotIssues: () => snapshotForExport(),
      buildExceptionText,
      sourceIdentity,
      persistNow,
      restoreForCurrentSource,
      setShow50m: value => { show50mCircles = !!value; sync50mCircleVisibility(); renderSummary(); },
      show50m: () => show50mCircles
    };
    return true;
  }

  const started = Date.now();
  const timer = setInterval(() => {
    if (install()) {
      clearInterval(timer);
      return;
    }
    if (Date.now() - started >= INSTALL_TIMEOUT_MS) {
      clearInterval(timer);
      console.warn('APAC Ver4 CREATIVE MODE support could not initialize.');
    }
  }, 50);
})();
