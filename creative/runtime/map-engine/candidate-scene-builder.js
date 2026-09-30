(() => {
  'use strict';

  const bridgeMapLab_candidateRenderKinds = Object.freeze({
    'new-pokestop': 'POKESTOP',
    'new-gym': 'GYM',
    'new-power': 'POWERSPOT'
  });
  const bridgeMapLab_candidateCircleRadii = Object.freeze([50, 40, 30]);

  function bridgeMapLab_candidateRenderKind(candidateType) {
    const renderKind = bridgeMapLab_candidateRenderKinds[candidateType];
    if (!renderKind) throw new TypeError(`Unsupported candidateType: ${candidateType}`);
    return renderKind;
  }

  function bridgeMapLab_candidateMarkerItem(entry) {
    const ownerKey = `candidate:${entry.candidateId}`;
    return Object.freeze({
      key: `marker:${ownerKey}`,
      itemType: 'marker',
      ownerKey,
      origin: 'candidate',
      renderKind: bridgeMapLab_candidateRenderKind(entry.candidateType),
      candidateType: entry.candidateType,
      layerKey: 'marker',
      geometry: entry.pointGeometry
    });
  }

  function bridgeMapLab_candidateCircleItem(entry, radiusMeters) {
    const ownerKey = `candidate:${entry.candidateId}`;
    const circleGeometry = entry.circleGeometries?.[radiusMeters];
    if (!circleGeometry) throw new Error(`Missing ${radiusMeters}m circle geometry for ${ownerKey}`);
    return Object.freeze({
      key: `circle${radiusMeters}:${ownerKey}`,
      itemType: 'circle',
      ownerKey,
      origin: 'candidate',
      renderKind: bridgeMapLab_candidateRenderKind(entry.candidateType),
      candidateType: entry.candidateType,
      layerKey: `circle-${radiusMeters}`,
      radiusMeters,
      geometry: circleGeometry
    });
  }

  function bridgeMapLab_candidateTypeVisible(candidateType, settings) {
    const visible = settings.candidateTypesVisible;
    if (!visible || typeof visible !== 'object') return true;
    return visible[candidateType] !== false;
  }

  function bridgeMapLab_visibleCircleRadii(settings) {
    if (Array.isArray(settings.circleRadiiVisible)) {
      const selected = new Set(settings.circleRadiiVisible.map(Number));
      return bridgeMapLab_candidateCircleRadii.filter((radius) => selected.has(radius));
    }
    return settings.circle50Visible === false ? [] : [50];
  }

  window.bridgeMapLab_buildSceneWithCandidates = function (
    stateLayerResult,
    existingGeometryLayerResult,
    candidateGeometryLayerResult,
    displaySettings
  ) {
    if (typeof window.bridgeMapLab_buildScene !== 'function') throw new Error('Existing Scene Builder is not available.');
    if (!candidateGeometryLayerResult || !Array.isArray(candidateGeometryLayerResult.entries)) {
      throw new TypeError('candidateGeometryLayerResult.entries must be an array.');
    }

    const settings = Object.assign({ circle50Visible: true }, displaySettings || {});
    const existingScene = window.bridgeMapLab_buildScene(stateLayerResult, existingGeometryLayerResult, settings);
    const candidateItems = [];
    const visibleCircleRadii = bridgeMapLab_visibleCircleRadii(settings);

    candidateGeometryLayerResult.entries.forEach((entry) => {
      if (!entry || typeof entry !== 'object') throw new TypeError('Candidate Geometry entry must be an object.');
      if (typeof entry.candidateId !== 'string' || entry.candidateId.trim() === '') throw new TypeError('Candidate Geometry entry must have candidateId.');
      if (!entry.pointGeometry) throw new Error(`Missing point geometry for candidate:${entry.candidateId}`);
      if (!bridgeMapLab_candidateTypeVisible(entry.candidateType, settings)) return;

      candidateItems.push(bridgeMapLab_candidateMarkerItem(entry));
      visibleCircleRadii.forEach((radiusMeters) => {
        candidateItems.push(bridgeMapLab_candidateCircleItem(entry, radiusMeters));
      });
    });

    return Object.freeze({ items: Object.freeze([...existingScene.items, ...candidateItems]) });
  };
})();
