import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.15";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getDiscordIdentity(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!supabaseUrl || !anonKey) return null;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data, error } = await userClient.auth.getUser();
  const user = data?.user;
  if (error || !user) return null;

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const discordIdentity = identities.find((identity: any) => identity?.provider === "discord");
  const appProvider = firstString((user.app_metadata as any)?.provider);
  if (!discordIdentity && appProvider !== "discord") return null;

  const identityData: any = (discordIdentity as any)?.identity_data || {};
  const meta: any = user.user_metadata || {};
  const discordUserId = firstString(
    identityData.provider_id,
    identityData.sub,
    (discordIdentity as any)?.id,
    meta.provider_id,
    meta.sub
  );
  const discordName = firstString(
    identityData.user_name,
    identityData.username,
    meta.user_name,
    meta.preferred_username,
    meta.name,
    meta.full_name
  );
  const discordGlobalName = firstString(
    identityData.global_name,
    identityData.full_name,
    meta.full_name,
    meta.name
  );

  if (!discordUserId || !discordName) return null;
  return { authUserId: user.id, discordUserId, discordName, discordGlobalName };
}

async function sendApprovalEmail(admin: any, authUserId: string, displayName: string) {
  const smtpUser = Deno.env.get("GMAIL_SMTP_USER") || "";
  const smtpPassword = Deno.env.get("GMAIL_SMTP_APP_PASSWORD") || "";
  if (!smtpUser || !smtpPassword) {
    return { sent: false, reason: "smtp_not_configured" };
  }

  const { data, error } = await admin.auth.admin.getUserById(authUserId);
  const recipient = firstString(data?.user?.email);
  if (error || !recipient) {
    console.error("approval email recipient lookup failed", { authUserId, error });
    return { sent: false, reason: "recipient_not_found" };
  }

  const transport = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: smtpUser,
      pass: smtpPassword
    }
  });

  const safeName = escapeHtml(displayName || "ご利用者様");
  const subject = "Campsite Design Tool への参加が承認されました";
  const text = [
    `${displayName || "ご利用者様"} さん`,
    "",
    "Campsite Design Tool への参加が承認されました 🎉",
    "",
    "Discord認証いただいたアカウントで、Campsite Design Toolをご利用いただけます。",
    "これからキャンプサイト設計の各機能をお使いいただけます。",
    "",
    "Campsite Design Tool"
  ].join("\n");
  const html = `
    <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.8;color:#1f2937">
      <p>${safeName} さん</p>
      <h2 style="margin:20px 0 12px">Campsite Design Tool への参加が承認されました 🎉</h2>
      <p>Discord認証いただいたアカウントで、Campsite Design Toolをご利用いただけます。</p>
      <p>これからキャンプサイト設計の各機能をお使いいただけます。</p>
      <p style="margin-top:28px;color:#6b7280">Campsite Design Tool</p>
    </div>
  `;

  try {
    await transport.sendMail({
      from: `"Campsite Design Tool" <${smtpUser}>`,
      to: recipient,
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (error) {
    console.error("approval email send failed", { authUserId, error });
    return { sent: false, reason: "send_failed" };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const identity = await getDiscordIdentity(req);
  if (!identity) return json({ error: "Discord login is required" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Server configuration error" }, 500);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: adminRow, error: adminError } = await admin
    .from("ca_access_admins")
    .select("discord_user_id,discord_name,active")
    .eq("discord_user_id", identity.discordUserId)
    .eq("active", true)
    .maybeSingle();

  if (adminError) {
    console.error(adminError);
    return json({ error: "Admin lookup failed" }, 500);
  }
  if (!adminRow) return json({ error: "Forbidden" }, 403);

  let body: any = {};
  try { body = await req.json(); } catch {}
  const action = firstString(body?.action) || "list";

  if (action === "list") {
    const { data, error } = await admin
      .from("ca_access_requests")
      .select("id,discord_user_id,discord_name,discord_global_name,status,first_requested_at,last_requested_at,approved_at,approved_by,rejected_at,revoked_at,note")
      .order("last_requested_at", { ascending: false });
    if (error) {
      console.error(error);
      return json({ error: "Request list failed" }, 500);
    }
    return json({ ok: true, admin: identity.discordName, requests: data || [] });
  }

  const requestId = firstString(body?.requestId);
  if (!requestId) return json({ error: "requestId is required" }, 400);

  const allowedActions = ["approve", "reject", "revoke", "restore"];
  if (!allowedActions.includes(action)) return json({ error: "Invalid action" }, 400);

  const { data: target, error: targetError } = await admin
    .from("ca_access_requests")
    .select("id,auth_user_id,discord_user_id,discord_name,discord_global_name,status")
    .eq("id", requestId)
    .maybeSingle();
  if (targetError) {
    console.error(targetError);
    return json({ error: "Request lookup failed" }, 500);
  }
  if (!target) return json({ error: "Request not found" }, 404);

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  if (action === "approve") {
    patch.status = "approved";
    patch.approved_at = now;
    patch.approved_by = identity.discordName;
    patch.rejected_at = null;
    patch.revoked_at = null;
  } else if (action === "reject") {
    patch.status = "rejected";
    patch.rejected_at = now;
    patch.approved_at = null;
    patch.approved_by = null;
    patch.revoked_at = null;
  } else if (action === "revoke") {
    patch.status = "revoked";
    patch.revoked_at = now;
  } else if (action === "restore") {
    patch.status = "approved";
    patch.approved_at = now;
    patch.approved_by = identity.discordName;
    patch.rejected_at = null;
    patch.revoked_at = null;
  }

  const { data: updated, error: updateError } = await admin
    .from("ca_access_requests")
    .update(patch)
    .eq("id", requestId)
    .select("id,discord_user_id,discord_name,discord_global_name,status,first_requested_at,last_requested_at,approved_at,approved_by,rejected_at,revoked_at,note")
    .single();

  if (updateError) {
    console.error(updateError);
    return json({ error: "Request update failed" }, 500);
  }

  const { error: auditError } = await admin.from("ca_access_audit_log").insert({
    request_id: target.id,
    target_discord_user_id: target.discord_user_id,
    target_discord_name: target.discord_name,
    action,
    admin_discord_user_id: identity.discordUserId,
    admin_discord_name: identity.discordName,
    note: firstString(body?.note) || null
  });
  if (auditError) console.error("audit insert failed", auditError);

  let approvalEmail = { sent: false, reason: "not_applicable" } as { sent: boolean; reason?: string };
  if (action === "approve" && target.status !== "approved" && target.auth_user_id) {
    const displayName = firstString(target.discord_global_name, target.discord_name) || "ご利用者様";
    approvalEmail = await sendApprovalEmail(admin, target.auth_user_id, displayName);
  }

  return json({ ok: true, request: updated, approvalEmail });
});
