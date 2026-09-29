(() => {
  'use strict';

  function bridgeMapLab_isValidFixturePoi(poi) {
    return poi !== null
      && typeof poi === 'object'
      && typeof poi.guid === 'string'
      && poi.guid.length > 0
      && typeof poi.lat === 'number'
      && Number.isFinite(poi.lat)
      && poi.lat >= -90
      && poi.lat <= 90
      && typeof poi.lng === 'number'
      && Number.isFinite(poi.lng)
      && poi.lng >= -180
      && poi.lng <= 180;
  }

  window.bridgeMapLab_buildDataLayer = function (fixture) {
    const validPois = fixture.filter(bridgeMapLab_isValidFixturePoi);
    const seenGuids = new Set();
    const normalizedPois = [];
    let duplicateCount = 0;

    validPois.forEach((poi) => {
      if (seenGuids.has(poi.guid)) {
        duplicateCount += 1;
        return;
      }

      seenGuids.add(poi.guid);
      normalizedPois.push(Object.freeze({
        guid: poi.guid,
        lat: poi.lat,
        lng: poi.lng
      }));
    });

    return Object.freeze({
      pois: Object.freeze(normalizedPois),
      counts: Object.freeze({
        raw: fixture.length,
        invalid: fixture.length - validPois.length,
        duplicate: duplicateCount,
        output: normalizedPois.length
      })
    });
  };
})();
