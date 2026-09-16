import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=60",
    },
  });
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return jsonResponse({ success: false, error: "server_config" }, 500);

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const { data, error } = await supabase
      .from("campsite_policy_versions")
      .select("id, version_no, spacing_meters, total_poi_limit, pokestop_limit, gym_limit, power_spot_limit, note, created_by, created_at")
      .eq("is_active", true)
      .order("version_no", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return jsonResponse({ success: false, error: "active_policy_not_found" }, 404);

    return jsonResponse({ success: true, policy: data });
  } catch (error) {
    console.error("campsite-policy", error);
    return jsonResponse({ success: false, error: "policy_fetch_failed" }, 500);
  }
});
