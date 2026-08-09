import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SESSION_HOURS = 12;
const RATE_WINDOW_MINUTES = 10;
const RATE_MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

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
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return bytesToHex(new Uint8Array(digest));
}

function createSessionToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getClientFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = (
    request.headers.get("cf-connecting-ip") ||
    forwarded.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  ).slice(0, 120);
  const userAgent = (request.headers.get("user-agent") || "unknown").slice(0, 300);
  return `${ip}|${userAgent}`;
}

function isFuture(value: string | null | undefined): boolean {
  if (!value) return false;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time > Date.now();
}

async function validateSession(supabase: any, sessionToken: string) {
  if (!sessionToken) return null;
  const tokenHash = await sha256(sessionToken);
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from("admin_sessions")
    .select("id, expires_at, revoked_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .maybeSingle();

  if (error || !data) return null;

  await supabase
    .from("admin_sessions")
    .update({ last_used_at: nowIso })
    .eq("id", data.id);

  return data;
}

async function registerFailure(supabase: any, keyHash: string, existing: any) {
  const now = new Date();
  const windowMs = RATE_WINDOW_MINUTES * 60 * 1000;
  const existingWindowStart = existing?.window_started_at
    ? new Date(existing.window_started_at).getTime()
    : 0;
  const inWindow = existingWindowStart > 0 && now.getTime() - existingWindowStart < windowMs;
  const nextCount = inWindow ? Number(existing?.failed_count || 0) + 1 : 1;
  const lockedUntil = nextCount >= RATE_MAX_FAILURES
    ? new Date(now.getTime() + LOCK_MINUTES * 60 * 1000).toISOString()
    : null;

  await supabase
    .from("admin_auth_rate_limits")
    .upsert({
      key_hash: keyHash,
      failed_count: nextCount,
      window_started_at: inWindow ? existing.window_started_at : now.toISOString(),
      locked_until: lockedUntil,
      updated_at: now.toISOString(),
    });

  return { nextCount, lockedUntil };
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ success: false, error: "POSTリクエストのみ受け付けます。" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ success: false, error: "サーバー設定に問題があります。" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const body = await request.json().catch(() => ({}));
    const action = sanitizeText(body?.action, 30) || "validate";

    if (action === "login") {
      const password = sanitizeText(body?.password, 200);
      if (!password) {
        return jsonResponse({ success: false, error: "管理者パスワードを入力してください。" }, 400);
      }

      const fingerprintHash = await sha256(getClientFingerprint(request));
      const { data: rateRow } = await supabase
        .from("admin_auth_rate_limits")
        .select("key_hash, failed_count, window_started_at, locked_until")
        .eq("key_hash", fingerprintHash)
        .maybeSingle();

      if (rateRow && isFuture(rateRow.locked_until)) {
        return jsonResponse({
          success: false,
          rateLimited: true,
          error: "認証試行が多すぎます。しばらく待ってから再試行してください。",
          lockedUntil: rateRow.locked_until,
        }, 429);
      }

      const { data: config, error: configError } = await supabase
        .from("admin_kmz_browser_config")
        .select("value_hash")
        .eq("config_key", "admin_code_sha256")
        .maybeSingle();

      if (configError || !config?.value_hash) {
        return jsonResponse({ success: false, error: "管理者認証設定を確認できません。" }, 500);
      }

      const passwordHash = await sha256(password);
      if (passwordHash !== config.value_hash) {
        const failed = await registerFailure(supabase, fingerprintHash, rateRow);
        return jsonResponse({
          success: false,
          error: "管理者パスワードが違います。",
          remainingAttempts: Math.max(0, RATE_MAX_FAILURES - failed.nextCount),
          rateLimited: Boolean(failed.lockedUntil),
        }, 401);
      }

      await supabase
        .from("admin_auth_rate_limits")
        .delete()
        .eq("key_hash", fingerprintHash);

      const sessionToken = createSessionToken();
      const tokenHash = await sha256(sessionToken);
      const expiresAt = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString();

      await supabase
        .from("admin_sessions")
        .delete()
        .lt("expires_at", new Date().toISOString());

      const { error: sessionError } = await supabase
        .from("admin_sessions")
        .insert({ token_hash: tokenHash, expires_at: expiresAt });

      if (sessionError) {
        console.error("admin session insert", sessionError);
        return jsonResponse({ success: false, error: "管理者セッションを作成できませんでした。" }, 500);
      }

      return jsonResponse({ success: true, sessionToken, expiresAt });
    }

    const sessionToken = sanitizeText(body?.sessionToken, 500);
    const session = await validateSession(supabase, sessionToken);

    if (action === "validate") {
      if (!session) {
        return jsonResponse({ success: false, authRequired: true, error: "管理者セッションが無効です。" }, 401);
      }
      return jsonResponse({ success: true, expiresAt: session.expires_at });
    }

    if (action === "logout") {
      if (sessionToken) {
        const tokenHash = await sha256(sessionToken);
        await supabase
          .from("admin_sessions")
          .update({ revoked_at: new Date().toISOString() })
          .eq("token_hash", tokenHash)
          .is("revoked_at", null);
      }
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: "不明な処理です。" }, 400);
  } catch (error) {
    console.error("admin-auth", error);
    return jsonResponse({ success: false, error: "管理者認証でエラーが発生しました。" }, 500);
  }
});
