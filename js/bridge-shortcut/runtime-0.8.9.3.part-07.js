        const timeout = setTimeout(() => {
          clearSendState();
          sendWorkflowActive = false;setSendStatus(
            sent
              ? '受信確認が取れませんでした。もう一度お試しください。'
              : '送信できませんでした。もう一度お試しください。',
            'error'
          );
        }, 12000);

        sendState = { receiver, listener, interval, timeout };
        transmit();
      } catch (error) {
        sendWorkflowActive = false;
        console.error('[Campsite Bridge] send workflow failed', error);
        setSendStatus('送信準備に失敗しました。もう一度お試しください。', 'error');
      }
    }

    function reset() {
      poiByGuid.clear();
      smrByGuid.clear();
      smrRecords.clear();
      observedGcsL14Tokens.clear();
      observedSponsorL15Ids.clear();
      queriedSponsorL15Ids.clear();
      sponsoredObjectIdsSeen.clear();
      sponsoredObjectIdsDetailed.clear();
      invalidateDerivedCaches();
      setSendStatus('');

      Object.assign(stats, {
        responses: 0,
        jsonResponses: 0,
        candidateResponses: 0,
        parseErrors: 0,
        lastResponseAt: null,
        lastPoiAt: null,
        smrResponses: 0,
        smrRecords: 0,
        smrTrue: 0,
        smrFalse: 0,
        lastSmrAt: null,
                unchangedPoiSkips: 0,
        skippedNonJsonBodies: 0,
        directJsonResponses: 0,
        sponsorObservedL14: 0,
        sponsorQueriedL15: 0,
        sponsorPendingL15: 0,
        sponsorMapRequests: 0,
        sponsorDetailRequests: 0,
        sponsorFound: 0,
        sponsorErrors: 0,
        lastSponsorAt: null,
        wfmmCacheAvailable: false,
        wfmmCacheRecords: 0,
        wfmmCacheMatched: 0,
        wfmmCacheCellsReused: 0,
        wfmmCacheErrors: 0,
        lastWfmmCacheAt: null
,
      areaCacheLoaded: Object.keys(areaCache?.pois || {}).length,
      areaCacheHits: 0,
      areaCacheMisses: 0,
      areaCachePruned: 0,
      areaCacheWrites: 0,
      areaCacheAreas: Array.isArray(areaCache?.areas) ? areaCache.areas.length : 0,
      areaCachePois: Object.keys(areaCache?.pois || {}).length,
      diffNew: 0,
      diffChanged: 0,
      diffMissing: 0,
      diffMissingReliable: false,
      qualityScore: 0,
      qualityLabel: '取得中'
      });

      scheduleRender();
    }

    function ensurePanel() {
      if (document.getElementById('campsite-bridge-089-panel')) return;

      const panel = document.createElement('div');
      panel.id = 'campsite-bridge-089-panel';
      Object.assign(panel.style, {
        position: 'fixed',
        left: '10px',
        bottom: '18px',
        zIndex: '2147483647',
        fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
        color: '#fff'
      });

      panel.innerHTML = `
        <button id="cb089-toggle" type="button" aria-expanded="false" style="display:flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:8px 11px;background:rgba(15,23,42,.94);color:#fff;font-weight:800;font-size:12px;box-shadow:0 6px 18px rgba(0,0,0,.28);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);cursor:pointer;">
          🌉 <span>Bridge</span><span id="cb089-mini-count" style="opacity:.72;font-weight:700">0</span>
        </button>

        <div id="cb089-body" style="display:none;position:absolute;left:0;bottom:44px;width:260px;padding:12px;border-radius:14px;background:rgba(15,23,42,.96);color:#fff;font-size:12px;line-height:1.45;box-shadow:0 10px 32px rgba(0,0,0,.34);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px">
            <div style="font-weight:800;font-size:14px">🌉 Campsite Bridge <span style="opacity:.65">0.8.9.1</span></div>
            <button id="cb089-close" type="button" aria-label="畳む" style="border:0;background:transparent;color:#fff;font-size:20px;line-height:1;padding:0 2px;cursor:pointer">×</button>
          </div>

          <div id="cb089-quality" style="margin-bottom:7px;padding:7px 8px;border-radius:9px;background:rgba(30,41,59,.8);font-size:11px">取得品質 計算中...</div>
          <div id="cb089-status" style="margin-bottom:9px">起動中...</div>

          <button id="cb089-send" type="button" style="width:100%;border:0;border-radius:10px;padding:10px 9px;background:#dcfce7;color:#14532d;font-weight:900;cursor:pointer">🏕 Campsiteへ送る</button>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px">
            <button id="cb089-diag-toggle" type="button" style="border:0;border-radius:9px;padding:8px 7px;font-weight:700;cursor:pointer">🔧 診断</button>
            <button id="cb089-reset" type="button" style="border:0;border-radius:9px;padding:8px 7px;font-weight:700;cursor:pointer">リセット</button>
          </div>
          <div id="cb089-diagnostics" style="display:none;margin-top:8px;padding:8px;border-radius:9px;background:rgba(2,6,23,.72);font-size:10px;line-height:1.55;max-height:230px;overflow:auto"></div>
          <div id="cb089-diag-actions" style="display:none;grid-template-columns:1fr 1fr;gap:6px;margin-top:6px">
            <button id="cb089-export" type="button" style="border:0;border-radius:8px;padding:7px;font-weight:700;cursor:pointer">💾 セッション</button>
            <button id="cb089-clear-cache" type="button" style="border:0;border-radius:8px;padding:7px;font-weight:700;cursor:pointer">🧹 履歴/Cache</button>
          </div>
          <div id="cb089-send-status" style="min-height:18px;margin-top:8px;font-size:11px;line-height:1.5;color:#cbd5e1"></div>
        </div>
      `;

      document.documentElement.appendChild(panel);

      const toggle = panel.querySelector('#cb089-toggle');
      const body = panel.querySelector('#cb089-body');
      const setOpen = open => {
        body.style.display = open ? 'block' : 'none';
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      };

      toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
      panel.querySelector('#cb089-close')?.addEventListener('click', event => {
        event.stopPropagation();
        setOpen(false);
      });
      panel.querySelector('#cb089-send')?.addEventListener('click', sendToCampsite);
      panel.querySelector('#cb089-reset')?.addEventListener('click', reset);
      panel.querySelector('#cb089-diag-toggle')?.addEventListener('click', () => {
        diagnosticsEnabled = !diagnosticsEnabled;
        render();
      });
      panel.querySelector('#cb089-export')?.addEventListener('click', exportSession);
      panel.querySelector('#cb089-clear-cache')?.addEventListener('click', clearPersistentBridgeData);

      setOpen(false);
      render();
    }

    function renderDiagnostics() {
      const box = document.getElementById('cb089-diagnostics');
      const actions = document.getElementById('cb089-diag-actions');
      if (!box || !actions) return;
      box.style.display = diagnosticsEnabled ? 'block' : 'none';
      actions.style.display = diagnosticsEnabled ? 'grid' : 'none';
      if (!diagnosticsEnabled) return;

      const diff = lastDiff || computeDiff(getSendPois());
      const missing = diff.missingReliable ? String(diff.missingCount || 0) : '判定保留';
      const provenanceCounts = { WAYFARER_PASSIVE: 0, WFMM_CACHE: 0, BRIDGE_ENRICHMENT: 0 };
      for (const poi of getSendPois()) {
        for (const source of normalizeProvenance(poi.provenance)) {
          if (source in provenanceCounts) provenanceCounts[source] += 1;
        }
      }
      const recent = diagnosticLog.slice(-6).reverse();
      box.innerHTML = `
        <div><strong>差分</strong> 新規 ${diff.newCount || 0} / 変更 ${diff.changedCount || 0} / 消失 ${missing}</div>
        <div><strong>GUID Cache</strong> loaded ${stats.areaCacheLoaded} / ${stats.areaCachePois}/${AREA_CACHE_MAX_POIS} POI · hit ${stats.areaCacheHits} / miss ${stats.areaCacheMisses} / pruned ${stats.areaCachePruned}</div>
        <div><strong>Area History</strong> ${stats.areaCacheAreas}/${AREA_CACHE_MAX_AREAS} captures</div>
        <div><strong>Source</strong> WF ${provenanceCounts.WAYFARER_PASSIVE} / WFMM ${provenanceCounts.WFMM_CACHE} / Enrich ${provenanceCounts.BRIDGE_ENRICHMENT}</div>
        <div><strong>Network</strong> JSON ${stats.jsonResponses} / skipped ${stats.skippedNonJsonBodies} / parse err ${stats.parseErrors}</div>
        <div><strong>Sponsor</strong> map req ${stats.sponsorMapRequests} / detail req ${stats.sponsorDetailRequests} / err ${stats.sponsorErrors}</div>
        <div style="margin-top:5px;opacity:.7"><strong>Recent</strong>${recent.length ? '<br>' + recent.map(item => `${item.at.slice(11,19)} ${item.type}`).join('<br>') : ' なし'}</div>
      `;
    }

    function render() {
      const status = document.getElementById('cb089-status');
      const mini = document.getElementById('cb089-mini-count');
      const qualityEl = document.getElementById('cb089-quality');
      const diagToggle = document.getElementById('cb089-diag-toggle');
      const counts = getCounts();
      lastDiff = computeDiff(getSendPois());
      lastQuality = computeQuality(getSendPois());

      if (mini) mini.textContent = String(counts.total);
      if (qualityEl) {
        const reason = lastQuality.reasons.length ? ` · ${lastQuality.reasons[0]}` : '';
        qualityEl.innerHTML = `取得品質 <strong>${lastQuality.score}%</strong> · ${lastQuality.label}<span style="opacity:.6">${reason}</span>`;
      }
      if (diagToggle) diagToggle.textContent = diagnosticsEnabled ? '🔧 診断ON' : '🔧 診断';
      if (status) {
        const missing = lastDiff.missingReliable ? lastDiff.missingCount : '—';
        status.innerHTML = `
          <div>POI <strong>${counts.total}</strong></div>
          <div style="margin-top:3px">PokéStop <strong>${counts.pokestop}</strong><span style="margin-left:6px">Gym <strong>${counts.gym}</strong></span></div>
          <div style="margin-top:3px">Power Spot <strong>${counts.powerspot}</strong></div>
          <div style="margin-top:3px;opacity:.78">Sponsor <strong>${counts.sponsored}</strong><span style="margin-left:6px">SMR <strong>${counts.smrTrue}</strong></span></div>
          <div style="margin-top:3px;opacity:.65;font-size:10px">差分 +${lastDiff.newCount || 0} / 変更 ${lastDiff.changedCount || 0} / 消失 ${missing}</div>
          <div style="margin-top:2px;opacity:.58;font-size:10px">L15 済 ${stats.sponsorQueriedL15} / 未 ${stats.sponsorPendingL15}</div>
        `;
      }
      renderDiagnostics();
    }

    function scheduleRender() {
      if (renderTimer) return;
      renderTimer = setTimeout(() => {
        renderTimer = null;
        render();
      }, RENDER_DEBOUNCE_MS);
    }

    installFetchCapture();
    installXhrCapture();
    diag('session-start', { version: BRIDGE_VERSION, cachedAreas: stats.areaCacheAreas, cachedPois: stats.areaCachePois, cacheLoaded: stats.areaCacheLoaded, cachePruned: stats.areaCachePruned, cacheMigrated: areaCacheLoadMeta.migrated });

    window.CampsiteBridge = Object.freeze({
      version: BRIDGE_VERSION,
      getPois: () => getSendPois().map(poi => ({ ...poi })),
      getCounts,
      getStats: () => ({ ...stats }),
      getDiff: () => ({ ...(lastDiff || computeDiff(getSendPois())) }),
      getQuality: () => ({ ...(lastQuality || computeQuality(getSendPois())) }),
      getAreaCacheStats: () => ({ areas: stats.areaCacheAreas, pois: stats.areaCachePois, loaded: stats.areaCacheLoaded, hits: stats.areaCacheHits, misses: stats.areaCacheMisses, pruned: stats.areaCachePruned, writes: stats.areaCacheWrites }),
      getSessionSnapshot: buildSessionSnapshot,
      exportSession,
      setDiagnostics: enabled => { diagnosticsEnabled = Boolean(enabled); render(); },
      clearPersistentCache: clearPersistentBridgeData,
      getSmrRecords: () => [...smrRecords.values()].map(record => ({ ...record })),
      getSponsorCells: () => ({
        observedL14: [...observedGcsL14Tokens],
        observedL15: [...observedSponsorL15Ids],
        queriedL15: [...queriedSponsorL15Ids],
        pendingL15: getPendingSponsorL15Ids()
      }),
      reuseWfmmSponsoredCache,
      enrichSponsored: enrichSponsoredBeforeSend,
      sendToCampsite,
      reset
    });

    window.addEventListener('pagehide', flushGuidCachePersist, { capture:true });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushGuidCachePersist();
    });

    const boot = () => {
      ensurePanel();
      console.info(`[Campsite Bridge] v${BRIDGE_VERSION} direct ready (GUID cache + acquisition history + diff + quality + diagnostics + optional WFMM + Sponsored L15)`);
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
      boot();
    }
  }

  function normalizeProvenance(value) {
    const input = Array.isArray(value) ? value : value ? [value] : [];
    const normalized = [];
    for (const item of input) {
      const name = String(item || '').trim().toUpperCase();
      if (!PROVENANCE_VALUES.has(name) || normalized.includes(name)) continue;
      normalized.push(name);
    }
    return normalized;
  }

  function normalizeEntity(value) {
    if (typeof value !== 'string') return undefined;
    const normalized = value.toUpperCase().replace(/[\s_-]/g, '');
    if (normalized === 'POKESTOP') return 'POKESTOP';
    if (normalized === 'GYM') return 'GYM';
    if (normalized === 'POWERSPOT') return 'POWERSPOT';
    return undefined;
  }

  function normalizeStatus(value) {
    if (typeof value !== 'string') return undefined;
    const normalized = value.toUpperCase();
    return GAME_STATUSES.has(normalized) ? normalized : undefined;
  }
})();
