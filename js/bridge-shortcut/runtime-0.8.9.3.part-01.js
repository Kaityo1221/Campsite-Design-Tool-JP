        console.error('[Campsite Bridge] virtual file assignment failed', error);
        showNotice('⚠️ Bridge POIをCampsiteへ設定できませんでした。', 'error');
        return true;
      }

      sessionStorage.setItem(CAMPSITE_ENRICHED_STORAGE_KEY, JSON.stringify({
        version: BRIDGE_VERSION,
        importedAt: new Date().toISOString(),
        pois
      }));

      window.CampsiteBridgeImport = Object.freeze({
        version: BRIDGE_VERSION,
        count: pois.length,
        pois
      });

      try { window.applyCampsiteCsvMode?.('extracted'); } catch (_) {}
      try { window.setWorkflowStep?.('csv'); } catch (_) {}
      try { window.openTab?.('tool'); } catch (_) {}

      input.dispatchEvent(new Event('change', { bubbles: true }));

      const sponsoredCount = pois.filter(poi => poi.sponsored).length;
      const smrCount = pois.filter(poi => poi.smr === true).length;
      showNotice(`🌉 Bridgeから${pois.length.toLocaleString('ja-JP')}件を直接読み込みました。スポンサー ${sponsoredCount}件 / SMR ${smrCount}件。CSV保存は不要です。`);

      try {
        history.replaceState(null, '', './index.html');
      } catch (_) {}

      console.info('[Campsite Bridge] direct import complete', {
        version: BRIDGE_VERSION,
        count: pois.length,
        sponsoredCount,
        smrCount
      });

      return true;
    }

    const attempts = [0, 100, 300, 700, 1500, 3000, 6000];
    let done = false;

    for (const delay of attempts) {
      setTimeout(() => {
        if (done) return;
        done = importIntoCampsite();
      }, delay);
    }
  }

  function installGatewayAutoPolygonHook() {
    if (window.__campsiteBridge089AutoPolygonHook) return;
    window.__campsiteBridge089AutoPolygonHook = true;

    let leafletValue = window.L;
    const patchLeaflet = L => {
      if (!L || L.__campsiteBridge089MapPatched || typeof L.map !== 'function') return;
      L.__campsiteBridge089MapPatched = true;
      const originalMap = L.map;
      L.map = function(...args) {
        const instance = originalMap.apply(this, args);
        const container = args[0];
        const id = typeof container === 'string' ? container : container?.id;
        if (id === 'campsiteBridgeMap') window.__campsiteBridge089LeafletMap = instance;
        return instance;
      };
    };

    if (leafletValue) {
      patchLeaflet(leafletValue);
    } else {
      try {
        Object.defineProperty(window, 'L', {
          configurable: true,
          enumerable: true,
          get() { return leafletValue; },
          set(value) {
            leafletValue = value;
            patchLeaflet(value);
            const retry = () => patchLeaflet(value);
            if (typeof queueMicrotask === 'function') queueMicrotask(retry);
            else Promise.resolve().then(retry);
          }
        });
      } catch (_) {}
    }

    function cross(o, a, b) {
      return (a[1] - o[1]) * (b[0] - o[0]) - (a[0] - o[0]) * (b[1] - o[1]);
    }

    function convexHull(points) {
      const unique = [...new Map(points.map(point => [`${point[0].toFixed(7)},${point[1].toFixed(7)}`, point])).values()];
      if (unique.length < 3) return unique;
      unique.sort((a, b) => a[1] === b[1] ? a[0] - b[0] : a[1] - b[1]);
      const lower = [];
      for (const point of unique) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) lower.pop();
        lower.push(point);
      }
      const upper = [];
      for (let index = unique.length - 1; index >= 0; index--) {
        const point = unique[index];
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) upper.pop();
        upper.push(point);
      }
      lower.pop(); upper.pop();
      return lower.concat(upper);
    }

    function padHull(points) {
      if (points.length < 3) return points;
      const centerLat = points.reduce((sum, point) => sum + point[0], 0) / points.length;
      const centerLng = points.reduce((sum, point) => sum + point[1], 0) / points.length;
      const latMeters = 111320;
      const lngMeters = Math.max(1000, 111320 * Math.cos(centerLat * Math.PI / 180));
      return points.map(([lat, lng]) => {
        const dy = (lat - centerLat) * latMeters;
        const dx = (lng - centerLng) * lngMeters;
        const distance = Math.hypot(dx, dy) || 1;
        const extra = Math.min(25, Math.max(10, distance * 0.08));
        const scale = (distance + extra) / distance;
        return [centerLat + (dy * scale) / latMeters, centerLng + (dx * scale) / lngMeters];
      });
    }

    function readAdapterPois() {
      try {
        const adapter = JSON.parse(sessionStorage.getItem(CAMPSITE_ADAPTER_STORAGE_KEY) || 'null');
        return Array.isArray(adapter?.pois)
          ? adapter.pois.map(poi => ({ lat:Number(poi.lat), lng:Number(poi.lng) })).filter(poi => Number.isFinite(poi.lat) && Number.isFinite(poi.lng))
          : [];
      } catch (_) {
        return [];
      }
    }

    function autoPolygon() {
      const L = window.L;
      const map = window.__campsiteBridge089LeafletMap;
      const status = document.getElementById('bridgeSelectionStatus');
      if (!L || !map) {
        if (status) status.textContent = '⚠️ 地図の準備がまだ終わっていません。数秒後にもう一度お試しください。';
        return;
      }

      const all = readAdapterPois();
      const bounds = map.getBounds?.();
      const visible = bounds ? all.filter(poi => bounds.contains([poi.lat, poi.lng])) : [];
      const candidates = visible.length >= 3 ? visible : all;
      if (candidates.length < 3) {
        if (status) status.textContent = '⚠️ 自動提案には3件以上のPOIが必要です。';
        return;
      }

      const hull = padHull(convexHull(candidates.map(poi => [poi.lat, poi.lng])));
      if (hull.length < 3) {
        if (status) status.textContent = '⚠️ POI配置からポリゴンを作れませんでした。手描きを使ってください。';
        return;
      }

      document.getElementById('bridgeClearBtn')?.click();
      const draw = document.getElementById('bridgeDrawBtn');
      if (draw?.getAttribute('aria-pressed') !== 'true') draw?.click();
      for (const point of hull) map.fire('click', { latlng: L.latLng(point[0], point[1]) });
      if (draw?.getAttribute('aria-pressed') === 'true') draw.click();
      if (status) status.textContent = `✨ 表示中${candidates.length.toLocaleString('ja-JP')}件から自動提案しました。必要なら手描きで微調整してください。`;
    }

    function installButton() {
      const toolbar = document.querySelector('#campsiteBridgeSelection .bridge-map-toolbar');
      if (!toolbar || document.getElementById('bridgeAutoProposalBtn')) return false;
      const button = document.createElement('button');
      button.id = 'bridgeAutoProposalBtn';
      button.type = 'button';
      button.textContent = '✨';
      button.title = '表示中のPOIからポリゴンを自動提案';
      button.setAttribute('aria-label', '表示中のPOIからポリゴンを自動提案');
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        autoPolygon();
      });
      const undo = document.getElementById('bridgeUndoBtn');
      toolbar.insertBefore(button, undo || null);
      return true;
    }

    const observer = new MutationObserver(() => { if (installButton()) observer.disconnect(); });
    const start = () => {
      if (!installButton()) observer.observe(document.documentElement, { childList:true, subtree:true });
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once:true });
    else start();
  }

  function installWayfarerBridge() {
    if (window.__campsiteBridge089Installed) return;
    window.__campsiteBridge089Installed = true;

    const poiByGuid = new Map();
    const smrByGuid = new Map();
    const smrRecords = new Map();
    const observedGcsL14Tokens = new Set();
    const observedSponsorL15Ids = new Set();
    const queriedSponsorL15Ids = new Set();
    const sponsoredObjectIdsSeen = new Set();
    const sponsoredObjectIdsDetailed = new Set();
    const bridgeNativeFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;
    let sponsorFetchInFlight = null;
    let sendWorkflowActive = false;
    let renderTimer = null;
    let sendState = null;
    let finalizedPoisCache = null;
    let countsCache = null;
    const sessionStartedAt = new Date().toISOString();
    let diagnosticsEnabled = false;
    const diagnosticLog = [];
    let lastDiff = null;
    let lastQuality = null;
    let areaCachePersistTimer = null;
    let areaCacheLoadMeta = { loadedAreas:0, loadedPois:0, prunedAreas:0, prunedPois:0, migrated:false };
    let areaCache = loadAreaCache();
    let previousSnapshot = loadHistorySnapshot();

    const stats = {
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
      areaCacheLoaded: areaCacheLoadMeta.loadedPois,
      areaCacheHits: 0,
      areaCacheMisses: 0,
      areaCachePruned: areaCacheLoadMeta.prunedPois,
      areaCacheWrites: 0,
      areaCacheAreas: Array.isArray(areaCache?.areas) ? areaCache.areas.length : 0,
      areaCachePois: Object.keys(areaCache?.pois || {}).length,
      diffNew: 0,
      diffChanged: 0,
      diffMissing: 0,
      diffMissingReliable: false,
      qualityScore: 0,
      qualityLabel: '取得中'
    };

    const isObject = value => value && typeof value === 'object' && !Array.isArray(value);

    function asFiniteNumber(value) {
      const n = typeof value === 'number' ? value : Number(value);
      return Number.isFinite(n) ? n : undefined;
    }

    function diag(type, detail = {}) {
      diagnosticLog.push({ at: new Date().toISOString(), type: String(type || 'event'), detail });
      if (diagnosticLog.length > DIAGNOSTIC_LOG_LIMIT) {
        diagnosticLog.splice(0, diagnosticLog.length - DIAGNOSTIC_LOG_LIMIT);
      }
    }
