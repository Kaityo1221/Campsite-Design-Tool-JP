import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const ui = fs.readFileSync('js/bridge-distance-mission-ui.js', 'utf8');
const gate = fs.readFileSync('js/bridge-distance-mission-gate.js', 'utf8');
const layout = fs.readFileSync('js/bridge-distance-mission-layout-v3.js', 'utf8');
const state = fs.readFileSync('js/bridge-distance-mission-state-v2.js', 'utf8');
const actions = fs.readFileSync('js/bridge-distance-mission-actions-v1.js', 'utf8');
const duplicate = fs.readFileSync('js/bridge-distance-duplicate-ui-v2.js', 'utf8');
const cleanup = fs.readFileSync('js/bridge-distance-legacy-cleanup-v1.js', 'utf8');
const layoutCss = fs.readFileSync('css/bridge-distance-mission-layout-v2.css', 'utf8');
const engine = fs.readFileSync('js/distance-advice-engine.js', 'utf8');
const bridge = fs.readFileSync('bridge-distance.html', 'utf8');

for (const [source, file] of [
  [ui, 'js/bridge-distance-mission-ui.js'],
  [gate, 'js/bridge-distance-mission-gate.js'],
  [layout, 'js/bridge-distance-mission-layout-v3.js'],
  [state, 'js/bridge-distance-mission-state-v2.js'],
  [actions, 'js/bridge-distance-mission-actions-v1.js'],
  [duplicate, 'js/bridge-distance-duplicate-ui-v2.js'],
  [cleanup, 'js/bridge-distance-legacy-cleanup-v1.js'],
  [engine, 'js/distance-advice-engine.js']
]) new vm.Script(source, { filename: file });

for (const label of ['MISSION 1', 'MISSION 2', 'MISSION 3', 'MISSION 4', 'MISSION 5']) {
  assert.ok(ui.includes(label) || layout.includes(label), `Mission UI copy missing: ${label}`);
}
for (const label of ['新しいPOIを確認しましょう','自分の拠点を理解しましょう','現地の使い方を確認しましょう','配置を地図で見てみましょう','最後に確認して準備完了']) {
  assert.ok(ui.includes(label) || layout.includes(label), `Mission instruction missing: ${label}`);
}
for (const label of ['📏 新規POIの距離確認','🏕️ 拠点の密集特性','🌳 現地環境','🗺️ 配置・マップ','✅ 最終確認']) {
  assert.ok(ui.includes(label) || layout.includes(label), `Mission result panel title missing: ${label}`);
}

assert.ok(ui.includes('project.siteEnvironment = env'), 'Mission 3 answers must persist in the Campsite Project');
assert.ok(ui.includes('campsite-mission-legacy'), 'Legacy distance DOM must be retained for compatibility');
assert.ok(ui.includes('distance-result-map'), 'Existing map section must remain available on demand');
assert.ok(ui.includes('pair.distance < 20') && ui.includes('pair.distance < 30'), 'Mission 2 bands must retain 20/30/50m structure');
assert.ok(ui.includes('distance < 1'), 'Duplicate POI interrupt must remain factual');
assert.ok(!ui.includes('拠点充実度'), 'Mission UI must not reintroduce old campsite scoring');
assert.ok(!ui.includes('判定結果：問題なし'), 'Mission UI must not present a pseudo overall verdict');
assert.ok(ui.includes('added.every((point) => Boolean(point.comment))'), 'MISSION 1 must require comments on every new POI in a pair');

assert.ok(layout.includes('新規 × 新規') && layout.includes('新規 × 既存'), 'MISSION 1 pair type copy missing');
assert.ok(layout.includes('campsite-v2-pair-kind'), 'MISSION 1 stable pair-kind selector missing');
assert.ok(layout.includes('v2PairToggle'), 'MISSION 1 detail toggle selector missing');
assert.ok(layout.includes('v2EnvToggle'), 'MISSION 3 editor toggle selector missing');
assert.ok(layout.includes("MK='campsiteDistanceMission4Viewed.v1'"), 'MISSION 4 viewed state must be tied to current result');
assert.ok(layout.includes('mark(latest)'), 'MISSION 4 map click must record viewed state');
assert.ok(layout.includes("dataset.v2Hidden!=='true'"), 'Legacy OPERATION TIPS must remain hidden');

assert.ok(state.includes("mission1=stale?'yellow'"), 'MISSION 1 stale must be yellow');
assert.ok(state.includes("mission2=stale?'yellow':'green'"), 'MISSION 2 stale must be yellow');
assert.ok(state.includes("mission3=env.complete?'green':env.entered?'yellow':'gray'"), 'MISSION 3 must distinguish unstarted/partial/complete');
assert.ok(state.includes("mission4=stale?'gray':mapDone?'green':'gray'"), 'MISSION 4 stale/unstarted must be gray');
assert.ok(state.includes("if(stale||ps.duplicates)mission5='red'"), 'MISSION 5 alone must be red for stale/duplicate blockers');
assert.ok(state.includes("green:'完了',yellow:'要確認',red:'修正が必要',gray:'未着手'"), 'Lamp meanings must remain progress states');
assert.ok(state.includes("n.textContent!==v"), 'Shared state rendering must avoid redundant text writes');
assert.ok(state.includes("n.dataset[k]!==v"), 'Shared state rendering must avoid redundant dataset writes');

assert.ok(actions.includes('data-v2-save'), 'MISSION 5 save action missing');
assert.ok(actions.includes('data-v2-rework'), 'MISSION 5 rework action missing');
assert.ok(actions.includes('data-v2-submit'), 'MISSION 5 pre-submit action missing');
assert.ok(actions.includes('window.CampsiteMissionState?.getState'), 'MISSION 5 must use shared mission state');
assert.ok(actions.includes('window.CampsiteDistanceBackup?.save'), 'MISSION 5 save must reuse existing backup handler');
assert.ok(actions.includes("document.querySelector('[data-project-rework]')"), 'MISSION 5 rework must reuse existing handler');
assert.ok(actions.includes("document.querySelector('[data-go-pre-submit]')"), 'MISSION 5 submit must reuse existing handler');

assert.ok(duplicate.includes('root.firstElementChild!==alert'), 'Duplicate interrupt must stay above mission flow');
assert.ok(duplicate.includes('if(c<=0){row?.remove();return}'), 'Zero duplicate row must stay absent');
assert.ok(duplicate.includes('重複POIが${c}組'), 'MISSION 5 must show duplicate count when blocking');
assert.ok(duplicate.includes('if(row.innerHTML!==html)'), 'Duplicate finalizer must avoid redundant rewrites');
assert.ok(cleanup.includes("const REMOVE_TITLES = ['拠点充実度', '判定結果']"), 'Bridge mission mode must remove old score/verdict panels');
assert.ok(cleanup.includes("child.classList.contains('distance-result-map')"), 'Legacy cleanup must preserve lazy map DOM');
assert.ok(layoutCss.includes('position:absolute!important') && layoutCss.includes('#campsiteDistanceCheckpoint'), 'Legacy action blocks must remain available behind MISSION 5 proxy actions');

assert.ok(gate.includes('#distance .distance-site-observation-step{display:none!important}'), 'Legacy field observation controls must be hidden');
assert.ok(gate.includes('#campsiteDistanceCommentWarning{display:none!important}'), 'Legacy optional-comment warning must be hidden');
assert.ok(gate.includes("'[data-go-pre-submit]'"), 'Mission gate must intercept pre-submit');
assert.ok(gate.includes('project?.siteEnvironment'), 'Mission gate must use persisted Mission 3 answers');
assert.ok(gate.includes("'#campsiteDistanceStaleWarning'"), 'Mission gate must focus stale warning');
assert.ok(gate.includes("'.campsite-duplicate-alert'"), 'Mission gate must focus duplicate alert');
assert.ok(gate.includes("'.campsite-chairman-sign'"), 'Mission gate must focus incomplete field confirmation');
assert.ok(gate.includes('event.stopImmediatePropagation()'), 'Mission gate must stop downstream handlers while blocked');
assert.ok(gate.includes('state.environmentComplete'), 'Mission gate must block incomplete field confirmation');
assert.ok(gate.includes('state.duplicateCount > 0'), 'Mission gate must block duplicates');
assert.ok(gate.includes('state.stale'), 'Mission gate must block stale results');
assert.ok(gate.includes("setLampState(shell, 3, 'gray')"), 'Stale map mission must be gray');
assert.ok(gate.includes("setLampState(shell, 4, 'red')"), 'Stale final mission must be red');

const commentsPos = bridge.indexOf('js/bridge-distance-ca-comments.js?v=2');
const enginePos = bridge.indexOf('js/distance-advice-engine.js?v=1');
const missionPos = bridge.indexOf('js/bridge-distance-mission-ui.js?v=1');
const missionGatePos = bridge.indexOf('js/bridge-distance-mission-gate.js?v=1');
const missionLayoutPos = bridge.indexOf('js/bridge-distance-mission-layout-v3.js?v=1');
const missionStatePos = bridge.indexOf('js/bridge-distance-mission-state-v2.js?v=1');
const missionActionsPos = bridge.indexOf('js/bridge-distance-mission-actions-v1.js?v=1');
const duplicatePos = bridge.indexOf('js/bridge-distance-duplicate-ui-v2.js?v=1');
const cleanupPos = bridge.indexOf('js/bridge-distance-legacy-cleanup-v1.js?v=1');
assert.ok(commentsPos >= 0, 'CA comment decorator must stay loaded');
assert.ok(enginePos > commentsPos, 'Advice engine load order broken');
assert.ok(missionPos > enginePos, 'Mission UI load order broken');
assert.ok(missionGatePos > missionPos, 'Mission gate load order broken');
assert.ok(missionLayoutPos > missionGatePos, 'Mission layout load order broken');
assert.ok(missionStatePos > missionLayoutPos, 'Mission state load order broken');
assert.ok(missionActionsPos > missionStatePos, 'MISSION 5 actions load order broken');
assert.ok(duplicatePos > missionActionsPos, 'Duplicate UI load order broken');
assert.ok(cleanupPos > duplicatePos, 'Legacy cleanup load order broken');

console.log('Distance mission UI regression checks: OK');
