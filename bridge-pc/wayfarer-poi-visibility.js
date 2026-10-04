(() => {
  'use strict';

  const VERSION = '0.1.0';
  const MAP_DATA_PATH = '/api/v1/vault/mapview/gcs';
  const SUPPORTED_BRAND = 'HOLOHOLO';
  const ACTIVE_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);

  if (window.__campsiteBridgeWayfarerPoiVisibilityInstalled) return;
  window.__campsiteBridgeWayfarerPoiVisibilityInstalled = true;

  const rawFetchImpl = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  const diagnostics = {
    mapResponsesSeen: 0,
    mapResponsesFiltered: 0,
    sourcePois: 0,
    visiblePois: 0,
    filterErrors: 0
  };

  function normalizeEntity(value) {
    const text = String(value || '').trim().toUpperCase().replace(/[\s_-]/g, '');
    return ACTIVE_ENTITIES.has(text) ? text : '';
  }

  function isSupportedBrand(value) {
    const brand = String(value || '').trim().toUpperCase();
    return brand === '' || brand === SUPPORTED_BRAND;
  }

  function isVisibleGameObject(value) {
    if (!value || typeof value !== 'object') return false;
    const status = String(value.status || '').trim().toUpperCase();
    return (
      status === 'ACTIVE' &&
      Boolean(normalizeEntity(value.entity)) &&
      isSupportedBrand(value.gameBrand)
    );
  }

  function isVisiblePoi(raw) {
    return Boolean(
      raw &&
      typeof raw === 'object' &&
      Array.isArray(raw.gmo) &&
      raw.gmo.some(isVisibleGameObject)
    );
  }

  function filterPayload(value) {
    if (Array.isArray(value)) return value.map(filterPayload);
    if (!value || typeof value !== 'object') return value;

    const result = {};
    for (const [key, child] of Object.entries(value)) {
      if (key === 'pois' && Array.isArray(child)) {
        diagnostics.sourcePois += child.length;
        const visible = child.filter(isVisiblePoi).map(filterPayload);
        diagnostics.visiblePois += visible.length;
        result[key] = visible;
      } else {
        result[key] = filterPayload(child);
      }
    }
    return result;
  }

  function requestUrl(input) {
    try {
      const value =
        typeof input === 'string' || input instanceof URL
          ? String(input)
          : String(input?.url || '');
      if (!value) return null;
      return new URL(value, window.location?.href || 'https://wayfarer.scopely.com/');
    } catch (_) {
      return null;
    }
  }

  function isMapDataRequest(input) {
    const url = requestUrl(input);
    return Boolean(url && url.pathname === MAP_DATA_PATH);
  }

  async function rawFetch(input, init) {
    if (!rawFetchImpl) throw new Error('Wayfarer fetch is unavailable.');
    return rawFetchImpl(input, init);
  }

  async function filteredFetch(input, init) {
    if (!rawFetchImpl) throw new Error('Wayfarer fetch is unavailable.');
    const response = await rawFetchImpl(input, init);
    if (!isMapDataRequest(input) || !response?.ok) return response;

    diagnostics.mapResponsesSeen += 1;
    try {
      const text = await response.text();
      const payload = JSON.parse(text);
      const filtered = filterPayload(payload);
      const headers = new Headers(response.headers || undefined);
      headers.delete('content-length');
      headers.delete('content-encoding');
      diagnostics.mapResponsesFiltered += 1;
      return new Response(JSON.stringify(filtered), {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    } catch (_) {
      diagnostics.filterErrors += 1;
      return response;
    }
  }

  if (rawFetchImpl) window.fetch = filteredFetch;

  window.CampsiteBridgeWayfarerPoiVisibility = Object.freeze({
    version: VERSION,
    mapDataPath: MAP_DATA_PATH,
    isVisibleGameObject,
    isVisiblePoi,
    filterPayload,
    isMapDataRequest,
    rawFetch,
    getDiagnostics: () => ({ ...diagnostics })
  });
})();
