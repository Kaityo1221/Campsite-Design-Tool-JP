export function poi(index, overrides = {}) {
  return { id: `fixture-${index}`, role: 'new', kind: 'pokestop', title: `地点${index}`,
    memo: '', lat: 35.123456789123, lng: 139.987654321987, deleted: false,
    guid: null, poiId: null, metadata: {}, ...overrides };
}
export function existing(count) {
  return Array.from({ length: count }, (_, i) => poi(i, { role: 'existing', guid: `guid-${i}` }));
}
export function candidates(stops = 12, gyms = 8, powers = 5) {
  const records = [];
  for (const [kind, count] of [['pokestop', stops], ['gym', gyms], ['power', powers]]) {
    for (let i = 0; i < count; i++) records.push(poi(`${kind}-${i}`, { kind }));
  }
  return records;
}
export const legacyCollision = {
  records: [
    { id: 'same', layer: 'existing-pokestop', title: '同じGUID A', latlng: [35.123456789123, 139.987654321987], guid: 'same-guid', memo: '日本語\n記号<&>', source: true },
    { id: 'same', layer: 'new-gym', title: '同じGUID B', latlng: [35.123456789123, 139.987654321987], guid: 'same-guid', memo: '別のPOI', source: true },
    { layer: 'new-power', title: 'IDなし', latlng: [35.2, 139.3], poiId: 'external-3', deleted: false, customField: { keep: true } },
  ],
  polygons: [{ points: [[35, 139], [35.1, 139], [35, 139.1]] }],
  center: [35, 139], zoom: 17, unknown: { keep: '原本' },
};
