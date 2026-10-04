(() => {
  'use strict';

  const CHANGE = Object.freeze({
    NEW: 'NEW_POI',
    TITLE: 'TITLE_CHANGED',
    TYPE: 'TYPE_CHANGED',
    STATUS: 'STATUS_CHANGED',
    COORDINATE: 'COORDINATE_CHANGED',
    MISSING: 'MISSING'
  });
  const ABSENCE = Object.freeze({
    UNCONFIRMED: 'UNCONFIRMED',
    DELETE_CANDIDATE: 'DELETE_CANDIDATE'
  });
  const EARTH_RADIUS_METERS = 6371008.8;
  const COORDINATE_TOLERANCE_METERS = 0.5;

  function finite(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  function radians(value) { return value * Math.PI / 180; }
  function distanceMeters(a, b) {
    if (!a || !b) return Infinity;
    const lat1 = finite(a.lat), lng1 = finite(a.lng);
    const lat2 = finite(b.lat), lng2 = finite(b.lng);
    if (![lat1,lng1,lat2,lng2].every(Number.isFinite)) return Infinity;
    const p1 = radians(lat1), p2 = radians(lat2);
    const dLat = p2 - p1, dLng = radians(lng2 - lng1);
    const h = Math.sin(dLat/2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLng/2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function identity(poi) {
    return String(poi?.guid || poi?.poiId || poi?.id || '').trim();
  }
  function normalizedPoi(poi, zone) {
    const guid = identity(poi);
    if (!guid) return null;
    const lat = finite(poi?.lat ?? poi?.latitude);
    const lng = finite(poi?.lng ?? poi?.longitude);
    return Object.freeze({
      guid, zone,
      title: String(poi?.title ?? poi?.name ?? ''),
      type: String(poi?.gameEntity ?? poi?.poiKind ?? poi?.type ?? '').toUpperCase(),
      status: String(poi?.gameStatus ?? poi?.status ?? '').toUpperCase(),
      lat, lng, raw: poi
    });
  }
  function flattenObservation(observation) {
    const byGuid = new Map();
    const zones = observation?.zones && typeof observation.zones === 'object' ? observation.zones : {};
    for (const [key, zone] of [['interior','INTERIOR'],['reference100','REFERENCE_100'],['reserve200','RESERVE_200']]) {
      for (const poi of Array.isArray(zones[key]) ? zones[key] : []) {
        const normalized = normalizedPoi(poi, zone);
        if (normalized && !byGuid.has(normalized.guid)) byGuid.set(normalized.guid, normalized);
      }
    }
    return byGuid;
  }
  function remoteComplete(observation) {
    return observation?.acquisition?.coverageComplete === true;
  }
  function copyAbsenceCounts(value) {
    const source = value && typeof value === 'object' ? value : {};
    const result = {};
    for (const [guid, count] of Object.entries(source)) {
      const n = Number(count);
      if (guid && Number.isFinite(n) && n > 0) result[guid] = Math.floor(n);
    }
    return result;
  }
  function fieldChanges(base, remote) {
    const changes = [];
    if (base.title !== remote.title) changes.push(CHANGE.TITLE);
    if (base.type !== remote.type) changes.push(CHANGE.TYPE);
    if (base.status !== remote.status) changes.push(CHANGE.STATUS);
    if (distanceMeters(base, remote) > COORDINATE_TOLERANCE_METERS) changes.push(CHANGE.COORDINATE);
    return Object.freeze(changes);
  }
  function freezeArray(items) {
    return Object.freeze(items.map(item => Object.freeze(item)));
  }

  window.bridgeMapLab_diffWayfarerObservations = function(baseObservation, remoteObservation, options = {}) {
    const previousAbsenceCounts = copyAbsenceCounts(options.absenceCounts);
    if (!remoteComplete(remoteObservation)) {
      return Object.freeze({
        canApply:false, reason:'REMOTE_INCOMPLETE', remoteComplete:false,
        additions:Object.freeze([]), changes:Object.freeze([]), absences:Object.freeze([]),
        nextAbsenceCounts:Object.freeze(previousAbsenceCounts),
        summary:Object.freeze({added:0,changed:0,unconfirmed:0,deleteCandidates:0})
      });
    }
    const base = flattenObservation(baseObservation);
    const remote = flattenObservation(remoteObservation);
    const additions = [], changes = [], absences = [], nextAbsenceCounts = {};

    for (const [guid, remotePoi] of remote.entries()) {
      const basePoi = base.get(guid);
      if (!basePoi) {
        additions.push({guid,kind:CHANGE.NEW,remote:remotePoi});
        continue;
      }
      const categories = fieldChanges(basePoi, remotePoi);
      if (categories.length) changes.push({guid,categories,base:basePoi,remote:remotePoi});
    }
    for (const [guid, basePoi] of base.entries()) {
      if (remote.has(guid)) continue;
      const count = Math.max(0, Number(previousAbsenceCounts[guid] || 0)) + 1;
      nextAbsenceCounts[guid] = count;
      absences.push({
        guid, kind:CHANGE.MISSING, count,
        state:count >= 2 ? ABSENCE.DELETE_CANDIDATE : ABSENCE.UNCONFIRMED,
        base:basePoi
      });
    }
    const unconfirmed = absences.filter(item => item.state === ABSENCE.UNCONFIRMED).length;
    const deleteCandidates = absences.filter(item => item.state === ABSENCE.DELETE_CANDIDATE).length;
    return Object.freeze({
      canApply:true, reason:'DIFF_READY', remoteComplete:true,
      baseSnapshotId:String(baseObservation?.snapshotId || ''),
      remoteSnapshotId:String(remoteObservation?.snapshotId || ''),
      additions:freezeArray(additions),
      changes:freezeArray(changes),
      absences:freezeArray(absences),
      nextAbsenceCounts:Object.freeze(nextAbsenceCounts),
      summary:Object.freeze({added:additions.length,changed:changes.length,unconfirmed,deleteCandidates})
    });
  };
  window.bridgeMapLab_wayfarerDiffChangeTypes = CHANGE;
  window.bridgeMapLab_wayfarerAbsenceStates = ABSENCE;
})();