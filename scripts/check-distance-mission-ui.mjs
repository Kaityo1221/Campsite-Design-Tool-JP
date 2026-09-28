import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('js/bridge-distance-mission-ui.js', 'utf8');
const gate = fs.readFileSync('js/bridge-distance-mission-gate.js', 'utf8');
const layout = fs.readFileSync('js/bridge-distance-mission-layout-v3.js', 'utf8');
const state = fs.readFileSync('js/bridge-distance-mission-state-v1.js', 'utf8');
const actions = fs.readFileSync('js/bridge-distance-mission-actions-v1.js', 'utf8');
const duplicate = fs.readFileSync('js/bridge-distance-duplicate-ui-v1.js', 'utf8');
const cleanup = fs.readFileSync('js/bridge-distance-legacy-cleanup-v1.js', 'utf8');
const layoutCss = fs.readFileSync('css/bridge-distance-mission-layout-v2.css', 'utf8');
const engine = fs.readFileSync('js/distance-advice-engine.js', 'utf8');
const bridge = fs.readFileSync('bridge-distance.html', 'utf8');

for (const [source, file] of [
  [ui, 'js/bridge-distance-mission-ui.js'],
  [gate, 'js/bridge-distance-mission-gate.js'],
  [layout, 'js/bridge-distance-mission-layout-v3.js'],
  [state, 'js/bridge-distance-mission-state-v1.js'],
  [actions, 'js/bridge-distance-mission-actions-v1.js'],
  [duplicate, 'js/bridge-distance-duplicate-ui-v1.js'],
  [cleanup, 'js/bridge-distance-legacy-cleanup-v1.js'],
  [engine, 'js/distance-advice-engine.js']
]) {
  new vm.Script(source, { filename: file });
}

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
assert.ok(ui.includes('added.every((point) => Boolean(point.comment))'), 'MISSION 1 must require comments on every new POI in a pair');

assert.ok(layout.includes('新規 × 新規') && layout.includes('新規 × 既存'), 'MISSION 1 detail must identify new-existing/new-new pairs');
assert.ok(layout.includes("MK='campsiteDistanceMission4Viewed.v1'"), 'MISSION 4 viewed state must be tied to the current distance result');
assert.ok(layout.includes('mark(latest)'), 'MISSION 4 map click must record the viewed state');
assert.ok(layout.includes("data.v2Hidden='true'"), 'Legacy OPERATION TIPS must stay hidden in the final mission layout');

assert.ok(state.includes("const mission1 = stale ? 'yellow'"), 'MISSION 1 stale state must be yellow, not a distance-quality verdict');
assert.ok(state.includes("const mission2 = stale ? 'yellow' : 'green'"), 'MISSION 2 stale state must request re-check');
assert.ok(state.includes("environment.complete ? 'green' : (environment.entered > 0 ? 'yellow' : 'gray')"), 'MISSION 3 must distinguish unstarted, partial, and complete field confirmation');
assert.ok(state.includes("const mission4 = stale ? 'gray' : (mapDone ? 'green' : 'gray')"), 'MISSION 4 must remain unstarted until the current map is viewed and must be gray when stale');
assert.ok(state.includes("if (stale || pairs.duplicates > 0) mission5 = 'red'"), 'MISSION 5 alone must use red for stale/duplicate blocking');
assert.ok(state.includes("green: '完了', yellow: '要確認', red: '修正が必要', gray: '未着手'"), 'Mission lamp meanings must remain progress states');

assert.ok(actions.includes('data-v2-save'), 'MISSION 5 must expose the save action');
assert.ok(actions.includes('data-v2-rework'), 'MISSION 5 must expose the Creative Mode rework action');
assert.ok(actions.includes('data-v2-submit'), 'MISSION 5 must expose the pre-submit action');
assert.ok(actions.includes('window.CampsiteMissionState?.getState'), 'MISSION 5 submit availability must use the shared mission-state engine');
assert.ok(actions.includes('window.CampsiteDistanceBackup?.save'), 'MISSION 5 save action must reuse the existing backup handler');
assert.ok(actions.includes("document.querySelector('[data-project-rework]')"), 'MISSION 5 rework action must reuse the existing Creative Mode handler');
assert.ok(actions.includes("document.querySelector('[data-go-pre-submit]')"), 'MISSION 5 submit action must reuse the existing pre-submit handler');

assert.ok(duplicate.includes('root.firstElementChild !== alert'), 'Duplicate interrupt must stay above the mission flow');
assert.ok(duplicate.includes('if (count <= 0) return'), 'Zero duplicate count must stay absent from normal MISSION 5 UI');
assert.ok(duplicate.includes('重複POIが${count}組'), 'MISSION 5 must show duplicate count only when blocking');
assert.ok(cleanup.includes("const REMOVE_TITLES = ['拠点充実度', '判定結果']"), 'Bridge mission mode must remove old score/verdict panels after render');
assert.ok(cleanup.includes("child.classList.contains('distance-result-map')"), 'Legacy cleanup must preserve the lazy map DOM');

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
assert.ok(gate.includes("setLampState(shell, 3, 'gray')"), 'Stale map mission must return to unstarted gray');
assert.ok(gate.includes("setLampState(shell, 4, 'red')"), 'Stale final mission must be blocking red');
assert.ok(gate.includes('new MutationObserver(queuePresentationSync)'), 'Stale presentation must follow mission UI rerenders');

const commentsPos = bridge.indexOf('js/bridge-distance-ca-comments.js?v=2');
const enginePos = bridge.indexOf('js/distance-advice-engine.js?v=1');
const missionPos = bridge.indexOf('js/bridge-distance-mission-ui.js?v=1');
const missionGatePos = bridge.indexOf('js/bridge-distance-mission-gate.js?v=1');
const missionLayoutPos = bridge.indexOf('js/bridge-distance-mission-layout-v3.js?v=1');
const missionStatePos = bridge.indexOf('js/bridge-distance-mission-state-v1.js?v=1');
const missionActionsPos = bridge.indexOf('js/bridge-distance-mission-actions-v1.js?v=1');
const duplicatePos = bridge.indexOf('js/bridge-distance-duplicate-ui-v1.js?v=1');
const cleanupPos = bridge.indexOf('js/bridge-distance-legacy-cleanup-v1.js?v=1');
assert.ok(commentsPos >= 0, 'CA comment decorator must stay loaded');
assert.ok(enginePos > commentsPos, 'Advice engine must load after existing CA comment compatibility scripts');
assert.ok(missionPos > enginePos, 'Mission UI must load after the advice engine');
assert.ok(missionGatePos > missionPos, 'Mission completion gate must load after the mission UI');
assert.ok(missionLayoutPos > missionGatePos, 'Final five-mission display layer must load after the mission gate');
assert.ok(missionStatePos > missionLayoutPos, 'Shared mission-state engine must load after layout normalization');
assert.ok(missionActionsPos > missionStatePos, 'MISSION 5 actions must load after shared mission state');
assert.ok(duplicatePos > missionActionsPos, 'Duplicate finalizer must load after MISSION 5 actions');
assert.ok(cleanupPos > duplicatePos, 'Legacy score cleanup must run after mission/duplicate presentation layers');

console.log('Distance mission UI regression checks: OK');
