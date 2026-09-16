import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
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
  return String(value || "").normalize("NFKC").toLowerCase().replace(/[\s　_＿\-－ー]+/g, "").trim();
}

function centroid(rows: any[]) {
  const pts = rows.filter((r) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)) && Number(r.lat) !== 0 && Number(r.lng) !== 0);
  if (!pts.length) return null;
  return {
    lat: pts.reduce((s, r) => s + Number(r.lat), 0) / pts.length,
    lng: pts.reduce((s, r) => s + Number(r.lng), 0) / pts.length,
  };
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

function fileNameFor(upload: any): string {
  return upload?.display_file_name || upload?.original_file_name || "";
}

function publicSnapshot(upload: any, rows: any[]) {
  return {
    id: upload.id,
    siteId: upload.site_id || null,
    createdAt: upload.created_at,
    parkName: upload.park_name || "",
    fileName: fileNameFor(upload),
    pois: rows.map(publicPoi),
  };
}

async function loadRowsForUpload(sb: any, uploadId: string) {
  const { data, error } = await sb
    .from("campsite_poi_observations")
    .select("master_poi_id, raw_name, normalized_name, poi_type, lat, lng")
    .eq("upload_id", uploadId)
    .limit(5000);
  if (error) throw error;
  return (data || []).filter((r: any) => Number.isFinite(Number(r.lat)) && Number.isFinite(Number(r.lng)) && Number(r.lat) !== 0 && Number(r.lng) !== 0);
}

async function loadSiteHistory(sb: any, currentUpload: any, currentRows: any[]) {
  const { data: site } = await sb
    .from("campsite_sites")
    .select("id, canonical_name, first_seen_at, last_seen_at, assignment_count")
    .eq("id", currentUpload.site_id)
    .maybeSingle();

  const { data: uploads, error } = await sb
    .from("campsite_kmz_uploads")
    .select("id, site_id, park_name, created_at, display_file_name, original_file_name, upload_status")
    .eq("site_id", currentUpload.site_id)
    .neq("id", currentUpload.id)
    .lt("created_at", currentUpload.created_at)
    .is("deleted_at", null)
    .neq("upload_status", "duplicate")
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) throw error;

  const history: any[] = [];
  for (const upload of uploads || []) {
    const rows = await loadRowsForUpload(sb, upload.id);
    history.push(publicSnapshot(upload, rows));
  }

  return jsonResponse({
    success: true,
    hasPast: history.length > 0,
    current: publicSnapshot(currentUpload, currentRows),
    previous: history[0] || null,
    history,
    hasMoreHistory: history.length > 1,
    site: site ? {
      id: site.id,
      name: site.canonical_name || currentUpload.park_name || "",
      firstSeenAt: site.first_seen_at,
      lastSeenAt: site.last_seen_at,
      assignmentCount: site.assignment_count,
    } : { id: currentUpload.site_id, name: currentUpload.park_name || "" },
    match: { source: "site_id", confident: true },
  });
}

function currentOnly(currentUpload: any, currentRows: any[], reason: string) {
  return jsonResponse({
    success: true,
    hasPast: false,
    reason,
    current: publicSnapshot(currentUpload, currentRows),
    previous: null,
    history: [],
    hasMoreHistory: false,
    site: currentUpload.site_id ? { id: currentUpload.site_id, name: currentUpload.park_name || "" } : null,
    match: { source: currentUpload.site_id ? "site_id" : "none", confident: Boolean(currentUpload.site_id) },
  });
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
      .select("id, site_id, park_name, created_at, display_file_name, original_file_name, deleted_at")
      .eq("id", recordId)
      .maybeSingle();
    if (uploadErr || !currentUpload || currentUpload.deleted_at) {
      return jsonResponse({ success: false, error: "対象データが見つかりません。" }, 404);
    }

    const currentRows = await loadRowsForUpload(sb, recordId);

    // site_id があればPOI観測件数に関係なく、サイト履歴を直接使う。
    if (currentUpload.site_id) {
      return await loadSiteHistory(sb, currentUpload, currentRows);
    }

    // 古い記録でPOI観測が少ない場合も、ワークスペースでは現在KMZを直接描画できる。
    if (currentRows.length < 3) {
      return currentOnly(currentUpload, currentRows, "not_enough_current_pois");
    }

    // Legacy fallback for old/unassigned records.
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
    if (!candidateIds.length) return currentOnly(currentUpload, currentRows, "no_nearby_history");

    const { data: candidateUploads } = await sb
      .from("campsite_kmz_uploads")
      .select("id, site_id, park_name, created_at, display_file_name, original_file_name, deleted_at, upload_status")
      .in("id", candidateIds)
      .is("deleted_at", null);

    const uploadMap = new Map((candidateUploads || []).map((u: any) => [u.id, u]));
    const accepted: any[] = [];
    for (const [uploadId, rows] of grouped.entries()) {
      const upload = uploadMap.get(uploadId);
      if (!upload || upload.upload_status === "duplicate" || rows.length < 3) continue;
      const c = centroid(rows);
      if (!c) continue;
      const centerDistance = distanceMeters(center, c);
      const shared = [...new Set(rows.map((r: any) => r.master_poi_id).filter(Boolean))].filter((id: any) => currentIds.has(id)).length;
      const candidatePark = norm(upload.park_name);
      const parkMatch = Boolean(currentPark && candidatePark && currentPark === candidatePark);
      if (!((shared >= 3 && centerDistance <= 1200) || (shared >= 1 && centerDistance <= 350 && parkMatch) || (shared === 0 && centerDistance <= 180 && parkMatch))) continue;
      const score = shared * 1000 + (parkMatch ? 250 : 0) + Math.max(0, 500 - Math.round(centerDistance));
      accepted.push({ upload, rows, score });
    }

    if (!accepted.length) return currentOnly(currentUpload, currentRows, "no_confident_match");
    accepted.sort((a, b) => new Date(b.upload.created_at).getTime() - new Date(a.upload.created_at).getTime());
    const history = accepted.slice(0, 8).map((item) => publicSnapshot(item.upload, item.rows));

    return jsonResponse({
      success: true,
      hasPast: true,
      current: publicSnapshot(currentUpload, currentRows),
      previous: history[0],
      history,
      hasMoreHistory: history.length > 1,
      site: null,
      match: { source: "poi_footprint", confident: true },
    });
  } catch (error) {
    console.error("admin-past-site-state", error);
    return jsonResponse({ success: false, error: "過去データの照合に失敗しました。" }, 500);
  }
});
