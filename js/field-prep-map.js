(() => {
  'use strict';

  const surveySection = document.getElementById('fieldPrepSurveySection');
  const mapElement = document.getElementById('fieldPrepMap');
  const mapStatus = document.getElementById('fieldPrepMapStatus');
  const startButton = document.getElementById('fieldPrepStartAreaButton');
  const addVertexButton = document.getElementById('fieldPrepAddVertexButton');
  const undoVertexButton = document.getElementById('fieldPrepUndoVertexButton');
  const confirmButton = document.getElementById('fieldPrepConfirmAreaButton');
  const resetButton = document.getElementById('fieldPrepResetAreaButton');
  const vertexCount = document.getElementById('fieldPrepVertexCount');
  const loadedCount = document.getElementById('fieldPrepLoadedCount');
  const insideCount = document.getElementById('fieldPrepInsideCount');
  const outsideCount = document.getElementById('fieldPrepOutsideCount');
  const saveKmlButton = document.getElementById('fieldPrepSaveKmlButton');
  const restoreNote = document.getElementById('fieldPrepRestoreNote');
  const startFieldModeButton = document.createElement('button');
  startFieldModeButton.id = 'fieldPrepStartFieldModeButton';
  startFieldModeButton.type = 'button';
  startFieldModeButton.className = 'field-prep-primary';
  startFieldModeButton.textContent = '現地モードを開始';
  startFieldModeButton.disabled = true;
  startFieldModeButton.style.marginBottom = '8px';
  saveKmlButton.insertAdjacentElement('beforebegin', startFieldModeButton);

  let map = null;
  let poiLayer = null;
  let draftLayer = null;
  let surveyLayer = null;
  let drawing = false;
  let draftVertices = [];
  let surveyPolygon = [];
  let currentPoints = [];
  let restoring = false;

  function setMapStatus(message, isError = false) {
    mapStatus.textContent = message;
    mapStatus.classList.toggle('is-error', isError);
  }

  function initMap() {
    if (map || typeof window.L === 'undefined') return Boolean(map);

    map = L.map(mapElement, { zoomControl: true }).setView([35.6812, 139.7671], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    poiLayer = L.layerGroup().addTo(map);
    return true;
  }

  function median(values) {
    const sorted = values
      .map(Number)
      .filter(Number.isFinite)
      .sort((a, b) => a - b);
    if (sorted.length === 0) return null;
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function fitPoints() {
    if (!map || currentPoints.length === 0) return;

    const pointLatLngs = currentPoints.map(point => [Number(point.lat), Number(point.lng)]);
    const focusLatLngs = surveyPolygon.length >= 3 ? surveyPolygon : pointLatLngs;
    const bounds = L.latLngBounds(focusLatLngs);
    if (!bounds.isValid()) return;

    map.invalidateSize({ animate: false, pan: false });
    map.fitBounds(bounds.pad(0.12), { maxZoom: 17, animate: false });

    // A hidden/restored map or a distant outlier can otherwise collapse to a world view.
    // In that case, reopen around the dense middle of the imported POIs at a field-use zoom.
    if (!Number.isFinite(map.getZoom()) || map.getZoom() < 13) {
      const centerLat = median(currentPoints.map(point => point.lat));
      const centerLng = median(currentPoints.map(point => point.lng));
      if (Number.isFinite(centerLat) && Number.isFinite(centerLng)) {
        map.setView([centerLat, centerLng], 14, { animate: false });
      }
    }
  }

  function scheduleFitPoints() {
    if (!map) return;
    window.requestAnimationFrame(() => {
      map.invalidateSize({ animate: false, pan: false });
      fitPoints();
      window.setTimeout(() => {
        map.invalidateSize({ animate: false, pan: false });
        if (map.getZoom() < 13) fitPoints();
      }, 90);
    });
  }

  function pointOnSegment(point, a, b, epsilon = 1e-10) {
    const px = point.lng;
    const py = point.lat;
    const ax = a[1];
    const ay = a[0];
    const bx = b[1];
    const by = b[0];
    const cross = (px - ax) * (by - ay) - (py - ay) * (bx - ax);
    if (Math.abs(cross) > epsilon) return false;
    const dot = (px - ax) * (bx - ax) + (py - ay) * (by - ay);
    if (dot < -epsilon) return false;
    const squaredLength = (bx - ax) ** 2 + (by - ay) ** 2;
    return dot <= squaredLength + epsilon;
  }

  function pointInPolygon(point, polygon) {
    if (!point || !Array.isArray(polygon) || polygon.length < 3) return false;

    let inside = false;
    const x = point.lng;
    const y = point.lat;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[j];
      const b = polygon[i];
      if (pointOnSegment(point, a, b)) return true;

      const xi = b[1];
      const yi = b[0];
      const xj = a[1];
      const yj = a[0];
      const intersects = ((yi > y) !== (yj > y)) &&
        (x < ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }

    return inside;
  }

  function getInsidePoints() {
    if (surveyPolygon.length < 3) return [];
    return currentPoints.filter(point => pointInPolygon(point, surveyPolygon));
  }

  function renderPoiMarkers() {
    if (!map || !poiLayer) return;
    poiLayer.clearLayers();

    currentPoints.forEach(point => {
      const inside = surveyPolygon.length < 3 || pointInPolygon(point, surveyPolygon);
      const type = window.FieldPrep?.normalizePoiType(point) || 'pokestop';
      const radius = type === 'gym' ? 6 : type === 'power' ? 5.5 : 5;
      const marker = L.circleMarker([point.lat, point.lng], {
        radius,
        weight: inside ? 2 : 1,
        opacity: inside ? 1 : 0.3,
        fillOpacity: inside ? 0.72 : 0.16
      });
      marker.bindTooltip(point.name || '名称なし');
      marker.addTo(poiLayer);
    });
  }

  function clearLayer(layer) {
    if (layer && map) map.removeLayer(layer);
  }

  function renderSurveyGeometry() {
    if (!map) return;

    clearLayer(draftLayer);
    clearLayer(surveyLayer);
    draftLayer = null;
    surveyLayer = null;

    if (surveyPolygon.length >= 3) {
      surveyLayer = L.polygon(surveyPolygon, {
        weight: 3,
        fillOpacity: 0.12
      }).addTo(map);
    } else if (draftVertices.length > 0) {
      draftLayer = L.layerGroup().addTo(map);

      draftVertices.forEach((latLng, index) => {
        L.circleMarker(latLng, {
          radius: index === draftVertices.length - 1 ? 5 : 4,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.95,
          interactive: false
        }).addTo(draftLayer);
      });

      if (draftVertices.length >= 3) {
        L.polygon(draftVertices, {
          weight: 3,
          dashArray: '8 7',
          fillOpacity: 0.08,
          interactive: false
        }).addTo(draftLayer);
      } else if (draftVertices.length >= 2) {
        L.polyline(draftVertices, {
          weight: 3,
          dashArray: '8 7',
          interactive: false
        }).addTo(draftLayer);
      }
    }

    vertexCount.textContent = String(drawing ? draftVertices.length : surveyPolygon.length);
  }

  function updateCounts() {
    const inside = getInsidePoints();
    loadedCount.textContent = String(currentPoints.length);
    insideCount.textContent = surveyPolygon.length >= 3 ? String(inside.length) : '-';
    outsideCount.textContent = surveyPolygon.length >= 3 ? String(currentPoints.length - inside.length) : '-';
    const cannotContinue = surveyPolygon.length < 3 || inside.length === 0;
    saveKmlButton.disabled = cannotContinue;
    startFieldModeButton.disabled = cannotContinue;
    renderPoiMarkers();
  }

  function updateButtons() {
    startButton.disabled = currentPoints.length === 0;
    addVertexButton.disabled = !drawing;
    undoVertexButton.disabled = !drawing || draftVertices.length === 0;
    confirmButton.disabled = !drawing || draftVertices.length < 3;
    resetButton.disabled = surveyPolygon.length === 0 && draftVertices.length === 0;
  }

  async function persist() {
    if (restoring || !window.FieldPrepSession || !window.FieldPrep) return;
    const core = window.FieldPrep.getState();
    if (core.uniquePoints.length === 0) {
      await window.FieldPrepSession.clear().catch(() => {});
      return;
    }

    await window.FieldPrepSession.save({
      core,
      survey: {
        polygon: surveyPolygon.map(pair => [...pair])
      }
    }).catch(() => {});
  }

  function resetSurvey({ persistState = true } = {}) {
    drawing = false;
    draftVertices = [];
    surveyPolygon = [];
    renderSurveyGeometry();
    updateCounts();
    updateButtons();
    setMapStatus('「調査範囲を設定」を押して、公園など今回調査する範囲を囲んでください。');
    if (persistState) persist();
  }

  function startDrawing() {
    if (!map || currentPoints.length === 0) return;
    drawing = true;
    draftVertices = surveyPolygon.length >= 3
      ? surveyPolygon.map(pair => [...pair])
      : [];
    surveyPolygon = [];
    renderSurveyGeometry();
    updateCounts();
    updateButtons();
    setMapStatus('地図を動かし、中央の十字を頂点に合わせて「＋ 頂点追加」を押してください。');
  }

  function addVertex() {
    if (!drawing || !map) return;
    const center = map.getCenter();
    draftVertices.push([center.lat, center.lng]);
    renderSurveyGeometry();
    updateButtons();
    setMapStatus(`${draftVertices.length}点を追加しました。${draftVertices.length === 1 ? '地図に最初の点を表示しました。' : draftVertices.length === 2 ? '2点を線でつなぎました。' : '3点以上で範囲を確定できます。'}`);
  }

  function undoVertex() {
    if (!drawing || draftVertices.length === 0) return;
    draftVertices.pop();
    renderSurveyGeometry();
    updateButtons();
    setMapStatus(`${draftVertices.length}点です。`);
  }

  function confirmSurvey() {
    if (!drawing || draftVertices.length < 3) return;
    surveyPolygon = draftVertices.map(pair => [...pair]);
    draftVertices = [];
    drawing = false;
    renderSurveyGeometry();
    updateCounts();
    updateButtons();
    const inside = getInsidePoints();
    setMapStatus(`調査範囲を確定しました。${inside.length}件を今回の調査対象にします。`);
    persist();
  }

  function escapeXml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function fallbackCircleCoordinates(lat, lng, radiusMeters, steps = 72) {
    const coordinates = [];
    const earthRadius = 6378137;
    const centerLat = Number(lat) * Math.PI / 180;
    const centerLng = Number(lng) * Math.PI / 180;
    const radius = Number(radiusMeters);

    for (let i = 0; i <= steps; i++) {
      const angle = (i / steps) * 2 * Math.PI;
      const pointLat = Math.asin(
        Math.sin(centerLat) * Math.cos(radius / earthRadius) +
        Math.cos(centerLat) * Math.sin(radius / earthRadius) * Math.cos(angle)
      );
      const pointLng = centerLng + Math.atan2(
        Math.sin(angle) * Math.sin(radius / earthRadius) * Math.cos(centerLat),
        Math.cos(radius / earthRadius) - Math.sin(centerLat) * Math.sin(pointLat)
      );
      coordinates.push(`${pointLng * 180 / Math.PI},${pointLat * 180 / Math.PI},0`);
    }
    return coordinates.join(' ');
  }

  function buildPointPlacemark(point) {
    return `<Placemark><name>${escapeXml(point.name || '')}</name><description>${escapeXml(point.type || '')}</description><Point><coordinates>${Number(point.lng)},${Number(point.lat)},0</coordinates></Point></Placemark>`;
  }

  function buildCirclePlacemark(point, radiusMeters = window.CampsitePoiSpacingPolicy.targetMeters) {
    const coords = typeof window.createCircleCoordinates === 'function'
      ? window.createCircleCoordinates(point.lat, point.lng, radiusMeters)
      : fallbackCircleCoordinates(point.lat, point.lng, radiusMeters);
    return `<Placemark><name>${escapeXml(point.name || '')}_${radiusMeters}m円</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${coords}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark>`;
  }

  function folder(name, content = '') {
    return `<Folder><name>${escapeXml(name)}</name>${content}</Folder>`;
  }

  function buildFieldKml(points) {
    const spacing = window.CampsitePoiSpacingPolicy;
    const grouped = { pokestop: [], gym: [], power: [] };
    points.forEach(point => grouped[window.FieldPrep.normalizePoiType(point)].push(point));

    const folders = [
      folder('既存のポケストップ', grouped.pokestop.map(buildPointPlacemark).join('')),
      folder('既存のジム', grouped.gym.map(buildPointPlacemark).join('')),
      folder('既存のパワースポット', grouped.power.map(buildPointPlacemark).join('')),
      folder('追加希望ポケスト'),
      folder('追加希望ジム'),
      folder('追加希望パワスポ'),
      folder('活動範囲'),
      folder(spacing.targetCircleFolder, points.map(point => buildCirclePlacemark(point, spacing.targetMeters)).join('')),
      folder(spacing.referenceCircleFolders[40]),
      folder(spacing.referenceCircleFolders[30])
    ].join('');

    return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Campsite Field Preparation</name>${folders}</Document></kml>`;
  }

  function saveFieldKml() {
    const inside = getInsidePoints();
    if (surveyPolygon.length < 3 || inside.length === 0) return;

    const kml = buildFieldKml(inside);
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    anchor.href = url;
    anchor.download = `field-prep-${stamp}.kml`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMapStatus(`現地モード用KMLを保存しました。調査範囲内の${inside.length}件を収録しています。`);
  }

  async function startFieldMode() {
    const inside = getInsidePoints();
    if (surveyPolygon.length < 3 || inside.length === 0) return;
    if (!window.FieldPrepSession?.createHandoff) {
      setMapStatus('現地モードへの引き継ぎ機能を読み込めませんでした。', true);
      return;
    }

    startFieldModeButton.disabled = true;
    setMapStatus(`現地モードへ${inside.length}件を引き継いでいます…`);
    try {
      const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
      const handoff = await window.FieldPrepSession.createHandoff({
        kml: buildFieldKml(inside),
        sourceName: `field-prep-${stamp}.kml`,
        pointCount: inside.length
      });
      window.location.assign(`field-mode.html?handoff=${encodeURIComponent(handoff.id)}`);
    } catch (error) {
      console.error('Field prep handoff failed', error);
      setMapStatus(`現地モードへ引き継げませんでした：${error.message || '端末保存エラー'}`, true);
      updateCounts();
    }
  }

  function applyPoints(points, { fit = true, resetPolygon = true } = {}) {
    currentPoints = Array.isArray(points)
      ? points.filter(point => Number.isFinite(Number(point.lat)) && Number.isFinite(Number(point.lng)))
      : [];

    if (currentPoints.length === 0) {
      surveySection.hidden = true;
      if (poiLayer) poiLayer.clearLayers();
      resetSurvey({ persistState: false });
      return;
    }

    surveySection.hidden = false;
    if (!initMap()) {
      setMapStatus('地図ライブラリを読み込めませんでした。通信環境を確認してください。', true);
      return;
    }

    if (resetPolygon) resetSurvey({ persistState: false });
    renderPoiMarkers();
    updateCounts();
    updateButtons();
    if (fit) scheduleFitPoints();
  }

  async function restoreSession() {
    if (!window.FieldPrepSession || !window.FieldPrep) return;

    restoring = true;
    try {
      const saved = await window.FieldPrepSession.load();
      if (!saved?.core?.uniquePoints?.length) return;

      const restored = window.FieldPrep.restorePreparedData(saved.core);
      if (!restored) return;

      surveyPolygon = Array.isArray(saved.survey?.polygon)
        ? saved.survey.polygon
          .map(pair => [Number(pair[0]), Number(pair[1])])
          .filter(pair => Number.isFinite(pair[0]) && Number.isFinite(pair[1]))
        : [];

      applyPoints(saved.core.uniquePoints, { fit: true, resetPolygon: false });
      renderSurveyGeometry();
      updateCounts();
      updateButtons();

      if (surveyPolygon.length >= 3) {
        setMapStatus(`前回の調査範囲を復元しました。${getInsidePoints().length}件が範囲内です。`);
      }
      restoreNote.hidden = false;
    } catch (error) {
      console.warn('Field prep restore failed', error);
    } finally {
      restoring = false;
    }
  }

  window.addEventListener('fieldprep:datachanged', event => {
    const detail = event.detail || {};
    if (detail.cleared) {
      currentPoints = [];
      surveySection.hidden = true;
      resetSurvey({ persistState: false });
      window.FieldPrepSession?.clear().catch(() => {});
      return;
    }

    applyPoints(detail.state?.uniquePoints || [], { fit: true, resetPolygon: true });
    persist();
  });

  startButton.addEventListener('click', startDrawing);
  addVertexButton.addEventListener('click', addVertex);
  undoVertexButton.addEventListener('click', undoVertex);
  confirmButton.addEventListener('click', confirmSurvey);
  resetButton.addEventListener('click', () => resetSurvey());
  saveKmlButton.addEventListener('click', saveFieldKml);
  startFieldModeButton.addEventListener('click', startFieldMode);

  window.FieldPrepSurvey = {
    getState() {
      return {
        polygon: surveyPolygon.map(pair => [...pair]),
        insidePoints: getInsidePoints().map(point => ({ ...point })),
        mapZoom: map?.getZoom?.() ?? null
      };
    },
    pointInPolygon,
    buildFieldKml
  };

  restoreSession();
})();
