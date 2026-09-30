(() => {
  'use strict';

  function bridgeMapLab_cloneExistingPoi(poi) {
    return {
      guid: poi.guid,
      lat: poi.lat,
      lng: poi.lng,
      state: poi.state,
      referenceKind: poi.referenceKind,
      sourceLayer: poi.sourceLayer
    };
  }

  window.bridgeMapLab_createExistingRecordsRefreshStore = function (getRecords) {
    if (typeof getRecords !== 'function') throw new TypeError('getRecords must be a function.');
    if (typeof window.bridgeMapLab_adaptCreativeExistingRecords !== 'function') throw new Error('Existing records Adapter is not available.');

    const subscribers = new Set();
    let snapshot = [];
    let diagnostics = [];
    let counts = null;

    function applyFromRecords() {
      const records = getRecords();
      if (!Array.isArray(records)) throw new TypeError('getRecords() must return an array.');
      const result = window.bridgeMapLab_adaptCreativeExistingRecords(records);
      snapshot = result.pois.map(bridgeMapLab_cloneExistingPoi);
      diagnostics = result.diagnostics.map((item) => ({ ...item }));
      counts = { ...result.counts };
    }

    function emitChange() {
      for (const callback of [...subscribers]) {
        try { callback(); } catch (error) { console.error('[bridgeMapLab Existing Refresh Store] subscriber failed', error); }
      }
    }

    function list() { return snapshot.map(bridgeMapLab_cloneExistingPoi); }
    function refresh() { applyFromRecords(); emitChange(); return list(); }
    function subscribe(callback) {
      if (typeof callback !== 'function') throw new TypeError('subscribe(callback) requires a function.');
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    }
    function getDiagnostics() { return diagnostics.map((item) => ({ ...item })); }
    function getCounts() { return counts ? { ...counts } : null; }

    applyFromRecords();
    return Object.freeze({ list, refresh, subscribe, getDiagnostics, getCounts });
  };
})();
