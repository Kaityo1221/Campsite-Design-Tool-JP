(() => {
  'use strict';

  const bridgeMapLab_supportedStates = Object.freeze([
    'POKESTOP',
    'GYM',
    'POWERSPOT',
    'NOT_IN_GAME',
    'UNKNOWN'
  ]);
  const bridgeMapLab_supportedReferenceKinds = Object.freeze([
    'NOT_IN_GAME',
    'INACTIVE_POWERSPOT'
  ]);
  const bridgeMapLab_statePriority = Object.freeze({
    POWERSPOT: 1,
    POKESTOP: 2,
    GYM: 3
  });

  function bridgeMapLab_isCompatibleGameBrand(gameBrand) {
    return gameBrand === 'HOLOHOLO'
      || gameBrand === ''
      || gameBrand === undefined;
  }

  function bridgeMapLab_isActiveCompatible(sourceGameObject) {
    return sourceGameObject !== null
      && typeof sourceGameObject === 'object'
      && sourceGameObject.status === 'ACTIVE'
      && Object.hasOwn(bridgeMapLab_statePriority, sourceGameObject.entity)
      && bridgeMapLab_isCompatibleGameBrand(sourceGameObject.gameBrand);
  }

  function bridgeMapLab_isInactivePowerSpotCompatible(sourceGameObject) {
    return sourceGameObject !== null
      && typeof sourceGameObject === 'object'
      && sourceGameObject.entity === 'POWERSPOT'
      && sourceGameObject.status === 'INACTIVE'
      && bridgeMapLab_isCompatibleGameBrand(sourceGameObject.gameBrand);
  }

  function bridgeMapLab_hasAmbiguousGameMetadata(sourceGameObjects) {
    return sourceGameObjects.some((sourceGameObject) => sourceGameObject === null
      || typeof sourceGameObject !== 'object'
      || sourceGameObject.malformed === true
      || typeof sourceGameObject.entity !== 'string'
      || typeof sourceGameObject.status !== 'string'
      || (sourceGameObject.gameBrand !== undefined && typeof sourceGameObject.gameBrand !== 'string'));
  }

  function bridgeMapLab_selectActiveState(sourceGameObjects) {
    return sourceGameObjects.reduce((state, sourceGameObject) => {
      if (!bridgeMapLab_isActiveCompatible(sourceGameObject)) return state;
      if (state === 'UNKNOWN') return sourceGameObject.entity;
      return bridgeMapLab_statePriority[sourceGameObject.entity] > bridgeMapLab_statePriority[state]
        ? sourceGameObject.entity
        : state;
    }, 'UNKNOWN');
  }

  function bridgeMapLab_classifyPoi(poi) {
    const sourceGameObjects = poi.sourceGameObjects;
    if (!Array.isArray(sourceGameObjects)) {
      return Object.freeze({ state: 'UNKNOWN', referenceKind: null });
    }

    const activeState = bridgeMapLab_selectActiveState(sourceGameObjects);
    if (activeState !== 'UNKNOWN') {
      return Object.freeze({ state: activeState, referenceKind: null });
    }

    if (bridgeMapLab_hasAmbiguousGameMetadata(sourceGameObjects)) {
      return Object.freeze({ state: 'UNKNOWN', referenceKind: null });
    }

    const hasInactivePowerSpot = sourceGameObjects.some(bridgeMapLab_isInactivePowerSpotCompatible);
    if (hasInactivePowerSpot) {
      return Object.freeze({
        state: 'NOT_IN_GAME',
        referenceKind: 'INACTIVE_POWERSPOT'
      });
    }

    return Object.freeze({
      state: 'NOT_IN_GAME',
      referenceKind: 'NOT_IN_GAME'
    });
  }

  window.bridgeMapLab_buildStateLayer = function (dataLayerResult) {
    const counts = Object.fromEntries(bridgeMapLab_supportedStates.map((state) => [state, 0]));
    const referenceCounts = Object.fromEntries(
      bridgeMapLab_supportedReferenceKinds.map((referenceKind) => [referenceKind, 0])
    );
    const statePois = dataLayerResult.pois.map((poi) => {
      const classification = bridgeMapLab_classifyPoi(poi);
      counts[classification.state] += 1;
      if (classification.referenceKind !== null) {
        referenceCounts[classification.referenceKind] += 1;
      }

      return Object.freeze({
        guid: poi.guid,
        lat: poi.lat,
        lng: poi.lng,
        sourceGameObjects: poi.sourceGameObjects,
        state: classification.state,
        referenceKind: classification.referenceKind
      });
    });

    return Object.freeze({
      pois: Object.freeze(statePois),
      counts: Object.freeze(counts),
      referenceCounts: Object.freeze(referenceCounts)
    });
  };
})();
