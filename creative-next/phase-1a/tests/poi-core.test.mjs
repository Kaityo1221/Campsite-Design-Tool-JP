import test from 'node:test';
import assert from 'node:assert/strict';
import { createPoiStore } from '../core/poi-store.mjs';
import { normalizePois } from '../core/poi-id.mjs';
import { assessLimits } from '../core/poi-limits.mjs';
import { convertLegacy } from '../adapters/legacy-records.mjs';
import { poi, existing, candidates, legacyCollision } from './fixtures/poi-cases.mjs';

function factory() { let n = 0; return () => `generated-${++n}`; }
function store(records = []) { return createPoiStore(records, { idFactory: factory() }); }
function commit(s, command) { return s.execute(command, { confirmed: true }); }
function addition(kind = 'power') { const { id, ...input } = poi('draft', { kind }); return { type: 'add', poi: input }; }

test('missing/colliding IDs are mapped per occurrence; same GUID is preserved', () => {
  const input = structuredClone(legacyCollision), before = structuredClone(input);
  const result = convertLegacy(input, { idFactory: factory() });
  assert.equal(result.ok, true);
  assert.deepEqual(input, before);
  assert.equal(result.records.length, 3);
  assert.equal(new Set(result.records.map(p => p.id)).size, 3);
  assert.deepEqual(result.mapping.map(m => m.reason), ['preserved', 'collision', 'missing-or-invalid']);
  assert.equal(result.mapping[0].oldId, result.mapping[1].oldId);
  assert.notEqual(result.mapping[0].id, result.mapping[1].id);
  assert.equal(result.records[0].guid, result.records[1].guid);
  assert.equal(result.records[2].poiId, 'external-3');
  assert.equal(result.records[1].role, 'new'); // source:true is not existing.
  assert.deepEqual(result.records[2].metadata.legacyRecord.customField, { keep: true });
  assert.deepEqual(result.preservedEnvelope.polygons, before.polygons);
});

test('ID allocator reserves IDs occurring later in the input', () => {
  let n = 0;
  const result = normalizePois([poi(1, { id: null }), poi(2, { id: 'generated-1' })], { idFactory: () => `generated-${++n}` });
  assert.equal(result.ok, true);
  assert.deepEqual(result.records.map(p => p.id), ['generated-2', 'generated-1']);
});

test('unknown, contradictory, malformed or guessed legacy data is withheld wholesale', () => {
  const cases = [
    { title: '新規Gymという名前', latlng: [35, 139], source: true },
    { layer: 'new-gym', role: 'existing', title: '矛盾', latlng: [35, 139] },
    { layer: 'existing-power', gameEntity: 'GYM', title: '矛盾', latlng: [35, 139] },
    { layer: 'new-gym', title: '座標不正', latlng: ['35', 139] },
    { layer: 'new-gym', title: '座標矛盾', latlng: [35, 139], lat: 36 },
    { layer: 'new-gym', title: '名前矛盾', name: '別名', latlng: [35, 139] },
  ];
  for (const invalid of cases) {
    const result = convertLegacy({ records: [legacyCollision.records[0], invalid] }, { idFactory: factory() });
    assert.equal(result.ok, false);
    assert.deepEqual(result.records, []);
    assert.deepEqual(result.mapping, []);
  }
});

test('currentPois is authoritative even when empty; selectedPois is not a fallback', () => {
  const result = convertLegacy({ currentPois: [], selectedPois: [{ invalid: true }], undoStack: [{ old: true }] });
  assert.equal(result.ok, true);
  assert.deepEqual(result.records, []);
  const invalid = convertLegacy({ currentPois: null, records: legacyCollision.records });
  assert.equal(invalid.ok, false);
});

test('coordinates keep original precision; existing coordinate updates are rejected on both command paths', () => {
  const s = store([poi(1, { role: 'existing' })]), baseline = s.snapshot();
  for (const command of [
    { type: 'move', id: 'fixture-1', lat: 36, lng: 140 },
    { type: 'edit', id: 'fixture-1', patch: { lat: 36, title: '同時変更' } },
  ]) {
    assert.equal(commit(s, command).error.code, 'EXISTING_COORDINATES_LOCKED');
    assert.deepEqual(s.snapshot(), baseline);
  }
  assert.equal(baseline.records[0].lat, 35.123456789123);
});

test('existing title, memo, kind and deletion remain editable without using candidate capacity', () => {
  const s = store([...existing(1), ...candidates()]);
  assert.equal(commit(s, { type: 'edit', id: 'fixture-0', patch: { title: '変更', memo: 'メモ\n<&>', kind: 'gym' } }).ok, true);
  assert.equal(s.snapshot().counts.new.count, 25);
  assert.equal(commit(s, { type: 'delete', id: 'fixture-0' }).ok, true);
  s.undo(); s.undo(); s.redo();
  const p = s.snapshot().records[0];
  assert.equal(p.kind, 'gym');
  assert.equal(p.lat, 35.123456789123);
  assert.equal(p.id, 'fixture-0');
});

test('identity and role cannot be edited; all failed commands preserve state and history', () => {
  const s = store([poi(1)]), baseline = s.snapshot();
  for (const patch of [{ id: 'changed' }, { role: 'existing' }, { guid: 'changed' }, { title: '' }, { lat: NaN }, { lng: 181 }]) {
    assert.equal(commit(s, { type: 'edit', id: 'fixture-1', patch }).ok, false);
    assert.deepEqual(s.snapshot(), baseline);
  }
});

for (const [count, level, accepted] of [[499, 'normal', true], [500, 'warning', true], [700, 'warning', true], [701, 'blocked', false]]) {
  test(`existing ${count}: ${level}, replacement accepted=${accepted}`, () => {
    assert.equal(assessLimits(existing(count)).existing.level, level);
    const s = store([poi('prior')]), baseline = s.snapshot();
    const result = s.replace(existing(count));
    assert.equal(result.ok, accepted);
    if (accepted) assert.equal(s.snapshot().counts.existing.count, count);
    else assert.deepEqual(s.snapshot(), baseline);
  });
}

test('replacement rejects overlapping existing coordinates at full precision without changing state', () => {
  const s = store([poi(1, { role: 'existing' }), poi(2)]);
  commit(s, { type: 'edit', id: 'fixture-2', patch: { memo: '履歴あり' } });
  s.undo(); // Keep an existing Redo entry to ensure replacement is fully atomic.
  const baseline = s.snapshot(), importReport = s.importReport();
  for (const patch of [{ lat: 35.123456789124 }, { lng: 139.123456789124 }]) {
    const incoming = [poi(1, { role: 'existing', ...patch }), poi(3)];
    const sourceCopy = structuredClone(incoming);
    const result = s.replace(incoming);
    assert.equal(result.ok, false);
    assert.equal(result.changed, false);
    assert.deepEqual(result.records, []);
    assert.deepEqual(result.mapping, []);
    assert.equal(result.errors[0].id, 'fixture-1');
    assert.equal(result.errors[0].code, 'EXISTING_COORDINATES_LOCKED');
    assert.deepEqual(incoming, sourceCopy);
    assert.deepEqual(s.snapshot(), baseline);
    assert.deepEqual(s.importReport(), importReport);
  }
  assert.equal(s.redo().changed, true);
});

test('replacement rejects an overlapping internal ID when role changes in either direction', () => {
  for (const [beforeRole, afterRole] of [['existing', 'new'], ['new', 'existing']]) {
    const s = store([poi(1, { role: beforeRole })]);
    const baseline = s.snapshot(), report = s.importReport();
    const result = s.replace([poi(1, { role: afterRole })]);
    assert.equal(result.ok, false);
    assert.equal(result.errors[0].code, 'IMMUTABLE_IDENTITY');
    assert.deepEqual(s.snapshot(), baseline);
    assert.deepEqual(s.importReport(), report);
  }
});

test('one conflicting POI rejects the whole replacement without partially applying other records', () => {
  const s = store([poi(1, { role: 'existing' }), poi(2)]);
  const baseline = s.snapshot();
  const result = s.replace([poi(3), poi(1, { role: 'existing', lng: 0 }), poi(4)]);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].index, 1);
  assert.deepEqual(s.snapshot(), baseline);
});

test('full replacement accepts disjoint IDs and matching identity, then clears history', () => {
  const s = store([poi(1, { role: 'existing' }), poi(2)]);
  commit(s, { type: 'edit', id: 'fixture-2', patch: { title: '編集中' } });
  s.undo();
  const result = s.replace([
    poi(1, { role: 'existing', title: '名称変更', kind: 'gym' }),
    poi(2, { role: 'new', lat: 35.987654321987, lng: 139.987654321987 }),
    poi(3),
  ]);
  assert.equal(result.ok, true);
  assert.equal(s.snapshot().records[0].title, '名称変更');
  assert.equal(s.snapshot().records[0].lat, 35.123456789123);
  assert.equal(s.snapshot().records[1].lat, 35.987654321987);
  assert.deepEqual(s.snapshot().history, { undo: 0, redo: 0 });
  assert.equal(s.replace([poi('unrelated', { role: 'existing' })]).ok, true);
  assert.deepEqual(s.snapshot().records.map(p => p.id), ['fixture-unrelated']);
});

test('colliding imported legacy IDs remain separate when remapped, with prior identity protected', () => {
  const s = store([poi(1, { role: 'existing' })]);
  const candidate = poi(1, { role: 'existing' });
  const different = poi(1, { role: 'new', title: '同一旧IDを持つ別個体' });
  const result = s.replace([candidate, different]);
  assert.equal(result.ok, true);
  assert.equal(s.snapshot().records.length, 2);
  assert.equal(new Set(s.snapshot().records.map(p => p.id)).size, 2);
  assert.equal(result.mapping[1].reason, 'collision');
  assert.equal(s.snapshot().records[0].id, 'fixture-1');
  assert.equal(s.snapshot().records[0].lat, 35.123456789123);
});

test('700 existing plus 25 new is supported; 700 plus 26 new is retained with warning', () => {
  const s = store([...existing(700), ...candidates()]);
  assert.equal(s.snapshot().records.length, 725);
  assert.equal(s.replace([...existing(700), ...candidates(13, 8, 5)]).ok, true);
  assert.equal(s.snapshot().records.length, 726);
  assert.equal(s.snapshot().counts.newOverLimit, true);
});

test('24 -> 25 is allowed when the target kind has room; 25 -> 26 addition is rejected', () => {
  const s = store(candidates(12, 8, 4));
  assert.equal(commit(s, addition()).ok, true);
  assert.equal(s.snapshot().counts.new.count, 25);
  const baseline = s.snapshot();
  assert.equal(commit(s, addition()).error.code, 'ADD_LIMIT');
  assert.deepEqual(s.snapshot(), baseline);
});

for (const [kind, limit] of [['pokestop', 12], ['gym', 8], ['power', 5]]) {
  test(`${kind} ${limit - 1}/${limit}/${limit + 1} boundary`, () => {
    const make = n => Array.from({ length: n }, (_, i) => poi(i, { kind }));
    const s = store(make(limit - 1));
    assert.equal(commit(s, addition(kind)).ok, true);
    const full = s.snapshot();
    assert.equal(commit(s, addition(kind)).ok, false);
    assert.deepEqual(s.snapshot(), full);
    assert.equal(s.replace(make(limit + 1)).ok, true);
    assert.equal(s.snapshot().counts.new.types[kind].excess, 1);
  });
}

test('over-limit candidates can be edited, deleted and restored by Undo without capacity rejection', () => {
  const s = store(candidates(13, 8, 5));
  assert.equal(commit(s, { type: 'edit', id: 'fixture-pokestop-0', patch: { title: '超過でも編集' } }).ok, true);
  assert.equal(commit(s, { type: 'delete', id: 'fixture-pokestop-0' }).ok, true);
  assert.equal(s.snapshot().counts.new.count, 25);
  assert.equal(s.undo().ok, true);
  assert.equal(s.snapshot().counts.new.count, 26);
  assert.equal(s.redo().ok, true);
  assert.equal(s.snapshot().counts.new.count, 25);
});

test('type change at total 25 is allowed into a free type but not into a full type', () => {
  const s = store(candidates(13, 8, 4));
  assert.equal(commit(s, { type: 'change-kind', id: 'fixture-pokestop-0', kind: 'power' }).ok, true);
  assert.equal(s.snapshot().counts.new.count, 25);
  assert.equal(s.snapshot().counts.new.types.pokestop.count, 12);
  assert.equal(commit(s, { type: 'change-kind', id: 'fixture-pokestop-1', kind: 'gym' }).error.code, 'TYPE_LIMIT');
  s.undo();
  assert.equal(s.snapshot().counts.new.types.pokestop.count, 13);
  s.redo();
  assert.equal(s.snapshot().counts.new.types.power.count, 5);
});

test('deleted candidates do not occupy capacity; snapshots cannot mutate internal state', () => {
  const s = store(candidates(12, 8, 6).map((p, i) => i === 25 ? { ...p, deleted: true } : p));
  assert.equal(s.snapshot().counts.new.count, 25);
  const exposed = s.snapshot();
  exposed.records[0].role = 'existing';
  exposed.records[0].lat = 0;
  exposed.records[0].metadata.injected = true;
  exposed.counts.new.count = 0;
  assert.equal(s.snapshot().records[0].role, 'new');
  assert.equal(s.snapshot().records[0].lat, 35.123456789123);
  assert.deepEqual(s.snapshot().records[0].metadata, {});
  assert.equal(s.snapshot().counts.new.count, 25);
});

test('addition cancellation, no-op and failed operation do not affect either history stack', () => {
  const s = store([poi(1)]);
  commit(s, { type: 'edit', id: 'fixture-1', patch: { memo: '確定' } });
  s.undo();
  const baseline = s.snapshot();
  assert.equal(s.execute(addition()).cancelled, true);
  assert.equal(s.execute(addition(), { confirmed: false }).cancelled, true);
  assert.equal(commit(s, { type: 'edit', id: 'fixture-1', patch: { title: '地点1' } }).changed, false);
  assert.equal(commit(s, { type: 'delete', id: 'missing' }).ok, false);
  assert.deepEqual(s.snapshot(), baseline);
  assert.equal(s.redo().changed, true);
});

test('add -> edit -> move -> type -> delete -> full Undo/Redo keeps ID and exact values', () => {
  const s = store();
  const id = commit(s, addition()).id;
  commit(s, { type: 'edit', id, patch: { title: '日本語<&>', memo: 'メモ\n2行' } });
  commit(s, { type: 'move', id, lat: 35.000000000001, lng: 139.000000000001 });
  commit(s, { type: 'change-kind', id, kind: 'gym' });
  commit(s, { type: 'delete', id });
  const final = s.snapshot().records;
  for (let i = 0; i < 5; i++) assert.equal(s.undo().changed, true);
  assert.deepEqual(s.snapshot().records, []);
  for (let i = 0; i < 5; i++) assert.equal(s.redo().changed, true);
  assert.deepEqual(s.snapshot().records, final);
  assert.equal(final[0].id, id);
});

test('new confirmed operation drops Redo; previously issued IDs are not reused', () => {
  const s = store();
  const first = commit(s, addition()).id;
  s.undo();
  const second = commit(s, addition()).id;
  assert.notEqual(first, second);
  assert.equal(s.snapshot().history.redo, 0);
  assert.equal(s.redo().changed, false);
});

test('accepted replacement and explicit history reset clear history, rejected replacement does not', () => {
  const s = store([poi(1)]);
  commit(s, { type: 'edit', id: 'fixture-1', patch: { memo: '変更' } });
  s.undo();
  const baseline = s.snapshot();
  assert.equal(s.replace([poi(2, { role: 'guess' })]).ok, false);
  assert.deepEqual(s.snapshot(), baseline);
  assert.equal(s.replace([poi(3)]).ok, true);
  assert.deepEqual(s.snapshot().history, { undo: 0, redo: 0 });
  commit(s, { type: 'delete', id: 'fixture-3' });
  const records = s.snapshot().records;
  s.resetHistory();
  assert.deepEqual(s.snapshot().history, { undo: 0, redo: 0 });
  assert.deepEqual(s.snapshot().records, records);
});

test('metadata, source and import reports are independent copies', () => {
  const source = [poi(1, { metadata: { nested: { keep: true } } })];
  const s = store(source);
  source[0].metadata.nested.keep = false;
  const report = s.importReport();
  report.mapping[0].id = 'tampered';
  assert.equal(s.snapshot().records[0].metadata.nested.keep, true);
  assert.equal(s.importReport().mapping[0].id, 'fixture-1');
});

test('bounded ID-generator failure and invalid metadata leave replacement untouched', () => {
  const s = createPoiStore([poi(1)], { idFactory: () => '' }), before = s.snapshot();
  assert.equal(s.replace([poi(2, { id: null })]).ok, false);
  assert.deepEqual(s.snapshot(), before);
  const cycle = {}; cycle.self = cycle;
  assert.equal(s.replace([poi(3, { metadata: cycle })]).ok, false);
  assert.deepEqual(s.snapshot(), before);
});

test('a sequence of confirmed edits returns through all recorded states in Undo/Redo', () => {
  const s = store([poi('existing', { role: 'existing' }), ...candidates(4, 3, 2)]);
  const states = [s.snapshot().records];
  let random = 20261008;
  const next = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random; };
  for (let i = 0; i < 80; i++) {
    const rows = s.snapshot().records.filter(p => !p.deleted);
    const target = rows[next() % rows.length];
    const command = i % 4 === 0 ? addition(['pokestop', 'gym', 'power'][next() % 3]) :
      i % 4 === 1 ? { type: 'edit', id: target.id, patch: { title: `順序試験${i}`, memo: `メモ${i}` } } :
      i % 4 === 2 ? { type: 'move', id: target.id, lat: 35 + i / 1000000000, lng: 139 + i / 1000000000 } :
      { type: 'change-kind', id: target.id, kind: ['pokestop', 'gym', 'power'][next() % 3] };
    const before = s.snapshot();
    const result = commit(s, command);
    if (result.ok && result.changed) states.push(s.snapshot().records);
    else assert.deepEqual(s.snapshot(), before);
  }
  assert.ok(states.length > 20);
  for (let i = states.length - 2; i >= 0; i--) {
    assert.equal(s.undo().ok, true);
    assert.deepEqual(s.snapshot().records, states[i]);
  }
  for (let i = 1; i < states.length; i++) {
    assert.equal(s.redo().ok, true);
    assert.deepEqual(s.snapshot().records, states[i]);
  }
});
