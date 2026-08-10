import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_CATEGORIES = new Set(["REST", "STAY", "LOOP", "CAUTION", "EXCLUDE", "HOLD"]);
const ALLOWED_DICTIONARY_STATUSES = new Set(["adopted", "later", "rejected"]);
const AI_REVIEW_TAG = "AI_REVIEW";

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

async function validateSession(supabase: any, token: string): Promise<boolean> {
  if (!token) return false;
  const tokenHash = await sha256(token);
  const { data, error } = await supabase
    .from("admin_sessions")
    .select("id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error || !data || data.revoked_at) return false;
  if (new Date(data.expires_at).getTime() <= Date.now()) return false;

  await supabase
    .from("admin_sessions")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);
  return true;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "POSTのみ受け付けます。" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return jsonResponse({ success: false, error: "サーバー設定に問題があります。" }, 500);

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await request.json().catch(() => ({}));
    const sessionToken = sanitizeText(body?.sessionToken, 200);
    if (!(await validateSession(supabase, sessionToken))) {
      return jsonResponse({ success: false, authRequired: true, error: "管理者セッションが無効です。" }, 401);
    }

    const action = sanitizeText(body?.action, 40);
    const reviewMode = sanitizeText(body?.reviewMode, 20);
    const aiOnly = reviewMode === "ai";

    if (action === "remaining-count") {
      let query = supabase
        .from("alias_review_queue")
        .select("id", { count: "exact", head: true })
        .eq("review_status", "pending");

      if (aiOnly) {
        query = query.eq("suggested_category", AI_REVIEW_TAG);
      }

      const { count, error } = await query;
      if (error) throw error;
      return jsonResponse({ success: true, count: count || 0 });
    }

    if (action === "next-items") {
      let query = supabase
        .from("alias_review_queue")
        .select("id, poi_name, normalized_name, count, sample_lat, sample_lng, source, review_status, suggested_category, review_note, created_at")
        .eq("review_status", "pending");

      if (aiOnly) {
        query = query.eq("suggested_category", AI_REVIEW_TAG);
      }

      const { data, error } = await query
        .order("count", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(aiOnly ? 100 : 30);
      if (error) throw error;
      return jsonResponse({ success: true, items: data || [] });
    }

    if (action === "submit-review") {
      const id = sanitizeText(body?.id, 100);
      const category = sanitizeText(body?.category, 30);
      const reviewNote = sanitizeText(body?.reviewNote, 500);
      if (!id || !ALLOWED_CATEGORIES.has(category)) {
        return jsonResponse({ success: false, error: "レビュー内容が正しくありません。" }, 400);
      }

      const reviewStatus = category === "EXCLUDE" ? "excluded" : category === "HOLD" ? "hold" : "reviewed";
      const { error } = await supabase
        .from("alias_review_queue")
        .update({
          review_status: reviewStatus,
          suggested_category: category,
          review_note: reviewNote,
          reviewed_at: new Date().toISOString(),
          reviewed_by: "管理者",
        })
        .eq("id", id)
        .eq("review_status", "pending");
      if (error) throw error;
      return jsonResponse({ success: true });
    }

    if (action === "review-history") {
      const { data, error } = await supabase
        .from("alias_review_queue")
        .select("id, poi_name, normalized_name, suggested_category, review_status, review_note, reviewed_by, reviewed_at")
        .not("reviewed_at", "is", null)
        .order("reviewed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return jsonResponse({ success: true, items: data || [] });
    }

    if (action === "dictionary-candidates") {
      const { data, error } = await supabase
        .from("alias_review_queue")
        .select("id, poi_name, normalized_name, suggested_category, review_status, review_note, reviewed_by, reviewed_at, dictionary_status, dictionary_reviewed_at, dictionary_reviewed_by")
        .eq("review_status", "reviewed")
        .order("reviewed_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return jsonResponse({ success: true, items: data || [] });
    }

    if (action === "update-dictionary-status") {
      const id = sanitizeText(body?.id, 100);
      const status = sanitizeText(body?.status, 30);
      if (!id || !ALLOWED_DICTIONARY_STATUSES.has(status)) {
        return jsonResponse({ success: false, error: "辞書判断が正しくありません。" }, 400);
      }

      const { data: item, error: fetchError } = await supabase
        .from("alias_review_queue")
        .select("id, poi_name, normalized_name, suggested_category, review_note")
        .eq("id", id)
        .maybeSingle();
      if (fetchError || !item) return jsonResponse({ success: false, error: "辞書候補が見つかりません。" }, 404);

      if (status === "adopted") {
        const dictionaryMap: Record<string, { dictionary_id: string; canonical_name: string }> = {
          REST: { dictionary_id: "LAB_REST", canonical_name: "休憩" },
          STAY: { dictionary_id: "LAB_STAY", canonical_name: "滞在" },
          LOOP: { dictionary_id: "LAB_LOOP", canonical_name: "回遊" },
          CAUTION: { dictionary_id: "LAB_CAUTION", canonical_name: "注意" },
        };
        const dictionary = dictionaryMap[item.suggested_category || ""];
        const aliasName = item.poi_name || item.normalized_name || "";
        const normalizedAlias = item.normalized_name || item.poi_name || "";
        if (!dictionary || !aliasName || !normalizedAlias) {
          return jsonResponse({ success: false, error: "辞書登録に必要な情報が不足しています。" }, 400);
        }

        const aliasId = `ALIAS_${dictionary.dictionary_id}_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
        const { error: upsertError } = await supabase
          .from("alias_master")
          .upsert({
            alias_id: aliasId,
            dictionary_id: dictionary.dictionary_id,
            canonical_name: dictionary.canonical_name,
            alias_name: aliasName,
            normalized_alias: normalizedAlias,
            match_type: "exact",
            source_type: "admin_review",
            review_status: "active",
            active: true,
            note: item.review_note || "",
          }, { onConflict: "normalized_alias,dictionary_id" });
        if (upsertError) throw upsertError;
      }

      const { error: updateError } = await supabase
        .from("alias_review_queue")
        .update({
          dictionary_status: status,
          dictionary_reviewed_at: new Date().toISOString(),
          dictionary_reviewed_by: "管理者",
        })
        .eq("id", id);
      if (updateError) throw updateError;
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: "不明な処理です。" }, 400);
  } catch (error) {
    console.error("admin-alias-access", error);
    return jsonResponse({ success: false, error: "管理者レビュー処理でエラーが発生しました。" }, 500);
  }
});
