          }
        } catch (caught) {
          timedOut = caught?.name === 'AbortError';
          error = caught;
          stats.sponsorErrors += 1;
          console.warn('[Campsite Bridge] Sponsored enrichment skipped/partial', caught);
        } finally {
          clearTimeout(timeout);
          stats.lastSponsorAt = new Date().toISOString();
          updateSponsorPendingStats();
          scheduleRender();
        }

        return {
          attempted: selectedCells.length,
          queried,
          found: sponsoredObjectIdsSeen.size,
          pending: stats.sponsorPendingL15,
          timedOut,
          error
        };
      })().finally(() => {
        sponsorFetchInFlight = null;
      });

      return sponsorFetchInFlight;
    }

    function markNetworkResponse() {
      stats.responses += 1;
      stats.lastResponseAt = new Date().toISOString();
    }

    function installFetchCapture() {
      const nativeFetch = window.fetch;
      if (typeof nativeFetch !== 'function') return;

      window.fetch = async function(...args) {
        const response = await nativeFetch.apply(this, args);
        markNetworkResponse();

        try {
          const contentType = response.headers?.get?.('content-type') || '';
          if (!contentTypeMayContainJson(contentType)) {
            stats.skippedNonJsonBodies += 1;
            return response;
          }
          const capturedAt = new Date().toISOString();
          response.clone().text().then(text => processText(text, capturedAt)).catch(() => {});
        } catch (_) {}
        return response;
      };
    }

    function installXhrCapture() {
      const XHR = window.XMLHttpRequest;
      if (!XHR?.prototype) return;

      const nativeSend = XHR.prototype.send;
      XHR.prototype.send = function(...args) {
        this.addEventListener('load', () => {
          markNetworkResponse();
          try {
            const capturedAt = new Date().toISOString();
            if (this.responseType === 'json' && this.response) {
              processJson(this.response, capturedAt);
              return;
            }

            const contentType = this.getResponseHeader?.('content-type') || '';
            if (!contentTypeMayContainJson(contentType)) {
              stats.skippedNonJsonBodies += 1;
              return;
            }

            if (!this.responseType || this.responseType === 'text') {
              processText(this.responseText || '', capturedAt);
            }
          } catch (_) {}
        }, { once: true });

        return nativeSend.apply(this, args);
      };
    }

    function finalizePoi(poi) {
      const s2 = getS2Fields(poi.lat, poi.lng);
      const smr = getSmrForPoi(poi);
      return {
        guid: String(poi.guid || ''),
        title: String(poi.title || ''),
        lat: Number(poi.lat),
        lng: Number(poi.lng),
        gameEntity: normalizeEntity(poi.gameEntity),
        gameStatus: normalizeStatus(poi.gameStatus) || 'UNKNOWN',
        sponsored: poi.sponsored === true,
        smr,
        imageUrl: String(poi.imageUrl || ''),
        description: String(poi.description || ''),
        s2L14: String(poi.s2L14 || s2.s2L14 || ''),
        s2L17: String(poi.s2L17 || s2.s2L17 || ''),
        provenance: normalizeProvenance(poi.provenance)
      };
    }

    function getPois() {
      return [...poiByGuid.values()];
    }

    function getSendPois() {
      if (finalizedPoisCache) return finalizedPoisCache;

      const byGuid = new Map();
      for (const raw of getPois()) {
        const poi = finalizePoi(raw);
        if (!poi.guid || !poi.gameEntity || !Number.isFinite(poi.lat) || !Number.isFinite(poi.lng)) continue;
        byGuid.set(poi.guid, poi);
      }

      finalizedPoisCache = [...byGuid.values()];
      return finalizedPoisCache;
    }

    function getCounts() {
      if (countsCache) return { ...countsCache };

      const pois = getSendPois();
      const counts = {
        total: pois.length,
        pokestop: 0,
        gym: 0,
        powerspot: 0,
        sponsored: 0,
        smrTrue: 0
      };

      for (const poi of pois) {
        if (poi.gameEntity === 'POKESTOP') counts.pokestop += 1;
        else if (poi.gameEntity === 'GYM') counts.gym += 1;
        else if (poi.gameEntity === 'POWERSPOT') counts.powerspot += 1;
        if (poi.sponsored) counts.sponsored += 1;
        if (poi.smr === true) counts.smrTrue += 1;
      }

      countsCache = counts;
      return { ...countsCache };
    }

    function setSendStatus(message, kind = 'normal') {
      const el = document.getElementById('cb089-send-status');
      if (!el) return;
      el.textContent = message || '';
      el.style.color = kind === 'error' ? '#fecaca' : kind === 'ok' ? '#bbf7d0' : '#cbd5e1';
    }

    function clearSendState() {
      if (!sendState) return;
      if (sendState.interval) clearInterval(sendState.interval);
      if (sendState.timeout) clearTimeout(sendState.timeout);
      if (sendState.listener) window.removeEventListener('message', sendState.listener);
      sendState = null;
    }

    async function sendToCampsite() {
      if (sendWorkflowActive) return;

      const before = getSendPois();
      if (!before.length) {
        setSendStatus('POIがまだありません。地図を表示してから送信してください。', 'error');
        return;
      }

      sendWorkflowActive = true;
      clearSendState();

      try {
        // Prefer already-cached WFMM Sponsored records when available. This is
        // a local-cache read only and remains optional; Bridge still works alone.
        await reuseWfmmSponsoredCache();
        updateSponsorPendingStats();
        if (stats.sponsorPendingL15 > 0) {
          const targetCount = Math.min(stats.sponsorPendingL15, SPONSOR_MAX_L15_PER_SEND);
          setSendStatus(`スポンサー補完中… 未取得L15 ${targetCount.toLocaleString('ja-JP')}セル`);

          const result = await enrichSponsoredBeforeSend();
          if (result.error) {
            const note = result.timedOut ? '時間上限' : '取得失敗';
            console.info(`[Campsite Bridge] Sponsored enrichment ${note}; continuing with available POIs.`);
          }
        }

        // Sponsored enrichment may have added or enriched POIs, so rebuild.
        invalidateDerivedCaches();
        const pois = getSendPois();

        const makeHandshakeId = () => {
          try {
            if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
            if (globalThis.crypto?.getRandomValues) {
              const bytes = new Uint8Array(16);
              globalThis.crypto.getRandomValues(bytes);
              return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
            }
          } catch (_) {}
          return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
        };

        const handshakeId = makeHandshakeId();
        const receiverUrl = `${RECEIVER_URL}&handshake=${encodeURIComponent(handshakeId)}`;
        const receiver = window.open(receiverUrl, RECEIVER_WINDOW_NAME);
        if (!receiver) {
          sendWorkflowActive = false;
          setSendStatus('Campsiteを開けませんでした。ポップアップを許可してください。', 'error');
          return;
        }

        lastDiff = computeDiff(pois);
        lastQuality = computeQuality(pois);
        const payload = {
          type: PROTOCOL,
          schemaVersion: '1.4',
          bridgeVersion: BRIDGE_VERSION,
          handshakeId,
          sentAt: new Date().toISOString(),
          autoContinue: true,
          sessionMeta: {
            quality: lastQuality,
            diff: {
              available: lastDiff.available,
              newCount: lastDiff.newCount,
              changedCount: lastDiff.changedCount,
              missingCount: lastDiff.missingCount,
              missingReliable: lastDiff.missingReliable
            },
            areaKeys: currentAreaKeys(pois)
          },
          pois
        };

        let sent = false;
        const transmit = () => {
          try {
            receiver.postMessage(payload, RECEIVER_ORIGIN);
            sent = true;
          } catch (_) {}
        };

        const listener = event => {
          if (event.origin !== RECEIVER_ORIGIN) return;
          const data = event.data || {};
          const responseHandshakeId = String(data.handshakeId || '').trim();
          // v0.8.9.3 receiver echoes the handshake ID. While the Pages update is
          // not yet live, accept the trusted-origin legacy receiver response too.
          if (responseHandshakeId && responseHandshakeId !== handshakeId) return;

          if (data.type === 'CAMPSITE_BRIDGE_READY_V1') {
            transmit();
            return;
          }

          if (data.type === 'CAMPSITE_BRIDGE_ACK_V1') {
            const accepted = data.accepted === true;
            const count = Number(data.count) || 0;
            clearSendState();
            sendWorkflowActive = false;

            if (accepted && count === pois.length) {
              const sponsorCount = pois.filter(poi => poi.sponsored).length;
              persistAreaCache(pois);
              saveHistorySnapshot(pois);
              lastDiff = computeDiff(pois);
              lastQuality = computeQuality(pois);
              diag('send-ack', { count, sponsorCount, quality: lastQuality.score });
              setSendStatus(`✅ ${count.toLocaleString('ja-JP')}件送信 / Sponsor ${sponsorCount}`, 'ok');
              scheduleRender();
            } else {
              setSendStatus(`⚠️ 受信確認に差があります（送信 ${pois.length} / 受信 ${count}）`, 'error');
            }
          }
        };

        window.addEventListener('message', listener);
        setSendStatus(`Campsiteへ${pois.length.toLocaleString('ja-JP')}件送信中…`);

        const interval = setInterval(transmit, 700);
