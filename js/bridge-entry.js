(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('campsiteBridgeImport') !== '1') return;

  let adapter = null;
  try {
    adapter = JSON.parse(sessionStorage.getItem('campsiteBridgeAdapter.v0.3') || 'null');
  } catch (_) {}
  if (!Array.isArray(adapter?.pois) || adapter.pois.length === 0) return;

  function enterBridgeTool() {
    const opening = document.getElementById('openingScreen');
    if (opening) {
      opening.classList.remove('show');
      opening.style.opacity = '1';
      opening.style.transition = 'none';
    }
    document.body.classList.remove('opening-mode');
    try { window.openTab?.('tool'); } catch (_) {}
    try { window.setWorkflowStep?.('csv'); } catch (_) {}
    window.scrollTo({ top:0, behavior:'auto' });
  }

  function receivedCounts() {
    const result = {
      total: adapter.pois.length,
      pokestop: 0,
      gym: 0,
      powerspot: 0,
      sponsored: 0,
      smr: 0
    };

    for (const poi of adapter.pois) {
      const entity = String(poi?.gameEntity || poi?.type || '').trim().toUpperCase();
      if (entity === 'POKESTOP') result.pokestop += 1;
      else if (entity === 'GYM') result.gym += 1;
      else if (entity === 'POWERSPOT') result.powerspot += 1;
      if (poi?.sponsored === true || String(poi?.sponsored).toLowerCase() === 'true') result.sponsored += 1;
      if (poi?.smr === true || String(poi?.smr).toLowerCase() === 'true') result.smr += 1;
    }

    return result;
  }

  function installSummaryStyles() {
    if (document.getElementById('campsiteBridgeReceivedSummaryStyles')) return;
    const style = document.createElement('style');
    style.id = 'campsiteBridgeReceivedSummaryStyles';
    style.textContent = `
      #campsiteBridgeSelection .bridge-summary{display:block!important;padding:0!important}
      #campsiteBridgeSelection .bridge-summary-section{padding:12px 14px}
      #campsiteBridgeSelection .bridge-summary-section + .bridge-summary-section{border-top:1px solid #1e293b}
      #campsiteBridgeSelection .bridge-summary-title{margin:0 0 8px;color:#bae6fd;font-size:11px;font-weight:900;letter-spacing:.04em}
      #campsiteBridgeSelection .bridge-summary-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
      #campsiteBridgeSelection .bridge-summary-grid.bridge-selected-grid{grid-template-columns:repeat(4,minmax(0,1fr))}
      @media(max-width:600px){
        #campsiteBridgeSelection .bridge-summary-grid,
        #campsiteBridgeSelection .bridge-summary-grid.bridge-selected-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
      }
    `;
    document.head.appendChild(style);
  }

  function installReceivedSummary() {
    const summary = document.querySelector('#campsiteBridgeSelection .bridge-summary');
    if (!summary) return false;
    if (summary.dataset.receivedSummaryInstalled === '1') return true;

    installSummaryStyles();
    const c = receivedCounts();
    summary.dataset.receivedSummaryInstalled = '1';
    summary.innerHTML = `
      <div class="bridge-summary-section">
        <div class="bridge-summary-title">受信内訳</div>
        <div class="bridge-summary-grid">
          <div class="bridge-count"><span>総数</span><b>${c.total.toLocaleString('ja-JP')}</b></div>
          <div class="bridge-count"><span>PokéStop</span><b>${c.pokestop.toLocaleString('ja-JP')}</b></div>
          <div class="bridge-count"><span>Gym</span><b>${c.gym.toLocaleString('ja-JP')}</b></div>
          <div class="bridge-count"><span>Power Spot</span><b>${c.powerspot.toLocaleString('ja-JP')}</b></div>
          <div class="bridge-count"><span>Sponsor</span><b>${c.sponsored.toLocaleString('ja-JP')}</b></div>
          <div class="bridge-count"><span>SMR</span><b>${c.smr.toLocaleString('ja-JP')}</b></div>
        </div>
      </div>
      <div class="bridge-summary-section">
        <div class="bridge-summary-title">選択中</div>
        <div class="bridge-summary-grid bridge-selected-grid">
          <div class="bridge-count"><span>総数</span><b id="bridgeSelectedTotal">0</b></div>
          <div class="bridge-count"><span>PokéStop</span><b id="bridgeSelectedStop">0</b></div>
          <div class="bridge-count"><span>Gym</span><b id="bridgeSelectedGym">0</b></div>
          <div class="bridge-count"><span>Power Spot</span><b id="bridgeSelectedPower">0</b></div>
        </div>
      </div>
    `;
    return true;
  }

  function watchReceivedSummary() {
    if (installReceivedSummary()) return;
    const observer = new MutationObserver(() => {
      if (installReceivedSummary()) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList:true, subtree:true });
    setTimeout(() => observer.disconnect(), 10000);
  }

  const originalShowOpeningScreen = window.showOpeningScreen;
  if (typeof originalShowOpeningScreen === 'function') {
    window.showOpeningScreen = function() {
      enterBridgeTool();
    };
  }

  if (!document.getElementById('loginScreen')) {
    setTimeout(enterBridgeTool, 0);
  }

  watchReceivedSummary();
  window.CampsiteBridgeEnterTool = enterBridgeTool;
})();
