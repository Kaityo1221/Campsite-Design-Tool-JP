(() => {
  'use strict';

  const VERSION = '1.2.0';

  function numberFrom(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function optionalBoolean(...values) {
    for (const value of values) {
      if (value === true || String(value).toLowerCase() === 'true') return true;
      if (value === false || String(value).toLowerCase() === 'false') return false;
    }
    return null;
  }

  function normalizeEntity(value) {
    const text = String(value || '').trim().toUpperCase().replace(/[\s_-]/g, '');
    if (text === 'POKESTOP') return 'POKESTOP';
    if (text === 'GYM') return 'GYM';
    if (text === 'POWERSPOT') return 'POWERSPOT';
    return '';
  }

  function normalizeStatus(value) {
    const text = String(value || 'UNKNOWN').trim().toUpperCase();
    if (text === 'ACTIVE' || text === 'INACTIVE') return text;
    return 'UNKNOWN';
  }

  function coordinates(raw) {
    const latE6 = numberFrom(raw?.latE6);
    const lngE6 = numberFrom(raw?.lngE6);
    const lat = Number.isFinite(latE6) ? latE6 / 1e6 : numberFrom(raw?.lat ?? raw?.latitude);
    const lng = Number.isFinite(lngE6) ? lngE6 / 1e6 : numberFrom(raw?.lng ?? raw?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat, lng };
  }

  function normalizeGameObjects(raw) {
    const gmo = Array.isArray(raw?.gmo) ? raw.gmo : [];
    return gmo.map(item => {
      if (!item || typeof item !== 'object') {
        return {
          entity: '',
          rawEntity: '',
          status: 'UNKNOWN',
          gameBrand: '',
          sponsored: null,
          smr: null,
          title: '',
          imageUrl: '',
          malformed: true
        };
      }

      const rawEntity = String(item.entity || '').trim();
      return {
        entity: normalizeEntity(item.entity),
        rawEntity,
        status: normalizeStatus(item.status),
        gameBrand: String(item.gameBrand || '').trim().toUpperCase(),
        sponsored: optionalBoolean(item.sponsored, item.isSponsored),
        smr: optionalBoolean(item.smr),
        title: String(item.title || item.name || '').trim(),
        imageUrl: String(item.imageUrl || item.imageURL || item.image || ''),
        malformed: !rawEntity
      };
    });
  }

  function sourceGameObjectMeta(raw, gameObjects) {
    const hasGmoProperty = Object.prototype.hasOwnProperty.call(raw || {}, 'gmo');
    const gmoIsArray = Array.isArray(raw?.gmo);
    return {
      gmoPresent: hasGmoProperty,
      gmoIsArray,
      itemCount: gmoIsArray ? raw.gmo.length : 0,
      malformedCount: (hasGmoProperty && !gmoIsArray ? 1 : 0) + gameObjects.filter(item => item.malformed).length,
      structureMalformed: hasGmoProperty && !gmoIsArray
    };
  }

  function parsePoi(raw) {
    if (!raw || typeof raw !== 'object') {
      return { ok: false, reason: 'INVALID_OBJECT', poi: null };
    }

    const guid = String(raw.poiId || raw.guid || raw.id || '').trim();
    if (!guid) return { ok: false, reason: 'MISSING_GUID', poi: null };

    const point = coordinates(raw);
    if (!point) return { ok: false, reason: 'INVALID_COORDINATES', poi: null };

    const gameObjects = normalizeGameObjects(raw);
    const meta = sourceGameObjectMeta(raw, gameObjects);

    return {
      ok: true,
      reason: null,
      poi: {
        guid,
        title: String(raw.title || raw.name || raw.poiName || '').trim(),
        lat: point.lat,
        lng: point.lng,
        sponsored: optionalBoolean(raw.sponsored, raw.isSponsored),
        smr: optionalBoolean(raw.smr),
        imageUrl: String(raw.imageUrl || raw.imageURL || raw.image || ''),
        description: String(raw.description || raw.poiDescription || ''),
        s2L14: String(raw.s2L14 || ''),
        s2L17: String(raw.s2L17 || ''),
        provenance: ['WAYFARER_PASSIVE'],
        sourceGameObjectMeta: meta,
        sourceGameObjects: gameObjects
      }
    };
  }

  function extractPoiArrays(payload) {
    const out = [];
    const stack = [payload];
    const seen = new WeakSet();
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (!Array.isArray(node)) {
        if (seen.has(node)) continue;
        seen.add(node);
        if (Array.isArray(node.pois)) out.push(node.pois);
      }
      for (const value of Object.values(node)) {
        if (value && typeof value === 'object') stack.push(value);
      }
    }
    return out;
  }

  function parsePayload(payload) {
    const byGuid = new Map();
    const diagnostics = [];
    let duplicateCount = 0;
    let sourceCount = 0;

    for (const list of extractPoiArrays(payload)) {
      for (const raw of list) {
        sourceCount += 1;
        const result = parsePoi(raw);
        if (!result.ok) {
          diagnostics.push({ reason: result.reason, guid: String(raw?.poiId || raw?.guid || raw?.id || '') });
          continue;
        }
        if (byGuid.has(result.poi.guid)) duplicateCount += 1;
        byGuid.set(result.poi.guid, result.poi);
      }
    }

    return {
      version: VERSION,
      sourceCount,
      parsedCount: byGuid.size,
      duplicateCount,
      failedCount: diagnostics.length,
      pois: [...byGuid.values()],
      diagnostics
    };
  }

  window.CampsiteBridgePoiParser = Object.freeze({
    version: VERSION,
    normalizeEntity,
    normalizeStatus,
    normalizeGameObjects,
    parsePoi,
    parsePayload
  });
})();
