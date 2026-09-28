import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('js/bridge-distance-mission-ui.js', 'utf8');
const gate = fs.readFileSync('js/bridge-distance-mission-gate.js', 'utf8');
const engine = fs.readFileSync('js/distance-advice-engine.js', 'utf8');
const bridge = fs.readFileSync('bridge-distance.html', 'utf8');

new vm.Script(ui, { filename: 'js/bridge-distance-mission-ui.js' });
new vm.Script(gate, { filename: 'js/bridge-distance-mission-gate.js' });
new vm.Script(engine, { filename: 'js/distance-advice-engine.js' });

for (const label of ['MISSION 1', 'MISSION 2', 'MISSION 3', 'MISSION 4', '準備完了！']) {
  assert.ok(ui.includes(label), `Mission UI copy missing: ${label}`);
}
for (const label of ['新しいPOIを確認しましょう', '自分の拠点を理解しましょう', '現地を確認しましょう', '最後に確認しましょう']) {
  assert.ok(ui.includes(label), `Mission instruction missing: ${label}`);
}
assert.ok(ui.includes('見てこないとだめだよ❗️'), 'Chairman field-check message missing');
assert.ok(ui.includes('現地へGO‼️'), 'Chairman GO message missing');
assert.ok(ui.includes('project.siteEnvironment = env'), 'Mission 3 answers must persist in the Campsite Project');
assert.ok(ui.includes('globalThis.CampsiteDistanceAdvice.evaluate'), 'Mission UI must use the rule engine for operation tips');
assert.ok(ui.includes('campsite-mission-legacy'), 'Legacy distance DOM must be retained for compatibility');
assert.ok(ui.includes('distance-result-map'), 'Existing map section must remain available on demand');
assert.ok(ui.includes("pair.distance < 20") && ui.includes("pair.distance < 30"), 'Mission 2 distance bands must retain 20/30/50m structure');
assert.ok(ui.includes("distance < 1"), 'Duplicate POI interrupt must remain based on factual near-identical coordinates');
assert.ok(!ui.includes('拠点充実度'), 'Mission UI must not reintroduce the old campsite score/rank label');
assert.ok(!ui.includes('判定結果：問題なし'), 'Mission UI must not present a pseudo overall verdict');

assert.ok(gate.includes('#distance .distance-site-observation-step{display:none!important}'), 'Legacy field observation controls must be hidden in mission mode');
assert.ok(gate.includes("'[data-go-pre-submit]'"), 'Mission gate must intercept pre-submit');
assert.ok(gate.includes('project?.siteEnvironment'), 'Mission gate must use persisted Mission 3 answers');
assert.ok(gate.includes("'#campsiteDistanceStaleWarning'"), 'Mission gate must focus stale-design warning');
assert.ok(gate.includes("'.campsite-duplicate-alert'"), 'Mission gate must focus duplicate alert');
assert.ok(gate.includes("'.campsite-chairman-sign'"), 'Mission gate must focus chairman sign when field confirmation is incomplete');
assert.ok(gate.includes('event.stopImmediatePropagation()'), 'Mission gate must stop downstream pre-submit handlers while blocked');
assert.ok(gate.includes('state.environmentComplete'), 'Mission gate must block incomplete field confirmation');
assert.ok(gate.includes('state.duplicateCount > 0'), 'Mission gate must block duplicate POIs');
assert.ok(gate.includes('state.stale'), 'Mission gate must block stale distance results');

const commentsPos = bridge.indexOf('js/bridge-distance-ca-comments.js?v=2');
const enginePos = bridge.indexOf('js/distance-advice-engine.js?v=1');
const missionPos = bridge.indexOf('js/bridge-distance-mission-ui.js?v=1');
const missionGatePos = bridge.indexOf('js/bridge-distance-mission-gate.js?v=1');
assert.ok(commentsPos >= 0, 'CA comment decorator must stay loaded');
assert.ok(enginePos > commentsPos, 'Advice engine must load after existing CA comment compatibility scripts');
assert.ok(missionPos > enginePos, 'Mission UI must load after the advice engine');
assert.ok(missionGatePos > missionPos, 'Mission completion gate must load after the mission UI');

console.log('Distance mission UI regression checks: OK');
