
    const lat = asFiniteNumber(source.location?.latitude ?? source.location?.lat);
    const lng = asFiniteNumber(source.location?.longitude ?? source.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    const exactGuid = findExactBridgeGuidForPoiId(descriptor.poiId);
    const existing = exactGuid ? poiByGuid.get(exactGuid) : null;
    const sourceName = String(source.name || '').trim();
    const existingName = String(existing?.title || '').trim();
    const verifiedName = sourceName || (
      exactGuid && existingName && existingName !== '(untitled)'
        ? existingName
        : ''
    );

    return {
      // Use the actual Pokémon GO POI ID, or the exact already-captured Bridge
      // GUID, so Sponsor enrichment merges instead of creating descriptor IDs.
      guid: exactGuid || descriptor.poiId,
      title: verifiedName || 'Sponsored location',
      description: String(node.description || existing?.description || ''),
      imageUrl: String(source.imageUrl || node.imageUrl || existing?.imageUrl || ''),
      lat,
      lng,
      gameEntity: descriptor.objectType === 'PGO_GYM' ? 'GYM' : 'POKESTOP',
      gameStatus: 'ACTIVE',
      sponsored: true,
      sponsorObjectId: String(node.id),
      sponsorPoiId: descriptor.poiId,
      sponsorNameVerified: Boolean(verifiedName),
      smr: descriptor.objectType === 'PGO_GYM' && typeof gym?.isMegaEnhancedEligible === 'boolean'
        ? gym.isMegaEnhancedEligible
        : null,
      provenance: ['BRIDGE_ENRICHMENT']
    };
  }

  function sponsorMapRequestBody(cellIds) {
    return {
      operationName: SPONSOR_MAP_OPERATION,
      query: SPONSOR_MAP_QUERY,
      variables: {
        realityChannelMapObjectsByS2CellsInput: {
          realityChannelId: SPONSOR_REALITY_CHANNEL_ID,
          s2CellLevel: SPONSOR_CELL_LEVEL,
          sourcesByS2Cells: cellIds.map(s2CellId => ({
            s2CellId,
            sources: [{ name: 'PGO', dropTypes: ['PGO_GYM', 'PGO_POKESTOP'] }]
          }))
        }
      }
    };
  }

  function sponsorDetailsRequestBody(ids) {
    return {
      operationName: SPONSOR_DETAILS_OPERATION,
      query: SPONSOR_DETAILS_QUERY,
      variables: { ids }
    };
  }

  async function sponsorGraphql(body, signal) {
    if (!nativeFetch) throw new Error('fetch unavailable');
    const response = await nativeFetch(SPONSOR_GRAPHQL_URL, {
      method: 'POST',
      credentials: 'omit',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal
    });
    const text = await response.text();
    const json = JSON.parse(text);
    if (!response.ok) throw new Error(`Sponsored GraphQL HTTP ${response.status}`);
    if (Array.isArray(json.errors) && json.errors.length) throw new Error('Sponsored GraphQL returned errors');
    return json;
  }

  function sponsoredObjectsFromBlocks(blocks) {
    const byId = new Map();
    if (!Array.isArray(blocks)) return [];
    for (const cell of blocks) {
      const typeBlocks = Array.isArray(cell?.mapObjectsByType) ? cell.mapObjectsByType : [];
      for (const typeBlock of typeBlocks) {
        const objects = Array.isArray(typeBlock?.mapObjects) ? typeBlock.mapObjects : [];
        for (const object of objects) {
          if (!object?.id || !decodeSponsoredDescriptor(object.id)) continue;
          byId.set(String(object.id), object);
        }
      }
    }
    return [...byId.values()];
  }

  function scheduleSponsorPreview() {
    // Sponsor preview is independent from WFMM. It only performs Bridge's own
    // read-only Sponsor query; it does not change WFMM settings, providers or map mode.
    if (sponsorPreviewTimer || sponsorPreviewInFlight) return;
    sponsorPreviewTimer = setTimeout(() => {
      sponsorPreviewTimer = null;
      void enrichSponsoredPreview();
    }, SPONSOR_PREVIEW_DEBOUNCE_MS);
  }

  async function enrichSponsoredPreview() {
    if (sponsorPreviewInFlight) return;
    const pending = [...observedSponsorL15Ids].filter(id => !previewQueriedSponsorL15Ids.has(id));
    if (!pending.length) return;

    sponsorPreviewInFlight = true;
    const generation = sponsorPreviewGeneration;
    const selectedCells = pending.slice(0, SPONSOR_PREVIEW_MAX_L15_PER_RUN);
    const controller = new AbortController();
    sponsorPreviewController = controller;
    const timeout = setTimeout(() => controller.abort(), SPONSOR_TIMEOUT_MS);

    try {
      for (let offset = 0; offset < selectedCells.length; offset += SPONSOR_MAP_BATCH_SIZE) {
        const batch = selectedCells.slice(offset, offset + SPONSOR_MAP_BATCH_SIZE);
        const json = await sponsorGraphql(sponsorMapRequestBody(batch), controller.signal);
        if (generation !== sponsorPreviewGeneration) return;
        stats.sponsorMapRequests += 1;
        const blocks = json?.data?.realityChannelMapObjectsByS2Cells?.mapObjectsByS2CellsAndTypes;
        if (!Array.isArray(blocks)) throw new Error('Sponsored preview map blocks missing');
        for (const id of batch) previewQueriedSponsorL15Ids.add(id);

        // Preview is intentionally map-query only. It is enough to draw the
        // yellow Sponsor ring without changing the normal Sponsor/SMR count UI.
        // The send workflow still performs its own final re-query.
        for (const cell of blocks) {
          for (const typeBlock of Array.isArray(cell?.mapObjectsByType) ? cell.mapObjectsByType : []) {
            for (const object of Array.isArray(typeBlock?.mapObjects) ? typeBlock.mapObjects : []) {
              saveSmrNode(object);
            }
          }
        }

        for (const object of sponsoredObjectsFromBlocks(blocks)) {
          const poi = candidateFromSponsoredMapObject(object);
          if (poi) upsertPoi(poi, true);
        }
      }
    } catch (error) {
      if (generation === sponsorPreviewGeneration && error?.name !== 'AbortError') {
        stats.sponsorErrors += 1;
        console.warn('[Campsite Bridge Shortcut] Sponsor preview partial', error);
      }
    } finally {
      clearTimeout(timeout);
      if (sponsorPreviewController === controller) sponsorPreviewController = null;
      sponsorPreviewInFlight = false;
      if (generation === sponsorPreviewGeneration) {
        scheduleRender();
        const hasMore = [...observedSponsorL15Ids].some(id => !previewQueriedSponsorL15Ids.has(id));
        if (hasMore) scheduleSponsorPreview();
      }
    }
  }

  async function enrichSponsoredAndSmr() {
    const pending = [...observedSponsorL15Ids].filter(id => !queriedSponsorL15Ids.has(id));
    if (!pending.length) return { partial: false };

    const selectedCells = pending.slice(0, SPONSOR_MAX_L15_PER_SEND);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SPONSOR_TIMEOUT_MS);
    const detailIds = new Set();
    let partial = pending.length > selectedCells.length;

    try {
      for (let offset = 0; offset < selectedCells.length; offset += SPONSOR_MAP_BATCH_SIZE) {
        const batch = selectedCells.slice(offset, offset + SPONSOR_MAP_BATCH_SIZE);
        const json = await sponsorGraphql(sponsorMapRequestBody(batch), controller.signal);
        stats.sponsorMapRequests += 1;
        const blocks = json?.data?.realityChannelMapObjectsByS2Cells?.mapObjectsByS2CellsAndTypes;
        if (!Array.isArray(blocks)) throw new Error('Sponsored map blocks missing');
        for (const id of batch) queriedSponsorL15Ids.add(id);

        const allMapObjects = [];
        for (const cell of blocks) {
          for (const typeBlock of Array.isArray(cell?.mapObjectsByType) ? cell.mapObjectsByType : []) {
            for (const object of Array.isArray(typeBlock?.mapObjects) ? typeBlock.mapObjects : []) {
              allMapObjects.push(object);
              saveSmrNode(object);
            }
          }
        }

        for (const object of sponsoredObjectsFromBlocks(blocks)) {
          const poi = candidateFromSponsoredMapObject(object);
          if (poi) {
            upsertPoi(poi, true);
            if (poi.gameEntity === 'GYM' && (poi.smr === true || poi.smr === false)) {
              const key = makeCoordKey(poi.lat, poi.lng);
              if (key) smrRecords.set(key, { guid: poi.guid, lat: poi.lat, lng: poi.lng, megaEnhancedEligible: poi.smr });
            }
          }
          if (!sponsoredObjectIdsDetailed.has(String(object.id))) detailIds.add(String(object.id));
        }
      }

      const ids = [...detailIds];
      for (let offset = 0; offset < ids.length; offset += SPONSOR_DETAIL_BATCH_SIZE) {
        const batch = ids.slice(offset, offset + SPONSOR_DETAIL_BATCH_SIZE);
        const json = await sponsorGraphql(sponsorDetailsRequestBody(batch), controller.signal);
        stats.sponsorDetailRequests += 1;
        const objects = json?.data?.gameMapObjectsByID;
        if (!Array.isArray(objects)) throw new Error('Sponsored detail objects missing');
        for (const object of objects) {
          saveSmrNode(object);
          const poi = candidateFromSponsoredMapObject(object);
          if (poi) {
            upsertPoi(poi, true);
            if (poi.gameEntity === 'GYM' && (poi.smr === true || poi.smr === false)) {
              const key = makeCoordKey(poi.lat, poi.lng);
              if (key) smrRecords.set(key, { guid: poi.guid, lat: poi.lat, lng: poi.lng, megaEnhancedEligible: poi.smr });
            }
          }
          sponsoredObjectIdsDetailed.add(String(object?.id || ''));
        }
