import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { unzipSync, strFromU8 } from "npm:fflate@0.8.2";
import { DOMParser } from "npm:@xmldom/xmldom@0.8.10";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET_NAME = "campsite-kmz";
const MAX_POINTS = 5000;

type PoiPoint = { name: string; normalizedName: string; poiType: string | null; lat: number; lng: number };

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

function normalizeText(value: string): string {
  return String(value || "").normalize("NFKC").trim().replace(/[\s　_＿\-－ー]+/g, "").toLowerCase();
}

const layerMap = new Map<string, string>([
  [normalizeText("既存 PokéStop"), "pokestop"], [normalizeText("既存 Gym"), "gym"],
  [normalizeText("既存 PowerSpot"), "power_spot"], [normalizeText("新規 PokéStop"), "pokestop"],
  [normalizeText("新規 Gym"), "gym"], [normalizeText("新規 PowerSpot"), "power_spot"],
  [normalizeText("既存のポケストップ"), "pokestop"], [normalizeText("既存のジム"), "gym"],
  [normalizeText("既存のパワースポット"), "power_spot"], [normalizeText("追加希望ポケスト"), "pokestop"],
  [normalizeText("追加希望ジム"), "gym"], [normalizeText("追加希望パワスポ"), "power_spot"],
  [normalizeText("追加希望のポケストップ候補"), "pokestop"], [normalizeText("追加希望のジム候補"), "gym"],
  [normalizeText("追加希望のパワースポット候補"), "power_spot"], [normalizeText("追加希望ポケストップ候補"), "pokestop"],
  [normalizeText("追加希望ジム候補"), "gym"], [normalizeText("追加希望パワースポット候補"), "power_spot"],
  [normalizeText("追加 PokéStop"), "pokestop"], [normalizeText("追加 Gym"), "gym"],
  [normalizeText("追加 PowerSpot"), "power_spot"], [normalizeText("追加希望POI"), "pokestop"],
]);

function directChildText(node: any, localName: string): string {
  if (!node?.childNodes) return "";
  for (let i = 0; i < node.childNodes.length; i++) {
    const child = node.childNodes[i];
    const name = String(child?.localName || child?.nodeName || "").split(":").pop();
    if (name === localName) return String(child?.textContent || "").trim();
  }
  return "";
}

function nearestFolderName(node: any): string {
  let current = node?.parentNode || null;
  while (current) {
    const name = String(current?.localName || current?.nodeName || "").split(":").pop();
    if (name === "Folder") return directChildText(current, "name");
    current = current.parentNode || null;
  }
  return "";
}

function parseCoordinate(text: string): { lat: number; lng: number } | null {
  const first = String(text || "").trim().split(/\s+/)[0];
  if (!first) return null;
  const parts = first.split(",");
  const lng = Number(parts[0]);
  const lat = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function extractPointsFromKml(kmlText: string): PoiPoint[] {
  const doc = new DOMParser().parseFromString(kmlText, "text/xml");
  if (!doc) throw new Error("KMLをXMLとして解析できませんでした");
  const placemarks = doc.getElementsByTagName("Placemark");
  const points: PoiPoint[] = [];
  for (let i = 0; i < placemarks.length; i++) {
    const placemark: any = placemarks.item(i);
    const pointNodes = placemark?.getElementsByTagName?.("Point");
    if (!pointNodes || pointNodes.length === 0) continue;
    const folderName = nearestFolderName(placemark);
    const poiType = layerMap.get(normalizeText(folderName));
    if (!poiType) continue;
    const coordinateNodes = pointNodes.item(0)?.getElementsByTagName?.("coordinates");
    if (!coordinateNodes || coordinateNodes.length === 0) continue;
    const coordinate = parseCoordinate(String(coordinateNodes.item(0)?.textContent || ""));
    if (!coordinate) continue;
    const name = directChildText(placemark, "name") || "名称不明";
    points.push({ name, normalizedName: name.normalize("NFKC").trim().toLowerCase(), poiType, ...coordinate });
    if (points.length >= MAX_POINTS) break;
  }
  return points;
}

function extractKmlText(bytes: Uint8Array, fileName: string): string {
  if (String(fileName || "").toLowerCase().endsWith(".kml")) return strFromU8(bytes);
  const zip = unzipSync(bytes);
  for (const [name, content] of Object.entries(zip)) if (name.toLowerCase().endsWith(".kml")) return strFromU8(content);
  for (const [name, content] of Object.entries(zip)) {
    if (!name.toLowerCase().endsWith(".kmz")) continue;
    const inner = unzipSync(content);
    for (const [innerName, innerContent] of Object.entries(inner)) if (innerName.toLowerCase().endsWith(".kml")) return strFromU8(innerContent);
  }
  throw new Error("KMZ内にKMLが見つかりませんでした");
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ success: false, error: "POSTのみ対応しています" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse({ success: false, error: "サーバー設定エラー" }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  try {
    const body = await request.json().catch(() => ({}));
    const recordId = typeof body?.record_id === "string" ? body.record_id : "";
    if (!recordId) return jsonResponse({ success: false, error: "record_id がありません" }, 400);

    const { data: record, error: recordError } = await supabase
      .from("campsite_kmz_uploads")
      .select("id, action_type, storage_bucket, storage_path, original_file_name, display_file_name, park_name, created_at")
      .eq("id", recordId)
      .single();
    if (recordError || !record) return jsonResponse({ success: false, error: "対象履歴が見つかりません" }, 404);
    if (!record.storage_path) return jsonResponse({ success: true, extracted: 0, ingested: 0, skipped: "storage_pathなし" });

    const { data: blob, error: downloadError } = await supabase.storage.from(record.storage_bucket || BUCKET_NAME).download(record.storage_path);
    if (downloadError || !blob) throw new Error(`Storage読込失敗: ${downloadError?.message || "unknown"}`);

    const bytes = new Uint8Array(await blob.arrayBuffer());
    const fileName = record.original_file_name || record.display_file_name || record.storage_path;
    const points = extractPointsFromKml(extractKmlText(bytes, fileName));

    let ingested = 0;
    const errors: string[] = [];
    for (const point of points) {
      const { error } = await supabase.rpc("ingest_campsite_poi_observation", {
        p_upload_id: record.id, p_action_type: record.action_type, p_raw_name: point.name,
        p_normalized_name: point.normalizedName, p_poi_type: point.poiType, p_lat: point.lat, p_lng: point.lng,
        p_observed_at: record.created_at, p_source_file_name: fileName, p_park_name: record.park_name,
      });
      if (error) { if (errors.length < 5) errors.push(error.message); continue; }
      ingested++;
    }

    let siteId: string | null = null;
    let siteAssignmentError: string | null = null;
    if (ingested >= 3) {
      const { data: assignedSiteId, error: siteError } = await supabase.rpc("assign_campsite_upload_site", { p_upload_id: record.id });
      if (siteError) {
        siteAssignmentError = siteError.message;
        console.error("site assignment failed", record.id, siteError);
      } else {
        siteId = typeof assignedSiteId === "string" ? assignedSiteId : null;
      }
    }

    return jsonResponse({ success: true, extracted: points.length, ingested, failed: points.length - ingested, errors, siteId, siteAssignmentError });
  } catch (error) {
    console.error("ingest-campsite-pois:", error);
    return jsonResponse({ success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});
