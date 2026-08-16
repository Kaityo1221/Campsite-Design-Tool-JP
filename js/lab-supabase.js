/* Supabase 疎通確認用
   ※ブラウザには Publishable key のみ記載する
   ※Secret key / service_role は絶対に記載しない */

const CAMPSITE_SUPABASE_URL = "https://azkshxjgsbtjgwbapcfw.supabase.co";
const CAMPSITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK";

if (window.supabase && typeof window.supabase.createClient === "function") {
  window.campsiteSupabase = window.supabase.createClient(
    CAMPSITE_SUPABASE_URL,
    CAMPSITE_SUPABASE_PUBLISHABLE_KEY
  );

  console.log("Campsite Lab Supabase client ready");
} else {
  window.campsiteSupabase = null;
  console.warn("Supabase SDKを読み込めませんでした。送信機能は無効です。");
}

async function loadCampsiteEngineDecisions(testBatchId = "kasai-rinkai-20260625-v1") {
  if (!window.campsiteSupabase) {
    console.warn("Supabase client is not ready.");
    return [];
  }

  const { data, error } = await window.campsiteSupabase
    .from("campsite_poi_engine_decisions_v1")
    .select("*")
    .eq("test_batch_id", testBatchId)
    .eq("is_active", true)
    .order("source_queue_id", { ascending: true });

  if (error) {
    console.error("engine decisions load error:", error);
    return [];
  }

  return data || [];
}

window.loadCampsiteEngineDecisions = loadCampsiteEngineDecisions;

/* Lab shell extension: keep navigation UI isolated from the large lab.html file. */
(() => {
  const script = document.createElement('script');
  script.src = 'js/lab-field-prep-entry.js?v=4';
  script.async = false;
  document.head.appendChild(script);
})();

/* Support bot extension */
(() => {
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = 'css/support-bot.css?v=1';
  document.head.appendChild(style);

  ['js/support-faq-mymaps.js?v=6', 'js/support-bot.js?v=1', 'js/support-bot-menu.js?v=2', 'js/support-bot-direct-contact.js?v=1'].forEach((src) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = false;
    document.head.appendChild(script);
  });
})();
