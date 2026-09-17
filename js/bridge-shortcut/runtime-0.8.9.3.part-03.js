      const currentAreas = currentAreaKeys(pois);
      const previousAreas = Array.isArray(previousSnapshot.areaKeys) ? [...previousSnapshot.areaKeys].sort() : [];
      const missingReliable = currentAreas.length > 0 && previousAreas.length === currentAreas.length && previousAreas.every((key, index) => key === currentAreas[index]);
      const missingGuids = [];
      if (missingReliable) {
        for (const guid of previousByGuid.keys()) if (!currentByGuid.has(guid)) missingGuids.push(guid);
      }

      const result = {
        available: true,
        newCount: newGuids.length,
        changedCount: changedGuids.length,
        missingCount: missingReliable ? missingGuids.length : null,
        missingReliable,
        newGuids,
        changedGuids,
        missingGuids
      };
      stats.diffNew = result.newCount;
      stats.diffChanged = result.changedCount;
      stats.diffMissing = result.missingCount || 0;
      stats.diffMissingReliable = missingReliable;
      return result;
    }

    function saveHistorySnapshot(pois) {
      const snapshot = {
        version: BRIDGE_VERSION,
        savedAt: new Date().toISOString(),
        areaKeys: currentAreaKeys(pois),
        pois: pois.map(diffComparablePoi)
      };
      if (writeLocalJson(BRIDGE_HISTORY_STORAGE_KEY, snapshot)) {
        previousSnapshot = snapshot;
        diag('history-snapshot', { pois: snapshot.pois.length, areas: snapshot.areaKeys.length });
      }
    }

    function computeQuality(pois = getSendPois()) {
      let score = 0;
      const reasons = [];
      if (pois.length > 0) score += 30; else reasons.push('POI未取得');
      if (observedGcsL14Tokens.size > 0) score += 20; else reasons.push('範囲情報未取得');

      if (observedSponsorL15Ids.size > 0) {
        const done = queriedSponsorL15Ids.size;
        const total = observedSponsorL15Ids.size;
        score += Math.round(25 * Math.min(1, done / total));
        if (stats.sponsorPendingL15 > 0) reasons.push(`Sponsor未確認L15 ${stats.sponsorPendingL15}`);
      } else {
        score += 8;
        reasons.push('Sponsor範囲未確定');
      }

      if (stats.parseErrors === 0) score += 15; else reasons.push(`解析エラー ${stats.parseErrors}`);
      if (stats.sponsorErrors === 0) score += 10; else reasons.push(`Sponsorエラー ${stats.sponsorErrors}`);
      score = Math.max(0, Math.min(100, score));
      const label = score >= 85 ? '良好' : score >= 60 ? '確認' : '取得中';
      const result = { score, label, reasons };
      stats.qualityScore = score;
      stats.qualityLabel = label;
      return result;
    }

    function buildSessionSnapshot() {
      const pois = getSendPois();
      const diff = computeDiff(pois);
      const quality = computeQuality(pois);
      return {
        bridge: 'Campsite Bridge',
        bridgeVersion: BRIDGE_VERSION,
        exportedAt: new Date().toISOString(),
        sessionStartedAt,
        quality,
        diff,
        stats: { ...stats },
        areaKeys: currentAreaKeys(pois),
        sponsorCells: {
          observedL14: [...observedGcsL14Tokens],
          observedL15: [...observedSponsorL15Ids],
          queriedL15: [...queriedSponsorL15Ids],
          pendingL15: getPendingSponsorL15Ids()
        },
        areaCache: {
          histories: Array.isArray(areaCache?.areas) ? areaCache.areas.length : 0,
          pois: Object.keys(areaCache?.pois || {}).length,
          loaded: stats.areaCacheLoaded,
          hits: stats.areaCacheHits,
          misses: stats.areaCacheMisses,
          pruned: stats.areaCachePruned,
          recentAreas: Array.isArray(areaCache?.areas) ? areaCache.areas.slice(0, AREA_CACHE_MAX_AREAS) : []
        },
        diagnostics: [...diagnosticLog],
        pois
      };
    }

    function exportSession() {
      const snapshot = buildSessionSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `campsite_bridge_session_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.documentElement.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      diag('session-export', { pois: snapshot.pois.length });
    }

    function clearPersistentBridgeData() {
      try { localStorage.removeItem(BRIDGE_HISTORY_STORAGE_KEY); } catch (_) {}
      try { localStorage.removeItem(BRIDGE_AREA_CACHE_STORAGE_KEY); } catch (_) {}
      if (areaCachePersistTimer) { clearTimeout(areaCachePersistTimer); areaCachePersistTimer = null; }
      areaCache = { version: BRIDGE_VERSION, updatedAt: null, areas: [], pois: {} };
      previousSnapshot = null;
      stats.areaCacheLoaded = 0;
      stats.areaCacheHits = 0;
      stats.areaCacheMisses = 0;
      stats.areaCachePruned = 0;
      stats.areaCacheAreas = 0;
      stats.areaCachePois = 0;
      diag('persistent-data-cleared');
      scheduleRender();
    }

    function s2TokenToUnsignedId(token) {
      const text = String(token || '').trim().toLowerCase();
      if (!/^[0-9a-f]{1,16}$/.test(text)) return null;
      try {
        return BigInt(`0x${text.padEnd(16, '0')}`);
      } catch (_) {
        return null;
      }
    }

    function unsignedS2ToSignedDecimal(id) {
      if (typeof id !== 'bigint') return null;
      const TWO_64 = 1n << 64n;
      const TWO_63 = 1n << 63n;
      const normalized = ((id % TWO_64) + TWO_64) % TWO_64;
      return (normalized >= TWO_63 ? normalized - TWO_64 : normalized).toString();
    }function l14TokenToL15Ids(token) {
      const parent = s2TokenToUnsignedId(token);
      if (parent === null) return [];

      // S2 CellId lsb at level L is 1 << (2 * (30 - L)).
      // The four direct children use one quarter of that lsb and are
      // separated by two child-lsb units.
      const parentLsb = 1n << BigInt(2 * (30 - 14));
      const childLsb = parentLsb >> 2n;
      const firstChild = parent - parentLsb + childLsb;
      const ids = [];
      for (let index = 0n; index < 4n; index += 1n) {
        ids.push(unsignedS2ToSignedDecimal(firstChild + (2n * childLsb * index)));
      }
      return ids.filter(Boolean);
    }

    function collectObservedGcsL14(node) {
      if (!isObject(node)) return false;
      const metadata = isObject(node.metadata) ? node.metadata : null;
      if (!metadata || Number(metadata.s2CellLevel) !== 14) return false;

      const token = String(metadata.s2CellId || node.cellId || '').trim().toLowerCase();
      if (!/^[0-9a-f]{1,16}$/.test(token)) return false;
      if (observedGcsL14Tokens.has(token)) return false;

      observedGcsL14Tokens.add(token);
      for (const id of l14TokenToL15Ids(token)) observedSponsorL15Ids.add(id);
      stats.sponsorObservedL14 = observedGcsL14Tokens.size;
      updateSponsorPendingStats();
      return true;
    }

    function getPendingSponsorL15Ids() {
      return [...observedSponsorL15Ids].filter(id => !queriedSponsorL15Ids.has(id));
    }

    function updateSponsorPendingStats() {
      stats.sponsorQueriedL15 = queriedSponsorL15Ids.size;
      stats.sponsorPendingL15 = Math.max(0, observedSponsorL15Ids.size - queriedSponsorL15Ids.size);
      stats.sponsorFound = sponsoredObjectIdsSeen.size;
    }

    function decodeBase64UrlText(value) {
      if (typeof value !== 'string' || !value) return null;
      if (value.includes('PGO_')) return value;

      try {
        const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        return atob(padded);
      } catch (_) {
        return null;
      }
    }

    function decodeMapObjectGuid(id) {
      const decoded = decodeBase64UrlText(id);
      if (!decoded) return null;

      const match =
        decoded.match(/(?:^|\.)PGO_GYM\.([A-Za-z0-9_-]+(?:\.\d+)?)$/) ||
        decoded.match(/PGO_GYM\.([A-Za-z0-9_-]+(?:\.\d+)?)/);

      return match ? match[1] : null;
    }

    function decodeSponsoredDescriptor(id) {
      const decoded = decodeBase64UrlText(id);
      if (!decoded) return null;

      const match = decoded.match(/^pgorelease\.(PGO_GYM|PGO_POKESTOP)\.([^.]+)$/i);
      if (!match) return null;

      return {
        decoded,
        objectType: match[1].toUpperCase(),
        poiId: match[2]
      };
    }

    function canonicalGuidBase(guid) {
      return String(guid || '').replace(/\.\d+$/, '');
    }

    function makeCoordKey(lat, lng) {
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      return `${lat.toFixed(6)},${lng.toFixed(6)}`;
    }

    function distanceMeters(aLat, aLng, bLat, bLng) {
      const R = 6371000;
      const toRad = value => value * Math.PI / 180;
      const dLat = toRad(bLat - aLat);
      const dLng = toRad(bLng - aLng);
      const lat1 = toRad(aLat);
      const lat2 = toRad(bLat);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
    }

    function getS2Fields(lat, lng) {
      // Optional WFMM reuse only. This is local calculation, not a network request.
      const s2 = window.WFMM?.s2;
      if (typeof s2?.latLngToId !== 'function') return { s2L14: '', s2L17: '' };
      try {
        return {
          s2L14: String(s2.latLngToId(Number(lat), Number(lng), 14) || ''),
          s2L17: String(s2.latLngToId(Number(lat), Number(lng), 17) || '')
        };
      } catch (_) {
        return { s2L14: '', s2L17: '' };
      }
    }

    function mergeNonEmpty(previous, next) {
      const merged = { ...(previous || {}) };
      for (const [key, value] of Object.entries(next || {})) {
        if (key === 'provenance') {
          merged.provenance = normalizeProvenance([
            ...normalizeProvenance(merged.provenance),
            ...normalizeProvenance(value)
          ]);
          continue;
        }
        const hasValue = value !== undefined && value !== null && value !== '';
        if (hasValue || !(key in merged)) merged[key] = value;
      }
      return merged;
    }

    function invalidateDerivedCaches() {
      finalizedPoisCache = null;
      countsCache = null;
    }

    function sameMeaningfulPoi(a, b) {
      if (!a || !b) return false;
      return (
        a.title === b.title &&
