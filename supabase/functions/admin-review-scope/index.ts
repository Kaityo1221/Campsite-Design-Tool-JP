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

type Vertex = { lat: number; lng: number };

function parseVertices(value: unknown): Vertex[] {
  if (!Array.isArray(value) || value.length < 3 || value.length > 200) {
    throw new Error("vertices_invalid");
  }
  const vertices = value.map((item: any) => {
    const lat = Number(item?.lat);
    const lng = Number(item?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      throw new Error("vertices_invalid");
    }
    return { lat, lng };
  });
  const unique = new Set(vertices.map(v => `${v.lat.toFixed(7)},${v.lng.toFixed(7)}`));
  if (unique.size < 3) throw new Error("vertices_invalid");
  return vertices;
}

function toGeoJson(vertices: Vertex[]) {
  const ring = vertices.map(v => [v.lng, v.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return { type: "Polygon", coordinates: [ring] };
}

function verticesFromGeoJson(value: any): Vertex[] {
  const ring = Array.isArray(value?.coordinates?.[0]) ? value.coordinates[0] : [];
  const rows = ring.map((coord: any) => ({ lat: Number(coord?.[1]), lng: Number(coord?.[0]) }))
    .filter((v: Vertex) => Number.isFinite(v.lat) && Number.isFinite(v.lng));
  if (rows.length > 1) {
    const first = rows[0];
    const last = rows[rows.length - 1];
    if (first.lat === last.lat && first.lng === last.lng) rows.pop();
  }
  return rows;
}

function publicScope(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    siteId: row.site_id,
    revision: row.revision,
    vertices: verticesFromGeoJson(row.polygon_geojson),
    vertexCount: row.vertex_count,
    sourceUploadId: row.source_upload_id || null,
    isActive: row.is_active === true,
    note: row.note || "",
    createdAt: row.created_at,
  };
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
    const session = await requireAdminSession(supabase, sessionToken);
    if (!session) {
      return jsonResponse({ success: false, authRequired: true, error: "管理者セッションが無効です。" }, 401);
    }

    const action = sanitizeText(body?.action, 30) || "get";
    const siteId = sanitizeText(body?.siteId, 80);
    if (!siteId) return jsonResponse({ success: false, error: "site_id_required" }, 400);

    if (action === "get") {
      const { data, error } = await supabase
        .from("campsite_review_scopes")
        .select("id, site_id, revision, polygon_geojson, vertex_count, source_upload_id, is_active, note, created_at")
        .eq("site_id", siteId)
        .order("revision", { ascending: false })
        .limit(5);
      if (error) throw error;
      const rows = data || [];
      const active = rows.find((row: any) => row.is_active === true) || null;
      return jsonResponse({
        success: true,
        scope: publicScope(active),
        history: rows.map(publicScope),
      });
    }

    if (action === "save") {
      const vertices = parseVertices(body?.vertices);
      const sourceUploadId = sanitizeText(body?.recordId, 80) || null;
      const note = sanitizeText(body?.note, 500) || null;
      const { data, error } = await supabase.rpc("save_campsite_review_scope", {
        p_site_id: siteId,
        p_polygon_geojson: toGeoJson(vertices),
        p_vertex_count: vertices.length,
        p_source_upload_id: sourceUploadId,
        p_admin_session_id: session.id,
        p_note: note,
      });
      if (error) throw error;
      return jsonResponse({ success: true, scope: publicScope(data) });
    }

    if (action === "clear") {
      const { data, error } = await supabase.rpc("clear_campsite_review_scope", {
        p_site_id: siteId,
        p_admin_session_id: session.id,
      });
      if (error) throw error;
      return jsonResponse({ success: true, cleared: Number(data) || 0 });
    }

    return jsonResponse({ success: false, error: "不明な処理です。" }, 400);
  } catch (error) {
    console.error("admin-review-scope", error);
    const message = error instanceof Error ? error.message : String(error);
    if (message === "vertices_invalid") {
      return jsonResponse({ success: false, error: "チェック範囲の頂点が正しくありません。" }, 400);
    }
    if (/site not found|source upload does not belong to site/.test(message)) {
      return jsonResponse({ success: false, error: "サイトと提出履歴の対応を確認できませんでした。" }, 400);
    }
    return jsonResponse({ success: false, error: "チェック範囲の処理でエラーが発生しました。" }, 500);
  }
});
