import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const JAPAN_GEOJSON_URL = "https://raw.githubusercontent.com/ricewin/simplify-japan-geojson/58c561b557eab3a08ee7aa17b6837bcd789cdf43/GeoJson/prefecture.json";
const COAST_BUFFER_METERS = 500;
const GPS_ACCURACY_LIMIT_METERS = 100;
const NOTIFY_SUPPRESSION_MINUTES = 30;
const TEST_SCENARIOS = new Set(["foreign_ip", "gps_overseas", "gps_low_accuracy", "location_denied"]);

type GeoFeature = {
  geometry?: {
    type?: string;
    coordinates?: any;
  };
  bbox?: [number, number, number, number];
};

type AccessContext = {
  userId: string;
  discordUserId: string;
  discordName: string;
  discordGlobalName: string;
  requestId: string;
  isAdmin: boolean;
};

let japanFeaturesPromise: Promise<GeoFeature[]> | null = null;

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

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeCountry(value: string | null) {
  const code = (value || "").trim().toUpperCase();
  if (!code || code === "XX" || code === "T1") return "";
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return code;
}

function pointInRing(lon: number, lat: number, ring: number[][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i]?.[0];
    const yi = ring[i]?.[1];
    const xj = ring[j]?.[0];
    const yj = ring[j]?.[1];
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = ((yi > lat) !== (yj > lat)) &&
      (lon < (xj - xi) * (lat - yi) / ((yj - yi) || Number.EPSILON) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lon: number, lat: number, polygon: number[][][]) {
  if (!polygon?.length || !pointInRing(lon, lat, polygon[0])) return false;
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(lon, lat, polygon[i])) return false;
  }
  return true;
}

function geometryContainsPoint(geometry: GeoFeature["geometry"], lon: number, lat: number) {
  if (!geometry?.coordinates) return false;
  if (geometry.type === "Polygon") {
    return pointInPolygon(lon, lat, geometry.coordinates as number[][][]);
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][]).some((polygon) => pointInPolygon(lon, lat, polygon));
  }
  return false;
}

function walkCoordinatePairs(value: any, visit: (lon: number, lat: number) => void) {
  if (!Array.isArray(value)) return;
  if (value.length >= 2 && Number.isFinite(value[0]) && Number.isFinite(value[1])) {
    visit(value[0], value[1]);
    return;
  }
  for (const child of value) walkCoordinatePairs(child, visit);
}

function computeBbox(feature: GeoFeature): [number, number, number, number] | null {
  const coords = feature.geometry?.coordinates;
  if (!coords) return null;
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  walkCoordinatePairs(coords, (lon, lat) => {
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  });
  return Number.isFinite(minLon) ? [minLon, minLat, maxLon, maxLat] : null;
}

function pointSegmentDistanceMeters(
  lon: number,
  lat: number,
  lon1: number,
  lat1: number,
  lon2: number,
  lat2: number
) {
  const latRad = lat * Math.PI / 180;
  const mx = 111320 * Math.cos(latRad);
  const my = 110540;
  const ax = (lon1 - lon) * mx;
  const ay = (lat1 - lat) * my;
  const bx = (lon2 - lon) * mx;
  const by = (lat2 - lat) * my;
  const dx = bx - ax;
  const dy = by - ay;
  const denom = dx * dx + dy * dy;
  let t = denom > 0 ? -(ax * dx + ay * dy) / denom : 0;
  t = Math.max(0, Math.min(1, t));
  const px = ax + t * dx;
  const py = ay + t * dy;
  return Math.sqrt(px * px + py * py);
}

function ringBoundaryDistanceMeters(lon: number, lat: number, ring: number[][]) {
  let min = Infinity;
  for (let i = 1; i < ring.length; i++) {
    const a = ring[i - 1];
    const b = ring[i];
    if (!a || !b || ![a[0], a[1], b[0], b[1]].every(Number.isFinite)) continue;
    const d = pointSegmentDistanceMeters(lon, lat, a[0], a[1], b[0], b[1]);
    if (d < min) min = d;
    if (min <= COAST_BUFFER_METERS) return min;
  }
  return min;
}

function geometryBoundaryDistanceMeters(geometry: GeoFeature["geometry"], lon: number, lat: number) {
  if (!geometry?.coordinates) return Infinity;
  let min = Infinity;
  const scanPolygon = (polygon: number[][][]) => {
    for (const ring of polygon) {
      const d = ringBoundaryDistanceMeters(lon, lat, ring);
      if (d < min) min = d;
      if (min <= COAST_BUFFER_METERS) return;
    }
  };
  if (geometry.type === "Polygon") {
    scanPolygon(geometry.coordinates as number[][][]);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates as number[][][][]) {
      scanPolygon(polygon);
      if (min <= COAST_BUFFER_METERS) break;
    }
  }
  return min;
}

async function getJapanFeatures() {
  if (!japanFeaturesPromise) {
    japanFeaturesPromise = (async () => {
      const response = await fetch(JAPAN_GEOJSON_URL, { headers: { "Accept": "application/geo+json,application/json" } });
      if (!response.ok) throw new Error(`Japan boundary fetch failed: ${response.status}`);
      const data = await response.json();
      const features: GeoFeature[] = Array.isArray(data?.features) ? data.features : [];
      if (!features.length) throw new Error("Japan boundary data is empty");
      for (const feature of features) {
        feature.bbox = computeBbox(feature) || undefined;
      }
      return features;
    })().catch((error) => {
      japanFeaturesPromise = null;
      throw error;
    });
  }
  return japanFeaturesPromise;
}

async function classifyJapanLocation(latitude: number, longitude: number) {
  const features = await getJapanFeatures();
  const latPad = 0.006;
  const lonPad = Math.max(0.006, 0.006 / Math.max(0.25, Math.cos(latitude * Math.PI / 180)));
  const candidates = features.filter((feature) => {
    const b = feature.bbox;
    return !!b && longitude >= b[0] - lonPad && longitude <= b[2] + lonPad && latitude >= b[1] - latPad && latitude <= b[3] + latPad;
  });

  for (const feature of candidates) {
    if (geometryContainsPoint(feature.geometry, longitude, latitude)) {
      return { inJapan: true, withinBuffer: false, distanceToBoundaryM: 0 };
    }
  }

  let minDistance = Infinity;
  for (const feature of candidates) {
    const distance = geometryBoundaryDistanceMeters(feature.geometry, longitude, latitude);
    if (distance < minDistance) minDistance = distance;
    if (minDistance <= COAST_BUFFER_METERS) break;
  }

  return {
    inJapan: minDistance <= COAST_BUFFER_METERS,
    withinBuffer: minDistance <= COAST_BUFFER_METERS,
    distanceToBoundaryM: Number.isFinite(minDistance) ? Math.round(minDistance) : null
  };
}

async function resolveAccessContext(req: Request): Promise<{ context?: AccessContext; admin?: any; error?: Response }> {
  const authHeader = req.headers.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return { error: json({ error: "Unauthorized" }, 401) };

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return { error: json({ error: "Server configuration error" }, 500) };
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  const user = userData?.user;
  if (userError || !user) return { error: json({ error: "Unauthorized" }, 401) };

  const identities = Array.isArray(user.identities) ? user.identities : [];
  const discordIdentity = identities.find((identity: any) => identity?.provider === "discord");
  const identityData: any = (discordIdentity as any)?.identity_data || {};
  const meta: any = user.user_metadata || {};
  const discordUserId = firstString(identityData.provider_id, identityData.sub, (discordIdentity as any)?.id, meta.provider_id, meta.sub);
  const discordName = firstString(identityData.user_name, identityData.username, meta.user_name, meta.preferred_username, meta.name, meta.full_name);
  const discordGlobalName = firstString(identityData.global_name, identityData.full_name, meta.full_name, meta.name);
  if (!discordUserId) return { error: json({ error: "Discord identity could not be verified" }, 422) };

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const { data: accessRow, error: accessError } = await admin
    .from("ca_access_requests")
    .select("id,status,auth_user_id,discord_user_id")
    .or(`auth_user_id.eq.${user.id},discord_user_id.eq.${discordUserId}`)
    .maybeSingle();
  if (accessError) {
    console.error("Geo guard access lookup failed", accessError);
    return { error: json({ error: "Access status lookup failed" }, 500) };
  }
  if (!accessRow || accessRow.status !== "approved") {
    return { error: json({ error: "Approved CA access is required" }, 403) };
  }

  const { data: adminRow, error: adminError } = await admin
    .from("ca_access_admins")
    .select("discord_user_id,active")
    .eq("discord_user_id", discordUserId)
    .eq("active", true)
    .maybeSingle();
  if (adminError) console.warn("Geo guard admin lookup failed", adminError);

  return {
    context: {
      userId: user.id,
      discordUserId,
      discordName,
      discordGlobalName,
      requestId: accessRow.id,
      isAdmin: !!adminRow
    },
    admin
  };
}

async function recordBlock(
  admin: any,
  context: AccessContext,
  params: {
    latitude?: number | null;
    longitude?: number | null;
    accuracy?: number | null;
    ipCountry?: string | null;
    gpsResult: string;
    blockReason: string;
    testScenario?: string | null;
    testBypass?: boolean;
    metadata?: Record<string, unknown>;
  }
) {
  const since = new Date(Date.now() - NOTIFY_SUPPRESSION_MINUTES * 60_000).toISOString();
  const { data: recent } = await admin
    .from("ca_geo_block_log")
    .select("id")
    .eq("discord_user_id", context.discordUserId)
    .eq("block_reason", params.blockReason)
    .eq("test_bypass", false)
    .gte("occurred_at", since)
    .limit(1);

  const row = {
    auth_user_id: context.userId,
    discord_user_id: context.discordUserId,
    discord_name: context.discordName || null,
    latitude: isFiniteNumber(params.latitude) ? params.latitude : null,
    longitude: isFiniteNumber(params.longitude) ? params.longitude : null,
    gps_accuracy_m: isFiniteNumber(params.accuracy) ? params.accuracy : null,
    ip_country: params.ipCountry || null,
    gps_result: params.gpsResult,
    block_reason: params.blockReason,
    test_bypass: !!params.testBypass,
    test_scenario: params.testScenario || null,
    metadata: params.metadata || {}
  };

  const { error: insertError } = await admin.from("ca_geo_block_log").insert(row);
  if (insertError) console.error("Geo guard block log insert failed", insertError);

  if (params.testBypass || (Array.isArray(recent) && recent.length > 0)) return;

  const webhook = Deno.env.get("DISCORD_CA_APPROVAL_WEBHOOK_URL") || "";
  if (!webhook) return;

  const displayName = context.discordGlobalName && context.discordGlobalName !== context.discordName
    ? `${context.discordGlobalName} (@${context.discordName})`
    : `@${context.discordName}`;
  const lines = [
    params.testScenario ? "🧪 **Campsite 海外利用ガード テスト検知**" : "🚫 **Campsite 海外利用ガード ブロック**",
    "",
    `**Discord:** ${displayName}`,
    `**Discord User ID:** ${context.discordUserId}`,
    `**理由:** ${params.blockReason}`,
    `**IP国:** ${params.ipCountry || "不明"}`,
    `**位置判定:** ${params.gpsResult}`,
    `**GPS精度:** ${isFiniteNumber(params.accuracy) ? `${Math.round(params.accuracy)}m` : "取得なし"}`,
    `**座標:** ${isFiniteNumber(params.latitude) && isFiniteNumber(params.longitude) ? `${params.latitude.toFixed(6)}, ${params.longitude.toFixed(6)}` : "取得なし"}`,
    `**日時:** ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}`
  ];
  if (params.testScenario) lines.push(`**テスト:** ${params.testScenario}`);

  try {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "Campsite Geo Guard", content: lines.join("\n") })
    });
    if (!response.ok) console.error("Geo guard Discord notify failed", response.status, await response.text());
  } catch (error) {
    console.error("Geo guard Discord notify exception", error);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method Not Allowed" }, 405);

  const resolved = await resolveAccessContext(req);
  if (resolved.error) return resolved.error;
  const context = resolved.context!;
  const admin = resolved.admin!;

  let body: any = {};
  try { body = await req.json(); } catch (_) {}
  const action = firstString(body?.action) || "check";
  const testScenario = firstString(body?.testScenario);
  if (testScenario && (!context.isAdmin || !TEST_SCENARIOS.has(testScenario))) {
    return json({ error: "Test scenario is not allowed" }, 403);
  }

  let ipCountry = normalizeCountry(req.headers.get("cf-ipcountry"));
  if (testScenario === "foreign_ip") ipCountry = "US";

  const latitude = isFiniteNumber(body?.latitude) ? body.latitude : null;
  const longitude = isFiniteNumber(body?.longitude) ? body.longitude : null;
  let accuracy = isFiniteNumber(body?.accuracy) ? Math.max(0, body.accuracy) : null;
  if (testScenario === "gps_low_accuracy") accuracy = 999;

  if (action === "test_bypass") {
    if (!context.isAdmin || !TEST_SCENARIOS.has(testScenario)) {
      return json({ error: "Admin test bypass is required" }, 403);
    }
    await recordBlock(admin, context, {
      latitude, longitude, accuracy, ipCountry,
      gpsResult: "test_bypass",
      blockReason: "test_bypass",
      testScenario,
      testBypass: true,
      metadata: { source: "chairman_test_mode" }
    });
    return json({ ok: true, status: "allowed", isAdmin: true, testBypass: true });
  }

  if (action === "location_denied" || testScenario === "location_denied") {
    await recordBlock(admin, context, {
      latitude: null, longitude: null, accuracy: null, ipCountry,
      gpsResult: "permission_denied",
      blockReason: "location_permission_denied",
      testScenario: testScenario || null,
      metadata: { source: testScenario ? "chairman_test_mode" : "browser" }
    });
    return json({
      ok: true,
      status: "blocked",
      blockReason: "location_permission_denied",
      message: "この機能を利用するには位置情報の許可が必要です。端末の設定から位置情報を許可してください。",
      ipCountry: ipCountry || null,
      gpsResult: "permission_denied",
      isAdmin: context.isAdmin,
      canContinueTest: context.isAdmin && !!testScenario
    });
  }

  if (latitude === null || longitude === null || accuracy === null) {
    return json({ error: "Location data is required" }, 422);
  }

  let geo;
  try {
    geo = testScenario === "gps_overseas"
      ? { inJapan: false, withinBuffer: false, distanceToBoundaryM: null }
      : await classifyJapanLocation(latitude, longitude);
  } catch (error) {
    console.error("Japan boundary classification failed", error);
    return json({
      ok: false,
      status: "service_unavailable",
      message: "位置情報の判定に失敗しました。通信環境を確認して、もう一度お試しください。",
      isAdmin: context.isAdmin
    }, 503);
  }

  const gpsResult = geo.inJapan ? (geo.withinBuffer ? "japan_buffer_500m" : "japan") : "overseas";

  if (!ipCountry) {
    if (body?.finalizeIpUnknown === true) {
      await recordBlock(admin, context, {
        latitude, longitude, accuracy, ipCountry: null, gpsResult,
        blockReason: "ip_country_unknown",
        testScenario: testScenario || null,
        metadata: { attempts: 3, distance_to_boundary_m: geo.distanceToBoundaryM }
      });
      return json({
        ok: true,
        status: "blocked",
        blockReason: "ip_country_unknown",
        message: "接続地域を確認できませんでした。通信環境を確認して、もう一度お試しください。",
        ipCountry: null,
        gpsResult,
        isAdmin: context.isAdmin,
        canContinueTest: false
      });
    }
    return json({ ok: true, status: "ip_unknown", ipCountry: null, gpsResult, isAdmin: context.isAdmin });
  }

  if (ipCountry !== "JP") {
    await recordBlock(admin, context, {
      latitude, longitude, accuracy, ipCountry, gpsResult,
      blockReason: "foreign_ip",
      testScenario: testScenario || null,
      metadata: { distance_to_boundary_m: geo.distanceToBoundaryM }
    });
    return json({
      ok: true,
      status: "blocked",
      blockReason: "foreign_ip",
      message: "海外からの接続として判定されました。VPN等を使用している場合はオフにしてください。解消しない場合は、別のWi-Fiまたは国内のモバイル回線をお試しください。",
      ipCountry,
      gpsResult,
      isAdmin: context.isAdmin,
      canContinueTest: context.isAdmin && !!testScenario
    });
  }

  if (accuracy > GPS_ACCURACY_LIMIT_METERS) {
    if (body?.finalizeLowAccuracy === true) {
      await recordBlock(admin, context, {
        latitude, longitude, accuracy, ipCountry, gpsResult,
        blockReason: "gps_low_accuracy",
        testScenario: testScenario || null,
        metadata: { accuracy_limit_m: GPS_ACCURACY_LIMIT_METERS }
      });
      return json({
        ok: true,
        status: "blocked",
        blockReason: "gps_low_accuracy",
        message: "位置情報の精度を確認できませんでした。空が開けた場所へ移動するか、位置情報を再取得してください。",
        ipCountry,
        gpsResult,
        isAdmin: context.isAdmin,
        canContinueTest: context.isAdmin && !!testScenario
      });
    }
    return json({ ok: true, status: "retry_accuracy", ipCountry, gpsResult, accuracy, isAdmin: context.isAdmin });
  }

  if (!geo.inJapan) {
    if (body?.finalizeOverseas === true) {
      await recordBlock(admin, context, {
        latitude, longitude, accuracy, ipCountry, gpsResult,
        blockReason: "gps_overseas",
        testScenario: testScenario || null,
        metadata: { distance_to_boundary_m: geo.distanceToBoundaryM, grace_seconds: 15 }
      });
      return json({
        ok: true,
        status: "blocked",
        blockReason: "gps_overseas",
        message: "現在地が日本国内として確認できませんでした。位置情報を確認して、もう一度お試しください。",
        ipCountry,
        gpsResult,
        isAdmin: context.isAdmin,
        canContinueTest: context.isAdmin && !!testScenario
      });
    }
    return json({
      ok: true,
      status: "retry_overseas",
      ipCountry,
      gpsResult,
      isAdmin: context.isAdmin,
      distanceToBoundaryM: geo.distanceToBoundaryM
    });
  }

  return json({
    ok: true,
    status: "allowed",
    ipCountry,
    gpsResult,
    withinCoastBuffer: !!geo.withinBuffer,
    distanceToBoundaryM: geo.distanceToBoundaryM,
    isAdmin: context.isAdmin
  });
});
