from pathlib import Path

# distance-file.js: detect recognized POI layers whose names are not one of the six formal names
path = Path('js/distance-file.js')
text = path.read_text(encoding='utf-8')

anchor = 'function renderDistanceLoadErrorHtml(title, message = "") {'
helper = r'''function getFormalPoiLayerNameForWarning(layerName) {
  const registry = window.CampsitePoiLayerNames;
  const raw = String(layerName || "").trim();

  if (!raw || !registry) return "";
  if (typeof registry.isFormal === "function" && registry.isFormal(raw)) {
    return raw;
  }

  const type = typeof getPoiTypeFromLayerName === "function"
    ? getPoiTypeFromLayerName(raw)
    : null;
  const isExisting = typeof isExistingLayerName === "function"
    ? isExistingLayerName(raw)
    : false;
  const isNew = typeof isAddedLayerName === "function"
    ? isAddedLayerName(raw)
    : false;

  if (!type || (!isExisting && !isNew)) {
    return typeof registry.canonicalize === "function"
      ? registry.canonicalize(raw)
      : "";
  }

  const formal = registry.FORMAL || {};
  const keyByRoleAndType = {
    existing: {
      pokestop: "existingPokestop",
      gym: "existingGym",
      power: "existingPowerSpot"
    },
    new: {
      pokestop: "newPokestop",
      gym: "newGym",
      power: "newPowerSpot"
    }
  };

  const role = isExisting ? "existing" : "new";
  return formal[keyByRoleAndType[role]?.[type]] || "";
}

function getDistancePoiLayerNameWarnings(layerNames = []) {
  const registry = window.CampsitePoiLayerNames;
  if (!registry || typeof registry.isFormal !== "function") return [];

  return Array.from(new Set(layerNames.map(name => String(name || "").trim())))
    .filter(Boolean)
    .filter(layerName => {
      if (typeof isAuxiliaryLayer === "function" && isAuxiliaryLayer(layerName)) {
        return false;
      }

      const hasPoiRole =
        (typeof isExistingLayerName === "function" && isExistingLayerName(layerName)) ||
        (typeof isAddedLayerName === "function" && isAddedLayerName(layerName));

      if (!hasPoiRole) return false;
      return !registry.isFormal(layerName);
    })
    .map(layerName => ({
      current: layerName,
      recommended: getFormalPoiLayerNameForWarning(layerName)
    }));
}

function renderDistancePoiLayerNameWarningHtml(warnings = []) {
  if (!warnings.length) return "";

  const rows = warnings.map(item => {
    const current = escapeDistanceHtml(item.current || "");
    const recommended = item.recommended && item.recommended !== item.current
      ? ` → <strong>${escapeDistanceHtml(item.recommended)}</strong>`
      : "";
    return `<li><code>${current}</code>${recommended}</li>`;
  }).join("");

  return `
    <div class="distance-warning" style="margin-bottom:12px;">
      <strong>⚠ POIレイヤー名が正式名称と異なります</strong><br>
      <small>距離チェックは続行できますが、提出前に正式名称へ統一してください。</small>
      <ul style="margin:8px 0 0 1.2em;padding:0;line-height:1.7;">
        ${rows}
      </ul>
      <div style="margin-top:8px;font-size:12px;line-height:1.6;opacity:.9;">
        正式名称：既存 PokéStop / 既存 Gym / 既存 PowerSpot / 新規 PokéStop / 新規 Gym / 新規 PowerSpot
      </div>
    </div>
  `;
}

'''
if helper not in text:
    if anchor not in text:
        raise SystemExit('distance-file helper anchor not found')
    text = text.replace(anchor, helper + anchor, 1)

reset_old = '''  window._layerPoints = {};
  window._hasPolygon = false;
  window._activityPolygons = [];
'''
reset_new = '''  window._layerPoints = {};
  window._hasPolygon = false;
  window._activityPolygons = [];
  window._distanceLayerNameWarnings = [];
'''
if reset_new not in text:
    if reset_old not in text:
        raise SystemExit('distance warning reset anchor not found')
    text = text.replace(reset_old, reset_new, 1)

summary_old = '''      summary.innerHTML =
  renderDistancePrecheckCompactHtml(counts);
'''
summary_new = '''      window._distanceLayerNameWarnings =
        getDistancePoiLayerNameWarnings(layerNames);

      summary.innerHTML =
        renderDistancePoiLayerNameWarningHtml(window._distanceLayerNameWarnings) +
        renderDistancePrecheckCompactHtml(counts);
'''
if summary_new not in text:
    if summary_old not in text:
        raise SystemExit('distance summary anchor not found')
    text = text.replace(summary_old, summary_new, 1)

path.write_text(text, encoding='utf-8')

# distance-poi.js: make the STEP 1 overall status reflect a layer-name warning
path = Path('js/distance-poi.js')
text = path.read_text(encoding='utf-8')

old = '''  const hasWarning =
    hasDuplicate ||
    !hasPolygon ||
    poiLimitExceeded;
'''
new = '''  const hasLayerNameWarning =
    Array.isArray(window._distanceLayerNameWarnings) &&
    window._distanceLayerNameWarnings.length > 0;

  const hasWarning =
    hasDuplicate ||
    !hasPolygon ||
    poiLimitExceeded ||
    hasLayerNameWarning;
'''
if new not in text:
    if old not in text:
        raise SystemExit('distance-poi hasWarning anchor not found')
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')

# index.html: cache-bust both modified JS files
path = Path('index.html')
text = path.read_text(encoding='utf-8')
replacements = {
    'js/distance-poi.js?v=1': 'js/distance-poi.js?v=2',
    'js/distance-file.js?v=2': 'js/distance-file.js?v=3',
}
for old, new in replacements.items():
    if old in text:
        text = text.replace(old, new, 1)
    elif new not in text:
        raise SystemExit(f'cache reference not found: {old}')
path.write_text(text, encoding='utf-8')
