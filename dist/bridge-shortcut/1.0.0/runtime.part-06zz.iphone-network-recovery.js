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
      let performanceGeneration = 0;

      // Campsite design only needs active game POIs plus inactive Power Spots.
      // Wayfarer can return thousands of portal-only records for one visible range,
      // especially on iPhone after resume/replay. Reject those before poiByGuid so
      // they never inflate Bridge memory or the Receiver payload.
      function isDiscardedNotInGamePoi(poi) {
        const rawEntity = String(poi?.gameEntity || '')
          .trim()
          .toUpperCase()
          .replace(/[\s_-]/g, '');
        const entity = normalizeEntity(poi?.gameEntity);
        const status = normalizeStatus(poi?.gameStatus);
        return rawEntity === 'NOTINGAME' ||
          ((entity === 'POKESTOP' || entity === 'GYM') && status === 'INACTIVE');
      }

      function readMapCoordinate(point, key) {
        if (!point) return null;
        try {
          const value = point[key];
          const number = Number(typeof value === 'function' ? value.call(point) : value);
          return Number.isFinite(number) ? number : null;
        } catch (_) {
          return null;
        }
      }

      function currentBridgeBounds() {
        let map = bridgeMap || window.__campsiteBridgeGoogleMap || null;
        if (!map) {
          try { map = window.WFMM?.map?.get?.() || null; } catch (_) {}
        }
        if (!map || typeof map.getBounds !== 'function') return null;
        try { return map.getBounds() || null; } catch (_) { return null; }
      }

      function isPoiInsideCurrentViewport(poi) {
        const lat = Number(poi?.lat);
        const lng = Number(poi?.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return true;

        const bounds = currentBridgeBounds();
        if (!bounds) return true;

        try {
          if (typeof bounds.contains === 'function') {
            const LatLng = window.google?.maps?.LatLng;
            if (LatLng) return Boolean(bounds.contains(new LatLng(lat, lng)));
            return Boolean(bounds.contains({ lat, lng }));
          }
        } catch (_) {}

        const sw = bounds.getSouthWest?.();
        const ne = bounds.getNorthEast?.();
        const south = readMapCoordinate(sw, 'lat');
        const west = readMapCoordinate(sw, 'lng');
        const north = readMapCoordinate(ne, 'lat');
        const east = readMapCoordinate(ne, 'lng');
        if (![south, west, north, east].every(Number.isFinite)) return true;

        const latitudeInside = lat >= south && lat <= north;
        const longitudeInside = west <= east
          ? lng >= west && lng <= east
          : lng >= west || lng <= east;
        return latitudeInside && longitudeInside;
      }

      const baseUpsertPoiForScopeFilter = upsertPoi;
      upsertPoi = function(poi, deferRender = false) {
        if (isDiscardedNotInGamePoi(poi)) return false;
        if (!isPoiInsideCurrentViewport(poi)) return false;
        return baseUpsertPoiForScopeFilter(poi, deferRender);
      };

      // Some POIs may have been observed before the Google Map instance became
      // available. Re-apply viewport scope at read/send time as a second guard.
      const baseGetSendPoisForScopeFilter = getSendPois;
      getSendPois = function() {
        return baseGetSendPoisForScopeFilter().filter(isPoiInsideCurrentViewport);
      };

      const baseGetReferencePoisForScopeFilter = getReferencePois;
      getReferencePois = function() {
        return baseGetReferencePoisForScopeFilter()
          .filter(poi => poi.referenceKind !== 'NOT_IN_GAME')
          .filter(isPoiInsideCurrentViewport);
      };

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
            const item = performanceReplayQueue.shift();
            const url = String(item?.url || '');
            const generation = Number(item?.generation);
            if (!url || generation !== performanceGeneration) continue;
            try {
              const response = await nativeFetch(url, { credentials: 'include', cache: 'no-store' });
              if (!response.ok) throw new Error('GCS resource replay HTTP ' + response.status);
              const payload = await response.json();
              if (generation !== performanceGeneration) continue;
              stats.gcs += 1;
              scanJson(payload);
              performanceReplayed += 1;
              scheduleRender();
            } catch (error) {
              if (generation !== performanceGeneration) continue;
              performanceReplayErrors += 1;
              stats.parseErrors += 1;
              console.warn('[Campsite Bridge Shortcut] GCS resource replay failed', error);
              scheduleRender();
            }
          }
        } finally {
          performanceReplayActive = false;
          scheduleRender();
          if (performanceReplayQueue.length) void drainPerformanceReplayQueue();
        }
      }

      function enqueuePerformanceGcsUrl(rawUrl) {
        const url = String(rawUrl || '');
        if (!isGcsResourceUrl(url) || observedPerformanceGcsUrls.has(url)) return false;
        observedPerformanceGcsUrls.add(url);
        performanceObserved += 1;
        performanceReplayQueue.push({ url, generation: performanceGeneration });
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

      const baseResetForNetworkRecovery = reset;
      reset = function() {
        // Bridge reset must also reset this module's URL de-duplication state.
        // Otherwise Safari can request the same GCS URL again after reset while
        // the recovery layer silently treats it as already handled. That left
        // the foreground count partial until visibility/pageshow forced a replay.
        performanceGeneration += 1;
        observedPerformanceGcsUrls.clear();
        performanceReplayQueue.length = 0;
        performanceObserved = 0;
        performanceReplayed = 0;
        performanceReplayErrors = 0;
        baseResetForNetworkRecovery();
        scheduleRender();
      };

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
          generation: performanceGeneration,
          continuousPolling: false
        })
      });

      window.addEventListener('pagehide', () => {
        try { performanceObserver?.disconnect?.(); } catch (_) {}
        performanceObserver = null;
        performanceGeneration += 1;
        observedPerformanceGcsUrls.clear();
        performanceReplayQueue.length = 0;
      }, { once: true });

      // If the user closes the Campsite tab after a successful send, Safari can
      // leave the fixed named target in a stale state. Keep the live Receiver
      // window while it exists and create a fresh uniquely named blank window
      // when it was closed. Also clear the previous success UI before retrying.
      const baseSendToCampsiteForReceiverRecovery = sendToCampsite;
      let iphoneReceiverWindow = null;
      sendToCampsite = async function (...args) {
        if (sendWorkflowActive) {
          return baseSendToCampsiteForReceiverRecovery.apply(this, args);
        }

        if (sendSucceeded) {
          sendSucceeded = false;
          setSendStatus('');
          scheduleRender();
        }

        const originalOpen = window.open;
        let pending;
        window.open = function (url, target, features) {
          const href = String(url || '');
          if (target !== RECEIVER_WINDOW_NAME || !href.startsWith(RECEIVER_ORIGIN)) {
            return originalOpen.apply(this, arguments);
          }

          try {
            if (iphoneReceiverWindow && !iphoneReceiverWindow.closed) {
              try { iphoneReceiverWindow.location.href = href; } catch (_) {}
              return iphoneReceiverWindow;
            }
          } catch (_) {
            iphoneReceiverWindow = null;
          }

          let handshakeId = '';
          try { handshakeId = new URL(href).searchParams.get('handshake') || ''; } catch (_) {}
          const safeHandshake = handshakeId.replace(/[^a-z0-9_-]/gi, '').slice(0, 80);
          const windowName = `${RECEIVER_WINDOW_NAME}_${safeHandshake || Date.now().toString(36)}`;

          let popup = null;
          try { popup = originalOpen.call(window, 'about:blank', windowName, features); } catch (_) {}
          if (!popup) return null;
          iphoneReceiverWindow = popup;
          try { popup.location.replace(href); }
          catch (_) {
            try { popup.location.href = href; } catch (_) {}
          }
          return popup;
        };

        try {
          pending = baseSendToCampsiteForReceiverRecovery.apply(this, args);
        } finally {
          window.open = originalOpen;
        }

        return await pending;
      };

      return {};
    })(),