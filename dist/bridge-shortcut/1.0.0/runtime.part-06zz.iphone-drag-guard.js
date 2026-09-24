    ...(() => {
      // iPhone/Safari latest-range color overlay guard.
      // The fallback overlay is screen-fixed, so keeping it visible while the
      // Google map is being dragged makes markers appear to swim. Hide it for
      // the gesture and only reveal it after Wayfarer has issued a fresh GCS
      // request for the new viewport.
      const ROOT_ID = 'campsite-bridge-iphone-latest-colors';
      const GCS_PATH = '/api/v1/vault/mapview/gcs';
      let mapGestureActive = false;
      let settleTimer = null;
      let freshGcsPollTimer = null;
      let gestureStartGcsUrl = '';

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

      function hideColors() {
        const root = getRoot();
        if (!root) return;
        root.style.setProperty('visibility', 'hidden', 'important');
        root.style.setProperty('opacity', '0', 'important');
      }

      function showColors() {
        const root = getRoot();
        if (!root) return;
        root.style.removeProperty('visibility');
        root.style.removeProperty('opacity');
      }

      function clearWaitTimers() {
        if (settleTimer) clearTimeout(settleTimer);
        if (freshGcsPollTimer) clearInterval(freshGcsPollTimer);
        settleTimer = null;
        freshGcsPollTimer = null;
      }

      function beginMapGesture(event) {
        if (!isMapTarget(event?.target)) return;
        mapGestureActive = true;
        clearWaitTimers();
        gestureStartGcsUrl = latestGcsUrl();
        hideColors();
      }

      function revealAfterFreshGcs() {
        const recovery = window.CampsiteBridgeIPhoneRecovery;
        const currentUrl = latestGcsUrl();
        if (!currentUrl || currentUrl === gestureStartGcsUrl) return false;

        Promise.resolve()
          .then(() => recovery?.replayLatestPerformanceGcs?.())
          .catch(() => {})
          .finally(() => {
            try { recovery?.repaintLatestRange?.(); } catch (_) {}
            if (!mapGestureActive) showColors();
          });
        return true;
      }

      function endMapGesture() {
        if (!mapGestureActive) return;
        mapGestureActive = false;
        hideColors();
        clearWaitTimers();

        // Give Wayfarer a brief moment to start its viewport request, then poll
        // the Performance Resource Timing buffer. Never reveal stale markers.
        settleTimer = setTimeout(() => {
          settleTimer = null;

          if (revealAfterFreshGcs()) return;

          freshGcsPollTimer = setInterval(() => {
            if (mapGestureActive) {
              hideColors();
              return;
            }
            if (!revealAfterFreshGcs()) return;
            clearInterval(freshGcsPollTimer);
            freshGcsPollTimer = null;
          }, 90);
        }, 90);
      }

      const startEvents = ['touchstart', 'pointerdown'];
      const moveEvents = ['touchmove', 'pointermove'];
      const endEvents = ['touchend', 'touchcancel', 'pointerup', 'pointercancel'];

      for (const name of startEvents) {
        document.addEventListener(name, beginMapGesture, { capture: true, passive: true });
      }
      for (const name of moveEvents) {
        document.addEventListener(name, event => {
          if (!mapGestureActive) return;
          if (isBridgeUiTarget(event?.target)) return;
          hideColors();
        }, { capture: true, passive: true });
      }
      for (const name of endEvents) {
        document.addEventListener(name, endMapGesture, { capture: true, passive: true });
      }

      window.addEventListener('pagehide', () => {
        clearWaitTimers();
      }, { once: true });

      return {};
    })(),
