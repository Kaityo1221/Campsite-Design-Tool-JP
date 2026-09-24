    ...(() => {
      // iPhone/Safari latest-range color overlay motion bridge.
      // The color layer is screen-fixed, so mirror one-finger map pans by
      // translating the whole layer. When Wayfarer publishes a fresh GCS
      // viewport, quietly replace the translated frame with the new one.
      const ROOT_ID = 'campsite-bridge-iphone-latest-colors';
      const GCS_PATH = '/api/v1/vault/mapview/gcs';
      let mapGestureActive = false;
      let gestureMode = 'none';
      let freshGcsPollTimer = null;
      let freshTimeoutTimer = null;
      let gestureStartGcsUrl = '';
      let startX = 0;
      let startY = 0;
      let baseOffsetX = 0;
      let baseOffsetY = 0;
      let offsetX = 0;
      let offsetY = 0;
      let swapInFlight = false;

      function getRoot() {
        return document.getElementById(ROOT_ID);
      }

      function isBridgeUiTarget(target) {
        try { return Boolean(target?.closest?.('#campsite-bridge-shortcut-panel')); } catch (_) { return false; }
      }

      function isMapTarget(target) {
        if (!target || isBridgeUiTarget(target)) return false;
        try {
          if (target.closest?.('.gm-style, app-wf-base-map, google-map')) return true;
        } catch (_) {}
        try {
          const mapHost = document.querySelector('app-wf-base-map');
          if (mapHost?.contains?.(target)) return true;
        } catch (_) {}
        return false;
      }

      function latestGcsUrl() {
        try {
          const entries = performance?.getEntriesByType?.('resource') || [];
          for (let index = entries.length - 1; index >= 0; index -= 1) {
            const name = String(entries[index]?.name || '');
            if (name.includes(GCS_PATH)) return name;
          }
        } catch (_) {}
        return '';
      }

      function clearWaitTimers() {
        if (freshGcsPollTimer) clearInterval(freshGcsPollTimer);
        if (freshTimeoutTimer) clearTimeout(freshTimeoutTimer);
        freshGcsPollTimer = null;
        freshTimeoutTimer = null;
      }

      function applyPanTransform() {
        const root = getRoot();
        if (!root) return;
        root.style.setProperty('visibility', 'visible', 'important');
        root.style.setProperty('opacity', '1', 'important');
        root.style.setProperty('transition', 'none', 'important');
        root.style.setProperty('transform', `translate3d(${offsetX}px, ${offsetY}px, 0)`, 'important');
        root.style.setProperty('will-change', 'transform,opacity', 'important');
      }

      function softenForZoom() {
        const root = getRoot();
        if (!root) return;
        root.style.setProperty('visibility', 'visible', 'important');
        root.style.setProperty('transition', 'opacity 120ms ease', 'important');
        root.style.setProperty('opacity', '0.12', 'important');
      }

      function restoreVisualState() {
        const root = getRoot();
        if (!root) return;
        root.style.setProperty('visibility', 'visible', 'important');
        root.style.setProperty('transition', 'opacity 150ms ease', 'important');
        root.style.setProperty('opacity', '1', 'important');
        setTimeout(() => {
          if (mapGestureActive || swapInFlight) return;
          root.style.removeProperty('transition');
          root.style.removeProperty('will-change');
        }, 180);
      }

      function beginTouch(event) {
        if (!isMapTarget(event?.target)) return;
        const touches = event?.touches;
        if (!touches?.length) return;

        mapGestureActive = true;
        swapInFlight = false;
        clearWaitTimers();
        gestureStartGcsUrl = latestGcsUrl();
        baseOffsetX = offsetX;
        baseOffsetY = offsetY;

        if (touches.length === 1) {
          gestureMode = 'pan';
          startX = touches[0].clientX;
          startY = touches[0].clientY;
          applyPanTransform();
        } else {
          gestureMode = 'zoom';
          softenForZoom();
        }
      }

      function moveTouch(event) {
        if (!mapGestureActive || isBridgeUiTarget(event?.target)) return;
        const touches = event?.touches;
        if (!touches?.length) return;

        if (touches.length > 1 || gestureMode === 'zoom') {
          gestureMode = 'zoom';
          softenForZoom();
          return;
        }

        const touch = touches[0];
        offsetX = baseOffsetX + (touch.clientX - startX);
        offsetY = baseOffsetY + (touch.clientY - startY);
        applyPanTransform();
      }

      async function swapToFreshViewport() {
        if (swapInFlight || mapGestureActive) return false;
        const currentUrl = latestGcsUrl();
        if (!currentUrl || currentUrl === gestureStartGcsUrl) return false;

        swapInFlight = true;
        clearWaitTimers();
        const root = getRoot();
        const recovery = window.CampsiteBridgeIPhoneRecovery;

        if (root) {
          root.style.setProperty('transition', 'opacity 100ms ease', 'important');
          root.style.setProperty('opacity', '0.18', 'important');
        }

        await new Promise(resolve => setTimeout(resolve, 70));
        if (mapGestureActive) {
          swapInFlight = false;
          return false;
        }

        offsetX = 0;
        offsetY = 0;
        if (root) root.style.setProperty('transform', 'translate3d(0,0,0)', 'important');

        try { await recovery?.replayLatestPerformanceGcs?.(); } catch (_) {}
        try { recovery?.repaintLatestRange?.(); } catch (_) {}

        if (root) {
          requestAnimationFrame(() => {
            root.style.setProperty('visibility', 'visible', 'important');
            root.style.setProperty('transition', 'opacity 150ms ease', 'important');
            root.style.setProperty('opacity', '1', 'important');
          });
        }

        setTimeout(() => {
          swapInFlight = false;
          if (!mapGestureActive && root) {
            root.style.removeProperty('transition');
            root.style.removeProperty('will-change');
          }
        }, 190);
        return true;
      }

      function waitForFreshViewport() {
        clearWaitTimers();
        if (swapToFreshViewport()) return;

        freshGcsPollTimer = setInterval(() => {
          if (mapGestureActive || swapInFlight) return;
          void swapToFreshViewport();
        }, 70);

        // If Wayfarer decides the pan is too small to request a new viewport,
        // keep the translated markers instead of making them blink away.
        freshTimeoutTimer = setTimeout(() => {
          if (freshGcsPollTimer) clearInterval(freshGcsPollTimer);
          freshGcsPollTimer = null;
          if (!mapGestureActive && gestureMode === 'pan') restoreVisualState();
        }, 2200);
      }

      function endTouch(event) {
        if (!mapGestureActive) return;
        const remainingTouches = event?.touches?.length || 0;
        if (remainingTouches > 0) {
          if (remainingTouches === 1 && gestureMode === 'zoom') softenForZoom();
          return;
        }

        mapGestureActive = false;
        if (gestureMode === 'pan') {
          applyPanTransform();
        } else {
          softenForZoom();
        }
        waitForFreshViewport();
      }

      document.addEventListener('touchstart', beginTouch, { capture: true, passive: true });
      document.addEventListener('touchmove', moveTouch, { capture: true, passive: true });
      document.addEventListener('touchend', endTouch, { capture: true, passive: true });
      document.addEventListener('touchcancel', endTouch, { capture: true, passive: true });

      window.addEventListener('pagehide', () => {
        clearWaitTimers();
      }, { once: true });

      return {};
    })(),
