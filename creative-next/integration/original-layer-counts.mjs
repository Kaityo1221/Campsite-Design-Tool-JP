// Shared, read-only projection for the ORIGINAL Creative Mode layer labels.
// No storage, UI, map, or editing side effects.
export const ORIGINAL_LAYER_GROUPS = Object.freeze([
  ['existing-pokestop', '既存 PokéStop'],
  ['existing-gym', '既存 Gym'],
  ['existing-power', '既存 PowerSpot'],
  ['new-pokestop', '新規 PokéStop'],
  ['new-gym', '新規 Gym'],
  ['new-power', '新規 PowerSpot']
].map(pair => Object.freeze(pair)));

export function countOriginalLayerRecords(records) {
  const counts = new Map(ORIGINAL_LAYER_GROUPS.map(([key]) => [key, 0]));
  for (const record of Array.isArray(records) ? records : []) {
    if (!record || record.deleted === true) continue;
    const key = record.role + '-' + record.kind;
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }
  return counts;
}
