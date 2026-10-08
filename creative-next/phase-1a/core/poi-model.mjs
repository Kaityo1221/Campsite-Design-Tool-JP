export const ROLES = Object.freeze(['existing', 'new']);
export const KINDS = Object.freeze(['pokestop', 'gym', 'power']);

export class PoiError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PoiError';
    this.code = code;
    this.details = details;
  }
}

export function copy(value) { return structuredClone(value); }
export function fail(code, message, details) { throw new PoiError(code, message, details); }

// Metadata is inert JSON data; functions, accessors and class instances are rejected.
export function assertData(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number' && Number.isFinite(value)) return;
  if (!value || typeof value !== 'object' || seen.has(value)) {
    fail('INVALID_DATA', '循環参照やJSON以外のデータは受け付けません');
  }
  const proto = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && proto !== Object.prototype && proto !== null) {
    fail('INVALID_DATA', '通常のデータオブジェクトが必要です');
  }
  seen.add(value);
  for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
    if (descriptor.get || descriptor.set) fail('INVALID_DATA', 'アクセサーは受け付けません');
    assertData(descriptor.value, seen);
  }
  seen.delete(value);
}

export function validatePoi(poi, { requireId = true } = {}) {
  assertData(poi);
  if (!poi || Array.isArray(poi)) fail('INVALID_POI', 'POIオブジェクトが必要です');
  if (requireId && (typeof poi.id !== 'string' || !poi.id.trim())) fail('INVALID_ID', '内部IDが必要です');
  if (!ROLES.includes(poi.role)) fail('UNKNOWN_ROLE', '既存／新規区分を明示してください');
  if (!KINDS.includes(poi.kind)) fail('UNKNOWN_KIND', 'POI種類を明示してください');
  if (typeof poi.title !== 'string' || !poi.title.trim()) fail('INVALID_TITLE', '名称が必要です');
  if (typeof poi.memo !== 'string') fail('INVALID_MEMO', 'メモは文字列にしてください');
  if (typeof poi.deleted !== 'boolean') fail('INVALID_DELETED', '削除状態が不正です');
  if (typeof poi.lat !== 'number' || !Number.isFinite(poi.lat) || poi.lat < -90 || poi.lat > 90 ||
      typeof poi.lng !== 'number' || !Number.isFinite(poi.lng) || poi.lng < -180 || poi.lng > 180) {
    fail('INVALID_COORDINATES', '有限の緯度・経度を指定してください');
  }
  for (const key of ['guid', 'poiId']) {
    if (poi[key] !== null && typeof poi[key] !== 'string') fail('INVALID_EXTERNAL_ID', `${key}が不正です`);
  }
  return poi;
}

export function canonicalPoi(input, id) {
  assertData(input);
  for (const key of Object.keys(input)) {
    if (!['id', 'role', 'kind', 'title', 'memo', 'lat', 'lng', 'deleted', 'guid', 'poiId', 'metadata'].includes(key)) {
      fail('UNKNOWN_FIELD', `${key}はmetadataに明示的に保持してください`);
    }
  }
  const poi = {
    id, role: input.role, kind: input.kind, title: input.title,
    memo: input.memo ?? '', lat: input.lat, lng: input.lng,
    deleted: input.deleted ?? false, guid: input.guid ?? null, poiId: input.poiId ?? null,
    metadata: copy(input.metadata ?? {}),
  };
  return validatePoi(poi);
}