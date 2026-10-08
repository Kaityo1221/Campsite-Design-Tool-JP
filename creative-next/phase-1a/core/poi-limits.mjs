import { KINDS } from './poi-model.mjs';

export const LIMITS = Object.freeze({ existing: 700, new: 25, pokestop: 12, gym: 8, power: 5 });

export function assessLimits(records) {
  const kinds = Object.fromEntries(KINDS.map(kind => [kind, 0]));
  // Conservative fixture-level guard: all existing records, including tombstones, count.
  // Real legacy-save and Wayfarer reserve counting is deliberately outside Phase 1-A.
  const existing = records.filter(p => p.role === 'existing').length;
  for (const poi of records) if (poi.role === 'new' && !poi.deleted) kinds[poi.kind] += 1;
  const fresh = Object.values(kinds).reduce((a, b) => a + b, 0);
  const types = Object.fromEntries(KINDS.map(kind => [kind, {
    count: kinds[kind], limit: LIMITS[kind], remaining: Math.max(0, LIMITS[kind] - kinds[kind]),
    excess: Math.max(0, kinds[kind] - LIMITS[kind]),
    canAdd: fresh < LIMITS.new && kinds[kind] < LIMITS[kind],
  }]));
  return {
    existing: { count: existing, limit: 700, level: existing > 700 ? 'blocked' : existing >= 500 ? 'warning' : 'normal' },
    new: { count: fresh, limit: 25, remaining: Math.max(0, 25 - fresh), excess: Math.max(0, fresh - 25), types },
    existingAllowed: existing <= 700,
    newOverLimit: fresh > 25 || KINDS.some(kind => kinds[kind] > LIMITS[kind]),
  };
}

export function additionReason(records, kind) {
  const counts = assessLimits(records);
  if (counts.new.count >= 25) return '新規合計25件に達しているため追加できません';
  if (!counts.new.types[kind]?.canAdd) return `対象種類の上限${LIMITS[kind]}件に達しているため追加できません`;
  return null;
}

export function kindChangeReason(records, current, kind) {
  if (current.role === 'existing' || current.kind === kind) return null;
  const count = records.filter(p => p.role === 'new' && !p.deleted && p.kind === kind && p.id !== current.id).length;
  return count >= LIMITS[kind] ? `対象種類の上限${LIMITS[kind]}件に達しているため変更できません` : null;
}