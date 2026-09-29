(() => {
  'use strict';

  const bridgeMapLab_supportedStates = Object.freeze([
    'POKESTOP',
    'GYM',
    'POWERSPOT',
    'UNKNOWN'
  ]);
  const bridgeMapLab_statePriority = Object.freeze({
    POWERSPOT: 1,
    POKESTOP: 2,
    GYM: 3
  });

  function bridgeMapLab_isActiveCompatible(sourceGameObject) {
    return sourceGameObject !== null
      && typeof sourceGameObject === 'object'
      && sourceGameObject.status === 'ACTIVE'
      && Object.hasOwn(bridgeMapLab_statePriority, sourceGameObject.entity)
      && (sourceGameObject.gameBrand === 'HOLOHOLO'
        || sourceGameObject.gameBrand === ''
        || sourceGameObject.gameBrand === undefined);
  }

  function bridgeMapLab_classifyPoi(poi) {
    if (!Array.isArray(poi.sourceGameObjects)) return 'UNKNOWN';

    return poi.sourceGameObjects.reduce((state, sourceGameObject) => {
      if (!bridgeMapLab_isActiveCompatible(sourceGameObject)) return state;
      if (state === 'UNKNOWN') return sourceGameObject.entity;
      return bridgeMapLab_statePriority[sourceGameObject.entity] > bridgeMapLab_statePriority[state]
        ? sourceGameObject.entity
        : state;
    }, 'UNKNOWN');
  }

  window.bridgeMapLab_buildStateLayer = function (dataLayerResult) {
    const counts = Object.fromEntries(bridgeMapLab_supportedStates.map((state) => [state, 0]));
    const statePois = dataLayerResult.pois.map((poi) => {
      const state = bridgeMapLab_classifyPoi(poi);
      counts[state] += 1;

      return Object.freeze({
        guid: poi.guid,
        lat: poi.lat,
        lng: poi.lng,
        sourceGameObjects: poi.sourceGameObjects,
        state
      });
    });

    return Object.freeze({
      pois: Object.freeze(statePois),
      counts: Object.freeze(counts)
    });
  };
})();
