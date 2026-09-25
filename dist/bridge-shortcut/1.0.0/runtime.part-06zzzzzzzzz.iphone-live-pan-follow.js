    ...(() => {
      // iPhone/Safari live pan follower.
      // Keep Bridge POI visuals attached to the map while a single-finger pan
      // is happening instead of hiding them and waiting for the next GCS load.
      const ua = String(navigator?.userAgent || '');
      if (!/iPhone|iPad|iPod/i.test(ua)) return {};

      const ROOT_ID = 'campsite-bridge-iphone-forced-poi-colors';
      const GCS_PATH = '/api/v1/vault/mapview/gcs';
      let mode = 'idle';
      let startX = 0;
      let startY = 0;
      let dx = 0;
      let dy = 0;
      let startUrl = '';
      let raf = 0;
      let settleRaf = 0;
      let settleStartedAt = 0;

      function latestGcsUrl() {
        try {
          const entries = performance?.getEntriesByType?.('resource') || [];
          for (let i = entries.length - 1; i >= 0; i -= 1) {
            const name = String(entries[i]?.name || '');
            if (name.includes(GCS_PATH)) return name;
          }
        } catch (_) {}
        return '';
      }

      function rootElement() {
        return document.getElementById(ROOT_ID);
      }

      function isMapTarget(target) {
        try { return Boolean(target?.closest?.('.gm-style, app-wf-base-map, google-map')); }
        catch (_) { return false; }
      }

      function applyPanFrame() {
        raf = 0;
        if (mode !== 'pan') return;
        const root = rootElement();
        if (!root) return;
        // The older renderer intentionally hides the root while touchActive.
        // Re-show it here every frame so live panning remains the visual authority.
        root.style.display = 'block';
        root.style.overflow = 'visible';
        root.style.willChange = 'transform';
        root.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        try { window.CampsiteBridgeIPhoneUiOcclusionGuard?.refresh?.(); } catch (_) {}
        raf = requestAnimationFrame(applyPanFrame);
      }

      function startPan(touch) {
        mode = 'pan';
        startX = Number(touch?.clientX || 0);
        startY = Number(touch?.clientY || 0);
        dx = 0;
        dy = 0;
        startUrl = latestGcsUrl();
        if (settleRaf) cancelAnimationFrame(settleRaf);
        settleRaf = 0;
        const root = rootElement();
        if (root) {
          root.style.display = 'block';
          root.style.overflow = 'visible';
          root.style.willChange = 'transform';
          root.style.transform = 'translate3d(0,0,0)';
        }
        if (!raf) raf = requestAnimationFrame(applyPanFrame);
      }

      function startPinch() {
        mode = 'pinch';
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        const root = rootElement();
        if (root) root.style.display = 'none';
      }

      function clearTransientStyles() {
        const root = rootElement();
        if (!root) return;
        root.style.transform = '';
        root.style.willChange = '';
        root.style.overflow = 'hidden';
      }

      function finishAndReproject() {
        if (settleRaf) cancelAnimationFrame(settleRaf);
        settleRaf = 0;
        clearTransientStyles();
        mode = 'idle';
        try { window.CampsiteBridgeIPhoneForcedColors?.refresh?.(); } catch (_) {}
        try { window.CampsiteBridgeIPhoneUiOcclusionGuard?.refresh?.(); } catch (_) {}
        setTimeout(() => {
          try { window.CampsiteBridgeIPhoneForcedColors?.refresh?.(); } catch (_) {}
          try { window.CampsiteBridgeIPhoneUiOcclusionGuard?.refresh?.(); } catch (_) {}
        }, 40);
      }

      function waitForFreshBounds() {
        settleRaf = 0;
        if (mode !== 'settling') return;
        const freshUrl = latestGcsUrl();
        const elapsed = performance.now() - settleStartedAt;
        if ((freshUrl && freshUrl !== startUrl) || elapsed >= 700) {
          finishAndReproject();
          return;
        }
        // Keep the translated overlay visible while Wayfarer loads fresh Wayspots.
        const root = rootElement();
        if (root) {
          root.style.display = 'block';
          root.style.overflow = 'visible';
          root.style.willChange = 'transform';
          root.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        }
        settleRaf = requestAnimationFrame(waitForFreshBounds);
      }

      window.addEventListener('touchstart', event => {
        if (!isMapTarget(event.target)) return;
        const touches = event.touches || [];
        if (touches.length === 1) startPan(touches[0]);
        else if (touches.length > 1) startPinch();
      }, { passive: true, capture: true });

      window.addEventListener('touchmove', event => {
        const touches = event.touches || [];
        if (touches.length > 1) {
          if (mode !== 'pinch') startPinch();
          return;
        }
        if (mode !== 'pan' || touches.length !== 1) return;
        dx = Number(touches[0]?.clientX || 0) - startX;
        dy = Number(touches[0]?.clientY || 0) - startY;
        const root = rootElement();
        if (root) {
          root.style.display = 'block';
          root.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
        }
      }, { passive: true, capture: true });

      const endTouch = event => {
        const remaining = event.touches || [];
        if (remaining.length > 1) {
          startPinch();
          return;
        }
        if (remaining.length === 1) {
          startPan(remaining[0]);
          return;
        }

        if (raf) cancelAnimationFrame(raf);
        raf = 0;

        if (mode === 'pinch') {
          clearTransientStyles();
          mode = 'idle';
          setTimeout(() => {
            try { window.CampsiteBridgeIPhoneForcedColors?.refresh?.(); } catch (_) {}
            try { window.CampsiteBridgeIPhoneUiOcclusionGuard?.refresh?.(); } catch (_) {}
          }, 24);
          return;
        }

        if (mode === 'pan') {
          mode = 'settling';
          settleStartedAt = performance.now();
          if (!settleRaf) settleRaf = requestAnimationFrame(waitForFreshBounds);
        }
      };

      window.addEventListener('touchend', endTouch, { passive: true, capture: true });
      window.addEventListener('touchcancel', endTouch, { passive: true, capture: true });

      window.CampsiteBridgeIPhoneLivePanFollow = Object.freeze({
        getState: () => ({ mode, dx, dy, waitingForFreshBounds: mode === 'settling' })
      });

      window.addEventListener('pagehide', () => {
        if (raf) cancelAnimationFrame(raf);
        if (settleRaf) cancelAnimationFrame(settleRaf);
        raf = 0;
        settleRaf = 0;
        clearTransientStyles();
        mode = 'idle';
      }, { once: true });

      return {};
    })(),
