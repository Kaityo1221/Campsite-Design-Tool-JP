    ...(() => {
      // iPhone/Safari viewport-resume guard.
      // Notifications, app switching, browser chrome changes and rotation can
      // change the visual viewport without a normal map drag lifecycle. When
      // that happens, force Google Maps to refresh its layout and then re-run
      // the pane-locked POI projection at the new viewport geometry.
      const ua = String(navigator?.userAgent || '');
      if (!/iPhone|iPad|iPod/i.test(ua)) return {};

      let disposed = false;
      let timer = 0;
      const cleanup = [];

      function looksLikeMap(value) {
        return Boolean(value && typeof value === 'object' &&
          typeof value.getCenter === 'function' &&
          typeof value.getZoom === 'function' &&
          typeof value.getDiv === 'function' &&
          typeof value.addListener === 'function');
      }

      function findMapFromAngular() {
        const host = document.querySelector('app-wf-base-map');
        if (!host || !Array.isArray(host.__ngContext__)) return null;
        for (const value of host.__ngContext__) {
          if (looksLikeMap(value)) return value;
          if (!value || typeof value !== 'object') continue;
          let keys = [];
          try { keys = Object.keys(value); } catch (_) { continue; }
          for (const key of keys) {
            let nested = null;
            try { nested = value[key]; } catch (_) { continue; }
            if (looksLikeMap(nested)) return nested;
          }
        }
        return null;
      }

      function findMap() {
        let map = window.__campsiteBridgeGoogleMap || null;
        if (!looksLikeMap(map)) {
          try { map = window.WFMM?.map?.get?.() || null; } catch (_) {}
        }
        if (!looksLikeMap(map)) {
          try { map = window.CampsiteBridgePcCollector?.findMap?.() || null; } catch (_) {}
        }
        if (!looksLikeMap(map)) map = findMapFromAngular();
        return looksLikeMap(map) ? map : null;
      }

      function hardResync() {
        if (disposed) return false;
        const map = findMap();
        if (!map) {
          try { window.CampsiteBridgeIPhonePaneLockedPoi?.refresh?.(); } catch (_) {}
          return false;
        }

        try { window.__campsiteBridgeGoogleMap = map; } catch (_) {}
        try { window.google?.maps?.event?.trigger?.(map, 'resize'); } catch (_) {}

        // Give Google Maps one layout frame before forcing the canonical end of
        // movement. The pane-locked renderer listens for idle and reprojects once.
        requestAnimationFrame(() => {
          if (disposed) return;
          try { window.google?.maps?.event?.trigger?.(map, 'idle'); } catch (_) {}
          try { window.CampsiteBridgeIPhonePaneLockedPoi?.refresh?.(); } catch (_) {}
          try { window.CampsiteBridgeIPhoneUiOcclusionGuard?.refresh?.(); } catch (_) {}
        });
        return true;
      }

      function scheduleResync(delay = 80) {
        if (disposed) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = 0;
          hardResync();
          // Safari sometimes settles the visual viewport over more than one frame.
          setTimeout(hardResync, 120);
          setTimeout(hardResync, 320);
        }, delay);
      }

      function on(target, type, handler, options) {
        if (!target?.addEventListener) return;
        target.addEventListener(type, handler, options);
        cleanup.push(() => {
          try { target.removeEventListener(type, handler, options); } catch (_) {}
        });
      }

      on(window, 'resize', () => scheduleResync(40), { passive: true });
      on(window, 'orientationchange', () => scheduleResync(120), { passive: true });
      on(window, 'pageshow', () => scheduleResync(40), { passive: true });
      on(document, 'visibilitychange', () => {
        if (document.visibilityState === 'visible') scheduleResync(60);
      }, { passive: true });
      if (window.visualViewport) {
        on(window.visualViewport, 'resize', () => scheduleResync(40), { passive: true });
      }

      // Initial sanity pass in case this part loads after Safari already changed
      // its viewport while the shortcut runtime was starting.
      for (const delay of [80, 300, 900]) setTimeout(() => scheduleResync(0), delay);

      window.CampsiteBridgeIPhoneViewportResync = Object.freeze({
        refresh: hardResync
      });

      window.addEventListener('pagehide', () => {
        disposed = true;
        if (timer) clearTimeout(timer);
        timer = 0;
        for (const fn of cleanup.splice(0)) fn();
      }, { once: true });

      return {};
    })(),