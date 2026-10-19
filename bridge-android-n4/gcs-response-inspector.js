(() => {
  'use strict';
  // Diagnostic-only shape checks. Nothing here can assert GCS source completeness.
  // Only anonymous counts and structural labels leave the transient tile handler.
  const MAX_NODES = 20000;
  const MAX_DEPTH = 14;
  const ARRAY_KEYS = new Set(['pois']);
  const TRUNCATION_KEYS = new Set([
    'hasMore','hasNext','hasNextPage','isTruncated','truncated',
    'moreResults','partialResult','partial','incomplete'
  ]);
  const CONTINUATION_KEYS = new Set([
    'nextPageToken','nextCursor','continuationToken','continuation','pageToken'
  ]);

  function inspect(body) {
    const invalid = reason => Object.freeze({
      valid:false, reason, sourceComplete:null,
      poiArrayCount:0, rawPoiCount:0, explicitIncomplete:false,
      shape:'invalid'
    });
    if (!body || typeof body !== 'object' || Array.isArray(body)) return invalid('NON_OBJECT');
    if (body.error || (Array.isArray(body.errors) && body.errors.length) ||
        body.success === false || String(body.status || '').toLowerCase() === 'error') {
      return invalid('ERROR_ENVELOPE');
    }

    const stack=[{value:body,depth:0}];
    const seen=new Set();
    let count=0, arrays=0, nodes=0;
    let explicitIncomplete=false;
    let exceeded=false;
    while (stack.length) {
      if (++nodes > MAX_NODES) { exceeded=true; break; }
      const {value,depth}=stack.pop();
      if (!value || typeof value!=='object') continue;
      if (seen.has(value)) continue;
      seen.add(value);
      if (depth > MAX_DEPTH) { exceeded=true; break; }
      if (Array.isArray(value)) {
        // Inspect containers, not individual POI content; never store POI data.
        for (const child of value) {
          if (child && typeof child === 'object') stack.push({value:child,depth:depth+1});
        }
        continue;
      }
      for (const [key,child] of Object.entries(value)) {
        if (ARRAY_KEYS.has(key) && Array.isArray(child)) {
          arrays += 1;
          count += child.length;
          continue;
        }
        if (TRUNCATION_KEYS.has(key) && child === true) explicitIncomplete=true;
        if (CONTINUATION_KEYS.has(key) &&
            typeof child === 'string' && child.trim().length > 0) explicitIncomplete=true;
        if (child && typeof child==='object') stack.push({value:child,depth:depth+1});
      }
    }
    if (exceeded) return invalid('SCAN_LIMIT');
    if (!arrays) return invalid('NO_POI_ARRAY');
    return Object.freeze({
      valid:!explicitIncomplete,
      reason:explicitIncomplete ? 'EXPLICIT_INCOMPLETE' : 'STRUCTURAL_ONLY',
      // API provenance/completeness semantics have not been proven. Never true.
      sourceComplete:null,
      poiArrayCount:arrays,
      rawPoiCount:count,
      explicitIncomplete,
      shape:'POI_ARRAYS'
    });
  }
  window.CampsiteBridgeAndroidN4GcsInspector=Object.freeze({inspect});
})();
