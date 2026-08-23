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
  return String(value || "").normalize("NFKC").toLowerCase().replace(/\s+/g, "").trim();
}

function centroid(rows: any[]) {
  const pts = rows.filter((r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)) && Number(r.lat) !== 0 && Number(r.lng) !== 0);
  if (!pts.length) return null;
  const lat = pts.reduce((s, r) => s + Number(r.lat), 0) / pts.length;
  const lng = pts.reduce((s, r) => s + Number(r.lng), 0) / pts.length;
  return { lat, lng };
}

function distanceMeters(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
  const R = 6371000;
  const p1 = a.lat * Math.PI / 180;
  const p2 = b.lat * Math.PI / 180;
  const dp = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(dp/2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1-x));
}

function publicPoi(row: any) {
  return {
    masterPoiId: row.master_poi_id,
    name: row.raw_name || row.normalized_name || "名称なし",
    normalizedName: row.normalized_name || "",
    poiType: row.poi_type || "",
    lat: Number(row.lat),
    lng: Number(row.lng),
  };
}

function publicHistory(item: any) {
  return {
    id: item.upload.id,
    createdAt: item.upload.created_at,
    parkName: item.upload.park_name || "",
    fileName: item.upload.display_file_name || item.upload.original_file_name || "",
    pois: item.rows.map(publicPoi),
  };
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

    const recordId = sanitizeText(body?.recordId, 80);
    if (!recordId) return jsonResponse({ success: false, error: "recordId_required" }, 400);

    const { data: currentUpload, error: uploadErr } = await sb
      .from("campsite_kmz_uploads")
      .select("id, park_name, created_at, deleted_at")
      .eq("id", recordId)
      .maybeSingle();
    if (uploadErr || !currentUpload || currentUpload.deleted_at) {
      return jsonResponse({ success: false, error: "対象データが見つかりません。" }, 404);
    }

    const { data: currentObs, error: currentErr } = await sb
      .from("campsite_poi_observations")
      .select("master_poi_id, raw_name, normalized_name, poi_type, lat, lng")
      .eq("upload_id", recordId)
      .limit(5000);
    if (currentErr) throw currentErr;

    const currentRows = (currentObs || []).filter((r: any) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)) && Number(r.lat) !== 0 && Number(r.lng) !== 0);
    if (currentRows.length < 3) {
      return jsonResponse({ success: true, hasPast: false, reason: "not_enough_current_pois" });
    }

    const center = centroid(currentRows)!;
    const lats = currentRows.map((r: any) => Number(r.lat));
    const lngs = currentRows.map((r: any) => Number(r.lng));
    const pad = 0.006;
    const minLat = Math.min(...lats) - pad;
    const maxLat = Math.max(...lats) + pad;
    const minLng = Math.min(...lngs) - pad;
    const maxLng = Math.max(...lngs) + pad;

    const { data: nearbyObs, error: nearbyErr } = await sb
      .from("campsite_poi_observations")
      .select("upload_id, master_poi_id, raw_name, normalized_name, poi_type, lat, lng, observed_at")
      .neq("upload_id", recordId)
      .gte("lat", minLat)
      .lte("lat", maxLat)
      .gte("lng", minLng)
      .lte("lng", maxLng)
      .lt("observed_at", currentUpload.created_at)
      .order("observed_at", { ascending: false })
      .limit(10000);
    if (nearbyErr) throw nearbyErr;

    const grouped = new Map<string, any[]>();
    for (const row of nearbyObs || []) {
      if (!row.upload_id) continue;
      if (!grouped.has(row.upload_id)) grouped.set(row.upload_id, []);
      grouped.get(row.upload_id)!.push(row);
    }

    const currentIds = new Set(currentRows.map((r: any) => r.master_poi_id).filter(Boolean));
    const currentPark = norm(currentUpload.park_name);
    const candidateIds = [...grouped.keys()].slice(0, 80);
    if (!candidateIds.length) return jsonResponse({ success: true, hasPast: false, reason: "no_nearby_history" });

    const { data: candidateUploads } = await sb
      .from("campsite_kmz_uploads")
      .select("id, park_name, created_at, display_file_name, original_file_name, deleted_at")
      .in("id", candidateIds)
      .is("deleted_at", null);

    const uploadMap = new Map((candidateUploads || []).map((u: any) => [u.id, u]));
    const accepted: any[] = [];

    for (const [uploadId, rows] of grouped.entries()) {
      const upload = uploadMap.get(uploadId);
      if (!upload || rows.length < 3) continue;
      const c = centroid(rows);
      if (!c) continue;
      const centerDistance = distanceMeters(center, c);
      const shared = [...new Set(rows.map((r: any) => r.master_poi_id).filter(Boolean))].filter((id: any) => currentIds.has(id)).length;
      const candidatePark = norm(upload.park_name);
      const parkMatch = Boolean(currentPark && candidatePark && currentPark === candidatePark);

      let isAccepted = false;
      if (shared >= 3 && centerDistance <= 1200) isAccepted = true;
      else if (shared >= 1 && centerDistance <= 350 && parkMatch) isAccepted = true;
      else if (shared === 0 && centerDistance <= 180 && parkMatch) isAccepted = true;
      if (!isAccepted) continue;

      const score = shared * 1000 + (parkMatch ? 250 : 0) + Math.max(0, 500 - Math.round(centerDistance));
      accepted.push({ upload, rows, shared, centerDistance, score });
    }

    if (!accepted.length) return jsonResponse({ success: true, hasPast: false, reason: "no_confident_match" });

    accepted.sort((a, b) => new Date(b.upload.created_at).getTime() - new Date(a.upload.created_at).getTime());
    const history = accepted.slice(0, 8);
    const best = history[0];

    return jsonResponse({
      success: true,
      hasPast: true,
      current: {
        id: currentUpload.id,
        createdAt: currentUpload.created_at,
        parkName: currentUpload.park_name || "",
        pois: currentRows.map(publicPoi),
      },
      previous: publicHistory(best),
      history: history.map(publicHistory),
      hasMoreHistory: history.length > 1,
      match: {
        source: "poi_footprint",
        confident: true,
      },
    });
  } catch (error) {
    console.error("admin-past-site-state", error);
    return jsonResponse({ success: false, error: "過去データの照合に失敗しました。" }, 500);
  }
});
