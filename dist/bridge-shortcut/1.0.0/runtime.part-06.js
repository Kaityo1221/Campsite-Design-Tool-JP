  }

  function getSendPois() {
    const byGuid = new Map();
    for (const raw of poiByGuid.values()) {
      const entity = normalizeEntity(raw.gameEntity);
      const lat = Number(raw.lat);
      const lng = Number(raw.lng);
      if (!raw.guid || !entity || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const poi = {
        guid: String(raw.guid),
        title: String(raw.title || ''),
        lat,
        lng,
        gameEntity: entity,
        gameStatus: normalizeStatus(raw.gameStatus),
        sponsored: raw.sponsored === true,
        smr: getSmrForPoi({ ...raw, gameEntity: entity, lat, lng }),
        imageUrl: String(raw.imageUrl || ''),
        description: String(raw.description || ''),
        s2L14: String(raw.s2L14 || ''),
        s2L17: String(raw.s2L17 || ''),
        provenance: Array.isArray(raw.provenance) ? raw.provenance : ['WAYFARER_PASSIVE']
      };
      byGuid.set(poi.guid, poi);
    }
    return [...byGuid.values()];
  }

  function getCounts() {
    const pois = getSendPois();
    const c = { total: pois.length, pokestop: 0, gym: 0, powerspot: 0, sponsored: 0, smr: 0 };
    for (const poi of pois) {
      if (poi.gameEntity === 'POKESTOP') c.pokestop += 1;
      else if (poi.gameEntity === 'GYM') c.gym += 1;
      else if (poi.gameEntity === 'POWERSPOT') c.powerspot += 1;
      if (poi.sponsored) c.sponsored += 1;
      if (poi.smr === true) c.smr += 1;
    }
    return c;
  }

  function makeHandshakeId() {
    try {
      if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
      if (globalThis.crypto?.getRandomValues) {
        const bytes = new Uint8Array(16);
        globalThis.crypto.getRandomValues(bytes);
        return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
      }
    } catch (_) {}
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  }

  function setSendStatus(message, kind = 'normal') {
    const el = document.getElementById('cbs-send-status');
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
    const initial = getSendPois();
    if (!initial.length) {
      setSendStatus('POIがまだありません。地図を動かして取得してください。', 'error');
      return;
    }

    // iPhone Safari対策: タップの同期処理中にReceiverを開き、前面化する。
    const handshakeId = makeHandshakeId();
    const receiverUrl = `${RECEIVER_URL}&handshake=${encodeURIComponent(handshakeId)}`;
    setSendStatus('Campsiteへ切り替えています…');
    const receiver = window.open(receiverUrl, RECEIVER_WINDOW_NAME);
    if (!receiver) {
      setSendStatus('Campsiteを開けませんでした。ポップアップを許可してください。', 'error');
      return;
    }
    try { receiver.focus(); } catch (_) {}

    sendWorkflowActive = true;
    sendSucceeded = false;
    clearSendState();
    extraInfoState = 'checking';
    confirmedSponsorCount = null;
    confirmedSmrCount = null;
    scheduleRender();

    let enrichmentPartial = false;
    try {
      const enrichment = await enrichSponsoredAndSmr();
      enrichmentPartial = enrichment.partial === true;
    } catch (_) {
      enrichmentPartial = true;
    }

    const pois = getSendPois();
    const counts = getCounts();
    confirmedSponsorCount = counts.sponsored;
    confirmedSmrCount = counts.smr;
    extraInfoState = enrichmentPartial ? 'partial' : 'confirmed';
    scheduleRender();

    const payload = {
      type: PROTOCOL,
      schemaVersion: '1.4',
      bridgeVersion: BRIDGE_VERSION,
      handshakeId,
      sentAt: new Date().toISOString(),
      autoContinue: true,
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
          sendSucceeded = true;
          setSendStatus(`✅ ${count.toLocaleString('ja-JP')}件送信 / Sponsor ${counts.sponsored} / SMR ${counts.smr}`, 'ok');
          scheduleRender();
          try { receiver.focus(); } catch (_) {}
        } else {
          setSendStatus(`⚠️ 受信確認に差があります（送信 ${pois.length} / 受信 ${count}）`, 'error');
        }
      }
    };

    window.addEventListener('message', listener);
    setSendStatus(`Campsiteへ${pois.length.toLocaleString('ja-JP')}件送信中…`);
    const interval = setInterval(transmit, 650);
    const timeout = setTimeout(() => {
      clearSendState();
      sendWorkflowActive = false;
      setSendStatus(sent ? '受信確認が取れませんでした。もう一度お試しください。' : '送信できませんでした。もう一度お試しください。', 'error');
    }, 12000);
    sendState = { receiver, listener, interval, timeout };
    transmit();
  }

  function reset() {
    poiByGuid.clear();
    smrByGuid.clear();
    smrRecords.clear();
    observedGcsL14Tokens.clear();
    observedSponsorL15Ids.clear();
    previewQueriedSponsorL15Ids.clear();
    queriedSponsorL15Ids.clear();
    sponsoredObjectIdsDetailed.clear();
    stats.xhr = 0;
    stats.gcs = 0;
    stats.receivedPoi = 0;
    stats.uniquePoi = 0;
    stats.duplicatePoi = 0;
    stats.parseErrors = 0;
    stats.sponsorMapRequests = 0;
    stats.sponsorDetailRequests = 0;
    stats.sponsorErrors = 0;
    stats.smrRecords = 0;
    stats.sponsorRingCandidates = 0;
    stats.sponsorRingDrawn = 0;
    stats.wfmmSponsoredRecords = 0;
    extraInfoState = 'reset';
    confirmedSponsorCount = 0;
    confirmedSmrCount = null;
    sendSucceeded = false;
    activeSponsorPopupGuid = '';
    sponsorPopupOpenedAt = 0;
    sponsorRingStableSince.clear();
    if (sponsorRingStabilizeTimer) {
      clearTimeout(sponsorRingStabilizeTimer);
      sponsorRingStabilizeTimer = null;
    }
    sponsorPreviewGeneration += 1;
    if (sponsorPreviewTimer) {
      clearTimeout(sponsorPreviewTimer);
      sponsorPreviewTimer = null;
    }
    try { sponsorPreviewController?.abort(); } catch (_) {}
    sponsorPreviewController = null;
    sponsorPreviewInFlight = false;
    setSendStatus('');
    scheduleRender();
  }

  function ensurePanel() {
    let panel = document.getElementById('campsite-bridge-shortcut-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'campsite-bridge-shortcut-panel';
    Object.assign(panel.style, {
