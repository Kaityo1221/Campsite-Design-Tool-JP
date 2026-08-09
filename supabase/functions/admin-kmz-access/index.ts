import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MAX_ROWS = 1000;
const SIGNED_URL_SECONDS = 90;

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

function tokyoDateKey(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function buildDeviceLabels(rows: any[], currentDeviceId: string) {
  const ids = [...new Set(rows.map((r) => r.anonymous_device_id).filter(Boolean))] as string[];
  const labels = new Map<string, string>();
  let n = 1;
  ids.forEach((id) => {
    if (currentDeviceId && id === currentDeviceId) labels.set(id, "この端末");
    else labels.set(id, `端末 ${String(n++).padStart(2, "0")}`);
  });
  return labels;
}

function toPublic(row: any, labels: Map<string, string>, currentDeviceId: string) {
  return {
    id: row.id,
    actionType: row.action_type,
    originalFileName: row.original_file_name,
    displayFileName: row.display_file_name,
    parkName: row.park_name,
    fileSizeBytes: row.file_size_bytes,
    poiCount: row.poi_count,
    existingPoiCount: row.existing_poi_count,
    addedPoiCount: row.added_poi_count,
    warningCount: row.warning_count,
    campsiteScore: row.campsite_score,
    campsiteRank: row.campsite_rank,
    uploadStatus: row.upload_status,
    isDuplicate: row.upload_status === "duplicate",
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    deviceLabel: labels.get(row.anonymous_device_id) || "端末不明",
    isCurrentDevice: Boolean(currentDeviceId && row.anonymous_device_id === currentDeviceId),
  };
}

function buildUnique(rows: any[], labels: Map<string, string>, currentDeviceId: string) {
  const groups = new Map<string, any[]>();
  rows.forEach((row) => {
    const key = row.file_hash || row.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(row);
  });

  return [...groups.values()].map((group) => {
    const sorted = [...group].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const rep = sorted[0];
    const currentCount = currentDeviceId
      ? sorted.filter((r) => r.anonymous_device_id === currentDeviceId).length
      : 0;
    return {
      ...toPublic(rep, labels, currentDeviceId),
      historyCount: sorted.length,
      duplicateCount: sorted.filter((r) => r.upload_status === "duplicate").length,
      firstActivityAt: sorted[sorted.length - 1]?.created_at || rep.created_at,
      lastActivityAt: rep.created_at,
      actionTypes: [...new Set(sorted.map((r) => r.action_type))],
      currentDeviceHistoryCount: currentCount,
      otherDeviceHistoryCount: sorted.length - currentCount,
      hasCurrentDeviceActivity: currentCount > 0,
      hasOtherDeviceActivity: sorted.length - currentCount > 0,
    };
  }).sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
}

function summarize(rows: any[]) {
  const today = tokyoDateKey(new Date());
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return {
    history: rows.length,
    uniqueFiles: new Set(rows.map((r) => r.file_hash || r.id)).size,
    duplicateHistory: rows.filter((r) => r.upload_status === "duplicate").length,
    distinctDevices: new Set(rows.map((r) => r.anonymous_device_id).filter(Boolean)).size,
    kmzGenerateCount: rows.filter((r) => r.action_type === "kmz_generate").length,
    distanceCheckCount: rows.filter((r) => r.action_type === "distance_check").length,
    todayCount: rows.filter((r) => tokyoDateKey(r.created_at) === today).length,
    last7DaysCount: rows.filter((r) => new Date(r.created_at).getTime() >= sevenDaysAgo).length,
  };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "POSTリクエストのみ受け付けます。" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ success: false, error: "サーバー設定に問題があります。" }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await request.json().catch(() => ({}));
    const sessionToken = sanitizeText(body?.sessionToken, 500);
    const session = await requireAdminSession(supabase, sessionToken);
    if (!session) {
      return jsonResponse({ success: false, authRequired: true, error: "管理者セッションが無効です。" }, 401);
    }

    const action = sanitizeText(body?.action, 30) || "list";

    if (action === "list") {
      const currentDeviceId = sanitizeText(body?.currentDeviceId, 100);
      const { data, error } = await supabase
        .from("campsite_kmz_uploads")
        .select("id, anonymous_device_id, action_type, original_file_name, display_file_name, park_name, storage_bucket, storage_path, file_hash, file_size_bytes, poi_count, existing_poi_count, added_poi_count, warning_count, campsite_score, campsite_rank, upload_status, duplicate_of, created_at, expires_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(MAX_ROWS);
      if (error) return jsonResponse({ success: false, error: "提出KMZ一覧を取得できませんでした。" }, 500);

      const rows = data || [];
      const labels = buildDeviceLabels(rows, currentDeviceId);
      const currentRows = currentDeviceId ? rows.filter((r: any) => r.anonymous_device_id === currentDeviceId) : [];
      const otherRows = currentDeviceId ? rows.filter((r: any) => r.anonymous_device_id !== currentDeviceId) : rows;
      const all = summarize(rows);
      const other = summarize(otherRows);

      return jsonResponse({
        success: true,
        capped: rows.length >= MAX_ROWS,
        summary: {
          totalHistory: all.history,
          uniqueFiles: all.uniqueFiles,
          duplicateHistory: all.duplicateHistory,
          distinctDevices: all.distinctDevices,
          kmzGenerateCount: all.kmzGenerateCount,
          distanceCheckCount: all.distanceCheckCount,
          todayCount: all.todayCount,
          last7DaysCount: all.last7DaysCount,
          currentDeviceHistoryCount: currentRows.length,
          otherDeviceHistoryCount: other.history,
          otherUniqueFiles: other.uniqueFiles,
          otherDuplicateHistory: other.duplicateHistory,
          otherDistinctDevices: other.distinctDevices,
          otherKmzGenerateCount: other.kmzGenerateCount,
          otherDistanceCheckCount: other.distanceCheckCount,
          otherTodayCount: other.todayCount,
          otherLast7DaysCount: other.last7DaysCount,
        },
        historyRecords: rows.map((r: any) => toPublic(r, labels, currentDeviceId)),
        uniqueRecords: buildUnique(rows, labels, currentDeviceId),
      });
    }

    if (action === "download") {
      const recordId = sanitizeText(body?.recordId, 80);
      if (!recordId) return jsonResponse({ success: false, error: "KMZレコードIDがありません。" }, 400);

      const { data: record, error } = await supabase
        .from("campsite_kmz_uploads")
        .select("id, duplicate_of, storage_bucket, storage_path, original_file_name, display_file_name, deleted_at")
        .eq("id", recordId)
        .maybeSingle();
      if (error || !record || record.deleted_at) return jsonResponse({ success: false, error: "対象KMZが見つかりません。" }, 404);

      let source: any = record;
      if ((!source.storage_bucket || !source.storage_path) && source.duplicate_of) {
        const { data: original } = await supabase
          .from("campsite_kmz_uploads")
          .select("id, storage_bucket, storage_path, original_file_name, display_file_name, deleted_at")
          .eq("id", source.duplicate_of)
          .maybeSingle();
        if (original && !original.deleted_at) source = original;
      }
      if (!source.storage_bucket || !source.storage_path) return jsonResponse({ success: false, error: "KMZ本体の保存先が見つかりません。" }, 404);

      const { data: signed, error: signedError } = await supabase.storage
        .from(source.storage_bucket)
        .createSignedUrl(source.storage_path, SIGNED_URL_SECONDS);
      if (signedError || !signed?.signedUrl) return jsonResponse({ success: false, error: "KMZ取得URLを発行できませんでした。" }, 500);

      return jsonResponse({
        success: true,
        signedUrl: signed.signedUrl,
        expiresIn: SIGNED_URL_SECONDS,
        fileName: source.display_file_name || source.original_file_name || "campsite.kmz",
        recordId: source.id,
      });
    }

    return jsonResponse({ success: false, error: "不明な処理です。" }, 400);
  } catch (error) {
    console.error("admin-kmz-access", error);
    return jsonResponse({ success: false, error: "管理者KMZアクセスでエラーが発生しました。" }, 500);
  }
});
