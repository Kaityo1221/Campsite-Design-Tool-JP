/*
 * Phase 1-B, isolated KMZ candidate diagnostic policy. No DOM, storage, network,
 * UI, or old Creative Mode mutations. Not an archive/XML parser or importer.
 * Input MUST be an exhaustive, independently audited staging manifest.
 */
export function diagnoseKmzCandidate(stage) {
  const issues = [];
  const counts = { existing: 0, newTotal: 0, newByKind: { pokestop: 0, gym: 0, power: 0 }, circles: 0, activityAreas: 0, unknown: 0 };
  const report = (code, severity, at, message) => issues.push({ code, severity, at, message });
  const data = (fields, name, at) => {
    const entries = Array.isArray(fields) ? fields.filter(x => x && x.name === name) : [];
    if (entries.length > 1) report('METADATA_DUPLICATE', 'BLOCK', at, name + ' is repeated');
    return entries.length === 1 ? String(entries[0].value ?? '') : null;
  };
  const dec = value => {
    const text = String(value ?? '').trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) return null;
    const negative = text.startsWith('-');
    const digits = text.replace(/^[+-]/, '').split('.');
    const whole = (digits[0] || '0').replace(/^0+/, '') || '0';
    const frac = (digits[1] || '').replace(/0+$/, '');
    if (whole === '0' && !frac) return '0';
    return (negative ? '-' : '') + whole + (frac ? '.' + frac : '');
  };
  const position = (place, at) => {
    const parts = typeof place.coordinates === 'string' ? place.coordinates.trim().split(',') : [];
    if (parts.length < 2 || parts.length > 3) {
      report('COORD_INVALID', 'BLOCK', at, 'Point must contain lng,lat[,alt]');
      return null;
    }
    const lng = dec(parts[0]), lat = dec(parts[1]);
    const alt = parts.length === 3 ? dec(parts[2]) : undefined;
    if (lat === null || lng === null || (parts.length === 3 && alt === null) ||
        !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)) ||
        Math.abs(Number(lat)) > 90 || Math.abs(Number(lng)) > 180) {
      report('COORD_INVALID', 'BLOCK', at, 'Invalid numeric Point');
      return null;
    }
    return { lat, lng, alt };
  };
  const folderByLayer = {
    'existing-pokestop': '既存 PokéStop', 'existing-gym': '既存 Gym', 'existing-power': '既存 PowerSpot',
    'new-pokestop': '新規 PokéStop', 'new-gym': '新規 Gym', 'new-power': '新規 PowerSpot'
  };
  let profile = 'LEGACY_UNKNOWN';
  if (!stage || typeof stage !== 'object' || !Array.isArray(stage.places)) {
    report('STAGING_INVALID', 'FATAL', 'file', 'An audited staging manifest is required');
  } else {
    const audit = stage.audit || {};
    if (audit.zipValid !== true || audit.boundedExtraction !== true || audit.safePaths !== true ||
        (Array.isArray(stage.errors) && stage.errors.some(x => ['XML_UNSAFE','ZIP_BOMB','ZIP_PATH','ZIP_INVALID','ZIP_DUPLICATE','ZIP_LIMIT','ZIP_UNSUPPORTED'].includes(x.code)))) {
      report('ARCHIVE_UNSAFE', 'FATAL', 'archive', 'Archive/XML safety checks did not pass');
    }
    if (audit.safeXml !== true) report('XML_NOT_VERIFIED', 'BLOCK', 'archive', 'KML was not safely validated');
    if (audit.kmlCount !== 1) report('KML_AMBIGUOUS', 'BLOCK', 'archive', 'Exactly one KML is required for this profile');
    if (stage.places.length === 0) report('EMPTY_INPUT', 'BLOCK', 'Document', 'No POI candidates');
    if (audit.unhandledFeatures > 0) report('UNHANDLED_KML_FEATURE', 'BLOCK', 'Document', 'Unrecognized KML features require review');
    if (audit.allObjectsCount !== stage.places.length || audit.unknownInformationPreserved !== true) {
      report('PRESERVATION_UNPROVEN', 'BLOCK', 'archive', 'All placemarks and unedited source information must be preserved');
    }
    const format = data(stage.documentData, 'campsite.creative.format', 'Document');
    const version = data(stage.documentData, 'campsite.creative.version', 'Document');
    if (format !== null || version !== null) {
      profile = 'NEW_V1';
      if (format !== 'creative-mode-next' || version !== '1') {
        report('VERSION_UNSUPPORTED', 'BLOCK', 'Document', 'Invalid/incomplete/unsupported new-format markers');
      }
    } else {
      profile = 'LEGACY_CREATIVE_KASAI_CANDIDATE';
    }
    const areaIds = new Set();
    const internalIds = new Set();
    const guidSeen = new Set();
    const nameSeen = new Set();
    const coordSeen = new Set();
    stage.places.forEach((place, index) => {
      const at = 'Placemark[' + index + ']';
      if (!place || typeof place !== 'object') {
        counts.unknown++;
        report('OBJECT_INVALID', 'BLOCK', at, 'Invalid Placemark');
        return;
      }
      const object = data(place.data, 'campsite.creative.object', at);
      if (place.geometry === 'Polygon') {
        if (profile === 'NEW_V1' && object === 'activity-area') {
          counts.activityAreas++;
          const areaId = data(place.data, 'campsite.creative.area-id', at);
          if (!areaId || areaIds.has(areaId) || place.polygonValid !== true) report('AREA_INVALID', 'BLOCK', at, 'Activity area is incomplete or ID repeated');
          else areaIds.add(areaId);
        } else if (profile === 'NEW_V1' && object === 'distance-circle') {
          counts.circles++;
          if (place.circleValid !== true) report('CIRCLE_INVALID', 'BLOCK', at, 'Circle metadata/geometry not verified');
        } else if (profile !== 'NEW_V1' && place.legacyShapeVerified === true && place.legacyShape === 'activity-area') {
          counts.activityAreas++;
        } else if (profile !== 'NEW_V1' && place.legacyShapeVerified === true && place.legacyShape === 'distance-circle') {
          counts.circles++;
        } else {
          counts.unknown++;
          report('GEOMETRY_UNKNOWN', 'BLOCK', at, 'Polygon classification is not trustworthy');
        }
        return;
      }
      if (place.geometry !== 'Point' || place.geometryCount !== 1) {
        counts.unknown++;
        report('GEOMETRY_UNKNOWN', 'BLOCK', at, 'Mixed or unknown geometries cannot be ignored');
        return;
      }
      const point = position(place, at);
      if (profile === 'NEW_V1') {
        if (object !== 'poi') report('OBJECT_TYPE_INVALID', 'BLOCK', at, 'Point must be a POI');
        const id = data(place.data, 'campsite.creative.id', at);
        const role = data(place.data, 'campsite.creative.role', at);
        const kind = data(place.data, 'campsite.creative.kind', at);
        const title = data(place.data, 'campsite.creative.title', at);
        const memo = data(place.data, 'campsite.creative.memo', at);
        const lat = dec(data(place.data, 'campsite.creative.lat', at));
        const lng = dec(data(place.data, 'campsite.creative.lng', at));
        if (!id || internalIds.has(id)) report('ID_COLLISION', 'BLOCK', at, 'ID missing or repeated');
        else internalIds.add(id);
        if (!['existing', 'new'].includes(role) || !['pokestop', 'gym', 'power'].includes(kind)) {
          report('CLASSIFICATION_INVALID', 'BLOCK', at, 'Role and kind must be explicit');
        } else if (role === 'existing') counts.existing++;
        else { counts.newTotal++; counts.newByKind[kind]++; }
        if (title === null || title !== place.name || title.length === 0 || memo === null) {
          report('TEXT_INVALID', 'BLOCK', at, 'Name or memo metadata missing or inconsistent');
        }
        if (place.description !== undefined && place.description !== memo) {
          report('DESCRIPTION_CONFLICT', 'BLOCK', at, 'Memo and description differ');
        }
        if (place.description === undefined && memo !== null) report('DESCRIPTION_ABSENT', 'WARNING', at, 'Description omitted, memo kept');
        if (!point || lat === null || lng === null || point.lat !== lat || point.lng !== lng) {
          report('COORD_CONFLICT', 'BLOCK', at, 'Point and metadata coordinates must match exactly');
        }
        const guid = data(place.data, 'campsite.creative.guid', at);
        if (guid) {
          if (guidSeen.has(guid)) report('GUID_DUPLICATE', 'WARNING', at, 'GUID shared by separate POIs');
          guidSeen.add(guid);
        }
      } else {
        const layer = data(place.data, 'nextlab-layer', at);
        if (!layer || !Object.prototype.hasOwnProperty.call(folderByLayer, layer)) {
          report('LEGACY_LAYER_INVALID', 'BLOCK', at, 'Missing or unknown legacy layer');
        } else {
          if (place.folder !== folderByLayer[layer]) report('LEGACY_FOLDER_CONFLICT', 'BLOCK', at, 'Folder and layer disagree');
          if (typeof place.styleUrl === 'string' && place.styleUrl.replace(/^#/, '').startsWith('creative-') &&
              place.styleUrl.replace(/^#creative-/, '') !== layer) report('LEGACY_STYLE_CONFLICT', 'BLOCK', at, 'Style and layer disagree');
          if (layer.startsWith('existing-')) counts.existing++;
          else { counts.newTotal++; counts.newByKind[layer.slice(4) === 'power' ? 'power' : layer.slice(4)]++; }
        }
        if (typeof place.name !== 'string' || !place.name) report('LEGACY_NAME_INVALID', 'BLOCK', at, 'Name missing');
        if (!point) report('LEGACY_COORD_INVALID', 'BLOCK', at, 'Coordinates invalid');
      }
      if (typeof place.name === 'string' && place.name) {
        if (nameSeen.has(place.name)) report('NAME_DUPLICATE', 'WARNING', at, 'Same name, distinct POI');
        nameSeen.add(place.name);
      }
      if (point) {
        const key = point.lng + ',' + point.lat;
        if (coordSeen.has(key)) report('POSITION_DUPLICATE', 'WARNING', at, 'Same location, distinct POI');
        coordSeen.add(key);
      }
    });
    if (profile !== 'NEW_V1') {
      report('LEGACY_NOT_APPROVED_FOR_APPLY', 'BLOCK', 'Document', 'Legacy profile awaits KMZ roundtrip and geometry tests');
    }
    if (counts.existing >= 500 && counts.existing <= 700) {
      report('EXISTING_LARGE', 'WARNING', 'Document', 'Large existing POI set');
    }
    if (counts.newTotal > 25 || counts.newByKind.pokestop > 12 || counts.newByKind.gym > 8 || counts.newByKind.power > 5) {
      report('NEW_LIMIT_EXCEEDED', 'WARNING', 'Document', 'Existing candidate may be edited/exported, but new additions must be blocked');
    }
    if (counts.existing > 700) report('EXISTING_OVER_700', 'FATAL', 'Document', 'Existing 701+ is rejected in full');
  }
  const disposition = issues.some(x => x.severity === 'FATAL') ? 'REJECT' :
    issues.some(x => x.severity === 'BLOCK') ? 'HOLD' : 'READY';
  return { disposition, profile, counts, issues, canApply: false };
}