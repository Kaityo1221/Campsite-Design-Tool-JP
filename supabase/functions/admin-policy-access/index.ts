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
      "Cache-Control": "no-store",
    },
  });
}

function sanitizeText(value: unknown, maxLength = 500): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function requireAdminSession(supabase: any, token: string) {
  if (!token) return null;
  const tokenHash = await sha256(token);
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("id, expires_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();
  if (error || !data) return null;
  await supabase.from("admin_sessions").update({ last_used_at: nowIso }).eq("id", data.id);
  return data;
}

function nullableLimit(value: unknown, field: string): number | null {
  if (value === null || value === undefined || value === "" || value === "unlimited") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 10000) throw new Error(`${field}_invalid`);
  return n;
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
    const body = await request.json().catch(() => ({}));
    const sessionToken = sanitizeText(body?.sessionToken, 500);
    if (!(await requireAdminSession(supabase, sessionToken))) {
      return jsonResponse({ success: false, authRequired: true, error: "管理者セッションが無効です。" }, 401);
    }

    const action = sanitizeText(body?.action, 40) || "get";

    if (action === "get") {
      const { data, error } = await supabase
        .from("campsite_policy_versions")
        .select("id, version_no, spacing_meters, total_poi_limit, pokestop_limit, gym_limit, power_spot_limit, note, created_by, created_at")
        .eq("is_active", true)
        .order("version_no", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return jsonResponse({ success: true, policy: data || null });
    }

    if (action === "history") {
      const limit = Math.min(Math.max(Number(body?.limit) || 20, 1), 100);
      const { data, error } = await supabase
        .from("campsite_policy_versions")
        .select("id, version_no, spacing_meters, total_poi_limit, pokestop_limit, gym_limit, power_spot_limit, is_active, note, created_by, created_at")
        .order("version_no", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return jsonResponse({ success: true, items: data || [] });
    }

    if (action === "set") {
      const spacingMeters = Number(body?.spacingMeters);
      if (!Number.isInteger(spacingMeters) || spacingMeters < 1 || spacingMeters > 1000) {
        return jsonResponse({ success: false, error: "距離基準が正しくありません。" }, 400);
      }

      const totalPoiLimit = nullableLimit(body?.totalPoiLimit, "total_poi_limit");
      const pokestopLimit = nullableLimit(body?.pokestopLimit, "pokestop_limit");
      const gymLimit = nullableLimit(body?.gymLimit, "gym_limit");
      const powerSpotLimit = nullableLimit(body?.powerSpotLimit, "power_spot_limit");
      const note = sanitizeText(body?.note, 1000);

      const { data, error } = await supabase.rpc("set_current_campsite_policy", {
        p_spacing_meters: spacingMeters,
        p_total_poi_limit: totalPoiLimit,
        p_pokestop_limit: pokestopLimit,
        p_gym_limit: gymLimit,
        p_power_spot_limit: powerSpotLimit,
        p_note: note || null,
        p_created_by: "admin",
      });
      if (error) throw error;
      return jsonResponse({ success: true, policy: data || null });
    }

    return jsonResponse({ success: false, error: "不明な処理です。" }, 400);
  } catch (error) {
    console.error("admin-policy-access", error);
    const message = error instanceof Error ? error.message : String(error);
    if (/_invalid$/.test(message)) return jsonResponse({ success: false, error: "上限値が正しくありません。" }, 400);
    return jsonResponse({ success: false, error: "ポリシー処理でエラーが発生しました。" }, 500);
  }
});
