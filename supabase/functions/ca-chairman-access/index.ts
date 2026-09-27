import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return json({ error: "Server configuration error" }, 500);
  }

  const userClient: any = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user: any = userData?.user;
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const identities: any[] = Array.isArray(user.identities) ? user.identities : [];
  const discordIdentity: any = identities.find((identity) => identity?.provider === "discord");
  const identityData: any = discordIdentity?.identity_data || {};
  const meta: any = user.user_metadata || {};
  const discordUserId = firstString(
    identityData.provider_id,
    identityData.sub,
    discordIdentity?.id,
    meta.provider_id,
    meta.sub
  );
  if (!discordUserId) return json({ ok: true, isChairman: false });

  const admin: any = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: row, error } = await admin
    .from("ca_access_admins")
    .select("chairman_test_mode")
    .eq("discord_user_id", discordUserId)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    console.error("Chairman flag lookup failed", error.message);
    return json({ error: "Flag lookup failed" }, 500);
  }

  return json({ ok: true, isChairman: row?.chairman_test_mode === true });
});
