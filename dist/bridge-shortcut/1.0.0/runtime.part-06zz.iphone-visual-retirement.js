    ...(() => {
      // Stage 5: retire Bridge-owned map visuals on iPhone/iPad.
      // Collection, classification, diagnostics and export remain active.
      const ua = String(navigator?.userAgent || '');
      if (!/iPhone|iPad|iPod/i.test(ua)) return {};

      function clearBridgeMapVisuals() {
        try {
          if (bridgeOverlayRoot) {
            bridgeOverlayRoot.replaceChildren?.();
            bridgeOverlayRoot.style.display = 'none';
            bridgeOverlayRoot.style.visibility = 'hidden';
            bridgeOverlayRoot.style.pointerEvents = 'none';
          }
        } catch (_) {}
        return false;
      }

      try { createGameEntityOverlay = () => null; } catch (_) {}
      try { createSponsorRingOverlay = () => null; } catch (_) {}
      try { createSponsorPopupOverlay = () => null; } catch (_) {}
      try { renderBridgeOverlaysNow = clearBridgeMapVisuals; } catch (_) {}
      try { scheduleOverlayRender = clearBridgeMapVisuals; } catch (_) {}
      try { scheduleOverlayRenderAfterIdle = clearBridgeMapVisuals; } catch (_) {}

      try {
        if (bridgeOverlayFrame) cancelAnimationFrame(bridgeOverlayFrame);
        bridgeOverlayFrame = 0;
      } catch (_) {}
      try {
        if (sponsorRingStabilizeTimer) clearTimeout(sponsorRingStabilizeTimer);
        sponsorRingStabilizeTimer = null;
      } catch (_) {}

      setTimeout(() => {
        clearBridgeMapVisuals();
        try {
          const inactiveToggle = document.getElementById('cbs-inactive-toggle');
          if (inactiveToggle) inactiveToggle.style.display = 'none';
          const displayNote = document.getElementById('cbs-display-note');
          if (displayNote) displayNote.style.display = 'none';
        } catch (_) {}
      }, 0);

      window.CampsiteBridgeIPhoneVisualPolicy = Object.freeze({
        bridgeOwnedMapVisuals: false,
        gameEntityOverlay: false,
        sponsorRingOverlay: false,
        manualViewportProjection: false,
        wayfarerDisplayUntouched: true,
        wfmmDisplayUntouched: true
      });

      return {};
    })(),