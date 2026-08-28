import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const discordIdentity = identities.find((identity: any) => identity?.provider === "discord");
  const identityData: any = (discordIdentity as any)?.identity_data || {};
  const meta: any = user.user_metadata || {};
  const discordUserId = firstString(identityData.provider_id, identityData.sub, (discordIdentity as any)?.id, meta.provider_id, meta.sub);
  if (!discordUserId) return json({ error: "Discord identity could not be verified" }, 422);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: adminRow, error: adminError } = await admin
    .from("ca_access_admins")
    .select("discord_user_id,active")
    .eq("discord_user_id", discordUserId)
    .eq("active", true)
    .maybeSingle();
  if (adminError) {
    console.error("Geo admin lookup failed", adminError);
    return json({ error: "Admin status lookup failed" }, 500);
  }
  if (!adminRow) return json({ error: "Owner access required" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const action = firstString(body?.action) || "list";
  if (action !== "list") return json({ error: "Unsupported action" }, 400);

  const requestedLimit = Number(body?.limit || 100);
  const limit = Math.max(1, Math.min(200, Number.isFinite(requestedLimit) ? Math.trunc(requestedLimit) : 100));
  let query = admin
    .from("ca_geo_block_log")
    .select("id,discord_user_id,discord_name,occurred_at,latitude,longitude,gps_accuracy_m,ip_country,gps_result,block_reason,test_bypass,test_scenario,metadata")
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (typeof body?.discordUserId === "string" && body.discordUserId.trim()) {
    query = query.eq("discord_user_id", body.discordUserId.trim());
  }

  const { data, error } = await query;
  if (error) {
    console.error("Geo block log list failed", error);
    return json({ error: "Block log lookup failed" }, 500);
  }

  return json({ ok: true, items: data || [], retentionDays: 30 });
});
