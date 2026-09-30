(() => {
  'use strict';

  const bridgeMapLab_existingCircleRadiiMeters = Object.freeze([50, 40, 30]);

  function bridgeMapLab_existingPointGeometry(poi) {
    return Object.freeze({ type: 'point', lat: poi.lat, lng: poi.lng });
  }

  function bridgeMapLab_existingCircleGeometry(poi, radiusMeters) {
    return Object.freeze({ type: 'circle', lat: poi.lat, lng: poi.lng, radiusMeters });
  }

  window.bridgeMapLab_buildExistingGeometry = function (pois) {
    if (!Array.isArray(pois)) throw new TypeError('existing pois must be an array.');
    return Object.freeze({
      entries: Object.freeze(pois.map((poi, index) => {
        if (!poi || typeof poi !== 'object') throw new TypeError(`Existing POI at index ${index} must be an object.`);
        const guid = String(poi.guid || '').trim();
        if (!guid) throw new TypeError(`Existing POI at index ${index} requires guid.`);
        if (typeof poi.lat !== 'number' || !Number.isFinite(poi.lat) || poi.lat < -90 || poi.lat > 90) throw new TypeError(`Existing POI "${guid}" has invalid latitude.`);
        if (typeof poi.lng !== 'number' || !Number.isFinite(poi.lng) || poi.lng < -180 || poi.lng > 180) throw new TypeError(`Existing POI "${guid}" has invalid longitude.`);
        const circleGeometries = {};
        bridgeMapLab_existingCircleRadiiMeters.forEach((radiusMeters) => {
          circleGeometries[radiusMeters] = bridgeMapLab_existingCircleGeometry(poi, radiusMeters);
        });
        return Object.freeze({
          ownerKey: `poi:${guid}`,
          pointGeometry: bridgeMapLab_existingPointGeometry(poi),
          circleGeometries: Object.freeze(circleGeometries)
        });
      }))
    });
  };
})();
