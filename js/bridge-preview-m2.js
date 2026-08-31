(() => {
  'use strict';

  const VERSION = '0.9.0-m2';
  const STORAGE_KEY = 'campsiteBridge.preview.m1.v0.9';
  const DEV_PARAM = 'campsiteBridgeDev';
  const ALLOWED_ORIGINS = new Set([
    'https://wayfarer.scopely.com',
    'https://wayfarer.nianticlabs.com'
  ]);
  const ALLOWED_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const ALLOWED_STATUSES = new Set(['ACTIVE', 'INACTIVE']);

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
      pois: []
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
        pois: parsed.pois
      };
    } catch (_) {
      return emptyState();
    }
  }

  let state = loadState();
  let bridgeMap = null;
  let markerLayer = null;
  let poiBounds = null;

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
      bridgeSource: raw.bridgeSource || 'bridge-preview-m2',
      bridgeCapturedAt: raw.bridgeCapturedAt || nowIso()
    };
  }

  function samePoi(a, b) {
    return a.title === b.title &&
      a.lat === b.lat &&
      a.lng === b.lng &&
      a.gameEntity === b.gameEntity &&
      a.gameStatus === b.gameStatus;
  }

  function addSnapshot(rawPois, meta = {}) {
    if (state.frozenAt) {
      return { accepted: false, reason: 'frozen', received: 0, valid: 0, added: 0, duplicate: 0, updated: 0, total: state.pois.length };
    }

    const input = Array.isArray(rawPois) ? rawPois : [];
    const normalized = input.map(normalizePoi).filter(Boolean);
    const byGuid = new Map(state.pois.map(poi => [poi.guid, poi]));
    let added = 0;
    let duplicate = 0;
    let updated = 0;

    for (const poi of normalized) {
      const existing = byGuid.get(poi.guid);
      if (!existing) {
        byGuid.set(poi.guid, poi);
        added++;
        continue;
      }

      duplicate++;
      if (!samePoi(existing, poi)) {
        byGuid.set(poi.guid, poi);
        updated++;
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

    return {
      accepted: true,
      received: input.length,
      valid: normalized.length,
      added,
      duplicate,
      updated,
      total: state.pois.length
    };
  }

  function counts() {
    const result = { total: state.pois.length, pokestop: 0, gym: 0, powerspot: 0, active: 0, inactive: 0 };
    for (const poi of state.pois) {
      if (poi.gameEntity === 'POKESTOP') result.pokestop++;
      if (poi.gameEntity === 'GYM') result.gym++;
      if (poi.gameEntity === 'POWERSPOT') result.powerspot++;
      if (poi.gameStatus === 'ACTIVE') result.active++;
      if (poi.gameStatus === 'INACTIVE') result.inactive++;
    }
    return result;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function renderSnapshots() {
    const list = $('snapshotList');
    list.innerHTML = '';

    if (!state.snapshots.length) {
      const empty = document.createElement('div');
      empty.className = 'snapshot-empty';
      empty.textContent = 'まだスナップショットはありません';
      list.appendChild(empty);
      return;
    }

    for (const snap of [...state.snapshots].reverse()) {
      const row = document.createElement('div');
      row.className = 'snapshot-row';
      row.innerHTML = `
        <div>
          <strong>#${snap.id} ${escapeHtml(snap.label)}</strong>
          <small>${escapeHtml(snap.source)} · ${new Date(snap.capturedAt).toLocaleTimeString('ja-JP')}</small>
        </div>
        <div class="snapshot-numbers">
          <b>+${snap.added}</b>
          <span>重複 ${snap.duplicate}</span>
          <span>累積 ${snap.totalAfter}</span>
        </div>`;
      list.appendChild(row);
    }
  }

  function markerStyle(poi) {
    const color = poi.gameEntity === 'GYM'
      ? '#f472b6'
      : poi.gameEntity === 'POWERSPOT'
        ? '#facc15'
        : '#38bdf8';

    return {
      radius: poi.gameEntity === 'GYM' ? 5 : 4,
      color: '#0f172a',
      weight: 1,
      fillColor: color,
      fillOpacity: poi.gameStatus === 'INACTIVE' ? 0.48 : 0.92
    };
  }

  function popupHtml(poi) {
    const label = poi.gameEntity === 'POKESTOP' ? 'PokéStop' : poi.gameEntity === 'GYM' ? 'Gym' : 'Power Spot';
    return `<strong>${escapeHtml(poi.title || '名称なし')}</strong><br>${label} · ${escapeHtml(poi.gameStatus)}<br><small>${poi.lat.toFixed(6)}, ${poi.lng.toFixed(6)}</small>`;
  }

  function ensureMap() {
    if (!state.frozenAt || !$('mapCard') || $('mapCard').hidden) return;

    if (!window.L) {
      $('mapMessage').textContent = 'Leafletの読み込みに失敗しました。通信状態を確認して再読み込みしてください。';
      return;
    }

    if (!bridgeMap) {
      bridgeMap = L.map('bridgeMap', {
        preferCanvas: true,
        zoomControl: true,
        attributionControl: true
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(bridgeMap);

      markerLayer = L.layerGroup().addTo(bridgeMap);
    }

    markerLayer.clearLayers();
    const validPois = state.pois.map(normalizePoi).filter(Boolean);
    const latLngs = [];

    for (const poi of validPois) {
      const latLng = [poi.lat, poi.lng];
      latLngs.push(latLng);
      L.circleMarker(latLng, markerStyle(poi))
        .bindPopup(popupHtml(poi))
        .addTo(markerLayer);
    }

    poiBounds = latLngs.length ? L.latLngBounds(latLngs) : null;
    $('mappedCount').textContent = validPois.length.toLocaleString('ja-JP');
    $('mappedSnapshotCount').textContent = state.snapshots.length.toLocaleString('ja-JP');

    requestAnimationFrame(() => {
      bridgeMap.invalidateSize();
      fitAllPois();
    });

    $('mapMessage').textContent = validPois.length
      ? `${validPois.length.toLocaleString('ja-JP')}件をBridge独立地図に固定表示しました。ここで縮小しても、収集済みPOIは減りません。`
      : '地図へ表示できるPOIがありません。収集に戻ってください。';
  }

  function fitAllPois() {
    if (!bridgeMap || !poiBounds || !poiBounds.isValid()) return;
    bridgeMap.fitBounds(poiBounds, { padding: [24, 24], maxZoom: 17 });
  }

  function setViewMode() {
    const frozen = Boolean(state.frozenAt);
    $('collectorCard').hidden = frozen;
    $('mapCard').hidden = !frozen;
    $('step1Nav').className = frozen ? 'step done' : 'step active';
    $('step2Nav').className = frozen ? 'step active' : 'step';

    if (frozen) {
      requestAnimationFrame(ensureMap);
    }
  }

  function render() {
    const c = counts();
    $('totalCount').textContent = c.total.toLocaleString('ja-JP');
    $('pokestopCount').textContent = c.pokestop.toLocaleString('ja-JP');
    $('gymCount').textContent = c.gym.toLocaleString('ja-JP');
    $('powerspotCount').textContent = c.powerspot.toLocaleString('ja-JP');
    $('snapshotCount').textContent = state.snapshots.length.toLocaleString('ja-JP');
    $('sessionId').textContent = state.sessionId.slice(0, 8);

    const frozen = Boolean(state.frozenAt);
    $('collectorState').textContent = frozen ? '地図確認中' : '収集中';
    $('collectorState').className = frozen ? 'status-chip frozen' : 'status-chip live';
    $('fileInput').disabled = frozen;
    $('dropZone').classList.toggle('disabled', frozen);
    $('nextHint').textContent = frozen
      ? `${c.total.toLocaleString('ja-JP')}件を固定しました。Bridge独立地図へ進みます。`
      : 'Wayfarerで地図を移動するたび、同じGUIDを重複させずに累積します。';

    renderSnapshots();
    setViewMode();
  }

  async function importFiles(files) {
    if (state.frozenAt) return;
    for (const file of files) {
      try {
        const parsed = JSON.parse(await file.text());
        const pois = Array.isArray(parsed?.pois) ? parsed.pois : [];
        addSnapshot(pois, {
          source: 'diagnostic-json',
          label: file.name,
          selectedBounds: parsed?.selectedBounds || null
        });
      } catch (error) {
        console.error('[Campsite Bridge M2] import failed', file.name, error);
        alert(`${file.name} を読み込めませんでした`);
      }
    }
    $('fileInput').value = '';
  }

  function exportMerged() {
    const payload = {
      bridge: 'Campsite Bridge',
      version: VERSION,
      milestone: 'M2_INDEPENDENT_POI_MAP',
      exportedAt: nowIso(),
      session: {
        id: state.sessionId,
        startedAt: state.startedAt,
        frozenAt: state.frozenAt
      },
      snapshots: state.snapshots,
      stats: counts(),
      pois: state.pois
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `campsite-bridge-m2-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  window.addEventListener('message', event => {
    if (!ALLOWED_ORIGINS.has(event.origin)) return;
    const data = event.data;
    if (!data || data.type !== 'CAMPSITE_BRIDGE_POI_V1' || !Array.isArray(data.pois)) return;

    const result = addSnapshot(data.pois, {
      source: 'wayfarer-postMessage',
      label: `Wayfarer ${state.snapshots.length + 1}`,
      selectedBounds: data.selectedBounds || null
    });

    if (event.source) {
      event.source.postMessage({
        type: 'CAMPSITE_BRIDGE_ACK_V1',
        accepted: result.accepted,
        count: result.total,
        added: result.added,
        duplicate: result.duplicate,
        milestone: 'M2'
      }, event.origin);
    }
  });

  $('fileInput').addEventListener('change', event => importFiles([...event.target.files]));
  $('dropZone').addEventListener('click', () => {
    if (!state.frozenAt) $('fileInput').click();
  });
  $('dropZone').addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !state.frozenAt) {
      event.preventDefault();
      $('fileInput').click();
    }
  });
  $('dropZone').addEventListener('dragover', event => {
    event.preventDefault();
    if (!state.frozenAt) $('dropZone').classList.add('dragover');
  });
  $('dropZone').addEventListener('dragleave', () => $('dropZone').classList.remove('dragover'));
  $('dropZone').addEventListener('drop', event => {
    event.preventDefault();
    $('dropZone').classList.remove('dragover');
    if (!state.frozenAt) importFiles([...event.dataTransfer.files]);
  });

  $('finishBtn').addEventListener('click', () => {
    if (!state.pois.length) return alert('POIを1件以上集めてください');
    state.frozenAt = nowIso();
    saveState();
    render();
  });

  $('backToCollectBtn').addEventListener('click', () => {
    state.frozenAt = null;
    saveState();
    render();
  });

  $('fitAllBtn').addEventListener('click', fitAllPois);

  $('resetBtn').addEventListener('click', () => {
    if (!confirm('収集データをすべて消去しますか？')) return;
    state = emptyState();
    saveState();
    render();
  });

  $('exportBtn').addEventListener('click', exportMerged);

  window.CampsiteBridgePreview = Object.freeze({
    version: VERSION,
    milestone: 'M2',
    get state() { return JSON.parse(JSON.stringify(state)); },
    get counts() { return counts(); },
    addSnapshot,
    fitAll: fitAllPois,
    exportMerged,
    reset() {
      state = emptyState();
      saveState();
      render();
    }
  });

  render();
})();