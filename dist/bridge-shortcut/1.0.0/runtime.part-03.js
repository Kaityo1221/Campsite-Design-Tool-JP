      }
    } catch (error) {
      partial = true;
      stats.sponsorErrors += 1;
      console.warn('[Campsite Bridge Shortcut] Sponsor/SMR enrichment partial', error);
    } finally {
      clearTimeout(timeout);
      scheduleRender();
    }

    return { partial };
  }

  function isWfmmPresent() {
    return Boolean(
      window.WFMM ||
      document.getElementById('wfmm-import-sponsored-link') ||
      document.querySelector('[id^="wfmapmods-"], [class*="wfmapmods-"]')
    );
  }

  function looksLikeGoogleMap(value) {
    return Boolean(
      value &&
      typeof value === 'object' &&
      typeof value.getCenter === 'function' &&
      typeof value.getZoom === 'function' &&
      typeof value.getDiv === 'function' &&
      typeof value.addListener === 'function'
    );
  }

  function closeSponsorPopup() {
    if (!activeSponsorPopupGuid) return;
    activeSponsorPopupGuid = '';
    sponsorPopupOpenedAt = 0;
    scheduleOverlayRender();
  }

  function detachMapInteractionHandlers() {
    try { mapInteractionCleanup?.(); } catch (_) {}
    mapInteractionCleanup = null;
  }

  function attachMapInteractionHandlers(map) {
    detachMapInteractionHandlers();
    if (!map) return;
    const removers = [];

    const suspendOverlay = () => {
      mapInteractionActive = true;
      if (bridgeOverlayRoot) bridgeOverlayRoot.style.visibility = 'hidden';
      if (activeSponsorPopupGuid) closeSponsorPopup();
    };
    const resumeOverlay = () => {
      mapInteractionActive = false;
      if (bridgeOverlayRoot) bridgeOverlayRoot.style.visibility = 'visible';
      scheduleOverlayRender();
    };

    for (const eventName of ['dragstart', 'zoom_changed']) {
      try {
        const listener = map.addListener(eventName, suspendOverlay);
        removers.push(() => listener?.remove?.());
      } catch (_) {}
    }
    for (const eventName of ['dragend', 'idle']) {
      try {
        const listener = map.addListener(eventName, resumeOverlay);
        removers.push(() => listener?.remove?.());
      } catch (_) {}
    }

    const mapDiv = map.getDiv?.();
    if (mapDiv?.addEventListener) {
      const onBlankClick = event => {
        if (!activeSponsorPopupGuid) return;
        if (Date.now() - sponsorPopupOpenedAt < 120) return;
        if (event.target?.closest?.('[data-cbs-sponsor-ring="1"]')) return;
        closeSponsorPopup();
      };
      mapDiv.addEventListener('click', onBlankClick, false);
      removers.push(() => mapDiv.removeEventListener('click', onBlankClick, false));
    }

    mapInteractionCleanup = () => {
      for (const remove of removers) {
        try { remove(); } catch (_) {}
      }
    };
  }

  function detachBridgeOverlay() {
    detachMapInteractionHandlers();
    mapInteractionActive = false;
    if (sponsorRingStabilizeTimer) {
      clearTimeout(sponsorRingStabilizeTimer);
      sponsorRingStabilizeTimer = null;
    }
    if (bridgeOverlayIdleTimer) {
      clearTimeout(bridgeOverlayIdleTimer);
      bridgeOverlayIdleTimer = null;
    }
    if (bridgeOverlayFrame) {
      cancelAnimationFrame(bridgeOverlayFrame);
      bridgeOverlayFrame = 0;
    }
    if (bridgeOverlay) {
      try { bridgeOverlay.setMap(null); } catch (_) {}
    }
    bridgeOverlay = null;
    bridgeOverlayRoot = null;
  }

  function captureBridgeMap(map) {
    if (!looksLikeGoogleMap(map)) return false;
    if (bridgeMap === map) return true;
    bridgeMap = map;
    window.__campsiteBridgeGoogleMap = map;
    detachBridgeOverlay();
    setTimeout(ensureBridgeOverlay, 0);
    return true;
  }

  function inspectObjectForMap(root, maxDepth = 2, maxNodes = 260) {
    if (!root || (typeof root !== 'object' && typeof root !== 'function')) return null;
    const queue = [{ value: root, depth: 0 }];
    const seen = new WeakSet();
    let visited = 0;

    while (queue.length && visited < maxNodes) {
      const { value, depth } = queue.shift();
      if (!value || (typeof value !== 'object' && typeof value !== 'function')) continue;
      if (seen.has(value)) continue;
      seen.add(value);
      visited += 1;
      if (looksLikeGoogleMap(value)) return value;
      if (depth >= maxDepth) continue;

      let keys = [];
      try { keys = Object.getOwnPropertyNames(value).slice(0, 100); } catch (_) { continue; }
      for (const key of keys) {
        let descriptor;
        try { descriptor = Object.getOwnPropertyDescriptor(value, key); } catch (_) { continue; }
        if (!descriptor || !('value' in descriptor)) continue;
        const child = descriptor.value;
        if (!child || (typeof child !== 'object' && typeof child !== 'function')) continue;
        if (looksLikeGoogleMap(child)) return child;
        if (depth === 0 || /map|google|props|fiber|context|instance|component|ng/i.test(key)) {
          queue.push({ value: child, depth: depth + 1 });
        }
      }
    }
    return null;
  }

  function discoverExistingGoogleMap() {
    try {
      const wfmmMap = window.WFMM?.map?.get?.();
      if (captureBridgeMap(wfmmMap)) return bridgeMap;
    } catch (_) {}

    if (captureBridgeMap(window.__campsiteBridgeGoogleMap)) return bridgeMap;

    const gm = document.querySelector('.gm-style');
    let node = gm;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      const found = inspectObjectForMap(node, 2, 220);
      if (captureBridgeMap(found)) return bridgeMap;
    }
    return null;
  }

  function installGoogleMapCaptureHooks() {
    const maps = window.google?.maps;
    const MapCtor = maps?.Map;
    if (!MapCtor?.prototype) return false;

    const proto = MapCtor.prototype;
    for (const methodName of ['getCenter', 'getZoom', 'getBounds', 'panTo', 'setCenter', 'setZoom', 'fitBounds']) {
      const original = proto[methodName];
      if (typeof original !== 'function' || original.__campsiteBridgeCaptureWrapped) continue;
      try {
        const wrapped = function(...args) {
          const result = original.apply(this, args);
          captureBridgeMap(this);
          return result;
        };
        Object.defineProperty(wrapped, '__campsiteBridgeCaptureWrapped', { value: true });
        proto[methodName] = wrapped;
      } catch (_) {}
    }

    if (!MapCtor.__campsiteBridgeConstructorWrapped) {
      try {
        const OriginalMap = MapCtor;
        let WrappedMap = null;
        WrappedMap = new Proxy(OriginalMap, {
          construct(target, args, newTarget) {
            const actualNewTarget = newTarget === WrappedMap ? target : newTarget;
            const instance = Reflect.construct(target, args, actualNewTarget);
            captureBridgeMap(instance);
            return instance;
          }
        });
        Object.defineProperty(WrappedMap, '__campsiteBridgeConstructorWrapped', { value: true });
        maps.Map = WrappedMap;
      } catch (_) {}
    }
    return true;
  }

  function beginMapDiscovery() {
    // WFMM already exposes the live Google Map. When it exists, use that
    // directly and do not monkey-patch google.maps.Map/prototype methods.
    // This keeps Bridge read-only with respect to WFMM's map runtime.
    const initialWfmmMap = window.WFMM?.map?.get?.();
    if (!captureBridgeMap(initialWfmmMap)) {
      installGoogleMapCaptureHooks();
      discoverExistingGoogleMap();
