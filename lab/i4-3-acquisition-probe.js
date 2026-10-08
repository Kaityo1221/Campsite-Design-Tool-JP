/* I4-3 isolated diagnostic. Not included in the production Shortcut bundle.
 * Must be explicitly loaded and invoked in the authenticated Wayfarer page world.
 * Never records payloads, POI data, credentials, or response headers.
 */
;(() => {
  'use strict';
  if (window.CampsiteI4AcquisitionProbe) return;
  const ENDPOINT = '/api/v1/vault/mapview/gcs';
  const isFiniteCoord = p => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
    && Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180;
  const bbox = polygon => {
    if (!Array.isArray(polygon) || polygon.length < 3 || polygon.length > 30 ||
        !polygon.every(isFiniteCoord)) throw new Error('INVALID_POLYGON');
    const lats = polygon.map(p => p.lat);
    const lngs = polygon.map(p => p.lng);
    const south = Math.min(...lats), north = Math.max(...lats);
    const west = Math.min(...lngs), east = Math.max(...lngs);
    if (east - west > 180) throw new Error('ANTIMERIDIAN_UNSUPPORTED');
    return { south, north, west, east };
  };
  async function run({ polygon, signal } = {}) {
    const bounds = bbox(polygon);
    const params = new URLSearchParams({
      ne: '(' + bounds.north + ',' + bounds.east + ')',
      sw: '(' + bounds.south + ',' + bounds.west + ')',
      cellLevel: '14'
    });
    const started = performance.now();
    try {
      const response = await fetch(ENDPOINT + '?' + params.toString(), {
        credentials: 'include', cache: 'no-store', signal
      });
      let jsonValid = false;
      let topLevelKind = 'unread';
      if (response.ok) {
        try {
          const payload = await response.json();
          jsonValid = true;
          topLevelKind = Array.isArray(payload) ? 'array' :
            payload === null ? 'null' : typeof payload;
        } catch (_) { topLevelKind = 'invalid-json'; }
      }
      return Object.freeze({
        httpStatus: response.status, httpOk: response.ok, jsonValid,
        topLevelKind, elapsedMs: Math.round(performance.now() - started),
        coverageComplete: null, sourceComplete: null,
        note: 'Diagnostic bounding-box request only; NOT polygon+200m coverage.'
      });
    } catch (error) {
      return Object.freeze({
        httpStatus: null, httpOk: false, jsonValid: false,
        errorType: error?.name === 'AbortError' ? 'ABORTED' : 'NETWORK_OR_AUTH',
        elapsedMs: Math.round(performance.now() - started),
        coverageComplete: null, sourceComplete: null
      });
    }
  }
  Object.defineProperty(window, 'CampsiteI4AcquisitionProbe', {
    value: Object.freeze({ run }), configurable: true
  });
})();
