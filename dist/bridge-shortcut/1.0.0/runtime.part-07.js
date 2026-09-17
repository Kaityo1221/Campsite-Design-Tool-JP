      position: 'fixed',
      left: '10px',
      bottom: '18px',
      zIndex: '2147483647',
      fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
      color: '#fff'
    });

    panel.innerHTML = `
      <button id="cbs-toggle" type="button" aria-expanded="false" style="display:flex;align-items:center;gap:6px;border:0;border-radius:999px;padding:8px 11px;background:rgba(15,23,42,.94);color:#fff;font-weight:800;font-size:12px;box-shadow:0 6px 18px rgba(0,0,0,.28);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);cursor:pointer;">
        🌉 <span>Bridge</span><span id="cbs-mini-count" style="opacity:.72;font-weight:700">0</span>
      </button>

      <div id="cbs-body" style="display:none;position:absolute;left:0;bottom:44px;width:260px;padding:12px;border-radius:14px;background:rgba(15,23,42,.96);color:#fff;font-size:12px;line-height:1.45;box-shadow:0 10px 32px rgba(0,0,0,.34);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px">
          <div style="font-weight:800;font-size:14px">🌉 Campsite Bridge</div>
          <button id="cbs-close" type="button" aria-label="畳む" style="border:0;background:transparent;color:#fff;font-size:20px;line-height:1;padding:0 2px;cursor:pointer">×</button>
        </div>

        <div id="cbs-ready" style="margin-bottom:7px;padding:7px 8px;border-radius:9px;background:rgba(30,41,59,.8);font-size:11px">取得状況：地図を動かしてください</div>
        <div id="cbs-status" style="margin-bottom:9px"></div>
        <div id="cbs-extra" style="margin-bottom:7px;padding:7px 8px;border-radius:9px;background:rgba(2,6,23,.6);font-size:11px"></div>
        <button id="cbs-inactive-toggle" type="button" style="width:100%;margin-bottom:5px;border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:7px 8px;background:rgba(30,41,59,.82);color:#e2e8f0;font-size:10px;font-weight:800;cursor:pointer">Power Spot INACTIVE：ON</button>
        <div id="cbs-display-note" style="display:none;margin:-1px 0 7px;padding:6px 7px;border-radius:8px;background:rgba(120,53,15,.34);color:#fde68a;font-size:10px;line-height:1.4"></div>

        <button id="cbs-send" type="button" style="width:100%;border:0;border-radius:10px;padding:10px 9px;background:#dcfce7;color:#14532d;font-weight:900;cursor:pointer">🏕 Campsiteへ送る</button>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:7px">
          <button id="cbs-diag-toggle" type="button" style="border:0;border-radius:9px;padding:8px 7px;font-weight:700;cursor:pointer">🔧 診断</button>
          <button id="cbs-reset" type="button" style="border:0;border-radius:9px;padding:8px 7px;font-weight:700;cursor:pointer">リセット</button>
        </div>
        <div id="cbs-diagnostics" style="display:none;margin-top:8px;padding:8px;border-radius:9px;background:rgba(2,6,23,.72);font-size:10px;line-height:1.55"></div>
        <div id="cbs-send-status" style="min-height:18px;margin-top:8px;font-size:11px;line-height:1.5;color:#cbd5e1"></div>
      </div>
    `;

    document.documentElement.appendChild(panel);

    const toggle = panel.querySelector('#cbs-toggle');
    const body = panel.querySelector('#cbs-body');
    const setOpen = open => {
      body.style.display = open ? 'block' : 'none';
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };

    toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
    panel.querySelector('#cbs-close')?.addEventListener('click', event => { event.stopPropagation(); setOpen(false); });
    panel.querySelector('#cbs-send')?.addEventListener('click', sendToCampsite);
    panel.querySelector('#cbs-inactive-toggle')?.addEventListener('click', () => {
      const note = panel.querySelector('#cbs-display-note');
      if (isWfmmPresent()) {
        if (note) {
          note.style.display = 'block';
          note.textContent = 'WFMM優先設定：Power Spotの表示はWFMM側で変更してください。';
        }
        scheduleRender();
        return;
      }
      showInactivePowerSpots = !showInactivePowerSpots;
      if (note) {
        note.style.display = 'none';
        note.textContent = '';
      }
      scheduleRender();
    });
    panel.querySelector('#cbs-reset')?.addEventListener('click', reset);
    panel.querySelector('#cbs-diag-toggle')?.addEventListener('click', () => {
      const box = panel.querySelector('#cbs-diagnostics');
      box.style.display = box.style.display === 'none' ? 'block' : 'none';
      render();
    });

    window.CampsiteBridgeShortcut = {
      openPanel: () => setOpen(true),
      getPois: () => getSendPois(),
      getCounts,
      sendToCampsite,
      reset,
      isWfmmPresent,
      getDisplayState: () => ({ showInactivePowerSpots, wfmmDetected: isWfmmPresent(), mapCaptured: Boolean(bridgeMap) })
    };

    render();
    return panel;
  }

  function render() {
    const counts = getCounts();
    const mini = document.getElementById('cbs-mini-count');
    const ready = document.getElementById('cbs-ready');
    const status = document.getElementById('cbs-status');
    const extra = document.getElementById('cbs-extra');
    const inactiveToggle = document.getElementById('cbs-inactive-toggle');
    const displayNote = document.getElementById('cbs-display-note');
    const sendButton = document.getElementById('cbs-send');
    const diag = document.getElementById('cbs-diagnostics');

    if (mini) mini.textContent = String(counts.total);
    if (ready) ready.textContent = counts.total > 0 ? '取得状況：送信できます' : '取得状況：地図を動かしてください';

    if (status) {
      status.innerHTML = `
        <div>POI <strong>${counts.total}</strong></div>
        <div style="margin-top:3px">PokéStop <strong>${counts.pokestop}</strong><span style="margin-left:6px">Gym <strong>${counts.gym}</strong></span></div>
        <div style="margin-top:3px">Power Spot <strong>${counts.powerspot}</strong></div>
      `;
    }

    if (extra) {
      if (extraInfoState === 'checking') {
        extra.innerHTML = 'Sponsor：<strong>確認中…</strong><span style="margin-left:10px">SMR：<strong>確認中…</strong></span>';
      } else if (extraInfoState === 'confirmed') {
        extra.innerHTML = `Sponsor：<strong>${confirmedSponsorCount ?? 0}</strong><span style="margin-left:10px">SMR：<strong>${confirmedSmrCount ?? 0}</strong></span>`;
      } else if (extraInfoState === 'partial') {
        extra.innerHTML = `Sponsor：<strong>${confirmedSponsorCount ?? 0}</strong><span style="opacity:.65">（一部確認）</span><br>SMR：<strong>${confirmedSmrCount ?? 0}</strong><span style="opacity:.65">（一部確認）</span>`;
      } else if (extraInfoState === 'reset') {
        extra.innerHTML = 'Sponsor：<strong>0</strong><span style="margin-left:10px">SMR：<strong>未確認</strong></span>';
      } else {
        extra.innerHTML = 'Sponsor：<strong>未確認</strong><span style="margin-left:10px">SMR：<strong>未確認</strong></span>';
      }
    }

    const wfmmPresent = isWfmmPresent();
    if (inactiveToggle) {
      inactiveToggle.textContent = wfmmPresent
        ? 'Power Spot INACTIVE：WFMM優先設定'
        : `Power Spot INACTIVE：${showInactivePowerSpots ? 'ON' : 'OFF'}`;
    }
    if (displayNote && !wfmmPresent && displayNote.style.display !== 'none') {
      displayNote.style.display = 'none';
      displayNote.textContent = '';
    }
    if (sendButton) {
      sendButton.textContent = sendSucceeded ? '✓ Campsiteへ送信済み' : '🏕 Campsiteへ送る';
    }

    if (diag && diag.style.display !== 'none') {
      diag.innerHTML = `
        <div>XHR ${stats.xhr} / GCS ${stats.gcs}</div>
        <div>受信POI ${stats.receivedPoi} / ユニーク ${counts.total}</div>
        <div>重複 ${stats.duplicatePoi} / 解析エラー ${stats.parseErrors}</div>
        <div>Sponsor req ${stats.sponsorMapRequests} / detail ${stats.sponsorDetailRequests} / error ${stats.sponsorErrors}</div>
        <div>Map ${bridgeMap ? 'captured' : 'waiting'} / Overlay ${bridgeOverlayRoot ? 'ready' : 'waiting'} / WFMM ${isWfmmPresent() ? 'yes' : 'no'}</div>
        <div>Ring ${stats.sponsorRingDrawn}/${stats.sponsorRingCandidates} / WFMM Sponsor records ${stats.wfmmSponsoredRecords} / INACTIVE ${showInactivePowerSpots ? 'ON' : 'OFF'}</div>
      `;
    }
  }

  function scheduleRender() {
    scheduleOverlayRender();
    if (renderTimer) return;
    renderTimer = setTimeout(() => {
      renderTimer = null;
      render();
    }, RENDER_DEBOUNCE_MS);
  }

  installXhrCapture();
  beginMapDiscovery();
  ensurePanel();
  console.info(`[Campsite Bridge Shortcut] ${BRIDGE_VERSION} ready`);
})();
