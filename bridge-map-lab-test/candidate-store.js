(() => {
  'use strict';

  const bridgeMapLab_candidateTypes = Object.freeze(new Set([
    'new-pokestop',
    'new-gym',
    'new-power'
  ]));

  function bridgeMapLab_validateCandidateId(id) {
    if (typeof id !== 'string' || id.trim() === '') {
      throw new TypeError('Candidate.id must be a non-empty string.');
    }
  }

  function bridgeMapLab_validateCoordinate(value, label, min, max) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
      throw new TypeError(`Candidate.${label} must be a finite number between ${min} and ${max}.`);
    }
  }

  function bridgeMapLab_validateCandidateType(candidateType) {
    if (!bridgeMapLab_candidateTypes.has(candidateType)) {
      throw new TypeError('Candidate.candidateType must be new-pokestop, new-gym, or new-power.');
    }
  }

  function bridgeMapLab_normalizeCandidate(candidate) {
    if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new TypeError('Candidate must be an object.');
    }

    const { id, lat, lng, candidateType } = candidate;
    bridgeMapLab_validateCandidateId(id);
    bridgeMapLab_validateCoordinate(lat, 'lat', -90, 90);
    bridgeMapLab_validateCoordinate(lng, 'lng', -180, 180);
    bridgeMapLab_validateCandidateType(candidateType);

    return Object.freeze({ id, lat, lng, candidateType });
  }

  function bridgeMapLab_cloneCandidate(candidate) {
    return {
      id: candidate.id,
      lat: candidate.lat,
      lng: candidate.lng,
      candidateType: candidate.candidateType
    };
  }

  function bridgeMapLab_createCandidateStore(initialCandidates = []) {
    if (!Array.isArray(initialCandidates)) {
      throw new TypeError('initialCandidates must be an array.');
    }

    const candidatesById = new Map();
    const subscribers = new Set();

    for (const initialCandidate of initialCandidates) {
      const normalized = bridgeMapLab_normalizeCandidate(initialCandidate);
      if (candidatesById.has(normalized.id)) {
        throw new Error(`Candidate with id "${normalized.id}" already exists.`);
      }
      candidatesById.set(normalized.id, normalized);
    }

    function emitChange() {
      for (const callback of [...subscribers]) {
        try {
          callback();
        } catch (error) {
          console.error('[bridgeMapLab Candidate Store] subscriber failed', error);
        }
      }
    }

    function list() {
      return [...candidatesById.values()].map(bridgeMapLab_cloneCandidate);
    }

    function add(candidate) {
      const normalized = bridgeMapLab_normalizeCandidate(candidate);
      if (candidatesById.has(normalized.id)) {
        throw new Error(`Candidate with id "${normalized.id}" already exists.`);
      }

      candidatesById.set(normalized.id, normalized);
      emitChange();
      return bridgeMapLab_cloneCandidate(normalized);
    }

    function remove(id) {
      bridgeMapLab_validateCandidateId(id);
      if (!candidatesById.has(id)) {
        throw new Error(`Candidate with id "${id}" does not exist.`);
      }

      candidatesById.delete(id);
      emitChange();
    }

    function move(id, lat, lng) {
      bridgeMapLab_validateCandidateId(id);
      bridgeMapLab_validateCoordinate(lat, 'lat', -90, 90);
      bridgeMapLab_validateCoordinate(lng, 'lng', -180, 180);

      const current = candidatesById.get(id);
      if (!current) {
        throw new Error(`Candidate with id "${id}" does not exist.`);
      }

      const moved = Object.freeze({
        id: current.id,
        lat,
        lng,
        candidateType: current.candidateType
      });
      candidatesById.set(id, moved);
      emitChange();
      return bridgeMapLab_cloneCandidate(moved);
    }

    function refresh() {
      emitChange();
    }

    function subscribe(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('subscribe(callback) requires a function.');
      }

      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    }

    return Object.freeze({
      list,
      add,
      remove,
      move,
      refresh,
      subscribe
    });
  }

  window.bridgeMapLab_createCandidateStore = bridgeMapLab_createCandidateStore;
})();
