    ...(() => {
      // iPhone/Safari: if the live Google OverlayView path is captured but not
      // actually visible, prefer the proven GCS/DOM fallback renderer.
      // This keeps startup POI acquisition while preventing a captured bridgeMap
      // from suppressing the only renderer Safari is currently showing reliably.
      const ua = String(navigator?.userAgent || '');
      if (!/iPhone|iPad|iPod/i.test(ua)) return {};

      let fallbackAuthority = false;
      let authorityTimer = null;
      const baseCaptureBridgeMapForAuthority = captureBridgeMap;

      function nativeOverlayClearlyVisible() {
        const first = gameOverlayDiag?.first || null;
        return Boolean(
          bridgeOverlayRoot?.isConnected &&
          Number(gameOverlayDiag?.created || 0) > 0 &&
          first?.inViewport === true &&
          first?.hitIsMarker === true
        );
      }

      function domFallbackReady() {
        try {
          const state = window.CampsiteBridgeIPhoneDomOverlay?.getState?.();
          return Boolean(state?.boundsFound && state?.mapRectFound);
        } catch (_) {
          return false;
        }
      }

      function detachNativeOverlay() {
        try { bridgeOverlay?.setMap?.(null); } catch (_) {}
        try { bridgeOverlayRoot?.remove?.(); } catch (_) {}
        bridgeOverlay = null;
        bridgeOverlayRoot = null;
        bridgeMap = null;
      }

      function activateFallbackAuthority() {
        if (fallbackAuthority || isWfmmPresent()) return fallbackAuthority;
        if (!poiByGuid?.size || !domFallbackReady()) return false;

        // If the native overlay is genuinely on top and visible, keep it.
        if (nativeOverlayClearlyVisible()) return false;

        fallbackAuthority = true;
        captureBridgeMap = function(map) {
          if (fallbackAuthority) return null;
          return baseCaptureBridgeMapForAuthority(map);
        };
        detachNativeOverlay();
        return true;
      }

      function refreshFallbackAuthority() {
        if (isWfmmPresent()) return;
        if (!fallbackAuthority) activateFallbackAuthority();
        if (!fallbackAuthority) return;

        // The startup recovery guard probes for a Google Map every 500ms.
        // Keep the iPhone renderer on the DOM fallback once selected.
        detachNativeOverlay();
        try { window.CampsiteBridgeIPhoneDomOverlay?.refresh?.(); } catch (_) {}

        const root = document.getElementById('campsite-bridge-iphone-dom-overlay');
        if (root) root.style.setProperty('z-index', '2147483645', 'important');
      }

      for (const delay of [650, 1100, 1800, 2800, 4200]) {
        setTimeout(refreshFallbackAuthority, delay);
      }
      authorityTimer = setInterval(refreshFallbackAuthority, 650);

      window.CampsiteBridgeIPhoneFallbackAuthority = Object.freeze({
        refresh: () => {
          refreshFallbackAuthority();
          return fallbackAuthority;
        },
        getState: () => ({
          active: fallbackAuthority,
          poiCount: Number(poiByGuid?.size || 0),
          domReady: domFallbackReady(),
          nativeVisible: nativeOverlayClearlyVisible(),
          domDrawn: Number(window.CampsiteBridgeIPhoneDomOverlay?.getState?.()?.drawn || 0)
        })
      });

      window.addEventListener('pagehide', () => {
        if (authorityTimer) clearInterval(authorityTimer);
        authorityTimer = null;
      }, { once: true });

      return {};
    })(),
