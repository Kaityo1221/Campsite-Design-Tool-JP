import { copy, assertData, fail } from '../core/poi-model.mjs';
import { normalizePois } from '../core/poi-id.mjs';

const layers = Object.freeze({
  'existing-pokestop': ['existing', 'pokestop'], 'existing-gym': ['existing', 'gym'], 'existing-power': ['existing', 'power'],
  'new-pokestop': ['new', 'pokestop'], 'new-gym': ['new', 'gym'], 'new-power': ['new', 'power'],
});
const entities = Object.freeze({ POKESTOP: 'pokestop', GYM: 'gym', POWERSPOT: 'power' });

function explicit(candidates, code) {
  const values = candidates.filter(v => v !== undefined);
  if (!values.length || new Set(values).size !== 1) fail(code, '必須項目が欠落または矛盾しています');
  return values[0];
}

// Receives data explicitly; it has no storage, Bridge, KMZ or network connection.
export function convertLegacy(input, options = {}) {
  try {
    assertData(input);
    let rows;
    if (Array.isArray(input)) rows = input;
    else if (Object.hasOwn(input, 'currentPois')) rows = input.currentPois;
    else if (Object.hasOwn(input, 'records')) rows = input.records;
    else fail('UNKNOWN_LEGACY_FORMAT', '対応するPOI配列がありません');
    if (!Array.isArray(rows)) fail('INVALID_RECORDS', 'POI配列が不正です');
    const mapped = [], errors = [];
    rows.forEach((row, index) => {
      try {
        if (!row || typeof row !== 'object' || Array.isArray(row)) fail('INVALID_POI', 'POIが不正です');
        if (row.layer !== undefined && !Object.hasOwn(layers, row.layer)) fail('UNKNOWN_LAYER', 'レイヤーを明確に判定できません');
        if (row.role !== undefined && !['existing', 'new', 'added'].includes(row.role)) fail('UNKNOWN_ROLE', '区分が不明です');
        if (row.gameEntity !== undefined && !Object.hasOwn(entities, row.gameEntity)) fail('UNKNOWN_KIND', '種類が不明です');
        const fromLayer = layers[row.layer];
        const role = explicit([fromLayer?.[0], row.role === 'added' ? 'new' : row.role], 'AMBIGUOUS_ROLE');
        const kind = explicit([fromLayer?.[1], row.kind, entities[row.gameEntity]], 'AMBIGUOUS_KIND');
        const title = explicit([row.title, row.name], 'AMBIGUOUS_TITLE');
        if (row.latlng !== undefined && (!Array.isArray(row.latlng) || row.latlng.length !== 2)) fail('INVALID_COORDINATES', '座標配列が不正です');
        const lat = explicit([row.latlng?.[0], row.lat], 'AMBIGUOUS_COORDINATES');
        const lng = explicit([row.latlng?.[1], row.lng], 'AMBIGUOUS_COORDINATES');
        const memoValues = [row.memo, row.description].filter(v => v !== undefined);
        const memo = memoValues.length ? explicit(memoValues, 'AMBIGUOUS_MEMO') : '';
        mapped.push({ id: row.id ?? null, role, kind, title, lat, lng, memo,
          deleted: row.deleted ?? false, guid: row.guid ?? null, poiId: row.poiId ?? null,
          metadata: { legacyRecord: copy(row) } });
      } catch (error) { errors.push({ index, code: error.code ?? 'INVALID_POI', message: error.message }); }
    });
    if (errors.length) return { ok: false, records: [], mapping: [], warnings: [], errors };
    const result = normalizePois(mapped, options);
    return { ...result, preservedEnvelope: Array.isArray(input) ? null : copy(input) };
  } catch (error) {
    return { ok: false, records: [], mapping: [], warnings: [], errors: [{ code: error.code ?? 'INVALID_DATA', message: error.message }] };
  }
}