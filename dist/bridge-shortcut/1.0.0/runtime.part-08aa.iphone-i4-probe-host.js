/* I4-3 page-world transport probe; inert until an explicit UI request. */
;(() => {
  'use strict';
  if (new URL(location.href).searchParams.get('cbsI4Probe') !== '1') return;
  function install() {
    if (window.__cbsI4ProbeInstalled) return;
    window.__cbsI4ProbeInstalled = true;
    document.addEventListener('cbs-i4:request', async event => {
      let msg;
      try { msg = JSON.parse(event.detail); } catch (_) { return; }
      if (!msg || typeof msg.requestId !== 'string') return;
      const reply = result => document.dispatchEvent(new CustomEvent('cbs-i4:result', {
        detail: JSON.stringify({ requestId: msg.requestId, result })
      }));
      const polygon = msg.polygon;
      if (!Array.isArray(polygon) || polygon.length < 3 || polygon.length > 30 ||
          !polygon.every(p => Number.isFinite(p?.lat) && Number.isFinite(p?.lng) &&
            Math.abs(p.lat) <= 90 && Math.abs(p.lng) <= 180)) {
        reply({ errorType: 'INVALID_POLYGON' }); return;
      }
      const lat = polygon.map(p => p.lat), lng = polygon.map(p => p.lng);
      if (Math.max(...lng) - Math.min(...lng) > 180) {
        reply({ errorType: 'ANTIMERIDIAN_UNSUPPORTED' }); return;
      }
      const query = 'ne=(' + Math.max(...lat) + ',' + Math.max(...lng) + ')' +
        '&sw=(' + Math.min(...lat) + ',' + Math.min(...lng) + ')&cellLevel=14';
      const started = performance.now();
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        let response;
        try {
          response = await fetch('/api/v1/vault/mapview/gcs?' + query, {
            credentials: 'include', cache: 'no-store', signal: controller.signal
          });
        } finally { clearTimeout(timer); }
        let jsonValid = false;
        if (response.ok) {
          try { await response.json(); jsonValid = true; } catch (_) {}
        }
        reply({ httpStatus: response.status, httpOk: response.ok, jsonValid,
          elapsedMs: Math.round(performance.now() - started),
          coverageComplete: null, sourceComplete: null,
          scope: 'bounding-box transport probe only' });
      } catch (error) {
        reply({ httpStatus: null, httpOk: false,
          errorType: error?.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_OR_AUTH',
          elapsedMs: Math.round(performance.now() - started),
          coverageComplete: null, sourceComplete: null });
      }
    });
  }
  const script = document.createElement('script');
  script.textContent = ';(' + install.toString() + ')();';
  (document.documentElement || document.head).appendChild(script);
  script.remove();
})();
