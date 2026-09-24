    ...(() => {
      // iPhone/Safari latest-range color overlay motion bridge.
      // Mirror one-finger pans and pinch zooms while the gesture is active.
      // When Wayfarer switches to its low-zoom Wayspot sample mode, suppress
      // Bridge colors entirely and wait for a fresh GCS viewport before showing
      // them again after returning to the normal map view.
      const ROOT_ID = 'campsite-bridge-iphone-latest-colors';
      const GCS_PATH = '/api/v1/vault/mapview/gcs';
      const SAMPLE_TEXT_PATTERNS = [
        'Wayspotのサンプルを表示',
        'Wayspot のサンプルを表示',
        'sample of Wayspots',
        'sample of the Wayspots'
      ];

      let mapGestureActive = false;
      let gestureMode = 'none';
      let freshGcsPollTimer = null;
      let freshTimeoutTimer = null;
      let sampleCheckTimer = null;
      let sampleObserver = null;
      let sampleModeActive = false;
      let gestureStartGcsUrl = '';

      let startX = 0;
      let startY = 0;
      let baseOffsetX = 0;
      let baseOffsetY = 0;
      let offsetX = 0;
      let offsetY = 0;

      let pinchStartDistance = 0;
      let pinchStartCenterX = 0;
      let pinchStartCenterY = 0;
      let pinchScale = 1;
      let pinchOffsetX = 0;
      let pinchOffsetY = 0;

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

      function detectSampleMode() {
        let text = '';
        try { text = String(document.body?.textContent || ''); } catch (_) { text = ''; }
        if (!text) return false;
        return SAMPLE_TEXT_PATTERNS.some(pattern => text.includes(pattern));
      }

      function clearWaitTimers() {
        if (freshGcsPollTimer) clearInterval(freshGcsPollTimer);
        if (freshTimeoutTimer) clearTimeout(freshTimeoutTimer);
        freshGcsPollTimer = null;
        freshTimeoutTimer = null;
      }

      function resetGestureTransform() {
        offsetX = 0;
        offsetY = 0;
        baseOffsetX = 0;
        baseOffsetY = 0;
        pinchScale = 1;
        pinchOffsetX = 0;
        pinchOffsetY = 0;
        const root = getRoot();
        if (!root) return;
        root.style.setProperty('transform-origin', '0 0', 'important');
        root.style.setProperty('transform', 'translate3d(0,0,0) scale(1)', 'important');
      }

      function hideColors() {
        const root = getRoot();
        if (!root) return;
        root.style.setProperty('visibility', 'hidden', 'important');
        root.style.setProperty('opacity', '0', 'important');
      }

      function ensureColorsVisible() {
        const root = getRoot();
        if (!root || sampleModeActive) {
          hideColors();
          return false;
        }
        root.style.setProperty('visibility', 'visible', 'important');
        root.style.setProperty('opacity', '1', 'important');
        return true;
      }

      function applyPanTransform() {
        const root = getRoot();
        if (!root || sampleModeActive) {
          hideColors();
          return;
        }
        root.style.setProperty('visibility', 'visible', 'important');
        root.style.setProperty('opacity', '1', 'important');
        root.style.setProperty('transition', 'none', 'important');
        root.style.setProperty('transform-origin', '0 0', 'important');
        root.style.setProperty('transform', `translate3d(${offsetX}px, ${offsetY}px, 0) scale(1)`, 'important');
        root.style.setProperty('will-change', 'transform,opacity', 'important');
      }

      function touchDistance(touches) {
        if (!touches || touches.length < 2) return 0;
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        return Math.hypot(dx, dy);
      }

      function touchCenter(touches) {
        if (!touches || touches.length < 2) return { x: 0, y: 0 };
        return {
          x: (touches[0].clientX + touches[1].clientX) / 2,
          y: (touches[0].clientY + touches[1].clientY) / 2
        };
      }

      function beginPinch(touches) {
        gestureMode = 'zoom';
        pinchStartDistance = Math.max(1, touchDistance(touches));
        const center = touchCenter(touches);
        pinchStartCenterX = center.x;
        pinchStartCenterY = center.y;
        pinchScale = 1;
        pinchOffsetX = offsetX;
        pinchOffsetY = offsetY;
      }

      function applyPinchTransform(touches) {
        const root = getRoot();
        if (!root || sampleModeActive) {
          hideColors();
          return;
        }
        if (!pinchStartDistance) beginPinch(touches);

        const distance = Math.max(1, touchDistance(touches));
        const center = touchCenter(touches);
        pinchScale = Math.max(0.2, Math.min(5, distance / pinchStartDistance));

        // Scale around the gesture's original center, while also following any
        // drift of the pinch center itself.
        const centerDx = center.x - pinchStartCenterX;
        const centerDy = center.y - pinchStartCenterY;
        const originCompX = pinchStartCenterX * (1 - pinchScale);
        const originCompY = pinchStartCenterY * (1 - pinchScale);
        const tx = pinchOffsetX + centerDx + originCompX;
        const ty = pinchOffsetY + centerDy + originCompY;

        root.style.setProperty('visibility', 'visible', 'important');
        root.style.setProperty('opacity', '1', 'important');
        root.style.setProperty('transition', 'none', 'important');
        root.style.setProperty('transform-origin', '0 0', 'important');
        root.style.setProperty('transform', `translate3d(${tx}px, ${ty}px, 0) scale(${pinchScale})`, 'important');
        root.style.setProperty('will-change', 'transform,opacity', 'important');
      }

      function restoreVisualState() {
        const root = getRoot();
        if (!root || sampleModeActive) {
          hideColors();
          return;
        }
        root.style.setProperty('visibility', 'visible', 'important');
        root.style.setProperty('transition', 'opacity 120ms ease', 'important');
        root.style.setProperty('opacity', '1', 'important');
        setTimeout(() => {
          if (mapGestureActive || swapInFlight || sampleModeActive) return;
          root.style.removeProperty('transition');
          root.style.removeProperty('will-change');
        }, 150);
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

        if (sampleModeActive) {
          hideColors();
          return;
        }

        if (touches.length === 1) {
          gestureMode = 'pan';
          startX = touches[0].clientX;
          startY = touches[0].clientY;
          applyPanTransform();
        } else {
          beginPinch(touches);
          applyPinchTransform(touches);
        }
      }

      function moveTouch(event) {
        if (!mapGestureActive || isBridgeUiTarget(event?.target)) return;
        const touches = event?.touches;
        if (!touches?.length) return;

        if (sampleModeActive) {
          hideColors();
          return;
        }

        if (touches.length > 1) {
          if (gestureMode !== 'zoom') beginPinch(touches);
          applyPinchTransform(touches);
          return;
        }

        if (gestureMode === 'zoom') return;

        const touch = touches[0];
        offsetX = baseOffsetX + (touch.clientX - startX);
        offsetY = baseOffsetY + (touch.clientY - startY);
        applyPanTransform();
      }

      async function swapToFreshViewport() {
        if (swapInFlight || mapGestureActive || sampleModeActive) return false;
        const currentUrl = latestGcsUrl();
        if (!currentUrl || currentUrl === gestureStartGcsUrl) return false;

        swapInFlight = true;
        clearWaitTimers();
        const root = getRoot();
        const recovery = window.CampsiteBridgeIPhoneRecovery;

        if (root) {
          root.style.setProperty('transition', 'opacity 80ms ease', 'important');
          root.style.setProperty('opacity', '0.45', 'important');
        }

        await new Promise(resolve => setTimeout(resolve, 45));
        if (mapGestureActive || sampleModeActive) {
          swapInFlight = false;
          hideColors();
          return false;
        }

        resetGestureTransform();

        try { await recovery?.replayLatestPerformanceGcs?.(); } catch (_) {}
        try { recovery?.repaintLatestRange?.(); } catch (_) {}

        if (root && !sampleModeActive) {
          requestAnimationFrame(() => {
            root.style.setProperty('visibility', 'visible', 'important');
            root.style.setProperty('transition', 'opacity 110ms ease', 'important');
            root.style.setProperty('opacity', '1', 'important');
          });
        }

        setTimeout(() => {
          swapInFlight = false;
          if (!mapGestureActive && root && !sampleModeActive) {
            root.style.removeProperty('transition');
            root.style.removeProperty('will-change');
          }
        }, 140);
        return true;
      }

      function waitForFreshViewport() {
        clearWaitTimers();
        if (sampleModeActive) {
          hideColors();
          return;
        }
        void swapToFreshViewport();

        freshGcsPollTimer = setInterval(() => {
          if (mapGestureActive || swapInFlight || sampleModeActive) return;
          void swapToFreshViewport();
        }, 70);

        // Small pans sometimes do not produce another GCS request. In that
        // case retain the translated pan frame. For zooms, never restore a stale
        // scaled frame after the timeout.
        freshTimeoutTimer = setTimeout(() => {
          if (freshGcsPollTimer) clearInterval(freshGcsPollTimer);
          freshGcsPollTimer = null;
          if (!mapGestureActive && gestureMode === 'pan' && !sampleModeActive) {
            restoreVisualState();
          } else if (gestureMode === 'zoom') {
            hideColors();
          }
        }, 2200);
      }

      function endTouch(event) {
        if (!mapGestureActive) return;
        const remainingTouches = event?.touches?.length || 0;
        if (remainingTouches > 0) return;

        mapGestureActive = false;
        if (sampleModeActive) {
          hideColors();
          return;
        }

        if (gestureMode === 'pan') applyPanTransform();
        waitForFreshViewport();
      }

      function syncSampleMode() {
        sampleCheckTimer = null;
        const next = detectSampleMode();
        if (next === sampleModeActive) {
          if (next) hideColors();
          return;
        }

        sampleModeActive = next;
        if (sampleModeActive) {
          clearWaitTimers();
          resetGestureTransform();
          hideColors();
          return;
        }

        // We just left Wayfarer's sample mode. Do not resurrect the pre-sample
        // local markers. Treat the current GCS URL as the baseline and wait for
        // a genuinely fresh normal-view response before revealing Bridge colors.
        resetGestureTransform();
        hideColors();
        gestureStartGcsUrl = latestGcsUrl();
        waitForFreshViewport();
      }

      function scheduleSampleModeCheck() {
        if (sampleCheckTimer) return;
        sampleCheckTimer = setTimeout(syncSampleMode, 80);
      }

      document.addEventListener('touchstart', beginTouch, { capture: true, passive: true });
      document.addEventListener('touchmove', moveTouch, { capture: true, passive: true });
      document.addEventListener('touchend', endTouch, { capture: true, passive: true });
      document.addEventListener('touchcancel', endTouch, { capture: true, passive: true });

      try {
        sampleObserver = new MutationObserver(scheduleSampleModeCheck);
        if (document.body) {
          sampleObserver.observe(document.body, { childList: true, subtree: true, characterData: true });
        }
      } catch (_) {
        sampleObserver = null;
      }
      syncSampleMode();

      window.addEventListener('pagehide', () => {
        clearWaitTimers();
        if (sampleCheckTimer) clearTimeout(sampleCheckTimer);
        sampleCheckTimer = null;
        try { sampleObserver?.disconnect?.(); } catch (_) {}
      }, { once: true });

      return {};
    })(),
