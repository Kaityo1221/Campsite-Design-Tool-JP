import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('js/bridge-distance-mission-ui.js', 'utf8');
const gate = fs.readFileSync('js/bridge-distance-mission-gate.js', 'utf8');
const layout = fs.readFileSync('js/bridge-distance-mission-layout-v2.js', 'utf8');
const layoutCss = fs.readFileSync('css/bridge-distance-mission-layout-v2.css', 'utf8');
const engine = fs.readFileSync('js/distance-advice-engine.js', 'utf8');
const bridge = fs.readFileSync('bridge-distance.html', 'utf8');

new vm.Script(ui, { filename: 'js/bridge-distance-mission-ui.js' });
new vm.Script(gate, { filename: 'js/bridge-distance-mission-gate.js' });
new vm.Script(layout, { filename: 'js/bridge-distance-mission-layout-v2.js' });
new vm.Script(engine, { filename: 'js/distance-advice-engine.js' });

for (const label of ['MISSION 1', 'MISSION 2', 'MISSION 3', 'MISSION 4', 'MISSION 5']) {
  assert.ok(ui.includes(label) || layout.includes(label), `Mission UI copy missing: ${label}`);
}
for (const label of [
  '新しいPOIを確認しましょう',
  '自分の拠点を理解しましょう',
  '現地の使い方を確認しましょう',
  '配置を地図で見てみましょう',
  '最後に確認して準備完了'
]) {
  assert.ok(ui.includes(label) || layout.includes(label), `Mission instruction missing: ${label}`);
}
for (const label of ['📏 新規POIの距離確認', '🏕️ 拠点の密集特性', '🌳 現地環境', '🗺️ 配置・マップ', '✅ 最終確認']) {
  assert.ok(ui.includes(label) || layout.includes(label), `Mission result panel title missing: ${label}`);
}

assert.ok(ui.includes('project.siteEnvironment = env'), 'Mission 3 answers must persist in the Campsite Project');
assert.ok(ui.includes('campsite-mission-legacy'), 'Legacy distance DOM must be retained for compatibility');
assert.ok(ui.includes('distance-result-map'), 'Existing map section must remain available on demand');
assert.ok(ui.includes("pair.distance < 20") && ui.includes("pair.distance < 30"), 'Mission 2 distance bands must retain 20/30/50m structure');
assert.ok(ui.includes("distance < 1"), 'Duplicate POI interrupt must remain based on factual near-identical coordinates');
assert.ok(!ui.includes('拠点充実度'), 'Mission UI must not reintroduce the old campsite score/rank label');
assert.ok(!ui.includes('判定結果：問題なし'), 'Mission UI must not present a pseudo overall verdict');

assert.ok(layout.includes("'新規 × 新規' : '新規 × 既存'"), 'MISSION 1 detail must identify new-existing/new-new pairs');
assert.ok(layout.includes("added.every(point => Boolean(point.comment))"), 'MISSION 1 must require comments on every new POI in the pair');
assert.ok(layout.includes("MAP_KEY = 'campsiteDistanceMission4Viewed.v1'"), 'MISSION 4 viewed state must be tied to the current distance result');
assert.ok(layout.includes("mapDone: mapViewed(project)"), 'MISSION 4 completion must come from the current map-view state');
assert.ok(layout.includes("state.mapDone ? 'green' : 'gray'"), 'MISSION 4 must remain unstarted until the map is viewed');
assert.ok(layout.includes("data-v2-save"), 'MISSION 5 must expose the save action');
assert.ok(layout.includes("data-v2-rework"), 'MISSION 5 must expose the Creative Mode rework action');
assert.ok(layout.includes("data-v2-submit"), 'MISSION 5 must expose the pre-submit action');
assert.ok(layout.includes("if (state.duplicateBlocked) rows.push"), 'Zero duplicate count must stay hidden from normal MISSION 5 UI');
assert.ok(layout.includes('⚠️ 近接ライン'), 'MISSION 4 must surface near-line count only when present');
assert.ok(layoutCss.includes('position:absolute!important') && layoutCss.includes('#campsiteDistanceCheckpoint'), 'Legacy action blocks must be visually replaced by MISSION 5 actions without deleting their handlers');

assert.ok(gate.includes('#distance .distance-site-observation-step{display:none!important}'), 'Legacy field observation controls must be hidden in mission mode');
assert.ok(gate.includes('#campsiteDistanceCommentWarning{display:none!important}'), 'Legacy optional-comment warning must stay hidden in mission mode');
assert.ok(gate.includes("'[data-go-pre-submit]'"), 'Mission gate must intercept pre-submit');
assert.ok(gate.includes('project?.siteEnvironment'), 'Mission gate must use persisted Mission 3 answers');
assert.ok(gate.includes("'#campsiteDistanceStaleWarning'"), 'Mission gate must focus stale-design warning');
assert.ok(gate.includes("'.campsite-duplicate-alert'"), 'Mission gate must focus duplicate alert');
assert.ok(gate.includes("'.campsite-chairman-sign'"), 'Mission gate must focus field confirmation when incomplete');
assert.ok(gate.includes('event.stopImmediatePropagation()'), 'Mission gate must stop downstream pre-submit handlers while blocked');
assert.ok(gate.includes('state.environmentComplete'), 'Mission gate must block incomplete field confirmation');
assert.ok(gate.includes('state.duplicateCount > 0'), 'Mission gate must block duplicate POIs');
assert.ok(gate.includes('state.stale'), 'Mission gate must block stale distance results');
assert.ok(gate.includes('campsite-stale-distance-card'), 'Stale distance-derived mission cards must be masked');
assert.ok(gate.includes("cardByKicker(shell, 'MISSION 1')"), 'MISSION 1 must be hidden while the distance result is stale');
assert.ok(gate.includes("cardByKicker(shell, 'MISSION 2')"), 'MISSION 2 must be hidden while the distance result is stale');
assert.ok(gate.includes("cardByKicker(shell, 'MISSION 4')"), 'MISSION 4 map must not expose a stale distance result');
assert.ok(gate.includes("setLampState(shell, 3, 'red')"), 'Stale map mission must be blocking');
assert.ok(gate.includes("setLampState(shell, 4, 'red')"), 'Stale final mission must be blocking');
assert.ok(gate.includes('new MutationObserver(queuePresentationSync)'), 'Stale presentation must follow mission UI rerenders');

const commentsPos = bridge.indexOf('js/bridge-distance-ca-comments.js?v=2');
const enginePos = bridge.indexOf('js/distance-advice-engine.js?v=1');
const missionPos = bridge.indexOf('js/bridge-distance-mission-ui.js?v=1');
const missionGatePos = bridge.indexOf('js/bridge-distance-mission-gate.js?v=1');
const missionLayoutPos = bridge.indexOf('js/bridge-distance-mission-layout-v2.js?v=1');
assert.ok(commentsPos >= 0, 'CA comment decorator must stay loaded');
assert.ok(enginePos > commentsPos, 'Advice engine must load after existing CA comment compatibility scripts');
assert.ok(missionPos > enginePos, 'Mission UI must load after the advice engine');
assert.ok(missionGatePos > missionPos, 'Mission completion gate must load after the mission UI');
assert.ok(missionLayoutPos > missionGatePos, 'Final five-mission display layer must load after the mission gate');

console.log('Distance mission UI regression checks: OK');
