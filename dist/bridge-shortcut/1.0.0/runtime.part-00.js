(() => {
  'use strict';

  const BRIDGE_VERSION = '1.0.0';
  const PROTOCOL = 'CAMPSITE_BRIDGE_POI_V1';
  const RECEIVER_ORIGIN = 'https://kaityo1221.github.io';
  const RECEIVER_URL = `${RECEIVER_ORIGIN}/Campsite-Design-Tool-JP/bridge-receiver.html?campsiteBridgeDev=1`;
  const RECEIVER_WINDOW_NAME = 'campsiteBridgeReceiver';

  const GAME_ENTITIES = new Set(['POKESTOP', 'GYM', 'POWERSPOT']);
  const GAME_STATUSES = new Set(['ACTIVE', 'INACTIVE', 'UNKNOWN']);
  const RENDER_DEBOUNCE_MS = 250;
  const MAX_COORD_MATCH_METERS = 12;

  const SPONSOR_GRAPHQL_URL = 'https://niantic-social-api.nianticlabs.com/graphql';
  const SPONSOR_REALITY_CHANNEL_ID = 'da83476a-c4da-4312-a610-a4f2fc2c37f0';
  const SPONSOR_CELL_LEVEL = 15;
  const SPONSOR_MAP_BATCH_SIZE = 24;
  const SPONSOR_DETAIL_BATCH_SIZE = 30;
  const SPONSOR_MAX_L15_PER_SEND = 96;
  const SPONSOR_PREVIEW_MAX_L15_PER_RUN = 24;
  const SPONSOR_PREVIEW_DEBOUNCE_MS = 350;
  const SPONSOR_RING_STABILIZE_MS = 650;
  const SPONSOR_TIMEOUT_MS = 6500;
  const SPONSOR_MAP_OPERATION = 'PgoGameMapObjectsByS2CellsProvider_mapObjectsByS2Cells_Query';
  const SPONSOR_DETAILS_OPERATION = 'PgoGameMapObjectDetails';

  const POWERSPOT_FILL = '#f195eb';
  const POWERSPOT_BORDER = '#e762d3';
  const SPONSOR_RING_COLOR = '#edcd1a';
  const MAP_DISCOVERY_INTERVAL_MS = 1200;
  const OVERLAY_IDLE_RENDER_MS = 160;

  const SPONSOR_MAP_QUERY = `
    query ${SPONSOR_MAP_OPERATION}(
      $realityChannelMapObjectsByS2CellsInput: RealityChannelMapObjectsByS2CellsInput!
    ) {
      realityChannelMapObjectsByS2Cells(input: $realityChannelMapObjectsByS2CellsInput) {
        mapObjectsByS2CellsAndTypes {
          s2CellId
          mapObjectsByType {
            type
            mapObjects {
              id
              mapObjectType
              pgoGym {
                name
                imageUrl
                isMegaEnhancedEligible
                location { latitude longitude }
              }
              pgoPokestop {
                name
                imageUrl
                location { latitude longitude }
              }
            }
          }
        }
      }
    }
  `;

  const SPONSOR_DETAILS_QUERY = `
    query ${SPONSOR_DETAILS_OPERATION}($ids: [ID!]!) {
      gameMapObjectsByID(ids: $ids) {
        id
        mapObjectType
        pgoGym {
          name
          imageUrl
          isMegaEnhancedEligible
          location { latitude longitude }
        }
        pgoPokestop {
          name
          imageUrl
          location { latitude longitude }
        }
      }
    }
  `;

  if (window.__campsiteBridgeShortcutProdInstalled) {
    try { window.CampsiteBridgeShortcut?.openPanel?.(); } catch (_) {}
    return;
  }
  window.__campsiteBridgeShortcutProdInstalled = true;

  const poiByGuid = new Map();
  const smrByGuid = new Map();
  const smrRecords = new Map();
  const observedGcsL14Tokens = new Set();
  const observedSponsorL15Ids = new Set();
  const previewQueriedSponsorL15Ids = new Set();
  const queriedSponsorL15Ids = new Set();
  const sponsoredObjectIdsDetailed = new Set();

  const nativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
  const nativeXhrSend = window.XMLHttpRequest?.prototype?.send;

  let renderTimer = null;
  let sendState = null;
  let sendWorkflowActive = false;
  let extraInfoState = 'unconfirmed'; // unconfirmed | checking | confirmed | partial
  let confirmedSponsorCount = null;
  let confirmedSmrCount = null;
  let sendSucceeded = false;
  let showInactivePowerSpots = true;
  let lastWfmmDetected = false;
  let bridgeMap = null;
  let bridgeOverlay = null;
  let bridgeOverlayRoot = null;
  let bridgeOverlayFrame = 0;
  let bridgeOverlayIdleTimer = null;
  let mapInteractionActive = false;
  let mapDiscoveryTimer = null;
  let mapInteractionCleanup = null;
  let activeSponsorPopupGuid = '';
  let sponsorPopupOpenedAt = 0;
  const sponsorRingStableSince = new Map();
  let sponsorRingStabilizeTimer = null;
  let sponsorPreviewTimer = null;
  let sponsorPreviewInFlight = false;
  let sponsorPreviewController = null;
  let sponsorPreviewGeneration = 0;

  const stats = {
    xhr: 0,
    gcs: 0,
    receivedPoi: 0,
    uniquePoi: 0,
    duplicatePoi: 0,
    parseErrors: 0,
    sponsorMapRequests: 0,
    sponsorDetailRequests: 0,
    sponsorErrors: 0,
    smrRecords: 0,
    sponsorRingCandidates: 0,
    sponsorRingDrawn: 0,
    wfmmSponsoredRecords: 0
  };

  const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

  function normalizeEntity(value) {
    if (typeof value !== 'string') return undefined;
    const normalized = value.toUpperCase().replace(/[\s_-]/g, '');
    if (normalized === 'POKESTOP') return 'POKESTOP';
    if (normalized === 'GYM') return 'GYM';
    if (normalized === 'POWERSPOT') return 'POWERSPOT';
    return undefined;
  }

  function normalizeStatus(value) {
    if (typeof value !== 'string') return 'UNKNOWN';
    const normalized = value.toUpperCase();
    return GAME_STATUSES.has(normalized) ? normalized : 'UNKNOWN';
  }

  function asFiniteNumber(value) {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? n : undefined;
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
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function mergePoi(previous, next) {
    const merged = { ...(previous || {}) };
    for (const [key, value] of Object.entries(next || {})) {
      if (value !== undefined && value !== null && value !== '') merged[key] = value;
      else if (!(key in merged)) merged[key] = value;
    }
    return merged;
  }

  function upsertPoi(poi, deferRender = false) {
    if (!poi?.guid) return false;
    const guid = String(poi.guid);
    const existed = poiByGuid.has(guid);
    const merged = mergePoi(poiByGuid.get(guid), poi);
    poiByGuid.set(guid, merged);
    if (existed) stats.duplicatePoi += 1;
    else if (sendSucceeded) sendSucceeded = false;
    stats.uniquePoi = poiByGuid.size;
    if (!deferRender) scheduleRender();
    return true;
  }

  function candidateFromGcsObject(obj) {
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
