
    return {
      guid,
      title: String(obj.title || '(untitled)'),
      description: String(obj.description || ''),
      imageUrl: String(obj.mainImage || obj.imageUrl || obj.image?.url || ''),
      lat: latE6 / 1_000_000,
      lng: lngE6 / 1_000_000,
      gameEntity: normalizeEntity(pgo.entity),
      gameStatus: normalizeStatus(pgo.status),
      sponsored: false,
      smr: null,
      provenance: ['WAYFARER_PASSIVE']
    };
  }

  function s2TokenToUnsignedId(token) {
    const text = String(token || '').trim().toLowerCase();
    if (!/^[0-9a-f]{1,16}$/.test(text)) return null;
    try { return BigInt(`0x${text.padEnd(16, '0')}`); }
    catch (_) { return null; }
  }

  function unsignedS2ToSignedDecimal(id) {
    if (typeof id !== 'bigint') return null;
    const TWO_64 = 1n << 64n;
    const TWO_63 = 1n << 63n;
    const normalized = ((id % TWO_64) + TWO_64) % TWO_64;
    return (normalized >= TWO_63 ? normalized - TWO_64 : normalized).toString();
  }

  function l14TokenToL15Ids(token) {
    const parent = s2TokenToUnsignedId(token);
    if (parent === null) return [];
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
    if (!isObject(node)) return;
    const metadata = isObject(node.metadata) ? node.metadata : null;
    if (!metadata || Number(metadata.s2CellLevel) !== 14) return;
    const token = String(metadata.s2CellId || node.cellId || '').trim().toLowerCase();
    if (!/^[0-9a-f]{1,16}$/.test(token)) return;
    if (observedGcsL14Tokens.has(token)) return;
    observedGcsL14Tokens.add(token);
    for (const id of l14TokenToL15Ids(token)) observedSponsorL15Ids.add(id);
    scheduleSponsorPreview();
  }

  function decodeBase64UrlText(value) {
    if (typeof value !== 'string' || !value) return null;
    if (value.includes('PGO_') || value.startsWith('pgorelease.')) return value;
    try {
      const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      return atob(padded);
    } catch (_) {
      return null;
    }
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

  function decodeMapObjectGuid(id) {
    const decoded = decodeBase64UrlText(id);
    if (!decoded) return null;
    const match = decoded.match(/(?:^|\.)PGO_GYM\.([A-Za-z0-9_-]+(?:\.\d+)?)$/) || decoded.match(/PGO_GYM\.([A-Za-z0-9_-]+(?:\.\d+)?)/);
    return match ? match[1] : null;
  }

  function canonicalGuidBase(guid) {
    return String(guid || '').replace(/\.\d+$/, '');
  }

  function saveSmrNode(node) {
    if (!isObject(node)) return false;
    const type = String(node.mapObjectType || node.type || '').toUpperCase();
    const gym = isObject(node.pgoGym) ? node.pgoGym : null;
    if (type && type !== 'PGO_GYM') return false;
    if (!gym || typeof gym.isMegaEnhancedEligible !== 'boolean') return false;

    const lat = asFiniteNumber(gym.location?.latitude ?? gym.location?.lat ?? node.location?.latitude ?? node.location?.lat);
    const lng = asFiniteNumber(gym.location?.longitude ?? gym.location?.lng ?? node.location?.longitude ?? node.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

    let guid = null;
    for (const id of [node.id, node.encodedMapObjectId, node.mapObjectId, gym.id]) {
      guid = decodeMapObjectGuid(id);
      if (guid) break;
    }

    const record = { guid, lat, lng, megaEnhancedEligible: gym.isMegaEnhancedEligible };
    const coordKey = makeCoordKey(lat, lng);
    if (coordKey) smrRecords.set(coordKey, record);
    if (guid) {
      smrByGuid.set(guid, record);
      smrByGuid.set(canonicalGuidBase(guid), record);
    }
    stats.smrRecords = smrRecords.size;
    return true;
  }

  function getSmrForPoi(poi) {
    if (!poi || poi.gameEntity !== 'GYM') return poi?.smr === true ? true : poi?.smr === false ? false : null;
    if (poi.smr === true || poi.smr === false) return poi.smr;

    const guid = String(poi.guid || '');
    const direct = smrByGuid.get(guid) || smrByGuid.get(canonicalGuidBase(guid));
    if (direct) return direct.megaEnhancedEligible;

    const exact = smrRecords.get(makeCoordKey(poi.lat, poi.lng));
    if (exact) return exact.megaEnhancedEligible;

    let closest = null;
    let closestDistance = Infinity;
    for (const record of smrRecords.values()) {
      const d = distanceMeters(poi.lat, poi.lng, record.lat, record.lng);
      if (d <= MAX_COORD_MATCH_METERS && d < closestDistance) {
        closest = record;
        closestDistance = d;
      }
    }
    return closest ? closest.megaEnhancedEligible : null;
  }

  function scanJson(root) {
    const stack = [root];
    const visited = new WeakSet();
    let changed = false;
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (isObject(node)) {
        if (visited.has(node)) continue;
        visited.add(node);
        collectObservedGcsL14(node);
        const gcs = candidateFromGcsObject(node);
        if (gcs) {
          stats.receivedPoi += 1;
          upsertPoi(gcs, true);
          changed = true;
        }
        if (saveSmrNode(node)) changed = true;
        for (const value of Object.values(node)) if (value && typeof value === 'object') stack.push(value);
      } else {
        for (const value of node) if (value && typeof value === 'object') stack.push(value);
      }
    }
    if (changed) scheduleRender();
  }

  function installXhrCapture() {
    const XHR = window.XMLHttpRequest;
    if (!XHR?.prototype || typeof nativeXhrSend !== 'function') return;
    if (XHR.prototype.__campsiteBridgeShortcutPatched) return;
    XHR.prototype.__campsiteBridgeShortcutPatched = true;

    XHR.prototype.send = function(...args) {
      this.addEventListener('load', () => {
        stats.xhr += 1;
        const url = String(this.responseURL || '');
        if (url.includes('/api/v1/vault/mapview/gcs')) stats.gcs += 1;
        try {
          if (this.responseType === 'json' && this.response) {
            scanJson(this.response);
          } else if (!this.responseType || this.responseType === 'text') {
            const text = String(this.responseText || '');
            if (!text || (!text.includes('HOLOHOLO') && !text.includes('isMegaEnhancedEligible') && !text.includes('PGO_GYM'))) return;
            scanJson(JSON.parse(text));
          }
        } catch (_) {
          stats.parseErrors += 1;
        }
      }, { once: true });
      return nativeXhrSend.apply(this, args);
    };
  }

  function findExactBridgeGuidForPoiId(poiId) {
    const exact = String(poiId || '').trim();
    if (!exact) return null;
    if (poiByGuid.has(exact)) return exact;

    // Some PGO IDs carry a trailing numeric suffix. Treat the canonical base
    // as exact only when it resolves to exactly one Bridge POI. No coordinate
    // proximity is used here.
    const canonical = canonicalGuidBase(exact);
    const matches = [];
    for (const guid of poiByGuid.keys()) {
      if (canonicalGuidBase(guid) === canonical) matches.push(guid);
      if (matches.length > 1) return null;
    }
    return matches.length === 1 ? matches[0] : null;
  }

  function candidateFromSponsoredMapObject(node) {
    if (!isObject(node) || !node.id) return null;
    const descriptor = decodeSponsoredDescriptor(node.id);
    if (!descriptor) return null;
    const gym = isObject(node.pgoGym) ? node.pgoGym : null;
    const stop = isObject(node.pgoPokestop) ? node.pgoPokestop : null;
    const source = descriptor.objectType === 'PGO_GYM' ? gym : stop;
    if (!source) return null;
