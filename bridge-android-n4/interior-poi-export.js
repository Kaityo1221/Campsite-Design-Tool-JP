(() => {
  'use strict';

  // The *observed entire polygon*, not the last visible UI SYNC_STATE, is the
  // exclusive source of editable Bridge POIs. Never send reference/reserve.
  const ACTIVE_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const ALLOWED_PROVENANCE = new Set(['WAYFARER_PASSIVE', 'WFMM_CACHE', 'BRIDGE_ENRICHMENT']);

  function fromObservation(observation) {
    if (observation?.canProceed !== true ||
        observation?.acquisition?.coverageComplete !== true) return [];
    const interior = observation?.zones?.interior;
    if (!Array.isArray(interior)) return [];
    const unique = new Map();
    for (const raw of interior) {
      if (!raw || typeof raw !== 'object' || raw.bridgeEligible !== true) continue;
      const entity = String(raw.gameEntity || raw.poiKind || '').trim().toUpperCase();
      if (!ACTIVE_ENTITIES.has(entity) ||
          String(raw.gameStatus || '').trim().toUpperCase() !== 'ACTIVE') continue;
      const guid = String(raw.guid || raw.poiId || '').trim();
      const lat = Number(raw.lat);
      const lng = Number(raw.lng);
      if (!guid || !Number.isFinite(lat) || !Number.isFinite(lng) ||
          Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
      const provenance = (Array.isArray(raw.provenance) ? raw.provenance : [])
        .map(v => String(v || '').trim().toUpperCase())
        .filter(v => ALLOWED_PROVENANCE.has(v));
      if (!provenance.length) provenance.push('WAYFARER_PASSIVE');
      if (!unique.has(guid)) unique.set(guid, {
        guid, title: String(raw.title || ''), lat, lng,
        gameEntity: entity, gameStatus: 'ACTIVE', sponsored: raw.sponsored === true,
        smr: raw.smr === true ? true : raw.smr === false ? false : null,
        imageUrl: String(raw.imageUrl || ''), description: String(raw.description || ''),
        s2L14: String(raw.s2L14 || ''), s2L17: String(raw.s2L17 || ''),
        provenance: [...new Set(provenance)]
      });
    }
    return [...unique.values()];
  }

  window.CampsiteBridgeAndroidN4InteriorExporter = Object.freeze({ fromObservation });
})();
