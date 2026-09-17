/* Load Supabase Auth + Japan CA access gate on standalone pages. */
(function () {
  'use strict';

  if (window.__campsiteCaAccessBootstrapStarted) return;
  window.__campsiteCaAccessBootstrapStarted = true;

  // document.currentScript is only reliable while this script is executing.
  // Capture it before the first await so standalone pages can resolve sibling JS
  // from /js/ even after asynchronous Supabase loading.
  const BOOTSTRAP_SCRIPT_SRC = document.currentScript?.src || '';

  const SUPABASE_URL = 'https://azkshxjgsbtjgwbapcfw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK';

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = false;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  function getBootstrapBase() {
    if (BOOTSTRAP_SCRIPT_SRC) {
      return new URL('.', BOOTSTRAP_SCRIPT_SRC);
    }

    const loaded = Array.from(document.scripts || []).find(script =>
      /\/ca-access-bootstrap\.js(?:\?|$)/.test(String(script.src || ''))
    );
    if (loaded?.src) {
      return new URL('.', loaded.src);
    }

    return new URL('/Campsite-Design-Tool-JP/js/', window.location.origin);
  }

  async function boot() {
    const base = getBootstrapBase();

    if (!window.supabase?.createClient) {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    }

    if (!window.campsiteSupabase && window.supabase?.createClient) {
      window.campsiteSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );
    }

    if (!window.CampsitePolicy) {
      await loadScript(new URL('campsite-policy.js?v=1', base).href);
      await window.CampsitePolicy?.ready;
    }

    if (!window.CampsiteCaAccess) {
      await loadScript(new URL('ca-access.js?v=4', base).href);
    }

    if (!window.CampsiteCaGeoGuard) {
      await loadScript(new URL('ca-geo-guard.js?v=1', base).href);
    }

    if (!window.CampsiteCaDeviceLink) {
      await loadScript(new URL('ca-device-link.js?v=1', base).href);
    }
  }

  boot().catch((error) => {
    console.error('CA access bootstrap failed', error);
    document.body.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#020617;color:#fff;font-family:sans-serif;padding:24px;text-align:center">認証システムを読み込めませんでした。再読み込みしてください。</div>';
  });
})();
