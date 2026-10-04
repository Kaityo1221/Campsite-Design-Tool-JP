(() => {
  'use strict';

  const VERSION = '0.1.0';
  const DEFAULT_BUFFER_METERS = 200;
  const DEFAULT_CELL_LEVEL = 14;
  const MAX_POLYGON_VERTICES = 30;
  const EARTH_RADIUS_METERS = 6378137;

  function finiteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function normalizePoint(value) {
    if (Array.isArray(value) && value.length >= 2) {
      const lat = finiteNumber(value[0]);
      const lng = finiteNumber(value[1]);
      if (lat === null || lng === null) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return { lat, lng };
    }
    if (value && typeof value === 'object') {
      const lat = finiteNumber(value.lat ?? value.latitude);
      const lng = finiteNumber(value.lng ?? value.longitude);
      if (lat === null || lng === null) return null;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
      return { lat, lng };
    }
    return null;
  }

  function normalizePolygon(input) {
    if (!Array.isArray(input)) throw new Error('Polygon must be an array.');
    if (input.length < 3) throw new Error('Polygon needs at least 3 vertices.');
    if (input.length > MAX_POLYGON_VERTICES) throw new Error('Polygon exceeds 30 vertices.');
    const polygon = input.map(normalizePoint);
    if (polygon.some(point => !point)) throw new Error('Polygon contains invalid coordinates.');
    return polygon;
  }

  function polygonBounds(input) {
    const polygon = normalizePolygon(input);
    let south = 90;
    let west = 180;
    let north = -90;
    let east = -180;
    for (const point of polygon) {
      south = Math.min(south, point.lat);
      west = Math.min(west, point.lng);
      north = Math.max(north, point.lat);
      east = Math.max(east, point.lng);
    }
    if (east - west > 180) {
      throw new Error('Antimeridian-crossing polygons are not supported in WM-1.');
    }
    return { south, west, north, east };
  }

  function metersPerDegreeLng(latitude) {
    const latRad = Math.max(-89.999999, Math.min(89.999999, latitude)) * Math.PI / 180;
    return (Math.PI / 180) * EARTH_RADIUS_METERS * Math.max(1e-9, Math.cos(latRad));
  }

  function metersPerDegreeLat() {
    return (Math.PI / 180) * EARTH_RADIUS_METERS;
  }

  function expandBoundsMeters(bounds, meters) {
    const distance = Math.max(0, Number(meters) || 0);
    const centerLat = (bounds.south + bounds.north) / 2;
    const latDelta = distance / metersPerDegreeLat();
    const lngDelta = distance / metersPerDegreeLng(centerLat);
    return {
      south: Math.max(-90, bounds.south - latDelta),
      west: Math.max(-180, bounds.west - lngDelta),
      north: Math.min(90, bounds.north + latDelta),
      east: Math.min(180, bounds.east + lngDelta)
    };
  }

  function boundsSizeMeters(bounds) {
    const centerLat = (bounds.south + bounds.north) / 2;
    return {
      height: Math.max(0, (bounds.north - bounds.south) * metersPerDegreeLat()),
      width: Math.max(0, (bounds.east - bounds.west) * metersPerDegreeLng(centerLat))
    };
  }

  function partitionBounds(bounds, options = {}) {
    const maxTileMeters = Math.max(0, Number(options.maxTileMeters) || 0);
    const size = boundsSizeMeters(bounds);
    const rows = maxTileMeters > 0 ? Math.max(1, Math.ceil(size.height / maxTileMeters)) : 1;
    const columns = maxTileMeters > 0 ? Math.max(1, Math.ceil(size.width / maxTileMeters)) : 1;
    const latStep = (bounds.north - bounds.south) / rows;
    const lngStep = (bounds.east - bounds.west) / columns;
    const tiles = [];

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        tiles.push({
          id: `r${row}c${column}`,
          row,
          column,
          south: row === 0 ? bounds.south : bounds.south + (latStep * row),
          north: row === rows - 1 ? bounds.north : bounds.south + (latStep * (row + 1)),
          west: column === 0 ? bounds.west : bounds.west + (lngStep * column),
          east: column === columns - 1 ? bounds.east : bounds.west + (lngStep * (column + 1))
        });
      }
    }

    return { rows, columns, tiles, maxTileMeters: maxTileMeters || null };
  }

  function queryForTile(tile, cellLevel = DEFAULT_CELL_LEVEL) {
    const level = Number.isFinite(Number(cellLevel)) ? Number(cellLevel) : DEFAULT_CELL_LEVEL;
    return (
      'ne=(' + tile.north + ',' + tile.east + ')' +
      '&sw=(' + tile.south + ',' + tile.west + ')' +
      '&cellLevel=' + level
    );
  }

  function createPlan(polygonInput, options = {}) {
    const polygon = normalizePolygon(polygonInput);
    const bufferMeters = Math.max(0, Number(options.bufferMeters ?? DEFAULT_BUFFER_METERS) || 0);
    const sourceBounds = polygonBounds(polygon);
    const acquisitionBounds = expandBoundsMeters(sourceBounds, bufferMeters);
    const partition = partitionBounds(acquisitionBounds, {
      maxTileMeters: options.maxTileMeters
    });
    const cellLevel = Number.isFinite(Number(options.cellLevel))
      ? Number(options.cellLevel)
      : DEFAULT_CELL_LEVEL;
    const tiles = partition.tiles.map(tile => ({
      ...tile,
      query: queryForTile(tile, cellLevel)
    }));

    return {
      version: VERSION,
      polygon,
      bufferMeters,
      cellLevel,
      sourceBounds,
      acquisitionBounds,
      maxTileMeters: partition.maxTileMeters,
      rows: partition.rows,
      columns: partition.columns,
      tiles,
      geometryCoverageComplete: tiles.length > 0
    };
  }

  function combinePayloads(payloads) {
    return {
      campsiteAcquisitionEnvelope: {
        version: VERSION,
        payloadCount: payloads.length
      },
      payloads
    };
  }

  async function executePlan(plan, requestTile, options = {}) {
    if (!plan || !Array.isArray(plan.tiles) || !plan.tiles.length) {
      throw new Error('Acquisition plan has no tiles.');
    }
    if (typeof requestTile !== 'function') {
      throw new Error('requestTile must be a function.');
    }

    const results = [];
    const payloads = [];
    let transportComplete = true;
    let sourceCompleteness = true;
    let sourceCompletenessKnown = typeof options.responseVerifier === 'function';

    for (const tile of plan.tiles) {
      try {
        const payload = await requestTile(tile);
        payloads.push(payload);
        let sourceComplete = null;
        if (typeof options.responseVerifier === 'function') {
          try {
            const verdict = options.responseVerifier(payload, tile);
            sourceComplete = verdict === true ? true : verdict === false ? false : null;
          } catch (_) {
            sourceComplete = false;
          }
          if (sourceComplete !== true) sourceCompleteness = false;
          if (sourceComplete === null) sourceCompletenessKnown = false;
        } else {
          sourceCompleteness = false;
        }
        results.push({ id: tile.id, ok: true, sourceComplete });
      } catch (error) {
        transportComplete = false;
        sourceCompleteness = false;
        results.push({
          id: tile.id,
          ok: false,
          sourceComplete: false,
          error: String(error?.message || error || 'request failed')
        });
      }
    }

    const geometryCoverageComplete = plan.geometryCoverageComplete === true;
    const sourceComplete = sourceCompletenessKnown ? sourceCompleteness : null;
    const coverageComplete =
      geometryCoverageComplete &&
      transportComplete &&
      sourceComplete === true;

    return {
      version: VERSION,
      plan,
      results,
      payloads,
      mergedPayload: combinePayloads(payloads),
      geometryCoverageComplete,
      transportComplete,
      sourceComplete,
      coverageComplete,
      coverageStatus: coverageComplete
        ? 'complete'
        : !transportComplete
          ? 'incomplete'
          : 'unverified'
    };
  }

  function guidSet(items) {
    return [...new Set(
      (Array.isArray(items) ? items : [])
        .map(item => String(item?.guid || item?.poiId || item?.id || '').trim())
        .filter(Boolean)
    )].sort();
  }

  function compareGuidSets(left, right) {
    const a = guidSet(left);
    const b = guidSet(right);
    const bSet = new Set(b);
    const aSet = new Set(a);
    return {
      equal: a.length === b.length && a.every(value => bSet.has(value)),
      onlyLeft: a.filter(value => !bSet.has(value)),
      onlyRight: b.filter(value => !aSet.has(value)),
      leftCount: a.length,
      rightCount: b.length
    };
  }

  window.CampsiteWayfarerAcquisitionEngine = Object.freeze({
    version: VERSION,
    defaultBufferMeters: DEFAULT_BUFFER_METERS,
    defaultCellLevel: DEFAULT_CELL_LEVEL,
    maxPolygonVertices: MAX_POLYGON_VERTICES,
    normalizePoint,
    normalizePolygon,
    polygonBounds,
    expandBoundsMeters,
    boundsSizeMeters,
    partitionBounds,
    queryForTile,
    createPlan,
    executePlan,
    combinePayloads,
    guidSet,
    compareGuidSets
  });
})();
