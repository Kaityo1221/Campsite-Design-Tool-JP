/* Supabase 疎通確認用
   ※ブラウザには Publishable key のみ記載する
   ※Secret key / service_role は絶対に記載しない */

const CAMPSITE_SUPABASE_URL = "https://azkshxjgsbtjgwbapcfw.supabase.co";
const CAMPSITE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK";

window.campsiteSupabase = window.supabase.createClient(
  CAMPSITE_SUPABASE_URL,
  CAMPSITE_SUPABASE_PUBLISHABLE_KEY
);

console.log("Campsite Lab Supabase client ready");
