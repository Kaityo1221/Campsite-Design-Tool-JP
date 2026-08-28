import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ROWS = 5000;

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

type CreatorProfile = {
  authUserId: string | null;
  discordUserId: string;
  discordName: string | null;
  discordGlobalName: string | null;
  evidenceCount: number;
  firstVerifiedAt: string | null;
  lastVerifiedAt: string | null;
};

function displayName(profile: CreatorProfile): string {
  const globalName = sanitizeText(profile.discordGlobalName, 100);
  const userName = sanitizeText(profile.discordName, 100);
  if (globalName && userName && globalName !== userName) return `${globalName} (@${userName})`;
  if (userName) return `@${userName}`;
  if (globalName) return globalName;
  return `Discord ${profile.discordUserId}`;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
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
    const sessionToken = sanitizeText(body?.sessionToken, 500);
    const session = await requireAdminSession(supabase, sessionToken);
    if (!session) {
      return jsonResponse({ success: false, authRequired: true, error: "管理者セッションが無効です。" }, 401);
    }

    const { data, error } = await supabase
      .from("campsite_kmz_uploads")
      .select("id, anonymous_device_id, created_at, created_by_auth_user_id, created_by_discord_user_id, created_by_discord_name, created_by_discord_global_name")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(MAX_ROWS);

    if (error) {
      console.error("creator inference query failed", error);
      return jsonResponse({ success: false, error: "作成者推定情報を取得できませんでした。" }, 500);
    }

    const rows = data || [];
    const creatorsByDevice = new Map<string, Map<string, CreatorProfile>>();

    for (const row of rows) {
      const deviceId = sanitizeText(row.anonymous_device_id, 120);
      const discordUserId = sanitizeText(row.created_by_discord_user_id, 100);
      if (!deviceId || !discordUserId) continue;

      if (!creatorsByDevice.has(deviceId)) creatorsByDevice.set(deviceId, new Map());
      const deviceCreators = creatorsByDevice.get(deviceId)!;
      const existing = deviceCreators.get(discordUserId);
      const createdAt = sanitizeText(row.created_at, 80) || null;

      if (!existing) {
        deviceCreators.set(discordUserId, {
          authUserId: sanitizeText(row.created_by_auth_user_id, 80) || null,
          discordUserId,
          discordName: sanitizeText(row.created_by_discord_name, 100) || null,
          discordGlobalName: sanitizeText(row.created_by_discord_global_name, 100) || null,
          evidenceCount: 1,
          firstVerifiedAt: createdAt,
          lastVerifiedAt: createdAt,
        });
      } else {
        existing.evidenceCount += 1;
        if (createdAt && (!existing.firstVerifiedAt || createdAt < existing.firstVerifiedAt)) existing.firstVerifiedAt = createdAt;
        if (createdAt && (!existing.lastVerifiedAt || createdAt > existing.lastVerifiedAt)) {
          existing.lastVerifiedAt = createdAt;
          existing.authUserId = sanitizeText(row.created_by_auth_user_id, 80) || existing.authUserId;
          existing.discordName = sanitizeText(row.created_by_discord_name, 100) || existing.discordName;
          existing.discordGlobalName = sanitizeText(row.created_by_discord_global_name, 100) || existing.discordGlobalName;
        }
      }
    }

    let directCount = 0;
    let inferredCount = 0;
    let ambiguousCount = 0;
    let unknownCount = 0;

    const records = rows.map((row: any) => {
      const directDiscordUserId = sanitizeText(row.created_by_discord_user_id, 100);
      const deviceId = sanitizeText(row.anonymous_device_id, 120);
      const deviceCreators = deviceId ? creatorsByDevice.get(deviceId) : undefined;
      const creatorCount = deviceCreators?.size || 0;

      if (directDiscordUserId) {
        directCount += 1;
        const profile = deviceCreators?.get(directDiscordUserId) || {
          authUserId: sanitizeText(row.created_by_auth_user_id, 80) || null,
          discordUserId: directDiscordUserId,
          discordName: sanitizeText(row.created_by_discord_name, 100) || null,
          discordGlobalName: sanitizeText(row.created_by_discord_global_name, 100) || null,
          evidenceCount: 1,
          firstVerifiedAt: sanitizeText(row.created_at, 80) || null,
          lastVerifiedAt: sanitizeText(row.created_at, 80) || null,
        };
        return {
          recordId: row.id,
          source: "direct",
          confidence: "confirmed",
          displayName: displayName(profile),
          discordUserId: profile.discordUserId,
          discordName: profile.discordName,
          discordGlobalName: profile.discordGlobalName,
          evidenceCount: profile.evidenceCount,
          firstVerifiedAt: profile.firstVerifiedAt,
          lastVerifiedAt: profile.lastVerifiedAt,
          deviceCreatorCount: creatorCount || 1,
        };
      }

      if (creatorCount === 1) {
        inferredCount += 1;
        const profile = [...deviceCreators!.values()][0];
        return {
          recordId: row.id,
          source: "device_inferred",
          confidence: "same_device",
          displayName: displayName(profile),
          discordUserId: profile.discordUserId,
          discordName: profile.discordName,
          discordGlobalName: profile.discordGlobalName,
          evidenceCount: profile.evidenceCount,
          firstVerifiedAt: profile.firstVerifiedAt,
          lastVerifiedAt: profile.lastVerifiedAt,
          deviceCreatorCount: 1,
        };
      }

      if (creatorCount > 1) {
        ambiguousCount += 1;
        return {
          recordId: row.id,
          source: "ambiguous",
          confidence: "none",
          displayName: "判定不能",
          discordUserId: null,
          discordName: null,
          discordGlobalName: null,
          evidenceCount: [...deviceCreators!.values()].reduce((sum, creator) => sum + creator.evidenceCount, 0),
          firstVerifiedAt: null,
          lastVerifiedAt: null,
          deviceCreatorCount: creatorCount,
        };
      }

      unknownCount += 1;
      return {
        recordId: row.id,
        source: "unknown",
        confidence: "none",
        displayName: "記録なし",
        discordUserId: null,
        discordName: null,
        discordGlobalName: null,
        evidenceCount: 0,
        firstVerifiedAt: null,
        lastVerifiedAt: null,
        deviceCreatorCount: 0,
      };
    });

    return jsonResponse({
      success: true,
      capped: rows.length >= MAX_ROWS,
      summary: {
        total: rows.length,
        direct: directCount,
        inferred: inferredCount,
        ambiguous: ambiguousCount,
        unknown: unknownCount,
        identifiedDevices: [...creatorsByDevice.values()].filter((creators) => creators.size === 1).length,
        ambiguousDevices: [...creatorsByDevice.values()].filter((creators) => creators.size > 1).length,
      },
      records,
    });
  } catch (error) {
    console.error("admin-kmz-creator-inference", error);
    return jsonResponse({ success: false, error: "作成者推定処理でエラーが発生しました。" }, 500);
  }
});
