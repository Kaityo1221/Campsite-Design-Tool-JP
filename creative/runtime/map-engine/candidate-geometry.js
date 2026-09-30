(() => {
  'use strict';

  const bridgeMapLab_candidateCircleRadiiMeters = Object.freeze([50, 40, 30]);

  function bridgeMapLab_buildCandidatePointGeometry(candidate) {
    return Object.freeze({
      type: 'point',
      lat: candidate.lat,
      lng: candidate.lng
    });
  }

  function bridgeMapLab_buildCandidateCircleGeometry(candidate, radiusMeters) {
    return Object.freeze({
      type: 'circle',
      lat: candidate.lat,
      lng: candidate.lng,
      radiusMeters
    });
  }

  function bridgeMapLab_validateCandidateGeometryInput(candidate, index) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new TypeError(`Candidate at index ${index} must be an object.`);
    }
    if (typeof candidate.id !== 'string' || candidate.id.trim() === '') {
      throw new TypeError(`Candidate at index ${index} must have a non-empty id.`);
    }
    if (typeof candidate.lat !== 'number' || !Number.isFinite(candidate.lat) || candidate.lat < -90 || candidate.lat > 90) {
      throw new TypeError(`Candidate "${candidate.id}" has invalid latitude.`);
    }
    if (typeof candidate.lng !== 'number' || !Number.isFinite(candidate.lng) || candidate.lng < -180 || candidate.lng > 180) {
      throw new TypeError(`Candidate "${candidate.id}" has invalid longitude.`);
    }
    if (!['new-pokestop', 'new-gym', 'new-power'].includes(candidate.candidateType)) {
      throw new TypeError(`Candidate "${candidate.id}" has invalid candidateType.`);
    }
  }

  window.bridgeMapLab_buildCandidateGeometry = function (candidates) {
    if (!Array.isArray(candidates)) {
      throw new TypeError('candidates must be an array.');
    }

    const entries = candidates.map((candidate, index) => {
      bridgeMapLab_validateCandidateGeometryInput(candidate, index);
      const circleGeometries = {};
      bridgeMapLab_candidateCircleRadiiMeters.forEach((radiusMeters) => {
        circleGeometries[radiusMeters] = bridgeMapLab_buildCandidateCircleGeometry(candidate, radiusMeters);
      });
      return Object.freeze({
        candidateId: candidate.id,
        candidateType: candidate.candidateType,
        pointGeometry: bridgeMapLab_buildCandidatePointGeometry(candidate),
        circleGeometries: Object.freeze(circleGeometries)
      });
    });

    return Object.freeze({ entries: Object.freeze(entries) });
  };
})();
