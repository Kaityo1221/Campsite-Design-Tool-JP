import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_STATUS = new Set(["ok", "needs_check", "needs_revision", "hold"]);
const VALID_REASONS = new Set([
  "distance", "poi_limit", "duplicate", "scope", "layer",
  "traffic", "route", "waiting", "other",
]);

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

function intValue(value: unknown, fallback = 0, max = 100000): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(Math.trunc(n), max));
}

function nullableLimit(value: unknown): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 100000 ? n : null;
}

function safePoint(value: any) {
  const lat = Number(value?.lat);
  const lng = Number(value?.lng);
  return {
    name: sanitizeText(value?.name, 200) || "名称なし",
    lat: Number.isFinite(lat) && lat >= -90 && lat <= 90 ? lat : null,
    lng: Number.isFinite(lng) && lng >= -180 && lng <= 180 ? lng : null,
    added: value?.added === true,
    poiType: ["pokestop", "gym", "powerSpot", "unknown"].includes(String(value?.poiType))
      ? String(value.poiType)
      : "unknown",
  };
}

function safePairs(value: unknown, maxItems = 100) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((row: any) => {
    const distance = Number(row?.distance);
    return {
      a: safePoint(row?.a),
      b: safePoint(row?.b),
      distance: Number.isFinite(distance) && distance >= 0 ? Math.round(distance * 10) / 10 : null,
    };
  });
}

function sanitizeAutoSnapshot(value: any) {
  if (!value || typeof value !== "object") return {};
  const counts = value.counts || {};
  const limitWarnings = Array.isArray(value.limitWarnings)
    ? value.limitWarnings.slice(0, 20).map((row: any) => ({
        key: sanitizeText(row?.key, 40),
        label: sanitizeText(row?.label, 100),
        count: intValue(row?.count),
        limit: nullableLimit(row?.limit),
      }))
    : [];

  return {
    ready: value.ready === true,
    scopedCount: intValue(value.scopedCount),
    addedCount: intValue(value.addedCount),
    counts: {
      totalAdded: intValue(counts.totalAdded),
      pokestop: intValue(counts.pokestop),
      gym: intValue(counts.gym),
      powerSpot: intValue(counts.powerSpot),
      unknown: intValue(counts.unknown),
    },
    spacingPairs: safePairs(value.spacingPairs),
    duplicatePairs: safePairs(value.duplicatePairs),
    limitWarnings,
  };
}

function sanitizeReasons(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(v => String(v)).filter(v => VALID_REASONS.has(v)))].slice(0, 20);
}

function publicReview(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    siteId: row.site_id,
    uploadId: row.upload_id,
    reviewRevision: row.review_revision,
    status: row.status,
    reasons: Array.isArray(row.reasons) ? row.reasons : [],
    memo: row.memo || "",
    scopeId: row.scope_id || null,
    scopeRevision: row.scope_revision ?? null,
    policyVersionNo: row.policy_version_no ?? null,
    policySnapshot: row.policy_snapshot || {},
    autoCheckSnapshot: row.auto_check_snapshot || {},
    reviewedAt: row.reviewed_at,
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
    const uploadId = sanitizeText(body?.uploadId, 80);

    if (action === "get") {
      if (!uploadId) return jsonResponse({ success: false, error: "upload_id_required" }, 400);
      const limit = Math.min(Math.max(Number(body?.limit) || 10, 1), 50);
      const { data, error } = await supabase
        .from("campsite_review_records")
        .select("id, site_id, upload_id, review_revision, status, reasons, memo, scope_id, scope_revision, policy_version_no, policy_snapshot, auto_check_snapshot, reviewed_at")
        .eq("upload_id", uploadId)
        .order("review_revision", { ascending: false })
        .limit(limit);
      if (error) throw error;
      const rows = data || [];
      return jsonResponse({ success: true, latest: publicReview(rows[0]), history: rows.map(publicReview) });
    }

    if (action === "save") {
      const siteId = sanitizeText(body?.siteId, 80);
      const status = sanitizeText(body?.status, 40);
      const reasons = sanitizeReasons(body?.reasons);
      const memo = sanitizeText(body?.memo, 1000);
      const requestedPolicyVersion = intValue(body?.policyVersionNo, 0, Number.MAX_SAFE_INTEGER);

      if (!siteId || !uploadId) return jsonResponse({ success: false, error: "site_id_and_upload_id_required" }, 400);
      if (!VALID_STATUS.has(status)) return jsonResponse({ success: false, error: "審査結果が正しくありません。" }, 400);

      const { data: upload, error: uploadError } = await supabase
        .from("campsite_kmz_uploads")
        .select("id, site_id, deleted_at")
        .eq("id", uploadId)
        .maybeSingle();
      if (uploadError) throw uploadError;
      if (!upload || upload.deleted_at || upload.site_id !== siteId) {
        return jsonResponse({ success: false, error: "サイトと提出履歴の対応を確認できませんでした。" }, 400);
      }

      const { data: scopeRows, error: scopeError } = await supabase
        .from("campsite_review_scopes")
        .select("id, site_id, revision, is_active")
        .eq("site_id", siteId)
        .eq("is_active", true)
        .order("revision", { ascending: false })
        .limit(1);
      if (scopeError) throw scopeError;
      const scope = scopeRows?.[0] || null;

      let policyQuery = supabase
        .from("campsite_policy_versions")
        .select("id, version_no, spacing_meters, total_poi_limit, pokestop_limit, gym_limit, power_spot_limit, note, created_at")
        .limit(1);
      if (requestedPolicyVersion > 0) {
        policyQuery = policyQuery.eq("version_no", requestedPolicyVersion);
      } else {
        policyQuery = policyQuery.eq("is_active", true).order("version_no", { ascending: false });
      }
      const { data: policyRows, error: policyError } = await policyQuery;
      if (policyError) throw policyError;
      const policy = policyRows?.[0] || null;
      if (!policy) return jsonResponse({ success: false, error: "審査時ポリシーを確認できませんでした。" }, 409);

      const policySnapshot = {
        id: policy.id,
        versionNo: policy.version_no,
        spacingMeters: policy.spacing_meters,
        limits: {
          total: policy.total_poi_limit,
          pokestop: policy.pokestop_limit,
          gym: policy.gym_limit,
          powerSpot: policy.power_spot_limit,
        },
        note: policy.note || "",
        createdAt: policy.created_at,
      };

      const autoCheckSnapshot = sanitizeAutoSnapshot(body?.autoCheckSnapshot);

      const { data, error } = await supabase.rpc("save_campsite_review_record", {
        p_site_id: siteId,
        p_upload_id: uploadId,
        p_admin_session_id: session.id,
        p_status: status,
        p_reasons: reasons,
        p_memo: memo || null,
        p_scope_id: scope?.id || null,
        p_scope_revision: scope?.revision || null,
        p_policy_version_id: policy.id,
        p_policy_version_no: policy.version_no,
        p_policy_snapshot: policySnapshot,
        p_auto_check_snapshot: autoCheckSnapshot,
      });
      if (error) throw error;
      return jsonResponse({ success: true, review: publicReview(data) });
    }

    return jsonResponse({ success: false, error: "不明な処理です。" }, 400);
  } catch (error) {
    console.error("admin-review-records", error);
    const message = error instanceof Error ? error.message : String(error);
    if (/upload does not belong to site|scope does not belong to site/.test(message)) {
      return jsonResponse({ success: false, error: "サイトと審査対象の対応を確認できませんでした。" }, 400);
    }
    return jsonResponse({ success: false, error: "レビュー記録の処理でエラーが発生しました。" }, 500);
  }
});
