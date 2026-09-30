(() => {
  'use strict';

  const bridgeMapLab_existingRecordTypes = new Map([
    ['existing-pokestop', 'POKESTOP'],
    ['existing-gym', 'GYM'],
    ['existing-power', 'POWERSPOT']
  ]);

  function bridgeMapLab_existingDiagnostic(index, record, code, message) {
    return Object.freeze({
      index,
      id: typeof record?.id === 'string' ? record.id : null,
      guid: typeof record?.guid === 'string' ? record.guid : null,
      layer: typeof record?.layer === 'string' ? record.layer : null,
      code,
      message
    });
  }

  function bridgeMapLab_existingCoordinate(value, min, max) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  }

  function bridgeMapLab_existingState(record) {
    const layer = String(record.layer || '');
    if (layer === 'existing-power' && String(record.gameStatus || '').toUpperCase() === 'INACTIVE') {
      return Object.freeze({ state: 'NOT_IN_GAME', referenceKind: 'INACTIVE_POWERSPOT' });
    }
    return Object.freeze({ state: bridgeMapLab_existingRecordTypes.get(layer), referenceKind: null });
  }

  window.bridgeMapLab_adaptCreativeExistingRecords = function (records) {
    if (!Array.isArray(records)) throw new TypeError('records must be an array.');

    const pois = [];
    const diagnostics = [];
    const seenGuids = new Set();
    let existingRecords = 0;
    let ignoredCandidate = 0;
    let ignoredDeleted = 0;
    let ignoredOther = 0;

    records.forEach((record, index) => {
      if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        ignoredOther += 1;
        return;
      }

      const layer = record.layer;
      if (typeof layer === 'string' && layer.startsWith('new-')) {
        ignoredCandidate += 1;
        return;
      }
      if (!bridgeMapLab_existingRecordTypes.has(layer)) {
        ignoredOther += 1;
        return;
      }

      existingRecords += 1;
      if (record.deleted === true) {
        ignoredDeleted += 1;
        return;
      }

      const guid = String(record.guid || record.id || '').trim();
      if (!guid) {
        diagnostics.push(bridgeMapLab_existingDiagnostic(index, record, 'INVALID_ID', 'Existing POI requires guid or id.'));
        return;
      }
      if (!Array.isArray(record.latlng) || record.latlng.length < 2) {
        diagnostics.push(bridgeMapLab_existingDiagnostic(index, record, 'INVALID_LATLNG', 'Existing record.latlng must be [lat, lng].'));
        return;
      }

      const lat = record.latlng[0];
      const lng = record.latlng[1];
      if (!bridgeMapLab_existingCoordinate(lat, -90, 90)) {
        diagnostics.push(bridgeMapLab_existingDiagnostic(index, record, 'INVALID_LATITUDE', 'Existing latitude must be a finite number between -90 and 90.'));
        return;
      }
      if (!bridgeMapLab_existingCoordinate(lng, -180, 180)) {
        diagnostics.push(bridgeMapLab_existingDiagnostic(index, record, 'INVALID_LONGITUDE', 'Existing longitude must be a finite number between -180 and 180.'));
        return;
      }
      if (seenGuids.has(guid)) {
        diagnostics.push(bridgeMapLab_existingDiagnostic(index, record, 'DUPLICATE_ID', `Existing POI with guid/id "${guid}" already exists.`));
        return;
      }

      seenGuids.add(guid);
      const classification = bridgeMapLab_existingState(record);
      pois.push(Object.freeze({
        guid,
        lat,
        lng,
        state: classification.state,
        referenceKind: classification.referenceKind,
        sourceLayer: layer
      }));
    });

    return Object.freeze({
      pois: Object.freeze(pois),
      diagnostics: Object.freeze(diagnostics),
      counts: Object.freeze({
        records: records.length,
        existingRecords,
        output: pois.length,
        invalid: diagnostics.length,
        ignoredCandidate,
        ignoredDeleted,
        ignoredOther
      })
    });
  };
})();
