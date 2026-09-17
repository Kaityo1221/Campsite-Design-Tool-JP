        capturedAt
      };

      if (coordKey) smrRecords.set(coordKey, record);
      if (guid) {
        smrByGuid.set(guid, record);
        smrByGuid.set(canonicalGuidBase(guid), record);
      }

      if (record.megaEnhancedEligible === true) stats.smrTrue += 1;
      else stats.smrFalse += 1;
      stats.smrRecords = smrRecords.size;
      stats.lastSmrAt = capturedAt;
      invalidateDerivedCaches();
      return true;
    }

    function getSmrForPoi(poi) {
      if (!poi || poi.gameEntity !== 'GYM') return null;

      const guid = String(poi.guid || '');
      const direct = smrByGuid.get(guid) || smrByGuid.get(canonicalGuidBase(guid));
      if (direct) return direct.megaEnhancedEligible;

      const exactCoord = smrRecords.get(makeCoordKey(poi.lat, poi.lng));
      if (exactCoord) return exactCoord.megaEnhancedEligible;

      let closest = null;
      let closestDistance = Infinity;
      for (const record of smrRecords.values()) {
        const distance = distanceMeters(poi.lat, poi.lng, record.lat, record.lng);
        if (distance <= MAX_COORD_MATCH_METERS && distance < closestDistance) {
          closest = record;
          closestDistance = distance;
        }
      }

      return closest ? closest.megaEnhancedEligible : null;
    }

    function scanJson(root, capturedAt) {
      const stack = [root];
      const visited = new WeakSet();
      let foundPoi = false;
      let foundSmr = false;
      let changedPoi = false;

      while (stack.length) {
        const node = stack.pop();
        if (!node || typeof node !== 'object') continue;

        if (isObject(node)) {
          if (visited.has(node)) continue;
          visited.add(node);

          collectObservedGcsL14(node);

          const gcs = candidateFromGcsObject(node, capturedAt);
          if (gcs) {
            foundPoi = true;
            if (upsertPoi(gcs, true)) changedPoi = true;
          }

          const sponsored = candidateFromSponsoredMapObject(node, capturedAt);
          if (sponsored) {
            foundPoi = true;
            if (upsertPoi(sponsored, true)) changedPoi = true;
          }

          if (saveSmrNode(node, capturedAt)) foundSmr = true;

          for (const value of Object.values(node)) {
            if (value && typeof value === 'object') stack.push(value);
          }
        } else {
          for (const value of node) {
            if (value && typeof value === 'object') stack.push(value);
          }
        }
      }

      if (foundPoi || foundSmr) {
        stats.candidateResponses += 1;
        if (foundSmr) stats.smrResponses += 1;
      }
      if (changedPoi || foundSmr) scheduleRender();
    }

    function looksRelevantText(text) {
      if (typeof text !== 'string' || text.length < 2) return false;
      return (
        text.includes('HOLOHOLO') ||
        text.includes('PGO_GYM') ||
        text.includes('PGO_POKESTOP') ||
        text.includes('isMegaEnhancedEligible') ||
        text.includes('pgoGym') ||
        text.includes('pgoPokestop') ||
        text.includes('POWERSPOT')
      );
    }

    function contentTypeMayContainJson(contentType) {
      if (!contentType) return true;
      return /json|graphql|javascript|text\/plain/i.test(contentType);
    }

    function processText(text, capturedAt = new Date().toISOString()) {
      if (!looksRelevantText(text)) return;

      try {
        const data = JSON.parse(text);
        stats.jsonResponses += 1;
        scanJson(data, capturedAt);
      } catch (_) {
        stats.parseErrors += 1;
      }
    }

    function processJson(data, capturedAt = new Date().toISOString()) {
      if (!data || typeof data !== 'object') return;

      // XHRのresponseType=jsonは再parseしない。ただし無関係なJSONを
      // 深く走査しないよう、文字列化は relevance gate のみに使う。
      let text = '';
      try { text = JSON.stringify(data); } catch (_) { return; }
      if (!looksRelevantText(text)) return;

      stats.jsonResponses += 1;
      stats.directJsonResponses += 1;
      scanJson(data, capturedAt);
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
              sources: [{
                name: 'PGO',
                dropTypes: ['PGO_GYM', 'PGO_POKESTOP']
              }]
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
      if (!bridgeNativeFetch) throw new Error('fetch unavailable');

      const response = await bridgeNativeFetch(SPONSOR_GRAPHQL_URL, {
        method: 'POST',
        credentials: 'omit',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        body: JSON.stringify(body),
        signal
      });

      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch (_) {
        throw new Error(`Sponsored GraphQL returned non-JSON (${response.status})`);
      }

      if (!response.ok) {
        throw new Error(`Sponsored GraphQL HTTP ${response.status}`);
      }
      if (Array.isArray(json.errors) && json.errors.length) {
        throw new Error('Sponsored GraphQL returned errors');
      }
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

    async function querySponsoredMapBatch(cellIds, signal) {
      const json = await sponsorGraphql(sponsorMapRequestBody(cellIds), signal);
      const blocks = json?.data?.realityChannelMapObjectsByS2Cells?.mapObjectsByS2CellsAndTypes;
      if (!Array.isArray(blocks)) throw new Error('Sponsored map blocks missing');
      return blocks;
    }

    async function querySponsoredDetailBatch(ids, signal) {
      if (!ids.length) return [];
      const json = await sponsorGraphql(sponsorDetailsRequestBody(ids), signal);
      const objects = json?.data?.gameMapObjectsByID;
      if (!Array.isArray(objects)) throw new Error('Sponsored detail objects missing');
      return objects;
    }

    async function enrichSponsoredBeforeSend() {
      if (sponsorFetchInFlight) return sponsorFetchInFlight;

      sponsorFetchInFlight = (async () => {
        updateSponsorPendingStats();
        const pendingBefore = getPendingSponsorL15Ids();
        if (!pendingBefore.length) {
          return {
            attempted: 0,
            queried: 0,
            found: sponsoredObjectIdsSeen.size,
            pending: 0,
            timedOut: false,
            error: null
          };
        }

        const selectedCells = pendingBefore.slice(0, SPONSOR_MAX_L15_PER_SEND);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SPONSOR_TIMEOUT_MS);
        const detailIds = new Set();
        let queried = 0;
        let error = null;
        let timedOut = false;

        try {
          for (let offset = 0; offset < selectedCells.length; offset += SPONSOR_MAP_BATCH_SIZE) {
            const batch = selectedCells.slice(offset, offset + SPONSOR_MAP_BATCH_SIZE);
            const blocks = await querySponsoredMapBatch(batch, controller.signal);
            stats.sponsorMapRequests += 1;

            // A cell is considered done only after a successful response.
            for (const id of batch) queriedSponsorL15Ids.add(id);
            queried += batch.length;

            const objects = sponsoredObjectsFromBlocks(blocks);
            const capturedAt = new Date().toISOString();
            for (const object of objects) {
              const id = String(object.id);
              const poi = candidateFromSponsoredMapObject(object, capturedAt, PROVENANCE.BRIDGE_ENRICHMENT);
              if (poi) upsertPoi(poi, true);
              const canonicalId = decodeSponsoredDescriptor(id)?.decoded || id;
              if (!sponsoredObjectIdsDetailed.has(canonicalId)) detailIds.add(id);
            }
          }

          const ids = [...detailIds];
          for (let offset = 0; offset < ids.length; offset += SPONSOR_DETAIL_BATCH_SIZE) {
            const batch = ids.slice(offset, offset + SPONSOR_DETAIL_BATCH_SIZE);
            const details = await querySponsoredDetailBatch(batch, controller.signal);
            stats.sponsorDetailRequests += 1;
            const capturedAt = new Date().toISOString();

            for (const object of details) {
              const id = String(object?.id || '');
              if (!id || !decodeSponsoredDescriptor(id)) continue;
              const poi = candidateFromSponsoredMapObject(object, capturedAt, PROVENANCE.BRIDGE_ENRICHMENT);
              if (poi) upsertPoi(poi, true);
              const canonicalId = decodeSponsoredDescriptor(id)?.decoded || id;
              sponsoredObjectIdsDetailed.add(canonicalId);
            }
