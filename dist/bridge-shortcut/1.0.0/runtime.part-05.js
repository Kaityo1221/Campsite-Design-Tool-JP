    const ring = document.createElement('button');
    ring.type = 'button';
    ring.dataset.cbsSponsorRing = '1';
    ring.setAttribute('aria-label', `${poi.title || 'Sponsored'} Sponsored`);
    Object.assign(ring.style, {
      position: 'absolute',
      left: `${point.x}px`,
      top: `${point.y}px`,
      transform: 'translate(-50%,-50%)',
      width: '24px',
      height: '24px',
      padding: '0',
      borderRadius: '50%',
      boxSizing: 'border-box',
      background: 'transparent',
      border: `3px solid ${SPONSOR_RING_COLOR}`,
      boxShadow: '0 0 0 1px rgba(15,23,42,.35),0 1px 5px rgba(0,0,0,.34)',
      pointerEvents: poi.sponsorNameVerified === true ? 'auto' : 'none',
      cursor: poi.sponsorNameVerified === true ? 'pointer' : 'default',
      WebkitTapHighlightColor: 'transparent'
    });
    ring.addEventListener('click', event => handleSponsorRingClick(event, poi));
    ring.addEventListener('pointerdown', event => {
      event.stopPropagation();
    });
    ring.addEventListener('touchstart', event => {
      event.stopPropagation();
    }, { passive: true });
    return ring;
  }

  function createSponsorPopupOverlay(poi, point) {
    if (poi.sponsorNameVerified !== true) return null;
    const popup = document.createElement('div');
    popup.dataset.cbsSponsorPopup = '1';
    const entityLabel = poi.gameEntity === 'GYM' ? 'Gym' : 'PokéStop';
    Object.assign(popup.style, {
      position: 'absolute',
      left: `${point.x}px`,
      top: `${point.y - 24}px`,
      transform: 'translate(-50%,-100%)',
      minWidth: '132px',
      maxWidth: '220px',
      padding: '7px 9px',
      borderRadius: '9px',
      background: 'rgba(15,23,42,.97)',
      color: '#fff',
      boxShadow: '0 6px 20px rgba(0,0,0,.34)',
      font: '600 11px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      textAlign: 'left',
      pointerEvents: 'none',
      whiteSpace: 'normal'
    });

    const name = document.createElement('div');
    name.textContent = String(poi.title || '');
    name.style.fontWeight = '800';
    name.style.marginBottom = '3px';
    const tag = document.createElement('div');
    tag.textContent = `Sponsored · ${entityLabel}`;
    tag.style.color = '#fde68a';
    tag.style.fontSize = '10px';
    popup.append(name, tag);
    return popup;
  }

  function createGameEntityOverlay(poi, point) {
    const entity = normalizeEntity(poi?.gameEntity);
    const status = normalizeStatus(poi?.gameStatus);
    if (!GAME_ENTITIES.has(entity)) return null;
    if (entity === 'POWERSPOT' && status === 'INACTIVE' && !showInactivePowerSpots) return null;

    const style = entity === 'POKESTOP'
      ? { fill: '#22b8f0', border: '#1748b8' }
      : entity === 'GYM'
        ? { fill: '#f04463', border: '#b91c3c' }
        : { fill: POWERSPOT_FILL, border: POWERSPOT_BORDER };

    const marker = document.createElement('div');
    marker.dataset.cbsGameEntity = entity;
    const inactive = entity === 'POWERSPOT' && status === 'INACTIVE';
    Object.assign(marker.style, {
      position: 'absolute',
      left: `${point.x}px`,
      top: `${point.y}px`,
      transform: 'translate(-50%,-50%) translateZ(0)',
      width: '24px',
      height: '24px',
      borderRadius: '50%',
      boxSizing: 'border-box',
      background: style.fill,
      border: `3px solid ${style.border}`,
      boxShadow: '0 0 0 1px rgba(255,255,255,.94),0 2px 5px rgba(0,0,0,.36)',
      opacity: inactive ? '.38' : '1',
      filter: inactive ? 'grayscale(1)' : 'none',
      pointerEvents: 'none',
      zIndex: '2147483646'
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

  // TEMP DIAGNOSTIC: native iPhone overlay draw state.
  // Keep this block self-contained so it can be removed after the visibility bug is isolated.
  const gameOverlayDiag = {
    renderedAt: 0,
    wfmmPresent: false,
    createCalls: 0,
    created: 0,
    pokestop: 0,
    gym: 0,
    powerspot: 0,
    projectionValid: 0,
    projectionInvalid: 0,
    rootConnected: false,
    rootChildNodes: 0,
    rootDisplay: '',
    rootVisibility: '',
    rootOpacity: '',
    rootZIndex: '',
    first: null
  };

  function resetGameOverlayDiagnostics(wfmmPresent) {
    gameOverlayDiag.renderedAt = Date.now();
    gameOverlayDiag.wfmmPresent = Boolean(wfmmPresent);
    gameOverlayDiag.createCalls = 0;
    gameOverlayDiag.created = 0;
    gameOverlayDiag.pokestop = 0;
    gameOverlayDiag.gym = 0;
    gameOverlayDiag.powerspot = 0;
    gameOverlayDiag.projectionValid = 0;
    gameOverlayDiag.projectionInvalid = 0;
    gameOverlayDiag.rootConnected = false;
    gameOverlayDiag.rootChildNodes = 0;
    gameOverlayDiag.rootDisplay = '';
    gameOverlayDiag.rootVisibility = '';
    gameOverlayDiag.rootOpacity = '';
    gameOverlayDiag.rootZIndex = '';
    gameOverlayDiag.first = null;
  }

  function describeOverlayHitElement(el) {
    if (!el) return 'none';
    const tag = String(el.tagName || '').toLowerCase() || 'node';
    const id = el.id ? `#${el.id}` : '';
    const cls = typeof el.className === 'string' && el.className.trim()
      ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}`
      : '';
    const bridgeEntity = el.dataset?.cbsGameEntity ? `[Bridge:${el.dataset.cbsGameEntity}]` : '';
    return `${tag}${id}${cls}${bridgeEntity}`.slice(0, 140);
  }

  function captureGameOverlayDiagnostics(firstMarker, firstPoint) {
    const root = bridgeOverlayRoot;
    if (root) {
      gameOverlayDiag.rootConnected = root.isConnected === true;
      gameOverlayDiag.rootChildNodes = root.childNodes?.length || 0;
      try {
        const rootStyle = getComputedStyle(root);
        gameOverlayDiag.rootDisplay = rootStyle.display;
        gameOverlayDiag.rootVisibility = rootStyle.visibility;
        gameOverlayDiag.rootOpacity = rootStyle.opacity;
        gameOverlayDiag.rootZIndex = rootStyle.zIndex;
      } catch (_) {}
    }

    if (!firstMarker || !root) return;

    const getRect = marker => {
      try { return marker.getBoundingClientRect(); } catch (_) { return null; }
    };
    const isRectInViewport = rect => {
      if (!rect) return false;
      const centerX = rect.left + (rect.width / 2);
      const centerY = rect.top + (rect.height / 2);
      return centerX >= 0 && centerY >= 0 && centerX <= window.innerWidth && centerY <= window.innerHeight;
    };

    let probeMarker = firstMarker;
    let probePoint = firstPoint;
    let rect = getRect(probeMarker);

    // POIs are accumulated while panning, so insertion order can point at an old,
    // off-screen marker. Prefer a currently visible marker so one screenshot is enough.
    if (!isRectInViewport(rect)) {
      for (const candidate of root.querySelectorAll('[data-cbs-game-entity]')) {
        const candidateRect = getRect(candidate);
        if (!isRectInViewport(candidateRect)) continue;
        probeMarker = candidate;
        probePoint = {
          x: Number.parseFloat(candidate.style.left),
          y: Number.parseFloat(candidate.style.top)
        };
        rect = candidateRect;
        break;
      }
    }

    if (!rect) return;

    let style = null;
    try { style = getComputedStyle(probeMarker); } catch (_) {}
    const centerX = rect.left + (rect.width / 2);
    const centerY = rect.top + (rect.height / 2);
    const inViewport = isRectInViewport(rect);
    let hit = null;
    let hitIsMarker = false;

    if (inViewport) {
      const rootPointerEvents = root.style.pointerEvents;
      const markerPointerEvents = probeMarker.style.pointerEvents;
      try {
        // Markers normally use pointer-events:none, so temporarily enable hit-testing
        // only for this synchronous probe. Styles are restored immediately.
        root.style.pointerEvents = 'auto';
        probeMarker.style.pointerEvents = 'auto';
        hit = document.elementFromPoint(centerX, centerY);
        hitIsMarker = hit === probeMarker || probeMarker.contains(hit);
      } catch (_) {
      } finally {
        root.style.pointerEvents = rootPointerEvents;
        probeMarker.style.pointerEvents = markerPointerEvents;
      }
    }

    gameOverlayDiag.first = {
      entity: probeMarker.dataset?.cbsGameEntity || '',
      x: Number(probePoint?.x),
      y: Number(probePoint?.y),
      left: Number(rect.left),
      top: Number(rect.top),
      width: Number(rect.width),
      height: Number(rect.height),
      display: style?.display || '',
      visibility: style?.visibility || '',
      opacity: style?.opacity || '',
      zIndex: style?.zIndex || '',
      inViewport,
      hit: describeOverlayHitElement(hit),
      hitIsMarker
    };
  }

  function renderBridgeOverlaysNow() {
    if (!bridgeOverlayRoot || !bridgeOverlay) return;
    let projection = null;
    try { projection = bridgeOverlay.getProjection?.(); } catch (_) {}
    if (!projection) return;

    bridgeOverlayRoot.replaceChildren();
    const wfmmPresent = isWfmmPresent();
    const wfmmVisibleSponsorIds = wfmmPresent ? getWfmmVisibleSponsoredIds() : new Set();
    const renderNow = Date.now();
    let nextSponsorStabilizeDelay = Infinity;
    let firstGameMarker = null;
    let firstGamePoint = null;
    stats.sponsorRingCandidates = 0;
    stats.sponsorRingDrawn = 0;
    resetGameOverlayDiagnostics(wfmmPresent);

    for (const poi of poiByGuid.values()) {
      const lat = Number(poi.lat);
      const lng = Number(poi.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        gameOverlayDiag.projectionInvalid += 1;
        continue;
      }
      const point = makeOverlayPoint(projection, poi);
      if (!point) {
        gameOverlayDiag.projectionInvalid += 1;
        continue;
      }
      gameOverlayDiag.projectionValid += 1;

      // Bridge owns the colored game-entity markers only when WFMM is absent.
      // When WFMM is present, its renderer remains the single visual source.
      if (!wfmmPresent) {
        gameOverlayDiag.createCalls += 1;
        const gameMarker = createGameEntityOverlay(poi, point);
        if (gameMarker) {
          bridgeOverlayRoot.appendChild(gameMarker);
          gameOverlayDiag.created += 1;
          const drawnEntity = gameMarker.dataset?.cbsGameEntity || '';
          if (drawnEntity === 'POKESTOP') gameOverlayDiag.pokestop += 1;
          else if (drawnEntity === 'GYM') gameOverlayDiag.gym += 1;
          else if (drawnEntity === 'POWERSPOT') gameOverlayDiag.powerspot += 1;
          if (!firstGameMarker) {
            firstGameMarker = gameMarker;
            firstGamePoint = point;
          }
        }
      }

      if (poi.sponsored === true) {
        stats.sponsorRingCandidates += 1;

        const sponsorKey = normalizeSponsorMatchId(poi?.sponsorPoiId || poi?.guid) || String(poi.guid || '');

        // If WFMM is actually painting this exact Sponsor, do not duplicate it.
        // Matching is ID-based only. No coordinate-based name inference is used.
        if (wfmmPresent && isSponsorAlreadyVisibleInWfmm(poi, wfmmVisibleSponsorIds)) {
          sponsorRingStableSince.delete(sponsorKey);
          continue;
        }

        // NOFLICKER:
        // When WFMM is installed, give its own Import Sponsored renderer a short
        // grace window before Bridge exposes a fallback ring. This prevents the
        // sequence "Bridge ring appears -> WFMM catches up -> Bridge ring vanishes".
        // Bridge-only users do not pay this delay.
        if (wfmmPresent) {
          let stableSince = sponsorRingStableSince.get(sponsorKey);
          if (!stableSince) {
            stableSince = renderNow;
            sponsorRingStableSince.set(sponsorKey, stableSince);
          }
          const elapsed = renderNow - stableSince;
          if (elapsed < SPONSOR_RING_STABILIZE_MS) {
            nextSponsorStabilizeDelay = Math.min(
              nextSponsorStabilizeDelay,
              SPONSOR_RING_STABILIZE_MS - elapsed
            );
            continue;
          }
        } else {
          sponsorRingStableSince.delete(sponsorKey);
        }

        bridgeOverlayRoot.appendChild(createSponsorRingOverlay(poi, point));
        stats.sponsorRingDrawn += 1;
        if (activeSponsorPopupGuid === String(poi.guid || '')) {
          const popup = createSponsorPopupOverlay(poi, point);
          if (popup) bridgeOverlayRoot.appendChild(popup);
        }
      }
    }

    captureGameOverlayDiagnostics(firstGameMarker, firstGamePoint);
    const diagBox = document.getElementById('cbs-diagnostics');
    if (diagBox && diagBox.style.display !== 'none') render();

    if (activeSponsorPopupGuid && !poiByGuid.has(activeSponsorPopupGuid)) {
      activeSponsorPopupGuid = '';
      sponsorPopupOpenedAt = 0;
    }

    if (Number.isFinite(nextSponsorStabilizeDelay)) {
      if (sponsorRingStabilizeTimer) clearTimeout(sponsorRingStabilizeTimer);
      sponsorRingStabilizeTimer = setTimeout(() => {
        sponsorRingStabilizeTimer = null;
        scheduleOverlayRender();
      }, Math.max(40, nextSponsorStabilizeDelay + 20));
    }
  }

  function scheduleOverlayRender() {
    if (mapInteractionActive) {
      scheduleOverlayRenderAfterIdle();
      return;
    }
    if (bridgeOverlayFrame) return;
    bridgeOverlayFrame = requestAnimationFrame(() => {
      bridgeOverlayFrame = 0;
      renderBridgeOverlaysNow();
    });
  }

  function scheduleOverlayRenderAfterIdle() {
    if (bridgeOverlayIdleTimer) clearTimeout(bridgeOverlayIdleTimer);
    bridgeOverlayIdleTimer = setTimeout(() => {
      bridgeOverlayIdleTimer = null;
      if (mapInteractionActive) return;
      scheduleOverlayRender();
    }, OVERLAY_IDLE_RENDER_MS);
  }

  function ensureBridgeOverlay() {
    if (!bridgeMap) return null;
    if (bridgeOverlay) {
      scheduleOverlayRender();
      return bridgeOverlay;
    }
    const maps = window.google?.maps;
    if (!maps?.OverlayView) return null;

    const overlay = new maps.OverlayView();
    overlay.onAdd = function() {
      const panes = this.getPanes?.();
      const pane = panes?.floatPane || panes?.overlayMouseTarget || panes?.overlayLayer;
      if (!pane) return;
      const root = document.createElement('div');
      root.id = 'campsite-bridge-map-overlay';
      Object.assign(root.style, {
        position: 'absolute',
        left: '0',
        top: '0',
        width: '0',
        height: '0',
        overflow: 'visible',
        isolation: 'isolate',
        pointerEvents: 'none',
        zIndex: '2147483646'
      });
      pane.appendChild(root);
      bridgeOverlayRoot = root;
      attachMapInteractionHandlers(bridgeMap);
      scheduleOverlayRender();
    };
    overlay.draw = function() {
      // Google Maps calls draw repeatedly while dragging/zooming.
      // Rebuilding hundreds of DOM overlays every frame makes iPhone Safari stutter.
      // Render only after map motion has settled.
      scheduleOverlayRenderAfterIdle();
    };
    overlay.onRemove = function() {
      bridgeOverlayRoot?.remove?.();
      bridgeOverlayRoot = null;
      detachMapInteractionHandlers();
    };
    try {
      overlay.setMap(bridgeMap);
      bridgeOverlay = overlay;
      return overlay;
    } catch (_) {
      return null;
    }