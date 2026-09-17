    }

    if (mapDiscoveryTimer) return;
    mapDiscoveryTimer = setInterval(() => {
      const wfmmNow = isWfmmPresent();
      if (wfmmNow) {
        try { captureBridgeMap(window.WFMM?.map?.get?.()); } catch (_) {}
        if (syncSponsorPreviewFromWfmm()) scheduleRender();
      } else {
        installGoogleMapCaptureHooks();
        discoverExistingGoogleMap();
      }

      if (wfmmNow !== lastWfmmDetected) {
        lastWfmmDetected = wfmmNow;
        scheduleRender();
      }
    }, MAP_DISCOVERY_INTERVAL_MS);
  }

  function normalizeSponsorMatchId(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const descriptor = decodeSponsoredDescriptor(raw);
    if (descriptor?.poiId) return canonicalGuidBase(descriptor.poiId);
    return canonicalGuidBase(raw);
  }

  function isWfmmSponsoredEntityActuallyVisible(entity) {
    const WFMM = window.WFMM;
    if (!WFMM || !entity) return false;

    // Mirror WFMM's own map-entity visibility rules as closely as possible.
    // A cached/published import-sponsored entity is NOT necessarily painted.
    // In particular, the provider has minZoom=16, so treating every cached
    // entity as visible suppresses Bridge rings at lower zooms.
    let provider = null;
    try { provider = WFMM.mapEntities?.getProvider?.(entity.providerId || 'import-sponsored') || null; } catch (_) {}

    const map = WFMM.map?.get?.() || bridgeMap || null;
    const zoom = Number(map?.getZoom?.());
    if (Number.isFinite(zoom)) {
      const minZoom = Number(provider?.minZoom);
      const maxZoom = Number(provider?.maxZoom);
      if (Number.isFinite(minZoom) && zoom < minZoom) return false;
      if (Number.isFinite(maxZoom) && zoom > maxZoom) return false;
    }

    try {
      const layerId = String(entity?.layerId || provider?.layerId || '').trim();
      if (layerId && WFMM.layers?.isEnabled?.(layerId) === false) return false;
    } catch (_) {}

    try {
      if (typeof provider?.isEntityVisible === 'function' &&
          provider.isEntityVisible(entity, { WFMM, map }) === false) return false;
    } catch (_) {}

    try {
      if (provider?.usesGlobalFilters !== false && WFMM.filters?.passesEntity &&
          WFMM.filters.passesEntity(entity) === false) return false;
    } catch (_) {}

    const lat = Number(entity?.lat);
    const lng = Number(entity?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;

    try {
      if (provider?.usesViewportCulling === true) {
        const bounds = map?.getBounds?.();
        if (bounds && bounds.contains && !bounds.contains({ lat, lng })) return false;
      }
    } catch (_) {}

    // If the mandatory WFMM map overlay runtime is absent, there is no
    // confirmed WFMM marker to protect from duplication.
    if (!WFMM.mapEntityOverlay) return false;
    return true;
  }

  function getWfmmVisibleSponsoredIds() {
    const ids = new Set();
    const WFMM = window.WFMM;
    if (!WFMM?.mapEntities?.listByProvider) return ids;
    let entities = [];
    try { entities = WFMM.mapEntities.listByProvider('import-sponsored') || []; } catch (_) {}
    for (const entity of entities) {
      if (!isWfmmSponsoredEntityActuallyVisible(entity)) continue;
      const candidates = [
        entity?.id,
        entity?.wayfarerPoiId,
        entity?.sourceData?.id,
        entity?.sourceData?.poiId
      ];
      for (const candidate of candidates) {
        const id = normalizeSponsorMatchId(candidate);
        if (id) ids.add(id);
      }
    }
    return ids;
  }

  function isSponsorAlreadyVisibleInWfmm(poi, wfmmVisibleIds = null) {
    if (!isWfmmPresent()) return false;
    const ids = wfmmVisibleIds || getWfmmVisibleSponsoredIds();
    const id = normalizeSponsorMatchId(poi?.sponsorPoiId || poi?.guid);
    return Boolean(id && ids.has(id));
  }

  function syncSponsorPreviewFromWfmm() {
    const WFMM = window.WFMM;
    if (!WFMM?.sponsoredPois?.listCached) {
      stats.wfmmSponsoredRecords = 0;
      return false;
    }
    let records = [];
    try { records = WFMM.sponsoredPois.listCached() || []; } catch (_) { records = []; }
    stats.wfmmSponsoredRecords = records.length;
    let changed = false;

    // PERF: build one GUID index instead of scanning every POI for every
    // WFMM sponsor record. This turns O(records × POIs) into O(records + POIs).
    const poiByCanonicalId = new Map();
    for (const poi of poiByGuid.values()) {
      const id = normalizeSponsorMatchId(poi?.guid);
      if (id && !poiByCanonicalId.has(id)) poiByCanonicalId.set(id, poi);
    }

    for (const record of records) {
      const sponsorId = normalizeSponsorMatchId(record?.id);
      if (!sponsorId) continue;
      const matched = poiByCanonicalId.get(sponsorId) || null;
      if (!matched) continue;
      if (matched.sponsored !== true) {
        matched.sponsored = true;
        changed = true;
      }
      matched.sponsorPoiId = String(record?.id || matched.guid || '');
      const title = String(record?.title || '').trim();
      if (title && title !== 'Sponsored location') {
        if (matched.title !== title || matched.sponsorNameVerified !== true) changed = true;
        matched.title = title;
        matched.sponsorNameVerified = true;
      }
    }
    return changed;
  }

  function makeOverlayPoint(projection, poi) {
    const maps = window.google?.maps;
    if (!projection?.fromLatLngToDivPixel || !maps?.LatLng) return null;
    try {
      const point = projection.fromLatLngToDivPixel(new maps.LatLng(Number(poi.lat), Number(poi.lng)));
      if (!point || !Number.isFinite(Number(point.x)) || !Number.isFinite(Number(point.y))) return null;
      return { x: Number(point.x), y: Number(point.y) };
    } catch (_) {
      return null;
    }
  }

  function createPowerSpotOverlay(poi, point) {
    const marker = document.createElement('div');
    const inactive = normalizeStatus(poi.gameStatus) === 'INACTIVE';
    Object.assign(marker.style, {
      position: 'absolute',
      left: `${point.x}px`,
      top: `${point.y}px`,
      transform: 'translate(-50%,-50%)',
      width: '12px',
      height: '12px',
      borderRadius: '50%',
      boxSizing: 'border-box',
      background: POWERSPOT_FILL,
      border: `2px solid ${POWERSPOT_BORDER}`,
      boxShadow: '0 1px 4px rgba(0,0,0,.38)',
      opacity: inactive ? '.38' : '1',
      filter: inactive ? 'grayscale(1)' : 'none',
      pointerEvents: 'none'
    });
    marker.setAttribute('aria-hidden', 'true');

    if (inactive) {
      const stop = document.createElement('span');
      stop.textContent = '⏸';
      Object.assign(stop.style, {
        position: 'absolute',
        right: '-7px',
        top: '-7px',
        fontSize: '8px',
        lineHeight: '10px',
        width: '11px',
        height: '11px',
        borderRadius: '999px',
        textAlign: 'center',
        background: 'rgba(15,23,42,.9)',
        color: '#fff',
        filter: 'none',
        opacity: '1'
      });
      marker.appendChild(stop);
    }
    return marker;
  }

  function handleSponsorRingClick(event, poi) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation?.();
    const guid = String(poi.guid || '');
    if (activeSponsorPopupGuid === guid) {
      closeSponsorPopup();
      return;
    }
    if (poi.sponsorNameVerified !== true) return;
    activeSponsorPopupGuid = guid;
    sponsorPopupOpenedAt = Date.now();
    scheduleOverlayRender();
  }

  function createSponsorRingOverlay(poi, point) {
