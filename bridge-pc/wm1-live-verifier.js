(() => {
  'use strict';

  const VERSION = '0.1.0';
  const TEST_TILE_SIZES = Object.freeze([null, 1000, 500]);

  function collectorApi() {
    const collector = window.CampsiteBridgePcCollector;
    if (!collector?.collectPolygon || !collector?.serializeBounds || !collector?.findMap) {
      throw new Error('WM-1 live verifier requires the PC collector.');
    }
    return collector;
  }

  function acquisitionApi() {
    const engine = window.CampsiteWayfarerAcquisitionEngine;
    if (!engine?.compareGuidSets) {
      throw new Error('WM-1 live verifier requires the acquisition engine.');
    }
    return engine;
  }

  function displayDiagnostics() {
    try {
      return window.CampsiteBridgeWayfarerDisplayOwner?.diagnose?.(document) || null;
    } catch (_) {
      return null;
    }
  }

  function polygonFromCurrentViewport() {
    const collector = collectorApi();
    const map = collector.findMap();
    if (!map) throw new Error('Wayfarer Mapを確認できませんでした。');
    const bounds = collector.serializeBounds(map);
    if (!bounds) throw new Error('Wayfarer Mapの表示範囲を取得できませんでした。');
    return {
      polygon: [
        [bounds.swLat, bounds.swLng],
        [bounds.swLat, bounds.neLng],
        [bounds.neLat, bounds.neLng],
        [bounds.neLat, bounds.swLng]
      ],
      viewport: bounds
    };
  }

  function guidsFrom(snapshot) {
    return (Array.isArray(snapshot?.enginePois) ? snapshot.enginePois : [])
      .map(item => ({ guid: String(item?.guid || '') }))
      .filter(item => item.guid);
  }

  function compactSnapshot(label, maxTileMeters, snapshot) {
    const enginePois = Array.isArray(snapshot?.enginePois) ? snapshot.enginePois : [];
    const active = Array.isArray(snapshot?.pois) ? snapshot.pois : [];
    const references = Array.isArray(snapshot?.referencePois) ? snapshot.referencePois : [];
    return {
      label,
      maxTileMeters,
      tileCount: Number(snapshot?.acquisition?.tileCount || 0),
      transportComplete: snapshot?.acquisition?.transportComplete === true,
      coverageStatus: String(snapshot?.acquisition?.coverageStatus || ''),
      guidCount: enginePois.length,
      activeCount: active.length,
      referenceCount: references.length,
      parserDuplicateCount: Number(snapshot?.parserStats?.duplicateCount || 0),
      parserFailedCount: Number(snapshot?.parserStats?.failedCount || 0),
      guids: guidsFrom(snapshot)
    };
  }

  function compareSnapshots(engine, left, right) {
    const comparison = engine.compareGuidSets(left.guids, right.guids);
    return {
      left: left.label,
      right: right.label,
      ...comparison
    };
  }

  async function run(options = {}) {
    const collector = collectorApi();
    const engine = acquisitionApi();
    const { polygon, viewport } = polygonFromCurrentViewport();
    const diagnostics = displayDiagnostics();
    const tileSizes = Array.isArray(options.tileSizes) && options.tileSizes.length
      ? options.tileSizes
      : TEST_TILE_SIZES;

    const snapshots = [];
    for (const maxTileMeters of tileSizes) {
      const label = maxTileMeters ? `split-${maxTileMeters}m` : 'single';
      const snapshot = await collector.collectPolygon(polygon, {
        bufferMeters: Number(options.bufferMeters ?? 200),
        maxTileMeters: maxTileMeters || undefined
      });
      snapshots.push(compactSnapshot(label, maxTileMeters, snapshot));
    }

    const comparisons = [];
    for (let i = 0; i < snapshots.length; i += 1) {
      for (let j = i + 1; j < snapshots.length; j += 1) {
        comparisons.push(compareSnapshots(engine, snapshots[i], snapshots[j]));
      }
    }

    const allTransportComplete = snapshots.every(item => item.transportComplete);
    const allGuidSetsEqual = comparisons.every(item => item.equal);
    const wfmmPresent = diagnostics?.map?.wfmmPresent === true;
    const wayfarerResolved = diagnostics?.map?.wayfarerResolved === true;
    const sourceConsistencyVerified =
      allTransportComplete &&
      snapshots.length >= 3 &&
      allGuidSetsEqual;

    const result = {
      version: VERSION,
      testedAt: new Date().toISOString(),
      bufferMeters: Number(options.bufferMeters ?? 200),
      viewportZoom: Number.isFinite(Number(viewport.zoom)) ? Number(viewport.zoom) : null,
      wfmm: {
        present: wfmmPresent,
        resolved: diagnostics?.map?.wfmmResolved === true
      },
      wayfarerMapResolved: wayfarerResolved,
      wfmmIndependentObserved:
        wayfarerResolved &&
        !wfmmPresent &&
        allTransportComplete &&
        snapshots.some(item => item.guidCount > 0),
      sourceConsistencyVerified,
      verdict: !allTransportComplete
        ? 'REQUEST_FAILURE'
        : !allGuidSetsEqual
          ? 'GUID_MISMATCH'
          : snapshots.every(item => item.guidCount === 0)
            ? 'ZERO_POI'
            : wfmmPresent
              ? 'CONSISTENT_WFMM_PRESENT'
              : 'CONSISTENT_WFMM_ABSENT',
      snapshots: snapshots.map(({ guids, ...item }) => item),
      comparisons
    };

    try {
      window.dispatchEvent(new CustomEvent('campsite-bridge-pc:wm1-live-result', {
        detail: JSON.stringify(result)
      }));
    } catch (_) {}

    return result;
  }

  window.CampsiteWayfarerWm1LiveVerifier = Object.freeze({
    version: VERSION,
    testTileSizes: [...TEST_TILE_SIZES],
    polygonFromCurrentViewport,
    run
  });
})();
