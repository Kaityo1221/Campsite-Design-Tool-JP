const MEGA_FINALE_SUPABASE_URL = "https://azkshxjgsbtjgwbapcfw.supabase.co";
const MEGA_FINALE_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rWbeIqdWJJHHBtphER8bdg__CaS_xGK";

window.megaFinaleSupabase = (window.supabase && typeof window.supabase.createClient === "function")
  ? window.supabase.createClient(MEGA_FINALE_SUPABASE_URL, MEGA_FINALE_SUPABASE_PUBLISHABLE_KEY)
  : null;
