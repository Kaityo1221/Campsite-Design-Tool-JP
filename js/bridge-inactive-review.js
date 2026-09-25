(() => {
  'use strict';

  const ADAPTER_KEY = 'campsiteBridgeAdapter.v0.3';
  const SELECTION_PREFIX = 'campsiteBridgeSelection.';

  function readJson(key) {
    try { return JSON.parse(sessionStorage.getItem(key) || 'null'); }
    catch (_) { return null; }
  }

  function activeHandoffId(adapter) {
    const explicit = String(adapter?.handoffId || '').trim();
    if (explicit) return explicit;
    const adaptedAt = String(adapter?.adaptedAt || '').trim();
    return adaptedAt ? `adapted:${adaptedAt}` : '';
  }

  function pointInPolygon(lat, lng, polygon) {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const yi = Number(polygon[i]?.[0]), xi = Number(polygon[i]?.[1]);
      const yj = Number(polygon[j]?.[0]), xj = Number(polygon[j]?.[1]);
      if (![yi, xi, yj, xj].every(Number.isFinite)) continue;
      const intersects = ((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
      if (intersects) inside = !inside;
    }
    return inside;
  }

  function latestSelection(expectedHandoffId) {
    const candidates = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (!key || !key.startsWith(SELECTION_PREFIX)) continue;
      const value = readJson(key);
      if (!value || !Array.isArray(value.pois) || !Array.isArray(value.polygon)) continue;
      if (expectedHandoffId && String(value.handoffId || '').trim() !== expectedHandoffId) continue;
      candidates.push({ key, value });
    }
    candidates.sort((a, b) => String(b.value.selectedAt || '').localeCompare(String(a.value.selectedAt || '')));
    return candidates[0] || null;
  }

  function normalizeInactive(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (String(raw.referenceKind || '').trim().toUpperCase() !== 'INACTIVE_POWERSPOT') return null;
    const guid = String(raw.guid || raw.id || raw.sourceId || '').trim();
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    if (!guid || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      guid,
      id: guid,
      title: String(raw.title || raw.name || '').trim() || 'Inactive Power Spot',
      name: String(raw.title || raw.name || '').trim() || 'Inactive Power Spot',
      lat,
      lng,
      gameEntity: 'POWERSPOT',
      type: 'POWERSPOT',
      gameStatus: 'INACTIVE',
      role: 'existing',
      layer: 'existing-power',
      referenceKind: 'INACTIVE_POWERSPOT',
      sponsored: false,
      smr: null,
      imageUrl: String(raw.imageUrl || ''),
      description: String(raw.description || ''),
      provenance: Array.isArray(raw.provenance) ? raw.provenance.slice() : []
    };
  }

  function mergeInactiveReviewTargets() {
    const adapter = readJson(ADAPTER_KEY);
    if (!adapter) return 0;
    const selected = latestSelection(activeHandoffId(adapter));
    if (!selected || selected.value.polygon.length < 3) return 0;

    const inactive = (Array.isArray(adapter.referencePois) ? adapter.referencePois : [])
      .map(normalizeInactive)
      .filter(Boolean)
      .filter(poi => pointInPolygon(poi.lat, poi.lng, selected.value.polygon));
    if (!inactive.length) return 0;

    const existingGuids = new Set(selected.value.pois.map(poi => String(poi?.guid || poi?.id || '')).filter(Boolean));
    const additions = inactive.filter(poi => !existingGuids.has(poi.guid));
    if (!additions.length) return 0;

    const next = {
      ...selected.value,
      selectedCount: selected.value.pois.length + additions.length,
      inactiveReviewCount: additions.length,
      pois: [...selected.value.pois, ...additions]
    };
    sessionStorage.setItem(selected.key, JSON.stringify(next));
    return additions.length;
  }

  document.addEventListener('click', event => {
    const button = event.target.closest?.('#bridgeConfirmBtn');
    if (!button || button.disabled) return;
    const count = mergeInactiveReviewTargets();
    if (count > 0) {
      const status = document.getElementById('bridgeSelectionStatus');
      if (status) status.textContent = `Inactive PS ${count}件も審査対象として引き継ぎます。`;
    }
  });

  window.CampsiteBridgeInactiveReview = Object.freeze({ mergeInactiveReviewTargets });
})();