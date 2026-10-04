(() => {
  'use strict';

  const DISPLAY_ZONES = Object.freeze(['INTERIOR', 'REFERENCE_100']);
  const ALL_ZONES = Object.freeze(['INTERIOR', 'REFERENCE_100', 'RESERVE_200']);
  const ZONE_INPUT_KEYS = Object.freeze({
    INTERIOR: 'interior',
    REFERENCE_100: 'reference100',
    RESERVE_200: 'reserve200'
  });

  function diagnostic(zone, index, raw, code, message) {
    return Object.freeze({
      zone,
      index,
      guid: typeof raw?.guid === 'string' ? raw.guid : typeof raw?.poiId === 'string' ? raw.poiId : null,
      code,
      message
    });
  }

  function finiteCoordinate(value, min, max) {
    const number = Number(value);
    return Number.isFinite(number) && number >= min && number <= max ? number : null;
  }

  function stableGuid(raw) {
    return String(raw?.guid || raw?.poiId || '').trim();
  }

  function renderKind(raw) {
    const kind = String(raw?.poiKind || '').trim().toUpperCase();
    const entity = String(raw?.gameEntity || '').trim().toUpperCase();
    const status = String(raw?.gameStatus || '').trim().toUpperCase();
    const referenceKind = String(raw?.referenceKind || '').trim().toUpperCase();

    if (status === 'ACTIVE' && kind === 'POKESTOP') return 'POKESTOP';
    if (status === 'ACTIVE' && kind === 'GYM') return 'GYM';
    if (status === 'ACTIVE' && kind === 'POWERSPOT') return 'POWERSPOT';
    if (status === 'INACTIVE' && entity === 'POWERSPOT' && referenceKind === 'INACTIVE_POWERSPOT') {
      return 'INACTIVE_POWERSPOT';
    }
    return null;
  }

  function editableGuidSet(records) {
    const result = new Set();
    for (const record of Array.isArray(records) ? records : []) {
      if (!record || typeof record !== 'object' || record.deleted === true) continue;
      if (!String(record.layer || '').startsWith('existing-')) continue;
      const guid = String(record.guid || record.id || '').trim();
      if (guid) result.add(guid);
    }
    return result;
  }

  function cloneReferencePoi(raw, guid, lat, lng, kind, zone) {
    return Object.freeze({
      guid,
      title: String(raw?.title || ''),
      lat,
      lng,
      renderKind: kind,
      observationZone: zone,
      readOnly: true,
      source: 'wayfarer-observation'
    });
  }

  function adaptWayfarerObservation(observation, editableRecords) {
    if (!observation || typeof observation !== 'object' || Array.isArray(observation)) {
      throw new TypeError('wayfarerObservation must be an object.');
    }
    const zones = observation.zones;
    if (!zones || typeof zones !== 'object' || Array.isArray(zones)) {
      throw new TypeError('wayfarerObservation.zones must be an object.');
    }

    const editableGuids = editableGuidSet(editableRecords);
    const displayPois = [];
    const reservePois = [];
    const suppressedByEditableGuid = [];
    const diagnostics = [];
    const seenGuids = new Set();
    const zoneCounts = { INTERIOR: 0, REFERENCE_100: 0, RESERVE_200: 0 };

    for (const zone of ALL_ZONES) {
      const key = ZONE_INPUT_KEYS[zone];
      const list = zones[key];
      if (!Array.isArray(list)) {
        throw new TypeError(`wayfarerObservation.zones.${key} must be an array.`);
      }

      list.forEach((raw, index) => {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
          diagnostics.push(diagnostic(zone, index, raw, 'INVALID_POI', 'Observation POI must be an object.'));
          return;
        }

        const guid = stableGuid(raw);
        if (!guid) {
          diagnostics.push(diagnostic(zone, index, raw, 'INVALID_GUID', 'Observation POI requires guid or poiId.'));
          return;
        }
        if (seenGuids.has(guid)) {
          diagnostics.push(diagnostic(zone, index, raw, 'DUPLICATE_GUID', `Observation POI "${guid}" appears more than once.`));
          return;
        }
        seenGuids.add(guid);

        const lat = finiteCoordinate(raw.lat ?? raw.latitude, -90, 90);
        const lng = finiteCoordinate(raw.lng ?? raw.longitude, -180, 180);
        if (lat === null || lng === null) {
          diagnostics.push(diagnostic(zone, index, raw, 'INVALID_COORDINATE', 'Observation POI requires valid latitude and longitude.'));
          return;
        }

        const kind = renderKind(raw);
        if (!kind) {
          diagnostics.push(diagnostic(zone, index, raw, 'UNSUPPORTED_POI_STATE', 'Observation POI is not a supported Pokémon GO state.'));
          return;
        }

        const poi = cloneReferencePoi(raw, guid, lat, lng, kind, zone);
        zoneCounts[zone] += 1;

        if (editableGuids.has(guid)) {
          suppressedByEditableGuid.push(poi);
          return;
        }

        if (DISPLAY_ZONES.includes(zone)) displayPois.push(poi);
        else reservePois.push(poi);
      });
    }

    return Object.freeze({
      displayPois: Object.freeze(displayPois),
      reservePois: Object.freeze(reservePois),
      suppressedByEditableGuid: Object.freeze(suppressedByEditableGuid),
      diagnostics: Object.freeze(diagnostics),
      counts: Object.freeze({
        interior: zoneCounts.INTERIOR,
        reference100: zoneCounts.REFERENCE_100,
        reserve200: zoneCounts.RESERVE_200,
        display: displayPois.length,
        retainedReserve: reservePois.length,
        suppressedByEditableGuid: suppressedByEditableGuid.length,
        invalid: diagnostics.length
      })
    });
  }

  window.bridgeMapLab_adaptWayfarerObservation = adaptWayfarerObservation;
})();
