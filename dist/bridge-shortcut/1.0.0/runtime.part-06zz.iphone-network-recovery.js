    ...(() => {
      // iPhone/Safari data recovery when the Wayfarer Google Map instance is not exposed.
      // Observe new GCS resource requests event-by-event; never poll and never draw.
      const IPHONE_GCS_PATH = '/api/v1/vault/mapview/gcs';
      const observedPerformanceGcsUrls = new Set();
      const performanceReplayQueue = [];
      let performanceObserver = null;
      let performanceReplayActive = false;
      let performanceObserved = 0;
      let performanceReplayed = 0;
      let performanceReplayErrors = 0;

      function isGcsResourceUrl(value) {
        return String(value || '').includes(IPHONE_GCS_PATH);
      }

      function seedExistingPerformanceUrls() {
        try {
          const entries = performance?.getEntriesByType?.('resource') || [];
          for (const entry of entries) {
            const url = String(entry?.name || '');
            if (isGcsResourceUrl(url)) observedPerformanceGcsUrls.add(url);
          }
        } catch (_) {}
      }

      async function drainPerformanceReplayQueue() {
        if (performanceReplayActive || !nativeFetch) return;
        performanceReplayActive = true;
        try {
          while (performanceReplayQueue.length) {
            const url = performanceReplayQueue.shift();
            if (!url) continue;
            try {
              const response = await nativeFetch(url, { credentials: 'include', cache: 'no-store' });
              if (!response.ok) throw new Error('GCS resource replay HTTP ' + response.status);
              const payload = await response.json();
              stats.gcs += 1;
              scanJson(payload);
              performanceReplayed += 1;
              scheduleRender();
            } catch (error) {
              performanceReplayErrors += 1;
              stats.parseErrors += 1;
              console.warn('[Campsite Bridge Shortcut] GCS resource replay failed', error);
              scheduleRender();
            }
          }
        } finally {
          performanceReplayActive = false;
          scheduleRender();
        }
      }

      function enqueuePerformanceGcsUrl(rawUrl) {
        const url = String(rawUrl || '');
        if (!isGcsResourceUrl(url) || observedPerformanceGcsUrls.has(url)) return false;
        observedPerformanceGcsUrls.add(url);
        performanceObserved += 1;
        performanceReplayQueue.push(url);
        void drainPerformanceReplayQueue();
        scheduleRender();
        return true;
      }

      function installPerformanceObserver() {
        if (performanceObserver || typeof PerformanceObserver !== 'function') return false;
        try {
          performanceObserver = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              enqueuePerformanceGcsUrl(entry?.name);
            }
          });
          try {
            performanceObserver.observe({ type: 'resource', buffered: false });
          } catch (_) {
            performanceObserver.observe({ entryTypes: ['resource'] });
          }
          return true;
        } catch (error) {
          performanceObserver = null;
          console.warn('[Campsite Bridge Shortcut] PerformanceObserver unavailable', error);
          return false;
        }
      }

      seedExistingPerformanceUrls();
      installPerformanceObserver();

      const baseRenderForNetworkRecovery = render;
      render = function() {
        baseRenderForNetworkRecovery();
        const diag = document.getElementById('cbs-diagnostics');
        if (diag && diag.style.display !== 'none') {
          diag.insertAdjacentHTML('beforeend',
            `<div style="margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12);font-weight:800">iPhone network recovery</div>` +
            `<div>Resource observer ${performanceObserver ? 'on' : 'off'} / observed ${performanceObserved}</div>` +
            `<div>Replayed ${performanceReplayed} / queued ${performanceReplayQueue.length} / error ${performanceReplayErrors}</div>`
          );
        }
      };

      window.CampsiteBridgeIPhoneNetworkRecovery = Object.freeze({
        getState: () => ({
          observerActive: Boolean(performanceObserver),
          observed: performanceObserved,
          replayed: performanceReplayed,
          queued: performanceReplayQueue.length,
          errors: performanceReplayErrors,
          continuousPolling: false
        })
      });

      window.addEventListener('pagehide', () => {
        try { performanceObserver?.disconnect?.(); } catch (_) {}
        performanceObserver = null;
        performanceReplayQueue.length = 0;
      }, { once: true });

      return {};
    })(),
