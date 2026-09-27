/* Chairman-only visibility/entry guard for CA geo test mode. */
(function () {
  'use strict';

  if (window.__campsiteChairmanTestGuardLoaded) return;
  window.__campsiteChairmanTestGuardLoaded = true;

  let resolved = false;
  let allowed = false;
  let apiWrapped = false;

  function isChairmanPanel(panel) {
    return !!panel && String(panel.textContent || '').includes('会長テストモード');
  }

  function enforcePanel() {
    const panel = document.getElementById('caGeoGuardPanel');
    if (!isChairmanPanel(panel)) return;
    panel.style.display = resolved && allowed ? 'block' : 'none';
  }

  function wrapGeoGuardApi() {
    if (apiWrapped) return;
    const original = window.CampsiteCaGeoGuard;
    if (!original?.check || !original?.runTest) return;

    const guarded = Object.freeze({
      check: (...args) => original.check(...args),
      runTest: (testScenario) => {
        if (!resolved || !allowed) {
          return Promise.reject(new Error('Chairman test mode is not available.'));
        }
        return original.runTest(testScenario);
      }
    });

    try {
      window.CampsiteCaGeoGuard = guarded;
      apiWrapped = true;
    } catch (_) {
      // Visibility guard below remains fail-closed even if API replacement is unavailable.
    }
  }

  async function resolveFlag() {
    const client = window.campsiteSupabase;
    if (!client?.functions?.invoke) {
      resolved = true;
      allowed = false;
      enforcePanel();
      return;
    }

    try {
      const { data, error } = await client.functions.invoke('ca-chairman-access', { body: {} });
      if (error) throw error;
      allowed = data?.isChairman === true;
    } catch (error) {
      console.warn('Chairman test flag lookup failed', error?.message || error);
      allowed = false;
    } finally {
      resolved = true;
      window.__campsiteChairmanTestAllowed = allowed;
      wrapGeoGuardApi();
      enforcePanel();
    }
  }

  function startObserver() {
    const observer = new MutationObserver(() => {
      wrapGeoGuardApi();
      enforcePanel();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style']
    });
    wrapGeoGuardApi();
    enforcePanel();
    resolveFlag();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  window.CampsiteChairmanTestGuard = Object.freeze({
    isResolved: () => resolved,
    isAllowed: () => allowed
  });
})();
