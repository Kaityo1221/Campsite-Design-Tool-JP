(() => {
  'use strict';

  const VERSION = '0.1.0';
  const MAP_DATA_PATH = '/api/v1/vault/mapview/gcs';
  const REQUEST_EVENT = 'campsite-bridge-pc:collect';
  const RESPONSE_EVENT = 'campsite-bridge-pc:response';
  const KNOWN_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);

  if (window.__campsiteBridgePcCollectorInstalled) return;
  window.__campsiteBridgePcCollectorInstalled = true;

  function numberFrom(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function coordinate(point, key) {
    if (!point) return null;
    try {
      const value = point[key];
      return numberFrom(typeof value === 'function' ? value.call(point) : value);
    } catch (_) {
      return null;
    }
  }

  function findMap() {
    const host = document.querySelector('app-wf-base-map');
    if (!host || !Array.isArray(host.__ngContext__)) return null;
    const ctx = host.__ngContext__;

    for (const value of ctx) {
      if (value && typeof value === 'object' &&
          typeof value.getBounds === 'function' &&
          typeof value.getZoom === 'function') {
        return value;
      }

      if (!value || typeof value !== 'object') continue;
      for (const key of Object.keys(value)) {
        try {
          const nested = value[key];
          if (nested && typeof nested === 'object' &&
              typeof nested.getBounds === 'function' &&
              typeof nested.getZoom === 'function') {
            return nested;
          }
        } catch (_) {}
      }
    }
    return null;
  }

  function serializeBounds(map) {
    if (!map || typeof map.getBounds !== 'function') return null;
    const bounds = map.getBounds();
    if (!bounds) return null;

    const sw = bounds.getSouthWest?.();
    const ne = bounds.getNorthEast?.();
    const swLat = coordinate(sw, 'lat');
    const swLng = coordinate(sw, 'lng');
    const neLat = coordinate(ne, 'lat');
    const neLng = coordinate(ne, 'lng');
    const zoom = numberFrom(map.getZoom?.());

    if (![swLat, swLng, neLat, neLng].every(Number.isFinite)) return null;

    let centerLat = (swLat + neLat) / 2;
    let centerLng = (swLng + neLng) / 2;
    try {
      const center = map.getCenter?.();
      const mapLat = coordinate(center, 'lat');
      const mapLng = coordinate(center, 'lng');
      if (Number.isFinite(mapLat)) centerLat = mapLat;
      if (Number.isFinite(mapLng)) centerLng = mapLng;
    } catch (_) {}

    return {
      swLat,
      swLng,
      neLat,
      neLng,
      zoom: Number.isFinite(zoom) ? zoom : null,
      center: { lat: centerLat, lng: centerLng }
    };
  }

  function activeGameObjects(poi) {
    return (Array.isArray(poi?.gmo) ? poi.gmo : [])
      .filter(item => item && String(item.status || '').toUpperCase() === 'ACTIVE')
      .map(item => ({ ...item, entity: String(item.entity || '').toUpperCase() }))
      .filter(item => KNOWN_ENTITIES.has(item.entity));
  }

  function primaryGameObject(poi) {
    const active = activeGameObjects(poi);
    if (!active.length) return null;
    const priority = ['GYM', 'POKESTOP', 'POWERSPOT'];
    for (const entity of priority) {
      const match = active.find(item => item.entity === entity);
      if (match) return match;
    }
    return active[0];
  }

  function optionalBoolean(...values) {
    for (const value of values) {
      if (value === true || String(value).toLowerCase() === 'true') return true;
      if (value === false || String(value).toLowerCase() === 'false') return false;
    }
    return null;
  }

  function normalizePoi(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const gameObject = primaryGameObject(raw);
    if (!gameObject) return null;

    const guid = String(raw.poiId || raw.guid || raw.id || '').trim();
    const latE6 = numberFrom(raw.latE6);
    const lngE6 = numberFrom(raw.lngE6);
    const lat = Number.isFinite(latE6) ? latE6 / 1e6 : numberFrom(raw.lat);
    const lng = Number.isFinite(lngE6) ? lngE6 / 1e6 : numberFrom(raw.lng);

    if (!guid || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    const title = String(
      raw.title || raw.name || raw.poiName ||
      gameObject.title || gameObject.name || ''
    ).trim();

    return {
      guid,
      title,
      lat,
      lng,
      gameEntity: gameObject.entity,
      gameStatus: 'ACTIVE',
      sponsored: optionalBoolean(
        raw.sponsored,
        raw.isSponsored,
        gameObject.sponsored,
        gameObject.isSponsored
      ) === true,
      smr: optionalBoolean(raw.smr, gameObject.smr),
      imageUrl: String(raw.imageUrl || raw.imageURL || raw.image || gameObject.imageUrl || ''),
      description: String(raw.description || raw.poiDescription || ''),
      s2L14: String(raw.s2L14 || ''),
      s2L17: String(raw.s2L17 || ''),
      provenance: ['WAYFARER_PASSIVE']
    };
  }

  function normalizeMapData(payload) {
    const groups = Array.isArray(payload)
      ? payload
      : payload?.result?.data;

    if (!Array.isArray(groups)) return [];

    const byGuid = new Map();
    for (const group of groups) {
      const pois = Array.isArray(group?.pois) ? group.pois : [];
      for (const raw of pois) {
        const poi = normalizePoi(raw);
        if (!poi) continue;
        byGuid.set(poi.guid, poi);
      }
    }
    return [...byGuid.values()];
  }

  function selectedBounds(bounds) {
    if (!bounds) return null;
    return {
      center: {
        lat: Number(bounds.center?.lat),
        lng: Number(bounds.center?.lng)
      },
      zoom: Number.isFinite(Number(bounds.zoom)) ? Number(bounds.zoom) : null,
      sw: { lat: bounds.swLat, lng: bounds.swLng },
      ne: { lat: bounds.neLat, lng: bounds.neLng }
    };
  }

  async function collect() {
    const map = findMap();
    if (!map) throw new Error('Wayfarer Mapを確認できませんでした。');

    const bounds = serializeBounds(map);
    if (!bounds) throw new Error('Wayfarer Mapの表示範囲を取得できませんでした。');

    const query =
      'ne=(' + bounds.neLat + ',' + bounds.neLng + ')' +
      '&sw=(' + bounds.swLat + ',' + bounds.swLng + ')' +
      '&cellLevel=14';

    const response = await fetch(MAP_DATA_PATH + '?' + query, {
      credentials: 'include',
      cache: 'no-store'
    });
    if (!response.ok) {
      throw new Error('Wayfarer Mapデータ取得に失敗しました (' + response.status + ')');
    }

    const payload = await response.json();
    return {
      pois: normalizeMapData(payload),
      selectedBounds: selectedBounds(bounds),
      sourcePath: MAP_DATA_PATH
    };
  }

  function dispatchResponse(detail) {
    window.dispatchEvent(new CustomEvent(RESPONSE_EVENT, {
      detail: JSON.stringify(detail)
    }));
  }

  window.addEventListener(REQUEST_EVENT, event => {
    let requestId = '';
    try {
      requestId = String(JSON.parse(String(event.detail || '{}')).requestId || '');
    } catch (_) {}
    if (!requestId) return;

    collect()
      .then(result => dispatchResponse({
        requestId,
        ok: true,
        ...result
      }))
      .catch(error => dispatchResponse({
        requestId,
        ok: false,
        error: String(error?.message || error || 'POI取得に失敗しました。')
      }));
  });

  window.CampsiteBridgePcCollector = Object.freeze({
    version: VERSION,
    mapDataPath: MAP_DATA_PATH,
    findMap,
    serializeBounds,
    normalizePoi,
    normalizeMapData,
    collect
  });
})();
