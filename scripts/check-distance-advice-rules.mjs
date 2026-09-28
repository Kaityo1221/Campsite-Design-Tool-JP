import fs from 'node:fs';
import assert from 'node:assert/strict';

const base = 'data/distance-advice';
const ruleset = JSON.parse(fs.readFileSync(`${base}/ruleset-v0.1.json`, 'utf8'));
const level2 = JSON.parse(fs.readFileSync(`${base}/rules-level2-v0.1.json`, 'utf8'));
const level3 = JSON.parse(fs.readFileSync(`${base}/rules-level3-v0.1.json`, 'utf8'));
const level4 = JSON.parse(fs.readFileSync(`${base}/rules-level4-v0.1.json`, 'utf8'));
const singles = JSON.parse(fs.readFileSync(`${base}/single-comments-v0.1.json`, 'utf8'));

const compoundRules = [
  ...level2.rules.map((rule) => ({ ...rule, level: 2 })),
  ...level3.rules.map((rule) => ({ ...rule, level: 3 })),
  ...level4.rules.map((rule) => ({ ...rule, level: 4 })),
];

assert.equal(level2.rules.length, 20, 'LEVEL 2 rule count must stay 20');
assert.equal(level3.rules.length, 28, 'LEVEL 3 rule count must stay 28');
assert.equal(level4.rules.length, 15, 'LEVEL 4 rule count must stay 15');
assert.equal(compoundRules.length, 63, 'Compound rule count must stay 63');
assert.equal(ruleset.rule_count, 63, 'Ruleset metadata must report 63 compound rules');
assert.equal(singles.comment_count, 54, 'Single-comment metadata must report 54 comments');
assert.equal(singles.comments.length, 54, 'Single-comment library must contain 54 comments');

const categories = new Set(ruleset.selection_policy.categories);
const ids = new Set();
for (const rule of compoundRules) {
  assert.ok(/^L[23]-\d{2}$|^AI-\d{2}$/.test(rule.id), `Unexpected rule id: ${rule.id}`);
  assert.ok(!ids.has(rule.id), `Duplicate rule id: ${rule.id}`);
  ids.add(rule.id);
  assert.ok(categories.has(rule.category), `Unknown category on ${rule.id}`);
  assert.ok(Number.isFinite(rule.priority), `Priority missing on ${rule.id}`);
  assert.ok(rule.when && typeof rule.when === 'object', `Condition missing on ${rule.id}`);
  assert.ok(typeof rule.advice === 'string' && rule.advice.length > 0, `Advice missing on ${rule.id}`);
  assert.ok(Array.isArray(rule.facts_used) && rule.facts_used.length > 0, `facts_used missing on ${rule.id}`);
  assert.ok(Array.isArray(rule.behavior_tags), `behavior_tags missing on ${rule.id}`);
}
for (const comment of singles.comments) {
  assert.ok(!ids.has(comment.id), `Single comment id collides with compound rule: ${comment.id}`);
  assert.ok(categories.has(comment.category), `Unknown fallback category on ${comment.id}`);
  assert.ok(comment.when && typeof comment.when === 'object', `Fallback condition missing on ${comment.id}`);
  assert.ok(typeof comment.advice === 'string' && comment.advice.length > 0, `Fallback advice missing on ${comment.id}`);
}

const densityProfiles = [
  { density_tag: 'NO_CLOSE', existing_poi_count: 12, under50_count: 0, under20_count: 0, between20_30_count: 0, between30_50_count: 0, under20_ratio: 0, between20_30_ratio: 0, between30_50_ratio: 0, feature_tags: [] },
  { density_tag: 'FEW_CLOSE', existing_poi_count: 12, under50_count: 2, under20_count: 1, between20_30_count: 1, between30_50_count: 0, under20_ratio: 0.5, between20_30_ratio: 0.5, between30_50_ratio: 0, feature_tags: [] },
  { density_tag: 'VERY_CLOSE_HEAVY', existing_poi_count: 12, under50_count: 8, under20_count: 5, between20_30_count: 2, between30_50_count: 1, under20_ratio: 0.625, between20_30_ratio: 0.25, between30_50_ratio: 0.125, feature_tags: ['CLOSE_MANY'] },
  { density_tag: 'MID_CLOSE_HEAVY', existing_poi_count: 12, under50_count: 8, under20_count: 2, between20_30_count: 5, between30_50_count: 1, under20_ratio: 0.25, between20_30_ratio: 0.625, between30_50_ratio: 0.125, feature_tags: ['CLOSE_MANY'] },
  { density_tag: 'WIDE_CLOSE_HEAVY', existing_poi_count: 12, under50_count: 8, under20_count: 1, between20_30_count: 2, between30_50_count: 5, under20_ratio: 0.125, between20_30_ratio: 0.25, between30_50_ratio: 0.625, feature_tags: ['CLOSE_MANY'] },
  { density_tag: 'MIXED_CLOSE', existing_poi_count: 12, under50_count: 6, under20_count: 2, between20_30_count: 2, between30_50_count: 2, under20_ratio: 1 / 3, between20_30_ratio: 1 / 3, between30_50_ratio: 1 / 3, feature_tags: ['CLOSE_MANY'] },
];

const eventProfiles = [{ group_tag: null, cluster_tag: null, stop_tag: null }];
for (const group_tag of ['GROUP_SMALL', 'GROUP_MID', 'GROUP_LARGE']) {
  for (const cluster_tag of ['CLUSTER_COMPACT', 'CLUSTER_MID', 'CLUSTER_SPREAD']) {
    for (const stop_tag of ['STOP_LOW', 'STOP_MID', 'STOP_HIGH']) {
      eventProfiles.push({ group_tag, cluster_tag, stop_tag });
    }
  }
}
assert.equal(eventProfiles.length, 28, 'Event profile count must stay 28');

function matches(rule, context) {
  return Object.entries(rule.when).every(([key, expected]) => {
    if (key === 'feature_tags') return expected.every((tag) => context.feature_tags.includes(tag));
    return context[key] === expected;
  });
}

function hasConflict(candidate, selected) {
  const pairs = ruleset.selection_policy.conflict_behavior_pairs || [];
  const candidateTags = new Set(candidate.behavior_tags || []);
  for (const current of selected) {
    const currentTags = new Set(current.behavior_tags || []);
    for (const [a, b] of pairs) {
      if ((candidateTags.has(a) && currentTags.has(b)) || (candidateTags.has(b) && currentTags.has(a))) return true;
    }
  }
  return false;
}

function hasInternalConflict(selected) {
  const tags = new Set(selected.flatMap((rule) => rule.behavior_tags || []));
  return (ruleset.selection_policy.conflict_behavior_pairs || []).some(([a, b]) => tags.has(a) && tags.has(b));
}

function selectCompound(context) {
  const matched = compoundRules.filter((rule) => matches(rule, context));
  const ordered = [...matched].sort((a, b) => b.priority - a.priority || b.level - a.level || a.id.localeCompare(b.id));
  const selected = [];
  const usedCategories = new Set();
  for (const rule of ordered) {
    if (usedCategories.has(rule.category)) continue;
    if (hasConflict(rule, selected)) continue;
    selected.push(rule);
    usedCategories.add(rule.category);
    if (selected.length >= ruleset.selection_policy.max_output) break;
  }
  return { matched, selected };
}

function selectFallbacks(context, selected) {
  const usedCategories = new Set(selected.map((item) => item.category));
  const out = [];
  for (const comment of singles.comments) {
    if (selected.length + out.length >= ruleset.selection_policy.max_output) break;
    if (usedCategories.has(comment.category)) continue;
    if (!matches(comment, context)) continue;
    out.push(comment);
    usedCategories.add(comment.category);
  }
  return out;
}

const matchedCount = new Map(compoundRules.map((rule) => [rule.id, 0]));
const selectedCount = new Map(compoundRules.map((rule) => [rule.id, 0]));
let cases = 0;
let noCompound = 0;
let noAdvice = 0;
let maxMatched = 0;
let maxMatchedContext = null;

for (const density of densityProfiles) {
  for (const traffic of ['easy', 'narrow', 'careful']) {
    for (const plaza of [false, true]) {
      for (const circulation of [false, true]) {
        for (const waiting of [false, true]) {
          for (const event of eventProfiles) {
            cases += 1;
            const context = { ...density, traffic, plaza, circulation, waiting, ...event };
            const { matched, selected } = selectCompound(context);
            for (const rule of matched) matchedCount.set(rule.id, matchedCount.get(rule.id) + 1);
            for (const rule of selected) selectedCount.set(rule.id, selectedCount.get(rule.id) + 1);
            if (matched.length === 0) noCompound += 1;
            if (matched.length > maxMatched) {
              maxMatched = matched.length;
              maxMatchedContext = context;
            }
            assert.ok(selected.length <= 3, 'More than 3 compound rules selected');
            assert.equal(new Set(selected.map((rule) => rule.category)).size, selected.length, 'Duplicate selected category');
            assert.ok(!hasInternalConflict(selected), 'Conflicting behaviors survived selection');
            const fallbacks = selectFallbacks(context, selected);
            if (selected.length + fallbacks.length === 0) noAdvice += 1;
          }
        }
      }
    }
  }
}

assert.equal(cases, 4032, 'Full QA matrix must contain 4032 cases');
assert.equal(noAdvice, 0, 'Every fully confirmed context must yield at least one advice item');

const neverMatched = [...matchedCount].filter(([, count]) => count === 0).map(([id]) => id);
const neverSelected = [...selectedCount].filter(([, count]) => count === 0).map(([id]) => id);
assert.deepEqual(neverMatched, [], `Rules that can never fire: ${neverMatched.join(', ')}`);
assert.deepEqual(neverSelected, [], `Rules that can never survive selection: ${neverSelected.join(', ')}`);

function runCase(name, context, expectedIds = [], forbiddenIds = []) {
  const { selected } = selectCompound(context);
  const selectedIds = selected.map((rule) => rule.id);
  for (const id of expectedIds) assert.ok(selectedIds.includes(id), `${name}: expected ${id}, got ${selectedIds.join(', ')}`);
  for (const id of forbiddenIds) assert.ok(!selectedIds.includes(id), `${name}: forbids ${id}, got ${selectedIds.join(', ')}`);
  return selectedIds;
}

const baseVeryClose = densityProfiles.find((item) => item.density_tag === 'VERY_CLOSE_HEAVY');
const q01 = runCase('Q01 large compact many-stops', {
  ...baseVeryClose, traffic: 'narrow', plaza: false, circulation: true, waiting: false,
  group_tag: 'GROUP_LARGE', cluster_tag: 'CLUSTER_COMPACT', stop_tag: 'STOP_HIGH',
}, ['AI-15', 'AI-07', 'AI-06']);

const q10 = runCase('Q10 small group on same dense site', {
  ...baseVeryClose, traffic: 'narrow', plaza: false, circulation: true, waiting: false,
  group_tag: 'GROUP_SMALL', cluster_tag: 'CLUSTER_COMPACT', stop_tag: 'STOP_HIGH',
}, ['AI-13'], ['AI-01', 'AI-04', 'AI-06', 'AI-07', 'AI-08', 'AI-15']);

console.log(`Distance advice rules QA: OK (${cases} cases)`);
console.log(`compound rules=${compoundRules.length}, fallbacks=${singles.comments.length}, noCompound=${noCompound}, maxMatched=${maxMatched}`);
console.log(`Q01=${q01.join(', ')} / Q10=${q10.join(', ')}`);
if (maxMatchedContext) console.log(`maxMatchedContext=${JSON.stringify(maxMatchedContext)}`);
