(() => {
  'use strict';

  const VERSION = '1.1.1';
  const ACTIVE_KINDS = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const ENTITY_PRIORITY = ['GYM', 'POKESTOP', 'POWERSPOT'];
  const SUPPORTED_BRAND = 'HOLOHOLO';

  function optionalBoolean(...values) {
    for (const value of values) {
      if (value === true || String(value).toLowerCase() === 'true') return true;
      if (value === false || String(value).toLowerCase() === 'false') return false;
    }
    return null;
  }

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
      sponsored: optionalBoolean(item?.sponsored),
      smr: optionalBoolean(item?.smr),
      title: String(item?.title || '').trim(),
      imageUrl: String(item?.imageUrl || ''),
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

  function chooseInactivePowerSpot(objects) {
    return objects.find(item =>
      item.status === 'INACTIVE' &&
      item.entity === 'POWERSPOT' &&
      isSupportedBrand(item.gameBrand)
    ) || null;
  }

  function chooseInactiveSupported(objects) {
    return objects.find(item =>
      item.status === 'INACTIVE' &&
      ACTIVE_KINDS.has(item.entity) &&
      isSupportedBrand(item.gameBrand)
    ) || null;
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
    return chooseInactiveSupported(objects) ? 'INACTIVE' : 'UNKNOWN';
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
    const inactivePowerSpot = chooseInactivePowerSpot(objects);
    const inactiveSupported = chooseInactiveSupported(objects);

    let poiKind = 'NOT_IN_GAME';
    let gameStatus = inactiveStatus(objects);
    let reasonCode = 'NO_ACTIVE_SUPPORTED_GAME_OBJECT';
    let gameEntity = null;
    let referenceKind = 'NOT_IN_GAME';
    let metadataSource = inactiveSupported;

    if (active) {
      poiKind = active.entity;
      gameEntity = active.entity;
      gameStatus = 'ACTIVE';
      reasonCode = activeReason(active.entity);
      referenceKind = null;
      metadataSource = active;
    } else if (hasAmbiguousMetadata(parsedPoi, objects)) {
      poiKind = 'UNKNOWN';
      gameStatus = 'UNKNOWN';
      reasonCode = 'AMBIGUOUS_GAME_OBJECT';
      referenceKind = null;
      metadataSource = null;
    } else if (inactivePowerSpot) {
      gameEntity = 'POWERSPOT';
      gameStatus = 'INACTIVE';
      reasonCode = 'INACTIVE_POWERSPOT_REFERENCE';
      referenceKind = 'INACTIVE_POWERSPOT';
      metadataSource = inactivePowerSpot;
    }

    return {
      ...parsedPoi,
      title: String(parsedPoi.title || metadataSource?.title || ''),
      sponsored: optionalBoolean(parsedPoi.sponsored, metadataSource?.sponsored) === true,
      smr: optionalBoolean(parsedPoi.smr, metadataSource?.smr),
      imageUrl: String(parsedPoi.imageUrl || metadataSource?.imageUrl || ''),
      poiKind,
      classification: poiKind,
      gameEntity,
      gameStatus,
      referenceKind,
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
    run
  });
})();
