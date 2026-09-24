    ...(() => {
      // iPhone/Safari latest-range color overlay guard.
      // The fallback overlay is screen-fixed, so keeping it visible while the
      // Google map is being dragged makes markers appear to swim. Hide it for
      // the gesture, then replay the latest GCS and repaint after the map settles.
      const ROOT_ID = 'campsite-bridge-iphone-latest-colors';
      let mapGestureActive = false;
      let settleTimer = null;
      let revealTimer = null;

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

      function beginMapGesture(event) {
        if (!isMapTarget(event?.target)) return;
        mapGestureActive = true;
        if (settleTimer) clearTimeout(settleTimer);
        if (revealTimer) clearTimeout(revealTimer);
        settleTimer = null;
        revealTimer = null;
        hideColors();
      }

      function endMapGesture() {
        if (!mapGestureActive) return;
        mapGestureActive = false;
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(async () => {
          settleTimer = null;
          const recovery = window.CampsiteBridgeIPhoneRecovery;
          try { await recovery?.replayLatestPerformanceGcs?.(); } catch (_) {}
          try { recovery?.repaintLatestRange?.(); } catch (_) {}
          showColors();

          // Safari/Wayfarer can finish the final GCS a little later than the
          // touchend. One quiet second-pass prevents a stale frame flashing.
          revealTimer = setTimeout(async () => {
            revealTimer = null;
            if (mapGestureActive) return;
            try { await recovery?.replayLatestPerformanceGcs?.(); } catch (_) {}
            try { recovery?.repaintLatestRange?.(); } catch (_) {}
            showColors();
          }, 420);
        }, 260);
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
        if (settleTimer) clearTimeout(settleTimer);
        if (revealTimer) clearTimeout(revealTimer);
      }, { once: true });

      return {};
    })(),
