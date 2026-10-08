import { canonicalPoi, copy, fail, KINDS, validatePoi, assertData } from './poi-model.mjs';
import { allocateId } from './poi-id.mjs';
import { additionReason, kindChangeReason } from './poi-limits.mjs';

export function protectTransition(before, after) {
  if (!before || !after) return;
  if (before.id !== after.id || before.role !== after.role) fail('IMMUTABLE_IDENTITY', '内部IDと既存／新規区分は変更できません');
  if (before.role === 'existing' && (before.lat !== after.lat || before.lng !== after.lng)) {
    fail('EXISTING_COORDINATES_LOCKED', '既存POIの座標は変更できません');
  }
}

export function planCommand(records, command, { reserved, idFactory }) {
  assertData(command);
  if (command.type === 'add') {
    const input = copy(command.poi);
    if (!input || input.role !== 'new') fail('NEW_ONLY', '追加操作は新規POIのみです');
    if (Object.hasOwn(input, 'id')) fail('IMMUTABLE_IDENTITY', '追加時の内部IDは基盤が生成します');
    if (input.deleted === true) fail('INVALID_ADD', '削除済みとして追加できません');
    if (!KINDS.includes(input.kind)) fail('UNKNOWN_KIND', 'POI種類が不正です');
    const reason = additionReason(records, input.kind);
    if (reason) fail('ADD_LIMIT', reason);
    const after = canonicalPoi(input, allocateId(reserved, idFactory));
    return { id: after.id, before: null, after };
  }
  const before = records.find(p => p.id === command.id);
  if (!before) fail('NOT_FOUND', '対象POIがありません');
  if (before.deleted) fail('DELETED_POI', '削除済みPOIはUndoで復元してください');
  let patch;
  switch (command.type) {
    case 'delete': patch = { deleted: true }; break;
    case 'edit':
      patch = command.patch;
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) fail('INVALID_PATCH', '変更項目が必要です');
      for (const key of Object.keys(patch)) {
        if (['id', 'role'].includes(key)) fail('IMMUTABLE_IDENTITY', '内部IDと区分は変更できません');
        if (!['title', 'memo', 'kind', 'lat', 'lng'].includes(key)) fail('UNSUPPORTED_FIELD', `${key}は変更できません`);
      }
      break;
    case 'change-kind': patch = { kind: command.kind }; break;
    case 'move': patch = { lat: command.lat, lng: command.lng }; break;
    default: fail('UNKNOWN_COMMAND', '未対応の操作です');
  }
  const after = { ...copy(before), ...copy(patch) };
  protectTransition(before, after);
  validatePoi(after);
  if (after.kind !== before.kind) {
    const reason = kindChangeReason(records, before, after.kind);
    if (reason) fail('TYPE_LIMIT', reason);
  }
  return { id: before.id, before: copy(before), after };
}