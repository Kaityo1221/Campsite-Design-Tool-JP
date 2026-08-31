(() => {
  'use strict';

  const VERSION = '0.9.0-m3';
  const STORAGE_KEY = 'campsiteBridge.preview.m1.v0.9';
  const DEV_PARAM = 'campsiteBridgeDev';
  const ALLOWED_ORIGINS = new Set([
    'https://wayfarer.scopely.com',
    'https://wayfarer.nianticlabs.com'
  ]);
  const ALLOWED_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const ALLOWED_STATUSES = new Set(['ACTIVE', 'INACTIVE']);
  const LEAFLET_FALLBACK_JS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';
  const LEAFLET_FALLBACK_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';

  const params = new URLSearchParams(location.search);
  if (params.get(DEV_PARAM) !== '1') return;
  document.documentElement.classList.add('bridge-preview-enabled');

  const $ = id => document.getElementById(id);
  const nowIso = () => new Date().toISOString();
  const newSessionId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

  function emptyState() {
    return {
      version: VERSION,
      sessionId: newSessionId(),
      startedAt: nowIso(),
      frozenAt: null,
      snapshots: [],
      pois: [],
      crop: null
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return emptyState();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.pois) || !Array.isArray(parsed.snapshots)) return emptyState();
      return {
        version: VERSION,
        sessionId: parsed.sessionId || newSessionId(),
        startedAt: parsed.startedAt || nowIso(),
        frozenAt: parsed.frozenAt || null,
        snapshots: parsed.snapshots,
        pois: parsed.pois,
        crop: parsed.crop || null
      };
    } catch (_) {
      return emptyState();
    }
  }

  let state = loadState();
  let bridgeMap = null;
  let markerLayer = null;
  let markerByGuid = new Map();
  let poiBounds = null;
  let polygonLayer = null;
  let vertexLayer = null;
  let drawMode = false;
  let polygonPoints = [];
  let selectedGuids = new Set();
  let leafletPromise = null;
  let viewStep = state.frozenAt ? 2 : 1;

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizePoi(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const guid = String(raw.guid || '').trim();
    const title = String(raw.title || raw.name || '').trim();
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const gameEntity = String(raw.gameEntity || raw.type || '').trim().toUpperCase();
    const gameStatus = String(raw.gameStatus || 'ACTIVE').trim().toUpperCase();
    if (!guid || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    if (!ALLOWED_ENTITIES.has(gameEntity)) return null;
    if (!ALLOWED_STATUSES.has(gameStatus)) return null;
    return {
      guid,
      title,
      lat,
      lng,
      gameEntity,
      gameStatus,
      bridgeSource: raw.bridgeSource || 'bridge-preview-m3',
      bridgeCapturedAt: raw.bridgeCapturedAt || nowIso()
    };
  }

  function samePoi(a, b) {
    return a.title === b.title && a.lat === b.lat && a.lng === b.lng && a.gameEntity === b.gameEntity && a.gameStatus === b.gameStatus;
  }

  function addSnapshot(rawPois, meta = {}) {
    if (state.frozenAt) return { accepted:false, reason:'frozen', total:state.pois.length, added:0, duplicate:0 };
    const input = Array.isArray(rawPois) ? rawPois : [];
    const normalized = input.map(normalizePoi).filter(Boolean);
    const byGuid = new Map(state.pois.map(p => [p.guid, p]));
    let added = 0;
    let duplicate = 0;
    let updated = 0;
    for (const poi of normalized) {
      const existing = byGuid.get(poi.guid);
      if (!existing) {
        byGuid.set(poi.guid, poi);
        added++;
      } else {
        duplicate++;
        if (!samePoi(existing, poi)) {
          byGuid.set(poi.guid, poi);
          updated++;
        }
      }
    }
    state.pois = [...byGuid.values()];
    state.snapshots.push({
      id: state.snapshots.length + 1,
      capturedAt: nowIso(),
      source: meta.source || 'unknown',
      label: meta.label || `Snapshot ${state.snapshots.length + 1}`,
      received: input.length,
      valid: normalized.length,
      added,
      duplicate,
      updated,
      totalAfter: state.pois.length,
      selectedBounds: meta.selectedBounds || null
    });
    saveState();
    render();
    return { accepted:true, total:state.pois.length, added, duplicate, updated };
  }

  function counts(pois = state.pois) {
    const result = { total:pois.length, pokestop:0, gym:0, powerspot:0 };
    for (const poi of pois) {
      if (poi.gameEntity === 'POKESTOP') result.pokestop++;
      if (poi.gameEntity === 'GYM') result.gym++;
      if (poi.gameEntity === 'POWERSPOT') result.powerspot++;
    }
    return result;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'",'&#039;');
  }

  function renderSnapshots() {
    const list = $('snapshotList');
    list.innerHTML = '';
    if (!state.snapshots.length) {
      list.innerHTML = '<div class="snapshot-empty">まだスナップショットはありません</div>';
      return;
    }
    for (const snap of [...state.snapshots].reverse()) {
      const row = document.createElement('div');
      row.className = 'snapshot-row';
      row.innerHTML = `<div><strong>#${snap.id} ${escapeHtml(snap.label)}</strong><small>${escapeHtml(snap.source)} · ${new Date(snap.capturedAt).toLocaleTimeString('ja-JP')}</small></div><div class="snapshot-numbers"><b>+${snap.added}</b><span>重複 ${snap.duplicate}</span><span>累積 ${snap.totalAfter}</span></div>`;
      list.appendChild(row);
    }
  }

  function ensureFallbackCss() {
    if ([...document.styleSheets].some(sheet => String(sheet.href || '').includes('leaflet'))) return;
    if (document.querySelector('link[data-bridge-leaflet-fallback]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = LEAFLET_FALLBACK_CSS;
    link.dataset.bridgeLeafletFallback = '1';
    document.head.appendChild(link);
  }

  function loadFallbackLeaflet() {
    if (window.L) return Promise.resolve(window.L);
    if (leafletPromise) return leafletPromise;
    ensureFallbackCss();
    $('mapMessage').textContent = '地図ライブラリを読み込んでいます…';
    leafletPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = LEAFLET_FALLBACK_JS;
      script.async = true;
      script.dataset.bridgeLeafletFallback = '1';
      script.onload = () => window.L ? resolve(window.L) : reject(new Error('Leaflet global missing'));
      script.onerror = () => reject(new Error('Leaflet fallback load failed'));
      document.head.appendChild(script);
    }).catch(error => { leafletPromise = null; throw error; });
    return leafletPromise;
  }

  function markerBaseStyle(poi) {
    const fillColor = poi.gameEntity === 'GYM' ? '#f472b6' : poi.gameEntity === 'POWERSPOT' ? '#facc15' : '#38bdf8';
    return {
      radius: poi.gameEntity === 'GYM' ? 5 : 4,
      color:'#0f172a',
      weight:1,
      fillColor,
      fillOpacity: poi.gameStatus === 'INACTIVE' ? 0.45 : 0.92
    };
  }

  function popupHtml(poi) {
    const label = poi.gameEntity === 'POKESTOP' ? 'PokéStop' : poi.gameEntity === 'GYM' ? 'Gym' : 'Power Spot';
    return `<strong>${escapeHtml(poi.title || '名称なし')}</strong><br>${label} · ${escapeHtml(poi.gameStatus)}<br><small>${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}</small>`;
  }

  async function ensureMap() {
    if (!state.frozenAt || viewStep < 2) return;
    try {
      if (!window.L) await loadFallbackLeaflet();
    } catch (error) {
      console.error('[Campsite Bridge M3] Leaflet load failed', error);
      $('mapMessage').textContent = '地図ライブラリを読み込めませんでした。「全POIを表示」で再試行できます。';
      return;
    }
    if (!window.L) return;

    if (!bridgeMap) {
      bridgeMap = L.map('bridgeMap', { preferCanvas:true, zoomControl:true, attributionControl:true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom:19,
        attribution:'&copy; OpenStreetMap contributors'
      }).addTo(bridgeMap);
      markerLayer = L.layerGroup().addTo(bridgeMap);
      vertexLayer = L.layerGroup().addTo(bridgeMap);
      bridgeMap.on('click', event => {
        if (!drawMode || viewStep !== 3) return;
        polygonPoints.push([event.latlng.lat, event.latlng.lng]);
        redrawPolygon();
      });
    }

    renderPoiMarkers();
    restoreCropIfAny();
    requestAnimationFrame(() => {
      bridgeMap.invalidateSize();
      if (viewStep === 2 && !state.crop) fitAllPois();
      if (viewStep === 3 && state.crop?.polygon?.length >= 3) bridgeMap.fitBounds(L.latLngBounds(state.crop.polygon), { padding:[26,26], maxZoom:18 });
    });
  }

  function renderPoiMarkers() {
    if (!bridgeMap || !markerLayer) return;
    markerLayer.clearLayers();
    markerByGuid = new Map();
    const validPois = state.pois.map(normalizePoi).filter(Boolean);
    const latLngs = [];
    for (const poi of validPois) {
      latLngs.push([poi.lat, poi.lng]);
      const marker = L.circleMarker([poi.lat, poi.lng], markerBaseStyle(poi)).bindPopup(popupHtml(poi));
      marker.addTo(markerLayer);
      markerByGuid.set(poi.guid, { marker, poi });
    }
    poiBounds = latLngs.length ? L.latLngBounds(latLngs) : null;
    $('mappedCount').textContent = validPois.length.toLocaleString('ja-JP');
    $('mappedSnapshotCount').textContent = state.snapshots.length.toLocaleString('ja-JP');
    $('mapMessage').textContent = validPois.length ? `${validPois.length.toLocaleString('ja-JP')}件をBridge独立地図に固定表示しました。` : '地図へ表示できるPOIがありません。';
    updateMarkerSelectionStyles();
  }

  function fitAllPois() {
    if (!bridgeMap || !poiBounds || !poiBounds.isValid()) {
      ensureMap();
      return;
    }
    bridgeMap.invalidateSize();
    bridgeMap.fitBounds(poiBounds, { padding:[24,24], maxZoom:17 });
  }

  function pointInPolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const yi = polygon[i][0], xi = polygon[i][1];
      const yj = polygon[j][0], xj = polygon[j][1];
      const intersects = ((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function selectedPois() {
    if (polygonPoints.length < 3) return [];
    return state.pois.map(normalizePoi).filter(Boolean).filter(p => pointInPolygon(p.lat, p.lng, polygonPoints));
  }

  function redrawPolygon() {
    if (!bridgeMap || !window.L) return;
    if (polygonLayer) {
      bridgeMap.removeLayer(polygonLayer);
      polygonLayer = null;
    }
    vertexLayer.clearLayers();

    for (const point of polygonPoints) {
      L.circleMarker(point, { radius:6, color:'#0f172a', weight:2, fillColor:'#22c55e', fillOpacity:1, interactive:false }).addTo(vertexLayer);
    }

    if (polygonPoints.length === 2) {
      polygonLayer = L.polyline(polygonPoints, { color:'#22c55e', weight:3, dashArray:'7 5', interactive:false }).addTo(bridgeMap);
    } else if (polygonPoints.length >= 3) {
      polygonLayer = L.polygon(polygonPoints, { color:'#22c55e', weight:3, fillColor:'#22c55e', fillOpacity:0.14, interactive:false }).addTo(bridgeMap);
    }

    const selected = selectedPois();
    selectedGuids = new Set(selected.map(p => p.guid));
    updateSelectionSummary(selected);
    updateMarkerSelectionStyles();
  }

  function updateMarkerSelectionStyles() {
    const activeSelection = polygonPoints.length >= 3;
    for (const { marker, poi } of markerByGuid.values()) {
      const base = markerBaseStyle(poi);
      if (!activeSelection) {
        marker.setStyle(base);
        continue;
      }
      const chosen = selectedGuids.has(poi.guid);
      marker.setStyle({
        ...base,
        radius: chosen ? Math.max(base.radius + 2, 6) : Math.max(base.radius - 1, 3),
        fillOpacity: chosen ? 1 : 0.13,
        opacity: chosen ? 1 : 0.2,
        weight: chosen ? 2 : 1
      });
    }
  }

  function updateSelectionSummary(selected = selectedPois()) {
    const c = counts(selected);
    $('selectedTotal').textContent = c.total.toLocaleString('ja-JP');
    $('selectedPokestop').textContent = c.pokestop.toLocaleString('ja-JP');
    $('selectedGym').textContent = c.gym.toLocaleString('ja-JP');
    $('selectedPower').textContent = c.powerspot.toLocaleString('ja-JP');
    $('vertexCount').textContent = polygonPoints.length.toLocaleString('ja-JP');
    const canConfirm = polygonPoints.length >= 3 && c.total > 0;
    $('confirmCropBtn').disabled = !canConfirm;
    $('confirmCropBtn').classList.toggle('disabled-button', !canConfirm);
    $('cropMessage').textContent = polygonPoints.length < 3
      ? `あと${3 - polygonPoints.length}点でポリゴンになります。`
      : `${c.total.toLocaleString('ja-JP')}件がポリゴン内に入っています。`;
  }

  function setDrawMode(enabled) {
    drawMode = enabled;
    if (!bridgeMap) return;
    if (enabled) {
      bridgeMap.dragging.disable();
      bridgeMap.doubleClickZoom.disable();
      $('drawBtn').textContent = '✋ 描画を止める';
      $('drawBtn').classList.add('drawing');
      $('cropMessage').textContent = '地図を順番にタップして公園を囲んでください。';
    } else {
      bridgeMap.dragging.enable();
      bridgeMap.doubleClickZoom.enable();
      $('drawBtn').textContent = polygonPoints.length ? '✏️ 頂点を追加する' : '✂️ ポリゴンを描く';
      $('drawBtn').classList.remove('drawing');
    }
  }

  function clearPolygon() {
    polygonPoints = [];
    selectedGuids = new Set();
    state.crop = null;
    saveState();
    if (polygonLayer && bridgeMap) bridgeMap.removeLayer(polygonLayer);
    polygonLayer = null;
    if (vertexLayer) vertexLayer.clearLayers();
    updateSelectionSummary([]);
    updateMarkerSelectionStyles();
    setDrawMode(false);
  }

  function undoVertex() {
    if (!polygonPoints.length) return;
    polygonPoints.pop();
    redrawPolygon();
  }

  function restoreCropIfAny() {
    if (!state.crop?.polygon || !Array.isArray(state.crop.polygon) || state.crop.polygon.length < 3) return;
    polygonPoints = state.crop.polygon.map(p => [Number(p[0]), Number(p[1])]);
    redrawPolygon();
  }

  function confirmCrop() {
    const selected = selectedPois();
    if (polygonPoints.length < 3 || !selected.length) return;
    const c = counts(selected);
    state.crop = {
      polygon: polygonPoints.map(p => [Number(p[0].toFixed(7)), Number(p[1].toFixed(7))]),
      selectedGuids: selected.map(p => p.guid),
      stats: c,
      confirmedAt: nowIso()
    };
    saveState();
    setDrawMode(false);
    $('cropMessage').textContent = `✅ ${c.total.toLocaleString('ja-JP')}件で切り取り範囲を固定しました。次はM4で最終確認へ進みます。`;
    $('confirmCropBtn').textContent = `✅ ${c.total.toLocaleString('ja-JP')}件で固定済み`;
  }

  function goToStep(step) {
    if (step === 1) {
      state.frozenAt = null;
      state.crop = null;
      saveState();
      viewStep = 1;
      setDrawMode(false);
    } else {
      if (!state.pois.length) return;
      if (!state.frozenAt) {
        state.frozenAt = nowIso();
        saveState();
      }
      viewStep = step;
      if (step !== 3) setDrawMode(false);
    }
    render();
    if (step >= 2) requestAnimationFrame(() => ensureMap());
  }

  function renderSteps() {
    for (let i = 1; i <= 5; i++) {
      const el = $(`step${i}Nav`);
      if (!el) continue;
      el.className = 'step';
      if (i < viewStep) el.classList.add('done');
      if (i === viewStep) el.classList.add('active');
    }
  }

  function render() {
    const c = counts();
    $('totalCount').textContent = c.total.toLocaleString('ja-JP');
    $('pokestopCount').textContent = c.pokestop.toLocaleString('ja-JP');
    $('gymCount').textContent = c.gym.toLocaleString('ja-JP');
    $('powerspotCount').textContent = c.powerspot.toLocaleString('ja-JP');
    $('snapshotCount').textContent = state.snapshots.length.toLocaleString('ja-JP');
    $('sessionId').textContent = state.sessionId.slice(0,8);
    $('collectorCard').hidden = viewStep !== 1;
    $('mapCard').hidden = viewStep < 2;
    $('m2Tools').hidden = viewStep !== 2;
    $('m3Tools').hidden = viewStep !== 3;
    $('collectorState').textContent = viewStep === 1 ? '収集中' : viewStep === 2 ? '地図確認中' : '切り取り中';
    $('collectorState').className = viewStep === 1 ? 'status-chip live' : 'status-chip frozen';
    renderSnapshots();
    renderSteps();
    if (viewStep >= 2) requestAnimationFrame(() => ensureMap());
    if (viewStep === 3) {
      restoreCropIfAny();
      updateSelectionSummary();
    }
  }

  async function importFiles(files) {
    if (state.frozenAt) return;
    for (const file of files) {
      try {
        const parsed = JSON.parse(await file.text());
        const pois = Array.isArray(parsed?.pois) ? parsed.pois : [];
        addSnapshot(pois, { source:'diagnostic-json', label:file.name, selectedBounds:parsed?.selectedBounds || null });
      } catch (error) {
        console.error('[Campsite Bridge M3] import failed', file.name, error);
        alert(`${file.name} を読み込めませんでした`);
      }
    }
    $('fileInput').value = '';
  }

  function exportMerged() {
    const payload = {
      bridge:'Campsite Bridge', version:VERSION, milestone:'M3_POLYGON_CUTTER', exportedAt:nowIso(),
      session:{ id:state.sessionId, startedAt:state.startedAt, frozenAt:state.frozenAt },
      snapshots:state.snapshots, stats:counts(), crop:state.crop, pois:state.pois
    };
    const blob = new Blob([JSON.stringify(payload,null,2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campsite-bridge-m3-${Date.now()}.json`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  window.addEventListener('message', event => {
    if (!ALLOWED_ORIGINS.has(event.origin)) return;
    const data = event.data;
    if (!data || data.type !== 'CAMPSITE_BRIDGE_POI_V1' || !Array.isArray(data.pois)) return;
    const result = addSnapshot(data.pois, { source:'wayfarer-postMessage', label:`Wayfarer ${state.snapshots.length + 1}`, selectedBounds:data.selectedBounds || null });
    if (event.source) event.source.postMessage({ type:'CAMPSITE_BRIDGE_ACK_V1', accepted:result.accepted, count:result.total, added:result.added, duplicate:result.duplicate, milestone:'M3' }, event.origin);
  });

  $('fileInput').addEventListener('change', e => importFiles([...e.target.files]));
  $('dropZone').addEventListener('click', () => { if (!state.frozenAt) $('fileInput').click(); });
  $('finishBtn').addEventListener('click', () => { if (!state.pois.length) return alert('POIを1件以上集めてください'); goToStep(2); });
  $('resetBtn').addEventListener('click', () => {
    if (!confirm('収集データをすべて消去しますか？')) return;
    state = emptyState();
    polygonPoints = []; selectedGuids = new Set(); viewStep = 1;
    saveState(); render();
  });
  $('exportBtn').addEventListener('click', exportMerged);
  $('fitAllBtn').addEventListener('click', fitAllPois);
  $('backToCollectBtn').addEventListener('click', () => goToStep(1));
  $('startCropBtn').addEventListener('click', () => goToStep(3));
  $('backToMapBtn').addEventListener('click', () => goToStep(2));
  $('drawBtn').addEventListener('click', () => setDrawMode(!drawMode));
  $('undoVertexBtn').addEventListener('click', undoVertex);
  $('clearPolygonBtn').addEventListener('click', clearPolygon);
  $('confirmCropBtn').addEventListener('click', confirmCrop);

  window.CampsiteBridgePreview = Object.freeze({
    version:VERSION,
    milestone:'M3',
    get state(){ return JSON.parse(JSON.stringify(state)); },
    get counts(){ return counts(); },
    get selectedCount(){ return selectedPois().length; },
    addSnapshot,
    fitAll:fitAllPois,
    exportMerged,
    reset(){ state = emptyState(); saveState(); viewStep = 1; render(); }
  });

  render();
})();