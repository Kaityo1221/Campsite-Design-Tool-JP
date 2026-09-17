
    function readLocalJson(key, fallback) {
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || 'null');
        return parsed && typeof parsed === 'object' ? parsed : fallback;
      } catch (_) {
        return fallback;
      }
    }

    function writeLocalJson(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (error) {
        diag('storage-write-error', { key, message: String(error?.message || error) });
        return false;
      }
    }

    function loadHistorySnapshot() {
      const value = readLocalJson(BRIDGE_HISTORY_STORAGE_KEY, null);
      if (!value || !Array.isArray(value.pois)) return null;
      return value;
    }

    function loadAreaCache() {
      const value = readLocalJson(BRIDGE_AREA_CACHE_STORAGE_KEY, null);
      if (!value || typeof value !== 'object') {
        areaCacheLoadMeta = { loadedAreas:0, loadedPois:0, prunedAreas:0, prunedPois:0, migrated:false };
        return { version: BRIDGE_VERSION, updatedAt: null, areas: [], pois: {} };
      }

      const rawPois = value.pois && typeof value.pois === 'object' ? value.pois : {};
      const rawAreas = value.areas;
      const migrated = String(value.version || '') !== BRIDGE_VERSION || !Array.isArray(rawAreas);
      const cache = {
        version: BRIDGE_VERSION,
        updatedAt: value.updatedAt || null,
        // v0.8.9.2+: areas are acquisition-history entries, not S2/grid buckets.
        areas: Array.isArray(rawAreas) ? rawAreas.filter(item => item && typeof item === 'object') : [],
        // GUID is the only lookup key for reusable POI records.
        pois: rawPois
      };

      const beforeAreas = cache.areas.length;
      const beforePois = Object.keys(cache.pois).length;
      const pruned = pruneAreaCache(cache);
      areaCacheLoadMeta = {
        loadedAreas: cache.areas.length,
        loadedPois: Object.keys(cache.pois).length,
        prunedAreas: pruned.prunedAreas,
        prunedPois: pruned.prunedPois,
        migrated
      };
      if (migrated || pruned.prunedAreas || pruned.prunedPois || beforeAreas !== cache.areas.length || beforePois !== Object.keys(cache.pois).length) {
        writeLocalJson(BRIDGE_AREA_CACHE_STORAGE_KEY, cache);
      }
      return cache;
    }

    function gridAreaKey(lat, lng) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const y = Math.floor((lat + 90) / GRID_CACHE_DEGREES);
      const x = Math.floor((lng + 180) / GRID_CACHE_DEGREES);
      return `grid:${y}:${x}`;
    }

    function areaKeysForPoi(poi) {
      const keys = [];
      const l14 = String(poi?.s2L14 || '').trim();
      if (l14) keys.push(`s2l14:${l14}`);
      const grid = gridAreaKey(Number(poi?.lat), Number(poi?.lng));
      if (grid) keys.push(grid);
      return [...new Set(keys)];
    }

    function currentAreaKeys(pois = getSendPois()) {
      const keys = new Set();
      for (const token of observedGcsL14Tokens) {
        const unsigned = s2TokenToUnsignedId(token);
        const id = unsignedS2ToSignedDecimal(unsigned);
        if (id) keys.add(`s2l14:${id}`);
      }
      for (const poi of pois) {
        for (const key of areaKeysForPoi(poi)) keys.add(key);
      }
      return [...keys].sort();
    }

    function acquisitionBounds(pois) {
      let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity;
      let count = 0;
      for (const poi of pois || []) {
        const lat = Number(poi?.lat);
        const lng = Number(poi?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
        minLng = Math.min(minLng, lng); maxLng = Math.max(maxLng, lng);
        count += 1;
      }
      if (!count) return null;
      return {
        minLat: Number(minLat.toFixed(6)), minLng: Number(minLng.toFixed(6)),
        maxLat: Number(maxLat.toFixed(6)), maxLng: Number(maxLng.toFixed(6)),
        centerLat: Number(((minLat + maxLat) / 2).toFixed(6)),
        centerLng: Number(((minLng + maxLng) / 2).toFixed(6))
      };
    }

    function pruneAreaCache(cache = areaCache) {
      if (!cache || typeof cache !== 'object') return { prunedAreas:0, prunedPois:0 };
      const now = Date.now();
      cache.areas = Array.isArray(cache.areas) ? cache.areas : [];
      cache.pois = cache.pois && typeof cache.pois === 'object' ? cache.pois : {};

      const beforeAreas = cache.areas.length;
      const beforePois = Object.keys(cache.pois).length;

      cache.areas = cache.areas
        .filter(area => {
          const updatedAt = Number(area?.updatedAt) || Date.parse(area?.capturedAt || '') || 0;
          return updatedAt && now - updatedAt <= AREA_CACHE_TTL_MS;
        })
        .sort((a, b) => (Number(b?.updatedAt) || Date.parse(b?.capturedAt || '') || 0) - (Number(a?.updatedAt) || Date.parse(a?.capturedAt || '') || 0))
        .slice(0, AREA_CACHE_MAX_AREAS);

      const poiEntries = Object.entries(cache.pois)
        .filter(([, record]) => {
          const updatedAt = Number(record?.updatedAt) || 0;
          return updatedAt && now - updatedAt <= AREA_CACHE_TTL_MS && record?.poi && typeof record.poi === 'object';
        })
        .sort((a, b) => (Number(b[1]?.updatedAt) || 0) - (Number(a[1]?.updatedAt) || 0))
        .slice(0, AREA_CACHE_MAX_POIS);

      cache.pois = Object.fromEntries(poiEntries.map(([guid, record]) => [guid, {
        updatedAt: Number(record.updatedAt) || now,
        poi: cacheSafePoi(record.poi)
      }]));

      return {
        prunedAreas: Math.max(0, beforeAreas - cache.areas.length),
        prunedPois: Math.max(0, beforePois - Object.keys(cache.pois).length)
      };
    }

    function findCachedPoi(poi) {
      const guid = String(poi?.guid || '').trim();
      if (!guid) return null;
      const record = areaCache?.pois?.[guid];
      if (!record) {
        stats.areaCacheMisses += 1;
        return null;
      }
      const updatedAt = Number(record.updatedAt) || 0;
      if (!updatedAt || Date.now() - updatedAt > AREA_CACHE_TTL_MS || !record.poi || typeof record.poi !== 'object') {
        delete areaCache.pois[guid];
        stats.areaCacheMisses += 1;
        stats.areaCachePruned += 1;
        stats.areaCachePois = Object.keys(areaCache.pois).length;
        return null;
      }
      stats.areaCacheHits += 1;
      return record.poi;
    }

    function cacheSafePoi(poi) {
      return {
        guid: String(poi.guid || ''),
        title: String(poi.title || ''),
        lat: Number(poi.lat),
        lng: Number(poi.lng),
        gameEntity: normalizeEntity(poi.gameEntity),
        gameStatus: normalizeStatus(poi.gameStatus) || 'UNKNOWN',
        sponsored: poi.sponsored === true,
        smr: poi.smr === true ? true : poi.smr === false ? false : null,
        s2L14: String(poi.s2L14 || ''),
        s2L17: String(poi.s2L17 || '')
      };
    }

    function persistGuidCache(pois = getSendPois(), { addAreaHistory = false } = {}) {
      const now = Date.now();
      const cache = areaCache || { version: BRIDGE_VERSION, updatedAt: null, areas: [], pois: {} };
      cache.version = BRIDGE_VERSION;
      cache.updatedAt = new Date(now).toISOString();
      cache.areas = Array.isArray(cache.areas) ? cache.areas : [];
      cache.pois = cache.pois && typeof cache.pois === 'object' ? cache.pois : {};

      const uniqueGuids = new Set();
      for (const poi of pois || []) {
        const safe = cacheSafePoi(poi);
        if (!safe.guid) continue;
        uniqueGuids.add(safe.guid);
        cache.pois[safe.guid] = { updatedAt: now, poi: safe };
      }

      if (addAreaHistory && uniqueGuids.size) {
        const bounds = acquisitionBounds(pois);
        cache.areas.unshift({
          id: `capture:${now}`,
          capturedAt: new Date(now).toISOString(),
          updatedAt: now,
          poiCount: uniqueGuids.size,
          bounds,
          observedL14Count: observedGcsL14Tokens.size,
          observedL15Count: observedSponsorL15Ids.size
        });
      }

      const pruned = pruneAreaCache(cache);
      areaCache = cache;
      stats.areaCachePruned += pruned.prunedPois;
      if (writeLocalJson(BRIDGE_AREA_CACHE_STORAGE_KEY, cache)) {
        stats.areaCacheWrites += 1;
        stats.areaCacheAreas = cache.areas.length;
        stats.areaCachePois = Object.keys(cache.pois || {}).length;
        diag('area-cache-write', {
          histories: stats.areaCacheAreas,
          pois: stats.areaCachePois,
          addAreaHistory,
          prunedPois: pruned.prunedPois,
          prunedAreas: pruned.prunedAreas
        });
      }
    }

    function persistAreaCache(pois) {
      persistGuidCache(pois, { addAreaHistory: true });
    }

    function scheduleGuidCachePersist() {
      if (areaCachePersistTimer) clearTimeout(areaCachePersistTimer);
      areaCachePersistTimer = setTimeout(() => {
        areaCachePersistTimer = null;
        persistGuidCache(getSendPois(), { addAreaHistory: false });
      }, AREA_CACHE_WRITE_DEBOUNCE_MS);
    }

    function flushGuidCachePersist() {
      if (areaCachePersistTimer) {
        clearTimeout(areaCachePersistTimer);
        areaCachePersistTimer = null;
      }
      if (poiByGuid.size) persistGuidCache(getSendPois(), { addAreaHistory: false });
    }

    function diffComparablePoi(poi) {
      return {
        guid: String(poi.guid || ''),
        title: String(poi.title || ''),
        lat: Number(poi.lat),
        lng: Number(poi.lng),
        gameEntity: normalizeEntity(poi.gameEntity),
        gameStatus: normalizeStatus(poi.gameStatus) || 'UNKNOWN',
        sponsored: poi.sponsored === true,
        areaKeys: areaKeysForPoi(poi)
      };
    }

    function changedFromSnapshot(a, b) {
      if (!a || !b) return false;
      return a.title !== b.title || a.gameEntity !== b.gameEntity || a.gameStatus !== b.gameStatus ||
        a.sponsored !== b.sponsored || Math.abs((a.lat || 0) - (b.lat || 0)) > 0.000005 ||
        Math.abs((a.lng || 0) - (b.lng || 0)) > 0.000005;
    }

    function computeDiff(pois = getSendPois()) {
      if (!previousSnapshot || !Array.isArray(previousSnapshot.pois)) {
        const result = { available: false, newCount: 0, changedCount: 0, missingCount: null, missingReliable: false, newGuids: [], changedGuids: [], missingGuids: [] };
        stats.diffNew = 0; stats.diffChanged = 0; stats.diffMissing = 0; stats.diffMissingReliable = false;
        return result;
      }

      const previousByGuid = new Map(previousSnapshot.pois.map(poi => [String(poi.guid || ''), poi]));
      const current = pois.map(diffComparablePoi);
      const currentByGuid = new Map(current.map(poi => [poi.guid, poi]));
      const newGuids = [];
      const changedGuids = [];
      for (const poi of current) {
        const before = previousByGuid.get(poi.guid);
        if (!before) newGuids.push(poi.guid);
        else if (changedFromSnapshot(before, poi)) changedGuids.push(poi.guid);
      }

