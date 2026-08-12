(() => {
  'use strict';

  const TOKYO_DOME_SQUARE_METERS = 46755;
  const POI_LIMITS_LOCAL = { pokestop: 12, gym: 8, power: 5 };

  let gungiOverlay = null;
  let gungiState = null;
  let gungiMapHome = null;
  let gungiFocusLayers = [];

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function ensureStyles() {
    if (document.getElementById('gungiRuntimeStyles')) return;

    const style = document.createElement('style');
    style.id = 'gungiRuntimeStyles';
    style.textContent = `
      body.gungi-open{overflow:hidden}
      .gungi-overlay{position:fixed;inset:0;z-index:1000000;background:rgba(2,6,23,.94);backdrop-filter:blur(12px);display:flex;align-items:center;justify-content:center;padding:18px;box-sizing:border-box}
      .gungi-shell{width:min(1120px,100%);max-height:calc(100dvh - 36px);overflow:auto;border:1px solid rgba(148,163,184,.28);border-radius:24px;background:linear-gradient(180deg,rgba(15,23,42,.98),rgba(2,6,23,.98));box-shadow:0 28px 80px rgba(0,0,0,.5)}
      .gungi-newsbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(148,163,184,.2);background:rgba(127,29,29,.28)}
      .gungi-newsbar strong{color:#fee2e2;font-size:13px;letter-spacing:.16em}
      .gungi-newsbar span{color:#fca5a5;font-size:11px;font-weight:800}
      .gungi-stage{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,.8fr);gap:16px;padding:16px}
      .gungi-monitor{min-width:0;border:1px solid rgba(56,189,248,.3);border-radius:18px;background:#020617;overflow:hidden;position:relative}
      .gungi-monitor-label{position:absolute;z-index:500;top:10px;left:10px;padding:6px 9px;border-radius:999px;background:rgba(2,6,23,.76);border:1px solid rgba(125,211,252,.35);color:#bae6fd;font-size:11px;font-weight:800;pointer-events:none}
      .gungi-map-slot{min-height:420px;height:min(56vh,560px)}
      .gungi-map-slot #distanceMap{width:100%!important;height:100%!important;min-height:420px!important;margin:0!important;border:0!important;border-radius:0!important}
      .gungi-panel{display:flex;flex-direction:column;gap:12px;min-width:0}
      .gungi-dialogue{padding:16px;border:1px solid rgba(148,163,184,.24);border-radius:16px;background:rgba(15,23,42,.76)}
      .gungi-dialogue-row+.gungi-dialogue-row{margin-top:12px;padding-top:12px;border-top:1px solid rgba(148,163,184,.15)}
      .gungi-speaker{display:inline-flex;align-items:center;gap:6px;margin-bottom:7px;padding:5px 9px;border-radius:999px;background:rgba(56,189,248,.11);color:#bae6fd;font-size:12px;font-weight:900}
      .gungi-speaker[data-speaker="ミナ"]{background:rgba(34,197,94,.11);color:#bbf7d0}
      .gungi-speaker[data-speaker="リク"]{background:rgba(249,115,22,.11);color:#fed7aa}
      .gungi-speaker[data-speaker="ハル"]{background:rgba(168,85,247,.11);color:#e9d5ff}
      .gungi-copy{margin:0;color:#f8fafc;font-size:16px;line-height:1.8;font-weight:700}
      .gungi-info{padding:14px;border:1px solid rgba(148,163,184,.18);border-radius:15px;background:rgba(2,6,23,.42);color:#cbd5e1;font-size:13px;line-height:1.75}
      .gungi-info:empty{display:none}
      .gungi-info-title{display:block;margin-bottom:7px;color:#f8fafc;font-size:12px;letter-spacing:.08em}
      .gungi-layer-line{padding:8px 10px;border-radius:10px;background:rgba(148,163,184,.08);color:#e2e8f0;font-weight:800}
      .gungi-layer-line+.gungi-layer-line{margin-top:7px}
      .gungi-note{margin-top:8px;color:#94a3b8;font-size:11px}
      .gungi-area-number{font-size:22px;font-weight:900;color:#f8fafc}
      .gungi-result-card{padding:14px;border:1px solid rgba(56,189,248,.32);border-radius:14px;background:rgba(14,165,233,.08)}
      .gungi-result-card[data-ok="true"]{border-color:rgba(34,197,94,.38);background:rgba(34,197,94,.08)}
      .gungi-result-label{color:#94a3b8;font-size:11px;letter-spacing:.12em;font-weight:900}
      .gungi-result-value{margin-top:5px;color:#f8fafc;font-size:21px;font-weight:900}
      .gungi-result-list{margin:10px 0 0;padding-left:18px;color:#cbd5e1;font-size:12px;line-height:1.7}
      .gungi-nav{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:0 16px 16px}
      .gungi-nav button{min-height:44px;padding:10px 14px;border-radius:12px;border:1px solid rgba(56,189,248,.32);background:rgba(14,165,233,.1);color:#e0f2fe;font-weight:900;cursor:pointer}
      .gungi-nav button:last-child{justify-self:stretch}
      .gungi-nav button:disabled{opacity:.35;cursor:default}
      .gungi-progress{color:#cbd5e1;font-size:12px;font-weight:900;text-align:center;white-space:nowrap}
      .gungi-close{border-color:rgba(34,197,94,.4)!important;background:rgba(34,197,94,.12)!important;color:#dcfce7!important}
      .gungi-map-focus-ring{animation:gungi-map-pulse 1.1s ease-in-out infinite;transform-origin:center;transform-box:fill-box}
      .gungi-map-area-focus{animation:gungi-area-pulse 1.3s ease-in-out infinite}
      @keyframes gungi-map-pulse{0%,100%{stroke-opacity:.55;fill-opacity:.08}50%{stroke-opacity:1;fill-opacity:.23}}
      @keyframes gungi-area-pulse{0%,100%{stroke-opacity:.5;fill-opacity:.06}50%{stroke-opacity:1;fill-opacity:.2}}
      @media(max-width:760px){
        .gungi-overlay{padding:0}
        .gungi-shell{max-height:100dvh;min-height:100dvh;border-radius:0;border-left:0;border-right:0}
        .gungi-stage{grid-template-columns:1fr;padding:10px;gap:10px}
        .gungi-map-slot{height:43vh;min-height:300px}
        .gungi-map-slot #distanceMap{min-height:300px!important}
        .gungi-dialogue{padding:13px}
        .gungi-copy{font-size:15px}
        .gungi-nav{padding:0 10px 12px;position:sticky;bottom:0;background:linear-gradient(180deg,rgba(2,6,23,0),rgba(2,6,23,.98) 22%);padding-top:18px}
      }
    `;
    document.head.appendChild(style);
  }

  function collectPoints() {
    const points = [];
    Object.entries(window._layerPoints || {}).forEach(([layerName, layerPoints]) => {
      if (!Array.isArray(layerPoints)) return;
      const isCsvLayer = layerName === 'CSV_POI';
      if (!isCsvLayer && typeof isDistanceTargetLayer === 'function' && !isDistanceTargetLayer(layerName)) return;
      layerPoints.forEach(point => {
        const lat = Number(point?.lat ?? point?.latitude ?? point?.Latitude ?? point?.['緯度']);
        const lng = Number(point?.lng ?? point?.lon ?? point?.longitude ?? point?.Longitude ?? point?.['経度']);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        points.push({
          ...point,
          lat,
          lng,
          layer: typeof cleanLayerName === 'function' ? cleanLayerName(layerName) : layerName,
          originalLayer: layerName
        });
      });
    });
    return points;
  }

  function isExistingPoint(point) {
    if (typeof isExistingPoi === 'function') return isExistingPoi(point);
    return /(既存|existing|current)/i.test(String(point?.originalLayer || point?.layer || ''));
  }

  function isAddedPoint(point) {
    if (typeof isAddedLayerName === 'function') return isAddedLayerName(point?.originalLayer || point?.layer || '');
    return /(追加|希望|新規|候補|add|new|candidate|proposed)/i.test(String(point?.originalLayer || point?.layer || ''));
  }

  function isExistingExisting(warning) {
    return Boolean(warning && isExistingPoint(warning.a) && isExistingPoint(warning.b));
  }

  function getIssueWarnings() {
    return Array.from(typeof latestDistanceWarnings !== 'undefined' ? latestDistanceWarnings : [])
      .filter(warning => warning && Number(warning.distance) < 40 && !isExistingExisting(warning))
      .sort((a, b) => Number(a.distance) - Number(b.distance));
  }

  function getReferenceWarnings() {
    return Array.from(typeof latestDistanceWarnings !== 'undefined' ? latestDistanceWarnings : [])
      .filter(warning => warning && Number(warning.distance) < 40 && isExistingExisting(warning));
  }

  function getLayerGuideRows() {
    const names = Object.keys(window._layerPoints || {});
    const typeOrder = ['pokestop', 'gym', 'power'];
    const labels = { pokestop: 'ポケストップ', gym: 'ジム', power: 'パワースポット' };

    const existing = new Set();
    const added = new Set();

    names.forEach(name => {
      const type = typeof getPoiTypeFromLayerName === 'function' ? getPoiTypeFromLayerName(name) : null;
      if (!type) return;
      if (typeof isExistingLayerName === 'function' && isExistingLayerName(name)) existing.add(type);
      if (typeof isAddedLayerName === 'function' && isAddedLayerName(name)) added.add(type);
    });

    const rows = [];
    const existingLabels = typeOrder.filter(type => existing.has(type)).map(type => labels[type]);
    const addedLabels = typeOrder.filter(type => added.has(type)).map(type => labels[type]);

    if (existingLabels.length) rows.push(`既存の${existingLabels.join(' / ')}`);
    if (addedLabels.length) rows.push(`追加希望${addedLabels.join(' / ')}`);

    if (!rows.length) {
      rows.push('既存のポケストップ / ジム / パワースポット');
      rows.push('追加希望ポケストップ / ジム / パワースポット');
    }

    return rows;
  }

  function getAddedCounts() {
    if (typeof countPoiTypesFromLayers === 'function') {
      return countPoiTypesFromLayers(window._layerPoints || {});
    }
    return { pokestop: 0, gym: 0, power: 0 };
  }

  function getSubmissionVerdict() {
    const issues = getIssueWarnings();
    const counts = getAddedCounts();
    const total = counts.pokestop + counts.gym + counts.power;
    const hasBlockingDistance = issues.some(item => Number(item.distance) < 30);
    const poiLimitOk =
      counts.pokestop <= POI_LIMITS_LOCAL.pokestop &&
      counts.gym <= POI_LIMITS_LOCAL.gym &&
      counts.power <= POI_LIMITS_LOCAL.power &&
      total <= 25;
    const activityAreaOk = Array.isArray(window._activityPolygons) && window._activityPolygons.length === 1;

    return {
      ok: !hasBlockingDistance && poiLimitOk && activityAreaOk,
      hasBlockingDistance,
      poiLimitOk,
      activityAreaOk,
      counts,
      total
    };
  }

  function polygonAreaSquareMeters(polygon) {
    if (!Array.isArray(polygon) || polygon.length < 3) return 0;
    const R = 6371000;
    const valid = polygon
      .map(item => [Number(item?.[0]), Number(item?.[1])])
      .filter(item => Number.isFinite(item[0]) && Number.isFinite(item[1]));
    if (valid.length < 3) return 0;

    const meanLat = valid.reduce((sum, item) => sum + item[0], 0) / valid.length;
    const cosLat = Math.cos(meanLat * Math.PI / 180);
    const projected = valid.map(([lat, lng]) => [
      R * lng * Math.PI / 180 * cosLat,
      R * lat * Math.PI / 180
    ]);

    let twiceArea = 0;
    projected.forEach((point, index) => {
      const next = projected[(index + 1) % projected.length];
      twiceArea += point[0] * next[1] - next[0] * point[1];
    });
    return Math.abs(twiceArea) / 2;
  }

  function getActivityAreaInfo() {
    const polygon = Array.isArray(window._activityPolygons) ? window._activityPolygons[0] : null;
    const squareMeters = polygonAreaSquareMeters(polygon);
    return {
      polygon,
      squareMeters,
      domeEquivalent: squareMeters > 0 ? squareMeters / TOKYO_DOME_SQUARE_METERS : 0
    };
  }

  function getMap() {
    try {
      return typeof distanceLeafletMap !== 'undefined' ? distanceLeafletMap : null;
    } catch (_) {
      return null;
    }
  }

  function clearMapFocus() {
    const map = getMap();
    if (!map) return;
    gungiFocusLayers.forEach(layer => {
      try { map.removeLayer(layer); } catch (_) {}
    });
    gungiFocusLayers = [];
  }

  function addFocusLayer(layer) {
    const map = getMap();
    if (!map || !layer) return;
    layer.addTo(map);
    gungiFocusLayers.push(layer);
  }

  function fitOverview() {
    clearMapFocus();
    const map = getMap();
    if (!map || typeof L === 'undefined') return;
    const latLngs = [];
    collectPoints().forEach(point => latLngs.push([point.lat, point.lng]));
    (window._activityPolygons || []).forEach(polygon => {
      (polygon || []).forEach(item => {
        const lat = Number(item?.[0]);
        const lng = Number(item?.[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) latLngs.push([lat, lng]);
      });
    });
    if (!latLngs.length) return;
    map.fitBounds(L.latLngBounds(latLngs), { padding: [38, 38] });
  }

  function focusActivityArea() {
    clearMapFocus();
    const map = getMap();
    const info = getActivityAreaInfo();
    if (!map || typeof L === 'undefined' || !Array.isArray(info.polygon) || info.polygon.length < 3) {
      fitOverview();
      return;
    }

    const focus = L.polygon(info.polygon, {
      color: '#c084fc',
      fillColor: '#c084fc',
      fillOpacity: 0.1,
      weight: 5,
      interactive: false,
      className: 'gungi-map-area-focus'
    });
    addFocusLayer(focus);
    map.fitBounds(focus.getBounds(), { padding: [55, 55], maxZoom: 18 });
  }

  function focusIssue(warning) {
    clearMapFocus();
    const map = getMap();
    if (!map || typeof L === 'undefined' || !warning) return;

    const points = [warning.a, warning.b];
    const latLngs = [];
    points.forEach(point => {
      const lat = Number(point?.lat);
      const lng = Number(point?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      latLngs.push([lat, lng]);
      addFocusLayer(L.circleMarker([lat, lng], {
        radius: 17,
        color: '#f8fafc',
        fillColor: '#38bdf8',
        fillOpacity: 0.12,
        weight: 5,
        interactive: false,
        className: 'gungi-map-focus-ring'
      }));
    });

    if (Number.isFinite(Number(warning.warningIndex)) && typeof focusDistanceWarning === 'function') {
      focusDistanceWarning(Number(warning.warningIndex));
      return;
    }

    if (latLngs.length) map.fitBounds(L.latLngBounds(latLngs), { padding: [80, 80], maxZoom: 19 });
  }

  function getCenterPoint() {
    const area = getActivityAreaInfo();
    if (Array.isArray(area.polygon) && area.polygon.length) {
      const valid = area.polygon
        .map(item => [Number(item?.[0]), Number(item?.[1])])
        .filter(item => Number.isFinite(item[0]) && Number.isFinite(item[1]));
      if (valid.length) {
        return {
          lat: valid.reduce((sum, item) => sum + item[0], 0) / valid.length,
          lng: valid.reduce((sum, item) => sum + item[1], 0) / valid.length
        };
      }
    }
    const points = collectPoints();
    if (!points.length) return null;
    return {
      lat: points.reduce((sum, point) => sum + point.lat, 0) / points.length,
      lng: points.reduce((sum, point) => sum + point.lng, 0) / points.length
    };
  }

  async function resolveLocationLabel() {
    const center = getCenterPoint();
    if (!center) return '';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2800);
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ja&zoom=10&lat=${encodeURIComponent(center.lat)}&lon=${encodeURIComponent(center.lng)}`;
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
      if (!response.ok) return '';
      const data = await response.json();
      const address = data?.address || {};
      const prefecture = address.province || address.state || address.region || '';
      const municipality = address.city || address.town || address.village || address.city_district || address.county || '';
      if (prefecture && municipality && !municipality.includes(prefecture)) return `${prefecture}${municipality}`;
      return prefecture || municipality || '';
    } catch (_) {
      return '';
    } finally {
      clearTimeout(timer);
    }
  }

  function speakerLabel(id) {
    return ({ ren: 'レン', mina: 'ミナ', riku: 'リク', haru: 'ハル' })[id] || id;
  }

  function issuePositiveLine(warning) {
    const distance = Number(warning?.distance);
    if (distance < 20) return '人が集まりやすい場所なんだね。現地では少し意識しておこう。';
    if (distance < 30) return 'まとまりのある場所なんだね。現地では人の流れを少し意識しておこう。';
    return '近い位置にまとまっているね。現地では少し意識しておこう。';
  }

  function buildSteps() {
    const issues = getIssueWarnings();
    return [
      { kind: 'news' },
      { kind: 'overview' },
      { kind: 'layers' },
      { kind: 'area' },
      { kind: 'count' },
      ...issues.map((warning, issueIndex) => ({ kind: 'issue', warning, issueIndex })),
      { kind: 'finale' }
    ];
  }

  function createOverlay() {
    ensureStyles();
    const overlay = document.createElement('div');
    overlay.className = 'gungi-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'キャンプサイト軍議');
    overlay.innerHTML = `
      <div class="gungi-shell">
        <div class="gungi-newsbar">
          <strong>CAMP SITE NEWS</strong>
          <span>軍議システム</span>
        </div>
        <div class="gungi-stage">
          <div class="gungi-monitor">
            <div class="gungi-monitor-label">LIVE MAP</div>
            <div class="gungi-map-slot"></div>
          </div>
          <div class="gungi-panel">
            <div class="gungi-dialogue" data-gungi-dialogue></div>
            <div class="gungi-info" data-gungi-info></div>
          </div>
        </div>
        <div class="gungi-nav">
          <button type="button" data-gungi-back>← 戻る</button>
          <div class="gungi-progress" data-gungi-progress></div>
          <button type="button" data-gungi-next>次へ →</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function dialogueHtml(lines) {
    return lines.map(line => {
      const name = speakerLabel(line.speaker);
      return `
        <div class="gungi-dialogue-row">
          <div class="gungi-speaker" data-speaker="${escapeHtml(name)}">${escapeHtml(name)}</div>
          <p class="gungi-copy">${escapeHtml(line.text)}</p>
        </div>
      `;
    }).join('');
  }

  function renderCurrentStep() {
    if (!gungiOverlay || !gungiState) return;
    const step = gungiState.steps[gungiState.stepIndex];
    if (!step) return;

    const dialogue = gungiOverlay.querySelector('[data-gungi-dialogue]');
    const info = gungiOverlay.querySelector('[data-gungi-info]');
    const back = gungiOverlay.querySelector('[data-gungi-back]');
    const next = gungiOverlay.querySelector('[data-gungi-next]');
    const progress = gungiOverlay.querySelector('[data-gungi-progress]');

    let lines = [];
    let infoHtml = '';
    let progressText = '';

    if (step.kind === 'news') {
      fitOverview();
      const location = gungiState.locationLabel ? `${gungiState.locationLabel}に、` : '';
      lines = [{ speaker: 'ren', text: `臨時ニュースです。${location}新たなキャンプサイトが発生しました。` }];
      infoHtml = '<span class="gungi-info-title">BREAKING NEWS</span>新規キャンプサイト発生';
    }

    if (step.kind === 'overview') {
      fitOverview();
      lines = [{ speaker: 'ren', text: '現地の状況を確認します。' }];
      if (gungiState.referenceWarnings.length > 0) {
        lines.push({ speaker: 'mina', text: 'POIに恵まれた、いい土地だね。' });
      }
    }

    if (step.kind === 'layers') {
      fitOverview();
      lines = [{ speaker: 'mina', text: 'レイヤー名はこれになってる？' }];
      const rows = getLayerGuideRows();
      infoHtml = `
        <span class="gungi-info-title">推奨レイヤー名</span>
        ${rows.map(row => `<div class="gungi-layer-line">${escapeHtml(row)}</div>`).join('')}
        <div class="gungi-note">※使っている種類だけでOK</div>
      `;
    }

    if (step.kind === 'area') {
      focusActivityArea();
      const area = getActivityAreaInfo();
      lines = [{ speaker: 'mina', text: '活動範囲はこのくらい。' }];
      if (area.squareMeters > 0) {
        infoHtml = `
          <span class="gungi-info-title">活動範囲</span>
          <div class="gungi-area-number">${Math.round(area.squareMeters).toLocaleString('ja-JP')}㎡</div>
          <div>🏟️ 東京ドーム 約${area.domeEquivalent.toFixed(1)}個分</div>
          <div class="gungi-note">推奨レイヤー名：活動範囲</div>
        `;
      } else {
        infoHtml = '<span class="gungi-info-title">活動範囲</span>活動範囲ポリゴンを確認できませんでした。<div class="gungi-note">推奨レイヤー名：活動範囲</div>';
      }
    }

    if (step.kind === 'count') {
      fitOverview();
      lines = [{ speaker: 'ren', text: `確認事項は${gungiState.issues.length}件です。` }];
      infoHtml = gungiState.issues.length
        ? '会話で取り上げるポイントを、1件ずつ地図で確認します。'
        : '距離に関する確認事項はありませんでした。';
    }

    if (step.kind === 'issue') {
      focusIssue(step.warning);
      const distance = Number(step.warning.distance).toFixed(1);
      lines = [
        { speaker: 'riku', text: `この2地点の距離は${distance}m。近い位置にあるね。` },
        { speaker: 'mina', text: issuePositiveLine(step.warning) }
      ];
      const aName = step.warning?.a?.name || '地点A';
      const bName = step.warning?.b?.name || '地点B';
      infoHtml = `
        <span class="gungi-info-title">確認ポイント</span>
        ${escapeHtml(aName)}<br>× ${escapeHtml(bName)}<br>
        <strong>${distance}m</strong>
      `;
      progressText = `確認 ${step.issueIndex + 1} / ${gungiState.issues.length}`;
    }

    if (step.kind === 'finale') {
      fitOverview();
      const verdict = getSubmissionVerdict();
      const verdictText = verdict.ok
        ? '以上の確認結果、このキャンプサイトは提出条件を満たしています。'
        : '今回の内容では、提出条件を満たしていない項目があります。';
      lines = [
        { speaker: 'ren', text: verdictText },
        { speaker: 'ren', text: '以上で確認は終了です。今お伝えした点を少し意識しながら、ミートアップを楽しんできてください。' }
      ];
      infoHtml = `
        <div class="gungi-result-card" data-ok="${String(verdict.ok)}">
          <div class="gungi-result-label">CAMP SITE CHECK</div>
          <div class="gungi-result-value">提出条件：${verdict.ok ? '適合' : '確認項目あり'}</div>
          <ul class="gungi-result-list">
            <li>追加POI：${verdict.total}件 / 最大25件</li>
            <li>30m未満の追加関連ペア：${gungiState.issues.filter(item => Number(item.distance) < 30).length}件</li>
            <li>活動範囲：${verdict.activityAreaOk ? '確認済み' : '未確認'}</li>
          </ul>
        </div>
      `;
    }

    dialogue.innerHTML = dialogueHtml(lines);
    info.innerHTML = infoHtml;
    progress.textContent = progressText;

    back.disabled = gungiState.stepIndex === 0;
    next.textContent = step.kind === 'finale' ? '軍議を終了' : '次へ →';
    next.classList.toggle('gungi-close', step.kind === 'finale');
  }

  function closeGungiDistanceStory() {
    clearMapFocus();
    document.body.classList.remove('gungi-open');
    const mapElement = document.getElementById('distanceMap');
    if (mapElement && gungiMapHome?.parent) {
      if (gungiMapHome.nextSibling && gungiMapHome.nextSibling.parentNode === gungiMapHome.parent) {
        gungiMapHome.parent.insertBefore(mapElement, gungiMapHome.nextSibling);
      } else {
        gungiMapHome.parent.appendChild(mapElement);
      }
    }
    gungiOverlay?.remove();
    gungiOverlay = null;
    gungiState = null;
    gungiMapHome = null;
    setTimeout(() => getMap()?.invalidateSize(), 80);
  }

  function nextStep() {
    if (!gungiState) return;
    const step = gungiState.steps[gungiState.stepIndex];
    if (step?.kind === 'finale') {
      closeGungiDistanceStory();
      return;
    }
    gungiState.stepIndex = Math.min(gungiState.stepIndex + 1, gungiState.steps.length - 1);
    renderCurrentStep();
  }

  function previousStep() {
    if (!gungiState) return;
    gungiState.stepIndex = Math.max(0, gungiState.stepIndex - 1);
    renderCurrentStep();
  }

  async function openGungiDistanceStory() {
    if (gungiOverlay) closeGungiDistanceStory();
    const mapElement = document.getElementById('distanceMap');
    const map = getMap();
    const points = collectPoints();
    if (!mapElement || !map || points.length < 2) return;

    const issues = getIssueWarnings();
    gungiState = {
      points,
      issues,
      referenceWarnings: getReferenceWarnings(),
      locationLabel: '',
      stepIndex: 0,
      steps: []
    };
    gungiState.steps = buildSteps();

    gungiOverlay = createOverlay();
    document.body.classList.add('gungi-open');
    gungiMapHome = { parent: mapElement.parentNode, nextSibling: mapElement.nextSibling };
    gungiOverlay.querySelector('.gungi-map-slot').appendChild(mapElement);
    gungiOverlay.querySelector('[data-gungi-back]').addEventListener('click', previousStep);
    gungiOverlay.querySelector('[data-gungi-next]').addEventListener('click', nextStep);

    setTimeout(() => {
      map.invalidateSize();
      renderCurrentStep();
    }, 80);

    const location = await resolveLocationLabel();
    if (gungiState && location) {
      gungiState.locationLabel = location;
      if (gungiState.steps[gungiState.stepIndex]?.kind === 'news') renderCurrentStep();
    }
  }

  function installDistanceCheckHook() {
    if (window.__gungiDistanceStoryHooked || typeof window.runDistanceCheck !== 'function') return;
    const previousRunDistanceCheck = window.runDistanceCheck;
    window.runDistanceCheck = async function(...args) {
      const value = await previousRunDistanceCheck.apply(this, args);
      setTimeout(() => {
        const result = document.getElementById('distanceResult');
        const mapElement = document.getElementById('distanceMap');
        if (result && (result.textContent || '').trim() && mapElement && mapElement.style.display !== 'none') {
          openGungiDistanceStory();
        }
      }, 220);
      return value;
    };
    window.__gungiDistanceStoryHooked = true;
  }

  window.openGungiDistanceStory = openGungiDistanceStory;
  window.closeGungiDistanceStory = closeGungiDistanceStory;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installDistanceCheckHook);
  } else {
    installDistanceCheckHook();
  }
})();