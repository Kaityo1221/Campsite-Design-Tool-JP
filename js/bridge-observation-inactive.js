(() => {
  'use strict';

  // Observations are read-only and must never be promoted into editable POIs
  // just to make a receiving counter accurate.
  function guidOf(raw) {
    return String(raw?.guid || raw?.poiId || raw?.sourceId || raw?.id || '').trim();
  }

  function normalizeInactive(raw, zone) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    if (String(raw.gameEntity || '').toUpperCase() !== 'POWERSPOT') return null;
    if (String(raw.gameStatus || '').toUpperCase() !== 'INACTIVE') return null;
    if (String(raw.referenceKind || '').toUpperCase() !== 'INACTIVE_POWERSPOT') return null;
    const guid = guidOf(raw);
    const lat = Number(raw.lat ?? raw.latitude);
    const lng = Number(raw.lng ?? raw.longitude);
    if (!guid || !Number.isFinite(lat) || !Number.isFinite(lng)
      || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return Object.freeze({
      guid, lat, lng,
      title: String(raw.title || raw.name || 'Inactive Power Spot'),
      zone, readOnly: true
    });
  }

  function collect(adapter) {
    const activeGuids = new Set(
      (Array.isArray(adapter?.pois) ? adapter.pois : []).map(guidOf).filter(Boolean)
    );
    const seen = new Set(activeGuids);
    const entries = [];
    const ingest = (raw, zone) => {
      const item = normalizeInactive(raw, zone);
      if (!item || seen.has(item.guid)) return;
      seen.add(item.guid);
      entries.push(item);
    };

    // Historical Bridge handoffs store the references in referencePois.
    for (const raw of Array.isArray(adapter?.referencePois) ? adapter.referencePois : []) {
      ingest(raw, 'LEGACY_REFERENCE');
    }

    // Confirmed-polygon handoffs intentionally store all three bands only in
    // wayfarerObservation. Never copy those items into records/currentPois.
    const zones = adapter?.wayfarerObservation?.zones;
    for (const [key, zone] of [
      ['interior', 'INTERIOR'],
      ['reference100', 'REFERENCE_100'],
      ['reserve200', 'RESERVE_200']
    ]) {
      for (const raw of Array.isArray(zones?.[key]) ? zones[key] : []) {
        ingest(raw, zone);
      }
    }
    const reserveCount = entries.filter(item => item.zone === 'RESERVE_200').length;
    return Object.freeze({
      count: entries.length,
      visibleCount: entries.length - reserveCount,
      reserveCount,
      entries: Object.freeze(entries)
    });
  }

  window.CampsiteBridgeInactiveObservation = Object.freeze({ collect });
})();