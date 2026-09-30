(() => {
  'use strict';

  const bridgeMapLab_candidateTypes = new Set([
    'new-pokestop',
    'new-gym',
    'new-power'
  ]);

  const bridgeMapLab_existingTypes = new Set([
    'existing-pokestop',
    'existing-gym',
    'existing-power'
  ]);

  function bridgeMapLab_diagnostic(index, record, code, message) {
    return Object.freeze({
      index,
      id: typeof record?.id === 'string' ? record.id : null,
      candidateType: typeof record?.layer === 'string' ? record.layer : null,
      code,
      message
    });
  }

  function bridgeMapLab_validCoordinate(value, min, max) {
    return typeof value === 'number'
      && Number.isFinite(value)
      && value >= min
      && value <= max;
  }

  function bridgeMapLab_adaptCreativeCandidateRecords(records) {
    if (!Array.isArray(records)) {
      throw new TypeError('records must be an array.');
    }

    const candidates = [];
    const diagnostics = [];
    const seenIds = new Set();
    let candidateRecords = 0;
    let ignoredExisting = 0;
    let ignoredDeleted = 0;
    let ignoredOther = 0;

    records.forEach((record, index) => {
      if (record === null || typeof record !== 'object' || Array.isArray(record)) {
        ignoredOther += 1;
        return;
      }

      const layer = record.layer;
      if (bridgeMapLab_existingTypes.has(layer)) {
        ignoredExisting += 1;
        return;
      }

      const looksLikeCandidate = typeof layer === 'string' && layer.startsWith('new-');
      if (!looksLikeCandidate) {
        ignoredOther += 1;
        return;
      }

      candidateRecords += 1;

      if (record.deleted === true) {
        ignoredDeleted += 1;
        return;
      }

      if (!bridgeMapLab_candidateTypes.has(layer)) {
        diagnostics.push(bridgeMapLab_diagnostic(
          index,
          record,
          'UNKNOWN_CANDIDATE_TYPE',
          'candidateType must be new-pokestop, new-gym, or new-power.'
        ));
        return;
      }

      if (typeof record.id !== 'string' || record.id.trim() === '') {
        diagnostics.push(bridgeMapLab_diagnostic(
          index,
          record,
          'INVALID_ID',
          'Candidate.id must be a non-empty string.'
        ));
        return;
      }

      if (!Array.isArray(record.latlng) || record.latlng.length < 2) {
        diagnostics.push(bridgeMapLab_diagnostic(
          index,
          record,
          'INVALID_LATLNG',
          'Candidate record.latlng must be [lat, lng].'
        ));
        return;
      }

      const lat = record.latlng[0];
      const lng = record.latlng[1];

      if (!bridgeMapLab_validCoordinate(lat, -90, 90)) {
        diagnostics.push(bridgeMapLab_diagnostic(
          index,
          record,
          'INVALID_LATITUDE',
          'Candidate latitude must be a finite number between -90 and 90.'
        ));
        return;
      }

      if (!bridgeMapLab_validCoordinate(lng, -180, 180)) {
        diagnostics.push(bridgeMapLab_diagnostic(
          index,
          record,
          'INVALID_LONGITUDE',
          'Candidate longitude must be a finite number between -180 and 180.'
        ));
        return;
      }

      if (seenIds.has(record.id)) {
        diagnostics.push(bridgeMapLab_diagnostic(
          index,
          record,
          'DUPLICATE_ID',
          `Candidate with id "${record.id}" already exists.`
        ));
        return;
      }

      seenIds.add(record.id);
      candidates.push({
        id: record.id,
        lat,
        lng,
        candidateType: layer
      });
    });

    return {
      candidates,
      diagnostics,
      counts: Object.freeze({
        records: records.length,
        candidateRecords,
        output: candidates.length,
        invalid: diagnostics.length,
        ignoredExisting,
        ignoredDeleted,
        ignoredOther
      })
    };
  }

  window.bridgeMapLab_adaptCreativeCandidateRecords = bridgeMapLab_adaptCreativeCandidateRecords;
})();
