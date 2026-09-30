(() => {
  'use strict';

  function bridgeMapLab_cloneCandidate(candidate) {
    return {
      id: candidate.id,
      lat: candidate.lat,
      lng: candidate.lng,
      candidateType: candidate.candidateType
    };
  }

  function bridgeMapLab_createCandidateRecordsRefreshStore(getRecords) {
    if (typeof getRecords !== 'function') {
      throw new TypeError('getRecords must be a function.');
    }
    if (typeof window.bridgeMapLab_adaptCreativeCandidateRecords !== 'function') {
      throw new Error('records Adapter is not available.');
    }

    const subscribers = new Set();
    let snapshot = [];
    let diagnostics = [];
    let counts = null;

    function readRecords() {
      const records = getRecords();
      if (!Array.isArray(records)) {
        throw new TypeError('getRecords() must return an array.');
      }
      return records;
    }

    function applyFromRecords() {
      const result = window.bridgeMapLab_adaptCreativeCandidateRecords(readRecords());
      snapshot = result.candidates.map(bridgeMapLab_cloneCandidate);
      diagnostics = result.diagnostics.map((item) => ({ ...item }));
      counts = { ...result.counts };
      return result;
    }

    function emitChange() {
      for (const callback of [...subscribers]) {
        try {
          callback();
        } catch (error) {
          console.error('[bridgeMapLab Candidate Refresh Store] subscriber failed', error);
        }
      }
    }

    function list() {
      return snapshot.map(bridgeMapLab_cloneCandidate);
    }

    function refresh() {
      applyFromRecords();
      emitChange();
      return list();
    }

    function subscribe(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('subscribe(callback) requires a function.');
      }
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }

    function getDiagnostics() {
      return diagnostics.map((item) => ({ ...item }));
    }

    function getCounts() {
      return counts ? { ...counts } : null;
    }

    applyFromRecords();

    return Object.freeze({
      list,
      refresh,
      subscribe,
      getDiagnostics,
      getCounts
    });
  }

  window.bridgeMapLab_createCandidateRecordsRefreshStore = bridgeMapLab_createCandidateRecordsRefreshStore;
})();
