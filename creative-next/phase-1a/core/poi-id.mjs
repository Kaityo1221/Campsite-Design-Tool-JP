import { canonicalPoi, copy, fail, assertData } from './poi-model.mjs';

export function defaultIdFactory() {
  if (!globalThis.crypto?.randomUUID) fail('ID_GENERATOR_UNAVAILABLE', '安全なID生成機能が利用できません');
  return `poi-${globalThis.crypto.randomUUID()}`;
}

export function allocateId(reserved, factory = defaultIdFactory) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = factory();
    if (typeof id === 'string' && id.trim() && !reserved.has(id)) return id;
  }
  fail('ID_ALLOCATION_FAILED', '重複しないIDを生成できませんでした');
}

// The mapping is an ordered list, never a map keyed only by a potentially duplicated legacy ID.
export function normalizePois(inputs, { idFactory = defaultIdFactory } = {}) {
  try {
    assertData(inputs);
    if (!Array.isArray(inputs)) fail('INVALID_RECORDS', 'POI配列が必要です');
    const reserved = new Set(inputs.map(p => p?.id).filter(id => typeof id === 'string' && id.trim()));
    const used = new Set(), records = [], mapping = [], warnings = [];
    const errors = [];
    for (const [index, input] of inputs.entries()) {
      try {
        if (!input || typeof input !== 'object' || Array.isArray(input)) fail('INVALID_POI', 'POIが不正です');
        const oldId = input.id ?? null;
        const usable = typeof oldId === 'string' && !!oldId.trim();
        const reason = !usable ? 'missing-or-invalid' : used.has(oldId) ? 'collision' : 'preserved';
        const id = reason === 'preserved' ? oldId : allocateId(new Set([...reserved, ...used]), idFactory);
        const poi = canonicalPoi(input, id);
        used.add(id);
        reserved.add(id);
        records.push(poi);
        mapping.push({ index, oldId: copy(oldId), id, reason });
        if (reason !== 'preserved') warnings.push({ code: 'ID_REMAPPED', index, oldId: copy(oldId), id, reason });
      } catch (error) {
        errors.push({ index, code: error.code ?? 'INVALID_POI', message: error.message });
      }
    }
    // Diagnose duplicates without merging or dropping any record.
    const guidIndices = new Map(), coordinateIndices = new Map();
    records.forEach((poi, index) => {
      for (const [key, value, map] of [
        ['guid', poi.guid, guidIndices],
        ['location-title', `${poi.lat}|${poi.lng}|${poi.title}`, coordinateIndices],
      ]) {
        if (!value) continue;
        if (map.has(value)) warnings.push({ code: 'DUPLICATE_CANDIDATE', key, indices: [map.get(value), index] });
        else map.set(value, index);
      }
    });
    if (errors.length) return { ok: false, records: [], mapping: [], warnings, errors };
    return { ok: true, records, mapping, warnings, errors: [] };
  } catch (error) {
    return { ok: false, records: [], mapping: [], warnings: [], errors: [{ code: error.code ?? 'INVALID_DATA', message: error.message }] };
  }
}
