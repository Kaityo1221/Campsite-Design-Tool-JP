/* Load Supabase Auth + Japan CA access gate on standalone pages. */
(function () {
  'use strict';

  if (window.__campsiteCaAccessBootstrapStarted) return;
  window.__campsiteCaAccessBootstrapStarted = true;

  const SUPABASE_URL = 'https://azkshxjgsbtjgwbapcfw.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK';

  // document.currentScript は await 後に null になることがあるため、
  // bootstrap 自身の場所を同期的に先に固定しておく。
  const bootstrapSrc = document.currentScript?.src || '';
  const scriptBase = bootstrapSrc
    ? new URL('.', bootstrapSrc)
    : new URL('../js/', window.location.href);

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

  async function boot() {
    if (!window.supabase?.createClient) {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    }

    if (!window.campsiteSupabase && window.supabase?.createClient) {
      window.campsiteSupabase = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
      );
    }

    if (!window.CampsiteCaAccess) {
      await loadScript(new URL('ca-access.js?v=1', scriptBase).href);
    }
  }

  boot().catch((error) => {
    console.error('CA access bootstrap failed', error);
    document.body.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#020617;color:#fff;font-family:sans-serif;padding:24px;text-align:center">認証システムを読み込めませんでした。再読み込みしてください。</div>';
  });
})();
