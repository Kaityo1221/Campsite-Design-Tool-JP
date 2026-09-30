(() => {
  'use strict';

  const bridgeMapLab_candidateRenderKinds = Object.freeze({
    'new-pokestop': 'POKESTOP',
    'new-gym': 'GYM',
    'new-power': 'POWERSPOT'
  });

  function bridgeMapLab_candidateRenderKind(candidateType) {
    const renderKind = bridgeMapLab_candidateRenderKinds[candidateType];
    if (!renderKind) throw new TypeError(`Unsupported candidateType: ${candidateType}`);
    return renderKind;
  }

  function bridgeMapLab_candidateMarkerItem(entry) {
    const ownerKey = `candidate:${entry.candidateId}`;
    return Object.freeze({ key:`marker:${ownerKey}`, itemType:'marker', ownerKey, origin:'candidate', renderKind:bridgeMapLab_candidateRenderKind(entry.candidateType), candidateType:entry.candidateType, layerKey:'marker', geometry:entry.pointGeometry });
  }

  function bridgeMapLab_candidateCircle50Item(entry) {
    const ownerKey = `candidate:${entry.candidateId}`;
    const circleGeometry = entry.circleGeometries?.[50];
    if (!circleGeometry) throw new Error(`Missing 50m circle geometry for ${ownerKey}`);
    return Object.freeze({ key:`circle50:${ownerKey}`, itemType:'circle', ownerKey, origin:'candidate', renderKind:bridgeMapLab_candidateRenderKind(entry.candidateType), candidateType:entry.candidateType, layerKey:'circle-50', geometry:circleGeometry });
  }

  window.bridgeMapLab_buildSceneWithCandidates = function (stateLayerResult, existingGeometryLayerResult, candidateGeometryLayerResult, displaySettings) {
    if (typeof window.bridgeMapLab_buildScene !== 'function') throw new Error('Existing Scene Builder is not available.');
    if (!candidateGeometryLayerResult || !Array.isArray(candidateGeometryLayerResult.entries)) throw new TypeError('candidateGeometryLayerResult.entries must be an array.');

    const settings = Object.assign({ circle50Visible: true }, displaySettings || {});
    const existingScene = window.bridgeMapLab_buildScene(stateLayerResult, existingGeometryLayerResult, settings);
    const candidateItems = [];

    candidateGeometryLayerResult.entries.forEach((entry) => {
      if (!entry || typeof entry !== 'object') throw new TypeError('Candidate Geometry entry must be an object.');
      if (typeof entry.candidateId !== 'string' || entry.candidateId.trim() === '') throw new TypeError('Candidate Geometry entry must have candidateId.');
      if (!entry.pointGeometry) throw new Error(`Missing point geometry for candidate:${entry.candidateId}`);
      candidateItems.push(bridgeMapLab_candidateMarkerItem(entry));
      if (settings.circle50Visible) candidateItems.push(bridgeMapLab_candidateCircle50Item(entry));
    });

    return Object.freeze({ items: Object.freeze([...existingScene.items, ...candidateItems]) });
  };
})();
