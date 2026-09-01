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

  const originalShowOpeningScreen = window.showOpeningScreen;
  if (typeof originalShowOpeningScreen === 'function') {
    window.showOpeningScreen = function() {
      enterBridgeTool();
    };
  }

  if (!document.getElementById('loginScreen')) {
    setTimeout(enterBridgeTool, 0);
  }

  window.CampsiteBridgeEnterTool = enterBridgeTool;
})();
