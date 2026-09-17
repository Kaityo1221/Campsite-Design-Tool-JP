        a.description === b.description &&
        a.imageUrl === b.imageUrl &&
        a.lat === b.lat &&
        a.lng === b.lng &&
        a.gameEntity === b.gameEntity &&
        a.gameStatus === b.gameStatus &&
        a.sponsored === b.sponsored &&
        a.smr === b.smr &&
        a.s2L14 === b.s2L14 &&
        a.s2L17 === b.s2L17 &&
        normalizeProvenance(a.provenance).join('|') === normalizeProvenance(b.provenance).join('|')
      );
    }

    function upsertPoi(poi, deferRender = false) {
      if (!poi?.guid) return false;
      const previous = poiByGuid.get(poi.guid);
      const cached = previous ? null : findCachedPoi(poi);
      const merged = mergeNonEmpty(mergeNonEmpty(cached, previous), poi);

      if (previous && sameMeaningfulPoi(previous, merged)) {
        stats.unchangedPoiSkips += 1;
        return false;
      }

      poiByGuid.set(poi.guid, merged);
      if (merged.sponsored === true) {
        sponsoredObjectIdsSeen.add(String(poi.guid));
        stats.sponsorFound = sponsoredObjectIdsSeen.size;
      }
      stats.lastPoiAt = new Date().toISOString();
      invalidateDerivedCaches();
      scheduleGuidCachePersist();
      if (!deferRender) scheduleRender();
      return true;
    }

    function candidateFromGcsObject(obj, capturedAt) {
      if (!isObject(obj)) return null;

      const guid = String(obj.poiId || '').trim();
      if (guid.length < 6) return null;

      const latE6 = asFiniteNumber(obj.latE6);
      const lngE6 = asFiniteNumber(obj.lngE6);
      if (!Number.isFinite(latE6) || !Number.isFinite(lngE6)) return null;

      const gmo = Array.isArray(obj.gmo) ? obj.gmo : [];
      const pgo = gmo.find(item =>
        isObject(item) &&
        typeof item.gameBrand === 'string' &&
        item.gameBrand.toUpperCase() === 'HOLOHOLO' &&
        GAME_ENTITIES.has(normalizeEntity(item.entity))
      );

      if (!pgo) return null;

      const lat = latE6 / 1_000_000;
      const lng = lngE6 / 1_000_000;
      const previous = poiByGuid.get(guid);
      const s2 = previous?.s2L14 && previous?.s2L17
        ? { s2L14: previous.s2L14, s2L17: previous.s2L17 }
        : getS2Fields(lat, lng);

      return {
        guid,
        title: String(obj.title || '(untitled)'),
        description: String(obj.description || ''),
        imageUrl: String(obj.mainImage || obj.imageUrl || obj.image?.url || ''),
        lat,
        lng,
        gameEntity: normalizeEntity(pgo.entity),
        gameStatus: normalizeStatus(pgo.status) || 'UNKNOWN',
        sponsored: false,
        smr: null,
        ...s2,
        provenance: [PROVENANCE.WAYFARER_PASSIVE],
        bridgeCapturedAt: capturedAt
      };
    }

    function candidateFromSponsoredMapObject(node, capturedAt, provenance = PROVENANCE.WAYFARER_PASSIVE) {
      if (!isObject(node) || !node.id) return null;

      const descriptor = decodeSponsoredDescriptor(node.id);
      if (!descriptor) return null;

      const gym = isObject(node.pgoGym) ? node.pgoGym : null;
      const stop = isObject(node.pgoPokestop) ? node.pgoPokestop : null;
      const source = descriptor.objectType === 'PGO_GYM' ? gym : stop;
      if (!source) return null;

      const lat = asFiniteNumber(source.location?.latitude ?? source.location?.lat);
      const lng = asFiniteNumber(source.location?.longitude ?? source.location?.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      const guid = descriptor.decoded;
      const previous = poiByGuid.get(guid);
      const s2 = previous?.s2L14 && previous?.s2L17
        ? { s2L14: previous.s2L14, s2L17: previous.s2L17 }
        : getS2Fields(lat, lng);

      return {
        guid,
        title: String(source.name || node.title || previous?.title || 'Sponsored location'),
        description: String(node.description || previous?.description || ''),
        imageUrl: String(source.imageUrl || node.imageUrl || previous?.imageUrl || ''),
        lat,
        lng,
        gameEntity: descriptor.objectType === 'PGO_GYM' ? 'GYM' : 'POKESTOP',
        gameStatus: 'ACTIVE',
        sponsored: true,
        smr: null,
        ...s2,
        provenance: [provenance],
        bridgeCapturedAt: capturedAt
      };
    }

    function observedL14DecimalIds() {
      const ids = new Set();
      for (const token of observedGcsL14Tokens) {
        const unsigned = s2TokenToUnsignedId(token);
        const id = unsignedS2ToSignedDecimal(unsigned);
        if (id) ids.add(id);
      }
      return ids;
    }

    function candidateFromWfmmSponsoredRecord(record, capturedAt) {
      if (!isObject(record)) return null;
      const descriptor = decodeSponsoredDescriptor(String(record.id || ''));
      const entity = normalizeEntity(record.entityType);
      const lat = asFiniteNumber(record.lat);
      const lng = asFiniteNumber(record.lng);
      if (!descriptor || !entity || entity === 'POWERSPOT') return null;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

      let s2L17 = '';
      const wfmmS2 = window.WFMM?.s2;
      if (record.l17CellKey && typeof wfmmS2?.keyToId === 'function') {
        try { s2L17 = String(wfmmS2.keyToId(record.l17CellKey) || ''); } catch (_) {}
      }
      const fallbackS2 = getS2Fields(lat, lng);

      return {
        guid: descriptor.decoded,
        title: String(record.title || 'Sponsored location'),
        description: '',
        imageUrl: String(record.imageUrl || ''),
        lat,
        lng,
        gameEntity: entity,
        gameStatus: 'ACTIVE',
        sponsored: true,
        smr: null,
        s2L14: String(record.l14CellId || fallbackS2.s2L14 || ''),
        s2L17: String(s2L17 || fallbackS2.s2L17 || ''),
        provenance: [PROVENANCE.WFMM_CACHE],
        bridgeCapturedAt: capturedAt
      };
    }

    async function reuseWfmmSponsoredCache() {
      const service = window.WFMM?.sponsoredPois;
      if (!service) {
        stats.wfmmCacheAvailable = false;
        return { available:false, records:0, matched:0, cellsReused:0 };
      }

      stats.wfmmCacheAvailable = true;
      let records = [];
      try {
        if (typeof service.listCached === 'function') {
          records = service.listCached();
        }
        if ((!Array.isArray(records) || records.length === 0) && typeof service.getAll === 'function') {
          // IndexedDB/local storage only. No sponsor network scan is triggered here.
          records = await service.getAll();
        }
      } catch (error) {
        stats.wfmmCacheErrors += 1;
        console.info('[Campsite Bridge] WFMM Sponsored cache unavailable; continuing standalone.', error);
        return { available:true, records:0, matched:0, cellsReused:0, error };
      }

      if (!Array.isArray(records)) records = [];
      const observedL14Ids = observedL14DecimalIds();
      const now = Date.now();
      const reusedCells = new Set();
      let matched = 0;
      const capturedAt = new Date().toISOString();

      for (const record of records) {
        if (!observedL14Ids.has(String(record?.l14CellId || ''))) continue;
        const poi = candidateFromWfmmSponsoredRecord(record, capturedAt);
        if (!poi) continue;
        matched += 1;
        upsertPoi(poi, true);

        // A cached record with usable details avoids a separate details request.
        if (poi.title && poi.title !== 'Sponsored location') {
          sponsoredObjectIdsDetailed.add(poi.guid);
        }

        // Recent WFMM scans can cover the same L15 without Bridge asking again.
        const scanCell = String(record?.l15ScanCellId || '');
        const updatedAt = Number(record?.updatedAt);
        const isFresh = Number.isFinite(updatedAt) && updatedAt > 0 && (now - updatedAt) <= WFMM_CACHE_MAX_AGE_MS;
        if (scanCell && observedSponsorL15Ids.has(scanCell) && isFresh) {
          queriedSponsorL15Ids.add(scanCell);
          reusedCells.add(scanCell);
        }
      }

      stats.wfmmCacheRecords = records.length;
      stats.wfmmCacheMatched = matched;
      stats.wfmmCacheCellsReused = reusedCells.size;
      stats.lastWfmmCacheAt = capturedAt;
      updateSponsorPendingStats();
      if (matched > 0) scheduleRender();

      return {
        available:true,
        records:records.length,
        matched,
        cellsReused:reusedCells.size
      };
    }

    function saveSmrNode(node, capturedAt) {
      if (!isObject(node)) return false;

      const type = String(node.mapObjectType || node.type || '').toUpperCase();
      const gym = isObject(node.pgoGym) ? node.pgoGym : null;

      if (type && type !== 'PGO_GYM') return false;
      if (!gym || typeof gym.isMegaEnhancedEligible !== 'boolean') return false;

      const lat = asFiniteNumber(
        gym.location?.latitude ?? gym.location?.lat ??
        node.location?.latitude ?? node.location?.lat
      );
      const lng = asFiniteNumber(
        gym.location?.longitude ?? gym.location?.lng ??
        node.location?.longitude ?? node.location?.lng
      );

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

      const idCandidates = [node.id, node.encodedMapObjectId, node.mapObjectId, gym.id];
      let guid = null;
      for (const id of idCandidates) {
        guid = decodeMapObjectGuid(id);
        if (guid) break;
      }

      const coordKey = makeCoordKey(lat, lng);
      const previous = coordKey ? smrRecords.get(coordKey) : null;
      const unchanged = previous &&
        previous.guid === guid &&
        previous.megaEnhancedEligible === gym.isMegaEnhancedEligible;

      if (guid) {
        const recordForGuid = previous || {
          guid,
          lat,
          lng,
          megaEnhancedEligible: gym.isMegaEnhancedEligible,
          capturedAt
        };
        smrByGuid.set(guid, recordForGuid);
        smrByGuid.set(canonicalGuidBase(guid), recordForGuid);
      }

      if (unchanged) return false;

      if (previous?.megaEnhancedEligible === true) stats.smrTrue = Math.max(0, stats.smrTrue - 1);
      if (previous?.megaEnhancedEligible === false) stats.smrFalse = Math.max(0, stats.smrFalse - 1);

      const record = {
        guid,
        lat,
        lng,
        megaEnhancedEligible: gym.isMegaEnhancedEligible,
