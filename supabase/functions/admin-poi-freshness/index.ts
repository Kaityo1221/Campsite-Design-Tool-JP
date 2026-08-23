import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
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

function norm(value: unknown): string {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s\u3000]+/g, "")
    .replace(/[・･\-ー_]/g, "")
    .trim();
}

function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "POST only" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return jsonResponse({ success: false, error: "server_config" }, 500);

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const body = await request.json().catch(() => ({}));
    const token = sanitizeText(body?.sessionToken, 500);
    if (!(await requireAdminSession(sb, token))) {
      return jsonResponse({ success: false, authRequired: true, error: "管理者セッションが無効です。" }, 401);
    }

    const rawPoints = Array.isArray(body?.points) ? body.points.slice(0, 600) : [];
    const points = rawPoints
      .map((p: any, index: number) => ({
        index,
        name: sanitizeText(p?.name, 200),
        lat: Number(p?.lat),
        lng: Number(p?.lng),
      }))
      .filter((p: any) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat !== 0 && p.lng !== 0);

    if (!points.length) return jsonResponse({ success: true, items: [] });

    const lats = points.map((p: any) => p.lat);
    const lngs = points.map((p: any) => p.lng);
    const pad = 0.00035;
    const { data: observations, error } = await sb
      .from("campsite_poi_observations")
      .select("raw_name, normalized_name, lat, lng, observed_at")
      .gte("lat", Math.min(...lats) - pad)
      .lte("lat", Math.max(...lats) + pad)
      .gte("lng", Math.min(...lngs) - pad)
      .lte("lng", Math.max(...lngs) + pad)
      .order("observed_at", { ascending: false })
      .limit(20000);
    if (error) throw error;

    const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
    const items: any[] = [];

    for (const point of points) {
      const pointName = norm(point.name);
      const candidates = (observations || []).filter((row: any) => {
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
        const d = distanceMeters(point, { lat, lng });
        if (d > 25) return false;
        const rowName = norm(row.normalized_name || row.raw_name);
        return Boolean(pointName && rowName && pointName === rowName) || d <= 8;
      });

      if (candidates.length < 2) continue;
      const latest = candidates
        .map((r: any) => new Date(r.observed_at).getTime())
        .filter((t: number) => Number.isFinite(t))
        .sort((a: number, b: number) => b - a)[0];
      if (!Number.isFinite(latest) || latest >= cutoff) continue;

      items.push({
        index: point.index,
        name: point.name || "名称なし",
        lat: point.lat,
        lng: point.lng,
        status: "stale",
        lastObservedAt: new Date(latest).toISOString(),
      });
    }

    return jsonResponse({ success: true, items });
  } catch (error) {
    console.error("admin-poi-freshness", error);
    return jsonResponse({ success: false, error: "POI確認時期の照合に失敗しました。" }, 500);
  }
});
