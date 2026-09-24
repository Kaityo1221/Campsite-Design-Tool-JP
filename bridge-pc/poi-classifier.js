(() => {
  'use strict';

  const VERSION = '1.0.0';
  const ACTIVE_KINDS = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const ENTITY_PRIORITY = ['GYM', 'POKESTOP', 'POWERSPOT'];
  const SUPPORTED_BRAND = 'HOLOHOLO';

  function normalizedBrand(value) {
    return String(value || '').trim().toUpperCase();
  }

  function isSupportedBrand(value) {
    const brand = normalizedBrand(value);
    return brand === '' || brand === SUPPORTED_BRAND;
  }

  function normalizedStatus(value) {
    const status = String(value || 'UNKNOWN').trim().toUpperCase();
    if (status === 'ACTIVE' || status === 'INACTIVE') return status;
    return 'UNKNOWN';
  }

  function normalizedEntity(value) {
    const text = String(value || '').trim().toUpperCase().replace(/[\s_-]/g, '');
    if (text === 'POKESTOP') return 'POKESTOP';
    if (text === 'GYM') return 'GYM';
    if (text === 'POWERSPOT') return 'POWERSPOT';
    return '';
  }

  function sourceObjects(poi) {
    if (!Array.isArray(poi?.sourceGameObjects)) return [];
    return poi.sourceGameObjects.map(item => ({
      entity: normalizedEntity(item?.entity),
      status: normalizedStatus(item?.status),
      gameBrand: normalizedBrand(item?.gameBrand),
      malformed: item?.malformed === true,
      rawEntity: String(item?.rawEntity || item?.entity || '').trim()
    }));
  }

  function chooseActive(objects) {
    const active = objects.filter(item =>
      item.status === 'ACTIVE' &&
      ACTIVE_KINDS.has(item.entity) &&
      isSupportedBrand(item.gameBrand)
    );
    for (const entity of ENTITY_PRIORITY) {
      const found = active.find(item => item.entity === entity);
      if (found) return found;
    }
    return null;
  }

  function hasAmbiguousMetadata(poi, objects) {
    if (Number(poi?.sourceGameObjectMeta?.malformedCount || 0) > 0) return true;
    return objects.some(item => {
      if (item.malformed) return true;
      if (!isSupportedBrand(item.gameBrand)) return false;
      if (!item.entity) return true;
      if (item.status === 'UNKNOWN') return true;
      return false;
    });
  }

  function inactiveStatus(objects) {
    return objects.some(item =>
      item.status === 'INACTIVE' &&
      ACTIVE_KINDS.has(item.entity) &&
      isSupportedBrand(item.gameBrand)
    ) ? 'INACTIVE' : 'UNKNOWN';
  }

  function activeReason(entity) {
    if (entity === 'GYM') return 'ACTIVE_GYM';
    if (entity === 'POKESTOP') return 'ACTIVE_POKESTOP';
    if (entity === 'POWERSPOT') return 'ACTIVE_POWERSPOT';
    return 'AMBIGUOUS_GAME_OBJECT';
  }

  function classifyPoi(parsedPoi) {
    if (!parsedPoi || typeof parsedPoi !== 'object') return null;

    const objects = sourceObjects(parsedPoi);
    const active = chooseActive(objects);

    let poiKind = 'NOT_IN_GAME';
    let gameStatus = inactiveStatus(objects);
    let reasonCode = 'NO_ACTIVE_SUPPORTED_GAME_OBJECT';
    let gameEntity = null;

    if (active) {
      poiKind = active.entity;
      gameEntity = active.entity;
      gameStatus = 'ACTIVE';
      reasonCode = activeReason(active.entity);
    } else if (hasAmbiguousMetadata(parsedPoi, objects)) {
      poiKind = 'UNKNOWN';
      gameStatus = 'UNKNOWN';
      reasonCode = 'AMBIGUOUS_GAME_OBJECT';
    }

    return {
      ...parsedPoi,
      poiKind,
      classification: poiKind,
      gameEntity,
      gameStatus,
      reasonCode,
      bridgeEligible: ACTIVE_KINDS.has(poiKind) && gameStatus === 'ACTIVE'
    };
  }

  function emptyCounts() {
    return {
      pokestopCount: 0,
      gymCount: 0,
      powerspotCount: 0,
      notInGameCount: 0,
      unknownCount: 0,
      exportCount: 0
    };
  }

  function increment(counts, poi) {
    if (poi.poiKind === 'POKESTOP') counts.pokestopCount += 1;
    else if (poi.poiKind === 'GYM') counts.gymCount += 1;
    else if (poi.poiKind === 'POWERSPOT') counts.powerspotCount += 1;
    else if (poi.poiKind === 'NOT_IN_GAME') counts.notInGameCount += 1;
    else counts.unknownCount += 1;
    if (poi.bridgeEligible) counts.exportCount += 1;
  }

  function toBridgePoi(enginePoi) {
    if (!enginePoi?.bridgeEligible) return null;
    if (!ACTIVE_KINDS.has(enginePoi.poiKind)) return null;
    return {
      guid: String(enginePoi.guid || ''),
      title: String(enginePoi.title || ''),
      lat: Number(enginePoi.lat),
      lng: Number(enginePoi.lng),
      gameEntity: enginePoi.poiKind,
      gameStatus: 'ACTIVE',
      sponsored: enginePoi.sponsored === true,
      smr: enginePoi.smr === true ? true : enginePoi.smr === false ? false : null,
      imageUrl: String(enginePoi.imageUrl || ''),
      description: String(enginePoi.description || ''),
      s2L14: String(enginePoi.s2L14 || ''),
      s2L17: String(enginePoi.s2L17 || ''),
      provenance: Array.isArray(enginePoi.provenance) ? enginePoi.provenance : ['WAYFARER_PASSIVE']
    };
  }

  function bridgePoisFromClassified(list) {
    return (Array.isArray(list) ? list : []).map(toBridgePoi).filter(Boolean);
  }

  function classifyMany(list) {
    const pois = (Array.isArray(list) ? list : []).map(classifyPoi).filter(Boolean);
    const counts = emptyCounts();
    const diagnostics = [];

    for (const poi of pois) {
      increment(counts, poi);
      if (poi.poiKind === 'UNKNOWN') {
        diagnostics.push({ guid: poi.guid, reason: poi.reasonCode });
      }
    }

    return { pois, counts, diagnostics };
  }

  function run(parsedResult) {
    const source = parsedResult && typeof parsedResult === 'object' ? parsedResult : {};
    const classified = classifyMany(source.pois);
    const sourceCount = Number(source.sourceCount || 0);
    const validCount = Number(source.parsedCount ?? classified.pois.length);
    const invalidCount = Number(source.failedCount || 0);
    const duplicateCount = Number(source.duplicateCount || 0);

    const stats = {
      sourceCount,
      validCount,
      invalidCount,
      duplicateCount,
      ...classified.counts
    };

    return {
      version: VERSION,
      pois: classified.pois,
      bridgePois: bridgePoisFromClassified(classified.pois),
      diagnostics: stats,
      classificationDiagnostics: classified.diagnostics
    };
  }

  window.CampsiteBridgePoiClassifier = Object.freeze({
    version: VERSION,
    entityPriority: [...ENTITY_PRIORITY],
    supportedBrand: SUPPORTED_BRAND,
    isSupportedBrand,
    classifyPoi,
    classifyMany,
    toBridgePoi,
    bridgePoisFromClassified,
    run
  });
})();
