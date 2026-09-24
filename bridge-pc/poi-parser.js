(() => {
  'use strict';

  const VERSION = '1.1.0';
  const KNOWN_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const ENTITY_PRIORITY = ['GYM', 'POKESTOP', 'POWERSPOT'];

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
          malformed: true,
          raw: null
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
        malformed: !rawEntity,
        raw: item
      };
    });
  }

  function classifyGameObject(gameObjects) {
    const active = gameObjects.filter(item =>
      item.status === 'ACTIVE' &&
      KNOWN_ENTITIES.has(item.entity) &&
      (item.gameBrand === '' || item.gameBrand === 'HOLOHOLO')
    );
    for (const entity of ENTITY_PRIORITY) {
      const found = active.find(item => item.entity === entity);
      if (found) return found;
    }
    return null;
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
    const primary = classifyGameObject(gameObjects);
    const meta = sourceGameObjectMeta(raw, gameObjects);
    const title = String(
      raw.title || raw.name || raw.poiName || primary?.title || ''
    ).trim();

    const supportedGameObjects = gameObjects.filter(item => KNOWN_ENTITIES.has(item.entity));
    const classification = primary ? primary.entity : (supportedGameObjects.length ? 'UNKNOWN' : 'NOT_IN_GAME');
    const gameStatus = primary ? 'ACTIVE' : (supportedGameObjects.some(item => item.status === 'INACTIVE') ? 'INACTIVE' : 'UNKNOWN');

    return {
      ok: true,
      reason: null,
      poi: {
        guid,
        title,
        lat: point.lat,
        lng: point.lng,
        classification,
        gameEntity: primary?.entity || null,
        gameStatus,
        sponsored: optionalBoolean(
          raw.sponsored,
          raw.isSponsored,
          primary?.sponsored
        ) === true,
        smr: optionalBoolean(raw.smr, primary?.smr),
        imageUrl: String(raw.imageUrl || raw.imageURL || raw.image || primary?.raw?.imageUrl || ''),
        description: String(raw.description || raw.poiDescription || ''),
        s2L14: String(raw.s2L14 || ''),
        s2L17: String(raw.s2L17 || ''),
        provenance: ['WAYFARER_PASSIVE'],
        sourceGameObjectMeta: meta,
        sourceGameObjects: gameObjects.map(item => ({
          entity: item.entity,
          rawEntity: item.rawEntity,
          status: item.status,
          gameBrand: item.gameBrand,
          malformed: item.malformed === true
        }))
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

  function toBridgePoi(parsedPoi) {
    if (!parsedPoi || !KNOWN_ENTITIES.has(parsedPoi.gameEntity)) return null;
    if (parsedPoi.gameStatus !== 'ACTIVE') return null;
    return {
      guid: parsedPoi.guid,
      title: parsedPoi.title,
      lat: parsedPoi.lat,
      lng: parsedPoi.lng,
      gameEntity: parsedPoi.gameEntity,
      gameStatus: parsedPoi.gameStatus,
      sponsored: parsedPoi.sponsored === true,
      smr: parsedPoi.smr === true ? true : parsedPoi.smr === false ? false : null,
      imageUrl: parsedPoi.imageUrl || '',
      description: parsedPoi.description || '',
      s2L14: parsedPoi.s2L14 || '',
      s2L17: parsedPoi.s2L17 || '',
      provenance: Array.isArray(parsedPoi.provenance) ? parsedPoi.provenance : ['WAYFARER_PASSIVE']
    };
  }

  function bridgePoisFromParsed(list) {
    return (Array.isArray(list) ? list : []).map(toBridgePoi).filter(Boolean);
  }

  window.CampsiteBridgePoiParser = Object.freeze({
    version: VERSION,
    entityPriority: [...ENTITY_PRIORITY],
    normalizeEntity,
    normalizeStatus,
    normalizeGameObjects,
    classifyGameObject,
    parsePoi,
    parsePayload,
    toBridgePoi,
    bridgePoisFromParsed
  });
})();
