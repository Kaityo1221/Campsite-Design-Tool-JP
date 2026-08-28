import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    const s = text(value, 200);
    if (s) return s;
  }
  return "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method Not Allowed" }, 405);

  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return json({ success: false, error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ success: false, error: "Server configuration error" }, 500);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return json({ success: false, error: "Unauthorized" }, 401);

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const discordIdentity: any = identities.find((identity: any) => identity?.provider === "discord") || null;
  const appProvider = firstString((user.app_metadata as any)?.provider);
  if (!discordIdentity && appProvider !== "discord") return json({ success: false, error: "Discord login is required" }, 403);

  const identityData: any = discordIdentity?.identity_data || {};
  const meta: any = user.user_metadata || {};
  const discordUserId = firstString(identityData.provider_id, identityData.sub, discordIdentity?.id, meta.provider_id, meta.sub);
  const discordName = firstString(identityData.user_name, identityData.username, meta.user_name, meta.preferred_username, meta.name, meta.full_name);
  const discordGlobalName = firstString(identityData.global_name, identityData.full_name, meta.full_name, meta.name);
  if (!discordUserId) return json({ success: false, error: "Discord identity could not be verified" }, 422);

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const anonymousDeviceId = text(body?.anonymousDeviceId, 120);
  if (!anonymousDeviceId || !/^[0-9a-z-]{20,120}$/i.test(anonymousDeviceId)) {
    return json({ success: false, error: "Invalid device id" }, 400);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: access, error: accessError } = await admin
    .from("ca_access_requests")
    .select("id,status,discord_user_id,discord_name,discord_global_name")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (accessError) {
    console.error("ca-device-link access lookup", accessError);
    return json({ success: false, error: "Access status lookup failed" }, 500);
  }
  if (!access || access.status !== "approved") return json({ success: false, error: "Approved CA access is required" }, 403);

  const now = new Date().toISOString();
  const payload = {
    anonymous_device_id: anonymousDeviceId,
    auth_user_id: user.id,
    discord_user_id: access.discord_user_id || discordUserId,
    discord_name: access.discord_name || discordName || null,
    discord_global_name: access.discord_global_name || discordGlobalName || null,
    last_seen_at: now,
    updated_at: now,
  };

  const { data: existing, error: existingError } = await admin
    .from("ca_device_identity_links")
    .select("id")
    .eq("anonymous_device_id", anonymousDeviceId)
    .eq("discord_user_id", payload.discord_user_id)
    .maybeSingle();

  if (existingError) {
    console.error("ca-device-link lookup", existingError);
    return json({ success: false, error: "Device link lookup failed" }, 500);
  }

  let saved;
  let saveError;
  if (existing?.id) {
    const result = await admin
      .from("ca_device_identity_links")
      .update(payload)
      .eq("id", existing.id)
      .select("id,anonymous_device_id,discord_user_id,discord_name,discord_global_name,first_seen_at,last_seen_at")
      .single();
    saved = result.data;
    saveError = result.error;
  } else {
    const result = await admin
      .from("ca_device_identity_links")
      .insert({ ...payload, first_seen_at: now })
      .select("id,anonymous_device_id,discord_user_id,discord_name,discord_global_name,first_seen_at,last_seen_at")
      .single();
    saved = result.data;
    saveError = result.error;
  }

  if (saveError) {
    console.error("ca-device-link save", saveError);
    return json({ success: false, error: "Device link could not be saved" }, 500);
  }

  return json({ success: true, linked: true, deviceId: saved.anonymous_device_id, discordUserId: saved.discord_user_id });
});
