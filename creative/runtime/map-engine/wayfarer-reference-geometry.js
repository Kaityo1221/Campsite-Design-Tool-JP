(() => {
  'use strict';

  function validCoordinate(value, min, max) {
    return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
  }

  function validatePoi(poi, index) {
    if (!poi || typeof poi !== 'object' || Array.isArray(poi)) {
      throw new TypeError(`Reference POI at index ${index} must be an object.`);
    }
    if (typeof poi.guid !== 'string' || poi.guid.trim() === '') {
      throw new TypeError(`Reference POI at index ${index} must have guid.`);
    }
    if (!validCoordinate(poi.lat, -90, 90) || !validCoordinate(poi.lng, -180, 180)) {
      throw new TypeError(`Reference POI "${poi.guid}" has invalid coordinates.`);
    }
    if (!['INTERIOR', 'REFERENCE_100'].includes(poi.observationZone)) {
      throw new TypeError(`Reference POI "${poi.guid}" has invalid observationZone.`);
    }
  }

  window.bridgeMapLab_buildWayfarerReferenceGeometry = function (referencePois) {
    if (!Array.isArray(referencePois)) throw new TypeError('referencePois must be an array.');

    const entries = referencePois.map((poi, index) => {
      validatePoi(poi, index);
      const ownerKey = `reference:${poi.guid}`;
      return Object.freeze({
        guid: poi.guid,
        ownerKey,
        renderKind: poi.renderKind,
        observationZone: poi.observationZone,
        readOnly: true,
        pointGeometry: Object.freeze({ type: 'point', lat: poi.lat, lng: poi.lng }),
        circle50Geometry: Object.freeze({ type: 'circle', lat: poi.lat, lng: poi.lng, radiusMeters: 50 })
      });
    });

    return Object.freeze({ entries: Object.freeze(entries) });
  };
})();
