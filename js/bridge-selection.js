(() => {
  'use strict';

  const VERSION = '0.8.5';
  const ADAPTER_STORAGE_KEY = 'campsiteBridgeAdapter.v0.3';
  const SELECTION_STORAGE_KEY = 'campsiteBridgeSelection.v0.8.5';
  const REVIEW_STORAGE_KEY = 'campsiteBridgeReviewMeta.v0.8.5';
  const ALLOWED_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const params = new URLSearchParams(location.search);

  if (params.get('campsiteBridgeImport') !== '1') return;
  if (window.__campsiteBridgeSelection085Installed) return;
  window.__campsiteBridgeSelection085Installed = true;

  function readJson(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); }
    catch (_) { return null; }
  }

  function normalizePoi(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const guid = String(raw.guid || raw.sourceId || raw.id || '').trim();
    const title = String(raw.title || raw.name || '').trim();
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const gameEntity = String(raw.gameEntity || raw.type || '').trim().toUpperCase();
    const gameStatus = String(raw.gameStatus || 'UNKNOWN').trim().toUpperCase();
    if (!guid || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    if (!ALLOWED_ENTITIES.has(gameEntity)) return null;
    return {
      guid,
      title,
      lat,
      lng,
      gameEntity,
      gameStatus,
      sponsored: raw.sponsored === true || String(raw.sponsored).toLowerCase() === 'true',
      smr: raw.smr === true ? true : raw.smr === false ? false : null,
      imageUrl: String(raw.imageUrl || ''),
      description: String(raw.description || ''),
      s2L14: String(raw.s2L14 || ''),
      s2L17: String(raw.s2L17 || '')
    };
  }

  const adapter = readJson(ADAPTER_STORAGE_KEY);
  const pois = Array.isArray(adapter?.pois) ? adapter.pois.map(normalizePoi).filter(Boolean) : [];
  if (!pois.length) return;

  let map = null;
  let markerLayer = null;
  let polygonLayer = null;
  let vertexLayer = null;
  let markerByGuid = new Map();
  let polygonPoints = [];
  let drawMode = false;
  let selectedGuids = new Set();
  let originalStepDisplays = new Map();
  let leafletPromise = null;

  const $ = id => document.getElementById(id);

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function counts(list) {
    const result = { total:list.length, pokestop:0, gym:0, powerspot:0, sponsored:0 };
    list.forEach(poi => {
      if (poi.gameEntity === 'POKESTOP') result.pokestop++;
      if (poi.gameEntity === 'GYM') result.gym++;
      if (poi.gameEntity === 'POWERSPOT') result.powerspot++;
      if (poi.sponsored) result.sponsored++;
    });
    return result;
  }

  function pointInPolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const yi = polygon[i][0], xi = polygon[i][1];
      const yj = polygon[j][0], xj = polygon[j][1];
      const intersects = ((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function selectedPois() {
    if (polygonPoints.length < 3) return [];
    return pois.filter(poi => pointInPolygon(poi.lat, poi.lng, polygonPoints));
  }

  function injectStyles() {
    if ($('campsiteBridgeSelectionStyles')) return;
    const style = document.createElement('style');
    style.id = 'campsiteBridgeSelectionStyles';
    style.textContent = `
      #campsiteBridgeSelection{margin:14px 0 20px;border:1px solid rgba(56,189,248,.38);border-radius:18px;overflow:hidden;background:rgba(2,6,23,.76)}
      #campsiteBridgeSelection .bridge-head{padding:16px 16px 12px;background:linear-gradient(135deg,rgba(14,116,144,.22),rgba(15,23,42,.15))}
      #campsiteBridgeSelection .bridge-head h3{margin:0;color:#f8fafc;font-size:20px}
      #campsiteBridgeSelection .bridge-head p{margin:7px 0 0;color:#bae6fd;font-size:13px;line-height:1.7}
      #campsiteBridgeSelection .bridge-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;padding:12px 14px}
      #campsiteBridgeSelection .bridge-count{padding:9px 6px;border:1px solid #334155;border-radius:11px;background:#0f172a;text-align:center}
      #campsiteBridgeSelection .bridge-count span{display:block;color:#94a3b8;font-size:10px}
      #campsiteBridgeSelection .bridge-count b{display:block;margin-top:2px;color:#f8fafc;font-size:17px}
      #campsiteBridgeSelection .bridge-map-wrap{position:relative}
      #campsiteBridgeMap{width:100%;height:520px;min-height:420px;background:#07111f;border-top:1px solid #1e293b;border-bottom:1px solid #1e293b}
      #campsiteBridgeMap.bridge-draw-mode{cursor:crosshair}
      #campsiteBridgeSelection .bridge-map-toolbar{position:absolute;z-index:700;top:10px;right:10px;display:flex;align-items:center;gap:7px;padding:6px;border-radius:14px;background:rgba(2,6,23,.78);border:1px solid rgba(148,163,184,.28);box-shadow:0 8px 24px rgba(2,6,23,.28);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}
      #campsiteBridgeSelection .bridge-map-toolbar button{border:1px solid rgba(148,163,184,.24);background:#0f172a;color:#e2e8f0;border-radius:10px;height:42px;min-width:42px;padding:0 11px;font-size:18px;font-weight:900;line-height:1;cursor:pointer;touch-action:manipulation;-webkit-tap-highlight-color:transparent}
      #campsiteBridgeSelection .bridge-map-toolbar .bridge-map-draw{font-size:13px;padding:0 13px;white-space:nowrap}
      #campsiteBridgeSelection .bridge-map-toolbar .bridge-drawing{background:#14532d!important;color:#dcfce7!important;border-color:rgba(34,197,94,.52)!important}
      #campsiteBridgeSelection.bridge-is-drawing .bridge-poi-marker{pointer-events:none!important}
      #campsiteBridgeSelection .bridge-tools{padding:14px}
      #campsiteBridgeSelection .bridge-guide{margin:0 0 11px;padding:11px 12px;border-radius:11px;background:rgba(20,83,45,.32);border:1px solid rgba(34,197,94,.35);color:#dcfce7;font-size:12px;line-height:1.65}
      #campsiteBridgeSelection .bridge-legend{display:flex;flex-wrap:wrap;gap:8px 14px;margin:0 0 11px;color:#94a3b8;font-size:11px}
      #campsiteBridgeSelection .bridge-legend span{display:inline-flex;align-items:center;gap:5px}.bridge-dot{width:9px;height:9px;border-radius:50%;display:inline-block}.bridge-dot.stop{background:#38bdf8}.bridge-dot.gym{background:#f472b6}.bridge-dot.power{background:#facc15}.bridge-dot.selected{background:#22c55e}
      #campsiteBridgeSelection .bridge-actions{display:grid;grid-template-columns:1fr;gap:8px}
      #campsiteBridgeSelection .bridge-actions button{border:0;border-radius:12px;padding:12px 10px;min-height:46px;font-weight:900;cursor:pointer}
      #campsiteBridgeSelection .bridge-primary{background:#22c55e;color:#052e16}.bridge-secondary{background:#1e293b;color:#e2e8f0}.bridge-disabled{opacity:.38;cursor:not-allowed!important}
      #campsiteBridgeSelection .bridge-status{margin:10px 0 0;color:#bae6fd;font-size:12px;line-height:1.6}
      #campsiteBridgeImportNotice{margin:14px 0;padding:13px 15px;border-radius:13px;border:1px solid rgba(34,197,94,.38);background:rgba(20,83,45,.24);color:#dcfce7;font-weight:800;line-height:1.65}
      #campsiteBridgeSelection .leaflet-container{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.leaflet-popup-content-wrapper,.leaflet-popup-tip{background:#0f172a;color:#e2e8f0}.leaflet-popup-content{margin:10px 12px;font-size:12px;line-height:1.45}
      @media(max-width:600px){#campsiteBridgeSelection .bridge-summary{grid-template-columns:repeat(2,minmax(0,1fr))}#campsiteBridgeMap{height:480px;min-height:400px}#campsiteBridgeSelection .bridge-map-toolbar{top:8px;right:8px;gap:5px;padding:5px}#campsiteBridgeSelection .bridge-map-toolbar button{height:40px;min-width:40px;padding:0 9px}#campsiteBridgeSelection .bridge-map-toolbar .bridge-map-draw{font-size:12px;padding:0 10px}}
    `;
    document.head.appendChild(style);
  }

  function hideNormalFlow(panel) {
    [...panel.children].forEach(child => {
      if (child.id === 'campsiteBridgeSelection') return;
      if (child.tagName === 'H2') return;
      originalStepDisplays.set(child, child.style.display);
      child.style.display = 'none';
    });
  }

  function restoreNormalFlow(panel) {
    [...panel.children].forEach(child => {
      if (child.id === 'campsiteBridgeSelection') return;
      if (!originalStepDisplays.has(child)) return;
      child.style.display = originalStepDisplays.get(child);
    });
  }

  function buildPanel(panel) {
    const total = counts(pois);
    const box = document.createElement('div');
    box.id = 'campsiteBridgeSelection';
    box.innerHTML = `
      <div class="bridge-head">
        <h3>🌉 Bridgeから受信しました</h3>
        <p>${total.total.toLocaleString('ja-JP')}件のPOIを地図に表示しています。設計に使う公園・エリアをポリゴンで囲んでください。</p>
      </div>
      <div class="bridge-summary">
        <div class="bridge-count"><span>受信</span><b>${total.total}</b></div>
        <div class="bridge-count"><span>選択中</span><b id="bridgeSelectedTotal">0</b></div>
        <div class="bridge-count"><span>PokéStop</span><b id="bridgeSelectedStop">0</b></div>
        <div class="bridge-count"><span>Gym</span><b id="bridgeSelectedGym">0</b></div>
        <div class="bridge-count"><span>Power Spot</span><b id="bridgeSelectedPower">0</b></div>
      </div>
      <div class="bridge-map-wrap">
        <div id="campsiteBridgeMap"></div>
        <div class="bridge-map-toolbar" aria-label="ポリゴン操作">
          <button id="bridgeDrawBtn" class="bridge-map-draw" type="button" aria-pressed="false">✏️ 描く</button>
          <button id="bridgeUndoBtn" type="button" title="1点戻す" aria-label="1点戻す">↶</button>
          <button id="bridgeClearBtn" type="button" title="ポリゴンをやり直す" aria-label="ポリゴンをやり直す">🗑</button>
          <button id="bridgeFitBtn" type="button" title="全POIを表示" aria-label="全POIを表示">🗺</button>
        </div>
      </div>
      <div class="bridge-tools">
        <div class="bridge-legend"><span><i class="bridge-dot stop"></i>PokéStop</span><span><i class="bridge-dot gym"></i>Gym</span><span><i class="bridge-dot power"></i>Power Spot</span><span><i class="bridge-dot selected"></i>ポリゴン内</span></div>
        <div class="bridge-guide"><strong>公園を囲む</strong><br>地図右上の「✏️ 描く」を押してから、外周を順番にタップしてください。描画中はPOIを触ってもポップアップは開きません。</div>
        <div class="bridge-actions">
          <button id="bridgeConfirmBtn" class="bridge-primary bridge-disabled" type="button" disabled>この範囲をCampsiteで使う</button>
        </div>
        <div id="bridgeSelectionStatus" class="bridge-status">ポリゴンはまだ作成されていません。</div>
      </div>
    `;
    const h2 = panel.querySelector(':scope > h2');
    if (h2) h2.insertAdjacentElement('afterend', box); else panel.prepend(box);
    return box;
  }

  function markerStyle(poi, selected = false) {
    const fillColor = selected ? '#22c55e' : poi.gameEntity === 'GYM' ? '#f472b6' : poi.gameEntity === 'POWERSPOT' ? '#facc15' : '#38bdf8';
    return {
      radius: poi.gameEntity === 'GYM' ? 5 : 4,
      color: selected ? '#dcfce7' : '#0f172a',
      weight: selected ? 2 : 1,
      fillColor,
      fillOpacity: poi.gameStatus === 'INACTIVE' ? 0.48 : 0.92,
      className: 'bridge-poi-marker'
    };
  }

  function popupHtml(poi) {
    const label = poi.gameEntity === 'POKESTOP' ? 'PokéStop' : poi.gameEntity === 'GYM' ? 'Gym' : 'Power Spot';
    const extras = [poi.sponsored ? 'スポンサー' : '', poi.smr === true ? 'SMR' : ''].filter(Boolean).join(' / ');
    return `<strong>${escapeHtml(poi.title || '名称なし')}</strong><br>${label}${extras ? ` · ${escapeHtml(extras)}` : ''}<br><small>${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}</small>`;
  }

  function waitForLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    leafletPromise = new Promise((resolve, reject) => {
      let tries = 0;
      const timer = setInterval(() => {
        if (window.L) {
          clearInterval(timer);
          resolve(window.L);
          return;
        }
        tries++;
        if (tries >= 50) {
          clearInterval(timer);
          reject(new Error('Leaflet not available'));
        }
      }, 100);
    });
    return leafletPromise;
  }

  function renderMarkers() {
    if (!map || !markerLayer) return;
    markerLayer.clearLayers();
    markerByGuid = new Map();
    pois.forEach(poi => {
      const selected = selectedGuids.has(poi.guid);
      const options = { ...markerStyle(poi, selected), interactive: !drawMode };
      const marker = L.circleMarker([poi.lat, poi.lng], options);
      if (!drawMode) marker.bindPopup(popupHtml(poi));
      marker.addTo(markerLayer);
      markerByGuid.set(poi.guid, marker);
    });
  }

  function fitAll() {
    if (!map || !pois.length) return;
    const bounds = L.latLngBounds(pois.map(p => [p.lat, p.lng]));
    if (bounds.isValid()) map.fitBounds(bounds, { padding:[24,24], maxZoom:17 });
  }

  function setDrawMode(enabled) {
    drawMode = Boolean(enabled);
    const btn = $('bridgeDrawBtn');
    const panel = $('campsiteBridgeSelection');
    const mapEl = $('campsiteBridgeMap');
    if (btn) {
      btn.classList.toggle('bridge-drawing', drawMode);
      btn.setAttribute('aria-pressed', String(drawMode));
      btn.textContent = drawMode ? '✅ 描画中' : '✏️ 描く';
    }
    panel?.classList.toggle('bridge-is-drawing', drawMode);
    mapEl?.classList.toggle('bridge-draw-mode', drawMode);
    if (drawMode) map?.closePopup();
    renderMarkers();
  }

  function updateSelection() {
    const selected = selectedPois();
    selectedGuids = new Set(selected.map(p => p.guid));
    const c = counts(selected);
    if ($('bridgeSelectedTotal')) $('bridgeSelectedTotal').textContent = c.total;
    if ($('bridgeSelectedStop')) $('bridgeSelectedStop').textContent = c.pokestop;
    if ($('bridgeSelectedGym')) $('bridgeSelectedGym').textContent = c.gym;
    if ($('bridgeSelectedPower')) $('bridgeSelectedPower').textContent = c.powerspot;
    const confirm = $('bridgeConfirmBtn');
    if (confirm) {
      confirm.disabled = c.total === 0 || polygonPoints.length < 3;
      confirm.classList.toggle('bridge-disabled', confirm.disabled);
    }
    const status = $('bridgeSelectionStatus');
    if (status) {
      status.textContent = polygonPoints.length < 3
        ? `頂点 ${polygonPoints.length}点。あと${3 - polygonPoints.length}点以上で範囲になります。`
        : `${c.total.toLocaleString('ja-JP')}件を選択中。スポンサー ${c.sponsored.toLocaleString('ja-JP')}件。`;
    }
    renderMarkers();
  }

  function redrawPolygon() {
    if (!map) return;
    if (polygonLayer) {
      map.removeLayer(polygonLayer);
      polygonLayer = null;
    }
    vertexLayer.clearLayers();
    polygonPoints.forEach(point => {
      L.circleMarker(point, { radius:6, color:'#052e16', weight:2, fillColor:'#22c55e', fillOpacity:1, interactive:false }).addTo(vertexLayer);
    });
    if (polygonPoints.length === 2) {
      polygonLayer = L.polyline(polygonPoints, { color:'#22c55e', weight:3, dashArray:'7 5', interactive:false }).addTo(map);
    } else if (polygonPoints.length >= 3) {
      polygonLayer = L.polygon(polygonPoints, { color:'#22c55e', weight:3, fillColor:'#22c55e', fillOpacity:.12, interactive:false }).addTo(map);
    }
    updateSelection();
  }

  function csvCell(value) {
    const text = String(value ?? '');
    if (!/[",\r\n]/.test(text)) return text;
    return `"${text.replaceAll('"', '""')}"`;
  }

  function createVirtualCsv(selected) {
    const rows = [
      ['title', 'lat', 'lng', 'gameEntity', 'gameStatus', 'guid'],
      ...selected.map(poi => [poi.title, poi.lat, poi.lng, poi.gameEntity, poi.gameStatus, poi.guid])
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    return new File([csv], `campsite_bridge_${selected.length}_pois.csv`, { type:'text/csv;charset=utf-8', lastModified:Date.now() });
  }

  function makeDataTransfer() {
    try { return new DataTransfer(); } catch (_) {}
    try {
      const event = new ClipboardEvent('paste');
      if (event.clipboardData) return event.clipboardData;
    } catch (_) {}
    return null;
  }

  function showImportNotice(panel, selectedCount, sourceCount) {
    let notice = $('campsiteBridgeImportNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'campsiteBridgeImportNotice';
      const summary = $('csvModeSummary');
      if (summary) summary.insertAdjacentElement('afterend', notice);
      else panel.querySelector(':scope > h2')?.insertAdjacentElement('afterend', notice);
    }
    notice.textContent = `🌉 Bridgeで受信した${sourceCount.toLocaleString('ja-JP')}件から、ポリゴン内${selectedCount.toLocaleString('ja-JP')}件をCampsiteへ読み込みました。`;
  }

  function handoffSelected(panel) {
    const selected = selectedPois();
    if (!selected.length || polygonPoints.length < 3) return;

    sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify({
      version: VERSION,
      selectedAt: new Date().toISOString(),
      sourceCount: pois.length,
      selectedCount: selected.length,
      polygon: polygonPoints,
      pois: selected
    }));

    sessionStorage.setItem(REVIEW_STORAGE_KEY, JSON.stringify({
      version: VERSION,
      capturedAt: new Date().toISOString(),
      sourceCount: pois.length,
      selectedCount: selected.length,
      polygon: polygonPoints,
      pois: selected.map(poi => ({
        guid: poi.guid,
        title: poi.title,
        lat: poi.lat,
        lng: poi.lng,
        gameEntity: poi.gameEntity,
        gameStatus: poi.gameStatus,
        sponsored: poi.sponsored,
        smr: poi.smr,
        imageUrl: poi.imageUrl,
        description: poi.description,
        s2L14: poi.s2L14,
        s2L17: poi.s2L17
      }))
    }));

    const input = $('fileInput');
    const transfer = makeDataTransfer();
    if (!input || !transfer?.items) {
      $('bridgeSelectionStatus').textContent = '⚠️ CampsiteのPOI読込欄へ受け渡しできませんでした。ページを再読み込みしてください。';
      return;
    }

    const file = createVirtualCsv(selected);
    try {
      transfer.items.add(file);
      input.files = transfer.files;
    } catch (error) {
      console.error('[Campsite Bridge] virtual file assignment failed', error);
      $('bridgeSelectionStatus').textContent = '⚠️ POIの自動受け渡しに失敗しました。';
      return;
    }

    try { window.applyCampsiteCsvMode?.('extracted'); } catch (_) {}
    try { window.setWorkflowStep?.('csv'); } catch (_) {}
    try { window.openTab?.('tool'); } catch (_) {}

    const bridgePanel = $('campsiteBridgeSelection');
    if (bridgePanel) bridgePanel.remove();
    restoreNormalFlow(panel);
    input.dispatchEvent(new Event('change', { bubbles:true }));
    showImportNotice(panel, selected.length, pois.length);

    window.CampsiteBridgeSelection = Object.freeze({
      version: VERSION,
      sourceCount: pois.length,
      count: selected.length,
      polygon: polygonPoints.map(point => [...point]),
      pois: selected
    });
  }

  async function initializeMap() {
    try {
      await waitForLeaflet();
    } catch (error) {
      console.error('[Campsite Bridge] Leaflet unavailable', error);
      $('bridgeSelectionStatus').textContent = '⚠️ 地図を読み込めませんでした。ページを再読み込みしてください。';
      return;
    }
    const mapEl = $('campsiteBridgeMap');
    if (!mapEl || map) return;
    map = L.map(mapEl, { preferCanvas:true, zoomControl:true, attributionControl:true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:19,
      attribution:'&copy; OpenStreetMap contributors'
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);
    vertexLayer = L.layerGroup().addTo(map);
    map.on('click', event => {
      if (!drawMode) return;
      polygonPoints.push([event.latlng.lat, event.latlng.lng]);
      redrawPolygon();
    });
    renderMarkers();
    requestAnimationFrame(() => {
      map.invalidateSize();
      fitAll();
    });
  }

  function bindControls(panel) {
    $('bridgeDrawBtn')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      setDrawMode(!drawMode);
    });
    $('bridgeFitBtn')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      fitAll();
    });
    $('bridgeUndoBtn')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      polygonPoints.pop();
      redrawPolygon();
    });
    $('bridgeClearBtn')?.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      polygonPoints = [];
      selectedGuids.clear();
      redrawPolygon();
    });
    $('bridgeConfirmBtn')?.addEventListener('click', () => handoffSelected(panel));
  }

  function prepareTool() {
    injectStyles();
    const panel = document.querySelector('#tool .panel');
    if (!panel) return false;

    try { window.applyCampsiteCsvMode?.('extracted'); } catch (_) {}
    try { window.setWorkflowStep?.('csv'); } catch (_) {}
    try { window.openTab?.('tool'); } catch (_) {}

    hideNormalFlow(panel);
    buildPanel(panel);
    bindControls(panel);
    void initializeMap();
    return true;
  }

  function start() {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts++;
      if (prepareTool() || attempts >= 50) clearInterval(timer);
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once:true });
  } else {
    start();
  }
})();
