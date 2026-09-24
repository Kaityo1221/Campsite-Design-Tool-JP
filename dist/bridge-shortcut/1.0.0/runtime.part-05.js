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
    if (entity !== 'POWERSPOT' && status !== 'ACTIVE') return null;
    if (entity === 'POWERSPOT' && status !== 'ACTIVE' && !showInactivePowerSpots) return null;

    const style = entity === 'POKESTOP'
      ? { fill: '#22b8f0', border: '#1748b8' }
      : entity === 'GYM'
        ? { fill: '#f04463', border: '#b91c3c' }
        : { fill: POWERSPOT_FILL, border: POWERSPOT_BORDER };

    const marker = document.createElement('div');
    marker.dataset.cbsGameEntity = entity;
    const inactive = status === 'INACTIVE';
    Object.assign(marker.style, {
      position: 'absolute',
      left: `${point.x}px`,
      top: `${point.y}px`,
      transform: 'translate(-50%,-50%)',
      width: '19px',
      height: '19px',
      borderRadius: '50%',
      boxSizing: 'border-box',
      background: style.fill,
      border: `3px solid ${style.border}`,
      boxShadow: '0 0 0 1px rgba(255,255,255,.94),0 1px 4px rgba(0,0,0,.32)',
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
    stats.sponsorRingCandidates = 0;
    stats.sponsorRingDrawn = 0;

    for (const poi of poiByGuid.values()) {
      const lat = Number(poi.lat);
      const lng = Number(poi.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const point = makeOverlayPoint(projection, poi);
      if (!point) continue;

      // Bridge owns the colored game-entity markers only when WFMM is absent.
      // When WFMM is present, its renderer remains the single visual source.
      if (!wfmmPresent) {
        const gameMarker = createGameEntityOverlay(poi, point);
        if (gameMarker) bridgeOverlayRoot.appendChild(gameMarker);
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
        pointerEvents: 'none',
        zIndex: '2147483000'
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
