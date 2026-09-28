import fs from 'node:fs';
import assert from 'node:assert/strict';
import '../js/distance-advice-engine.js';

const base = 'data/distance-advice';
const data = globalThis.CampsiteDistanceAdvice.normalizeData({
  ruleset: JSON.parse(fs.readFileSync(`${base}/ruleset-v0.1.json`, 'utf8')),
  level2: JSON.parse(fs.readFileSync(`${base}/rules-level2-v0.1.json`, 'utf8')),
  level3: JSON.parse(fs.readFileSync(`${base}/rules-level3-v0.1.json`, 'utf8')),
  level4: JSON.parse(fs.readFileSync(`${base}/rules-level4-v0.1.json`, 'utf8')),
  singles: JSON.parse(fs.readFileSync(`${base}/single-comments-v0.1.json`, 'utf8')),
});

const incomplete = globalThis.CampsiteDistanceAdvice.evaluateWithData({
  existing_poi_count: 18,
  under50_count: 8,
  under20_count: 5,
  between20_30_count: 2,
  between30_50_count: 1,
}, data);
assert.equal(incomplete.status, 'site_confirmation_required');
assert.equal(incomplete.advice.length, 0);
assert.ok(incomplete.chairman_message.includes('見てこないとだめだよ❗️'));
assert.ok(incomplete.chairman_message.includes('現地へGO‼️'));

const q01 = globalThis.CampsiteDistanceAdvice.evaluateWithData({
  existing_poi_count: 12,
  under50_count: 8,
  under20_count: 5,
  between20_30_count: 2,
  between30_50_count: 1,
  traffic: 'narrow',
  plaza: false,
  circulation: true,
  waiting: false,
  group_size: 40,
  cluster_length_m: 90,
  expected_stop_points: 8,
}, data, { seed: 'Q01' });
assert.equal(q01.status, 'ready');
assert.deepEqual(q01.compound_rule_ids, ['AI-15', 'AI-07', 'AI-06']);
assert.equal(q01.advice.length, 3);
assert.equal(q01.context.density_tag, 'VERY_CLOSE_HEAVY');
assert.equal(q01.context.group_tag, 'GROUP_LARGE');
assert.equal(q01.context.cluster_tag, 'CLUSTER_COMPACT');
assert.equal(q01.context.stop_tag, 'STOP_HIGH');

const q10 = globalThis.CampsiteDistanceAdvice.evaluateWithData({
  existing_poi_count: 12,
  under50_count: 8,
  under20_count: 5,
  between20_30_count: 2,
  between30_50_count: 1,
  traffic: 'narrow',
  plaza: false,
  circulation: true,
  waiting: false,
  group_size: 6,
  cluster_length_m: 90,
  expected_stop_points: 8,
}, data, { seed: 'Q10' });
assert.equal(q10.status, 'ready');
assert.equal(q10.compound_rule_ids[0], 'AI-13');
assert.ok(!q10.compound_rule_ids.some((id) => ['AI-01', 'AI-04', 'AI-06', 'AI-07', 'AI-08', 'AI-15'].includes(id)));

const fallbackInput = {
  existing_poi_count: 12,
  under50_count: 0,
  under20_count: 0,
  between20_30_count: 0,
  between30_50_count: 0,
  traffic: 'easy',
  plaza: false,
  circulation: false,
  waiting: true,
};
const fallbackA = globalThis.CampsiteDistanceAdvice.evaluateWithData(fallbackInput, data, { seed: 'same-project' });
const fallbackB = globalThis.CampsiteDistanceAdvice.evaluateWithData(fallbackInput, data, { seed: 'same-project' });
assert.deepEqual(fallbackA.fallback_ids, fallbackB.fallback_ids, 'Fallback selection must be deterministic for the same Project seed');
assert.ok(fallbackA.advice.length >= 1 && fallbackA.advice.length <= 3);

console.log('Distance advice engine: OK');
console.log(`Q01=${q01.compound_rule_ids.join(', ')} / Q10=${q10.compound_rule_ids.join(', ')}`);
console.log(`fallback=${fallbackA.fallback_ids.join(', ') || '(none)'}`);
