(() => {
  'use strict';

  const VERSION = '1.1.1';
  const PROTOCOL = 'CAMPSITE_BRIDGE_POI_V1';
  const SCHEMA_VERSION = '1.2';
  const PLATFORM = 'pc';
  const ACTIVE_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const REFERENCE_KINDS = new Set(['NOT_IN_GAME', 'INACTIVE_POWERSPOT']);
  const ALLOWED_PROVENANCE = new Set(['WAYFARER_PASSIVE', 'WFMM_CACHE', 'BRIDGE_ENRICHMENT']);

  function referenceLayerApi() {
    const layer = window.CampsiteBridgePoiReferenceLayer;
    return layer?.splitClassified ? layer : null;
  }

  function text(value) {
    return String(value ?? '');
  }

  function finite(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function booleanOrNull(value) {
    if (value === true || String(value).toLowerCase() === 'true') return true;
    if (value === false || String(value).toLowerCase() === 'false') return false;
    return null;
  }

  function normalizeProvenance(value) {
    const input = Array.isArray(value) ? value : value ? [value] : [];
    const result = [];
    for (const item of input) {
      const normalized = String(item || '').trim().toUpperCase();
      if (!ALLOWED_PROVENANCE.has(normalized) || result.includes(normalized)) continue;
      result.push(normalized);
    }
    if (!result.length) result.push('WAYFARER_PASSIVE');
    return result;
  }

  function normalizePoi(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const guid = text(raw.guid).trim();
    const lat = finite(raw.lat);
    const lng = finite(raw.lng);
    const gameEntity = text(raw.gameEntity || raw.poiKind).trim().toUpperCase();
    const gameStatus = text(raw.gameStatus).trim().toUpperCase();

    if (!guid) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    if (!ACTIVE_ENTITIES.has(gameEntity)) return null;
    if (gameStatus !== 'ACTIVE') return null;
    if (raw.bridgeEligible === false) return null;

    return {
      guid,
      title: text(raw.title),
      lat,
      lng,
      gameEntity,
      gameStatus: 'ACTIVE',
      sponsored: raw.sponsored === true,
      smr: booleanOrNull(raw.smr),
      imageUrl: text(raw.imageUrl),
      description: text(raw.description),
      s2L14: text(raw.s2L14),
      s2L17: text(raw.s2L17),
      provenance: normalizeProvenance(raw.provenance)
    };
  }

  function normalizeReferencePoi(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const guid = text(raw.guid || raw.sourceId || raw.id).trim();
    const lat = finite(raw.lat);
    const lng = finite(raw.lng);
    const referenceKind = text(raw.referenceKind).trim().toUpperCase();
    const gameEntity = text(raw.gameEntity).trim().toUpperCase();
    const gameStatus = text(raw.gameStatus || 'UNKNOWN').trim().toUpperCase();

    if (!guid) return null;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    if (!REFERENCE_KINDS.has(referenceKind)) return null;

    return {
      guid,
      title: text(raw.title || raw.name),
      lat,
      lng,
      referenceKind,
      gameEntity: ACTIVE_ENTITIES.has(gameEntity) ? gameEntity : '',
      gameStatus: gameStatus === 'ACTIVE' || gameStatus === 'INACTIVE' ? gameStatus : 'UNKNOWN',
      imageUrl: text(raw.imageUrl),
      description: text(raw.description),
      provenance: normalizeProvenance(raw.provenance)
    };
  }

  function exportPois(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const candidates = Array.isArray(source.enginePois)
      ? source.enginePois
      : Array.isArray(source.pois) ? source.pois : [];

    const byGuid = new Map();
    for (const raw of candidates) {
      const poi = normalizePoi(raw);
      if (!poi) continue;
      byGuid.set(poi.guid, poi);
    }
    return [...byGuid.values()];
  }

  function exportReferencePois(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    let candidates = [];

    if (Array.isArray(source.referencePois)) {
      candidates = source.referencePois;
    } else if (Array.isArray(source.enginePois)) {
      const layer = referenceLayerApi();
      candidates = layer ? layer.splitClassified(source.enginePois).referencePois : [];
    }

    const byGuid = new Map();
    for (const raw of candidates) {
      const poi = normalizeReferencePoi(raw);
      if (!poi) continue;
      byGuid.set(poi.guid, poi);
    }
    return [...byGuid.values()];
  }

  function normalizeBounds(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const centerLat = finite(raw.center?.lat);
    const centerLng = finite(raw.center?.lng);
    const zoom = finite(raw.zoom);
    if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng)) return null;
    if (centerLat < -90 || centerLat > 90 || centerLng < -180 || centerLng > 180) return null;

    const result = {
      center: { lat: centerLat, lng: centerLng },
      zoom: Number.isFinite(zoom) ? zoom : null
    };

    const swLat = finite(raw.sw?.lat);
    const swLng = finite(raw.sw?.lng);
    const neLat = finite(raw.ne?.lat);
    const neLng = finite(raw.ne?.lng);
    if ([swLat, swLng, neLat, neLng].every(Number.isFinite)) {
      result.sw = { lat: swLat, lng: swLng };
      result.ne = { lat: neLat, lng: neLng };
    }
    return result;
  }

  function makePayload(snapshot, handshakeId, options = {}) {
    const id = text(handshakeId).trim();
    const pois = exportPois(snapshot);
    const activeGuids = new Set(pois.map(poi => poi.guid));
    const referencePois = exportReferencePois(snapshot).filter(poi => !activeGuids.has(poi.guid));

    return {
      type: PROTOCOL,
      bridgeVersion: text(options.bridgeVersion || '0.1.0'),
      bridgePlatform: PLATFORM,
      schemaVersion: SCHEMA_VERSION,
      handshakeId: id,
      selectedBounds: normalizeBounds(snapshot?.selectedBounds),
      autoContinue: options.autoContinue !== false,
      pois,
      referencePois
    };
  }

  window.CampsiteBridgeV1Exporter = Object.freeze({
    version: VERSION,
    protocol: PROTOCOL,
    schemaVersion: SCHEMA_VERSION,
    platform: PLATFORM,
    normalizePoi,
    normalizeReferencePoi,
    normalizeBounds,
    exportPois,
    exportReferencePois,
    makePayload
  });
})();
