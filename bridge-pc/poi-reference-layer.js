(() => {
  'use strict';

  const VERSION = '1.0.0';
  const ACTIVE_KINDS = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const REFERENCE_KINDS = new Set(['NOT_IN_GAME', 'INACTIVE_POWERSPOT']);
  const ALLOWED_PROVENANCE = new Set(['WAYFARER_PASSIVE', 'WFMM_CACHE', 'BRIDGE_ENRICHMENT']);

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

  function validCoordinate(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
  }

  function toReferencePoi(enginePoi) {
    if (!enginePoi || typeof enginePoi !== 'object') return null;
    const guid = String(enginePoi.guid || '').trim();
    const lat = validCoordinate(enginePoi.lat, -90, 90);
    const lng = validCoordinate(enginePoi.lng, -180, 180);
    const referenceKind = String(enginePoi.referenceKind || '').trim().toUpperCase();
    if (!guid || lat === null || lng === null || !REFERENCE_KINDS.has(referenceKind)) return null;

    const gameEntity = String(enginePoi.gameEntity || '').trim().toUpperCase();
    const gameStatus = String(enginePoi.gameStatus || 'UNKNOWN').trim().toUpperCase();

    return {
      guid,
      title: String(enginePoi.title || ''),
      lat,
      lng,
      referenceKind,
      gameEntity: ACTIVE_KINDS.has(gameEntity) ? gameEntity : '',
      gameStatus: gameStatus === 'ACTIVE' || gameStatus === 'INACTIVE' ? gameStatus : 'UNKNOWN',
      imageUrl: String(enginePoi.imageUrl || ''),
      description: String(enginePoi.description || ''),
      provenance: normalizeProvenance(enginePoi.provenance)
    };
  }

  function isActive(enginePoi) {
    return Boolean(
      enginePoi &&
      enginePoi.bridgeEligible === true &&
      ACTIVE_KINDS.has(String(enginePoi.poiKind || '').trim().toUpperCase()) &&
      String(enginePoi.gameStatus || '').trim().toUpperCase() === 'ACTIVE'
    );
  }

  function splitClassified(list) {
    const activeByGuid = new Map();
    const referenceByGuid = new Map();
    const diagnosticPois = [];

    for (const enginePoi of Array.isArray(list) ? list : []) {
      const guid = String(enginePoi?.guid || '').trim();
      if (isActive(enginePoi) && guid) {
        activeByGuid.set(guid, enginePoi);
        referenceByGuid.delete(guid);
        continue;
      }

      const referencePoi = toReferencePoi(enginePoi);
      if (referencePoi && !activeByGuid.has(referencePoi.guid)) {
        referenceByGuid.set(referencePoi.guid, referencePoi);
        continue;
      }

      if (enginePoi) diagnosticPois.push(enginePoi);
    }

    return {
      version: VERSION,
      activeEnginePois: [...activeByGuid.values()],
      referencePois: [...referenceByGuid.values()],
      diagnosticPois
    };
  }

  window.CampsiteBridgePoiReferenceLayer = Object.freeze({
    version: VERSION,
    referenceKinds: [...REFERENCE_KINDS],
    toReferencePoi,
    splitClassified
  });
})();
