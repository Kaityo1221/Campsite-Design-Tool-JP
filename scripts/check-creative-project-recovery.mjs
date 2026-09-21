import fs from 'node:fs';
import assert from 'node:assert/strict';

const creativePatch = fs.readFileSync('creative/bridge-project-patch.js', 'utf8');
const distanceProject = fs.readFileSync('js/bridge-distance-project.js', 'utf8');

const cases = [
  ['POI追加を復元', "if(poi.role==='added')added.push(poi)", creativePatch],
  ['POI削除を復元', 'if(r.deleted){deleted.push(poi);return}', creativePatch],
  ['POI移動を変更履歴へ保存', 'const moved=Math.abs(Number(base.lat)-poi.lat)>1e-8', creativePatch],
  ['名称変更を変更履歴へ保存', "const renamed=String(base.title||base.name||'')!==poi.title", creativePatch],
  ['Gym / PowerSpot / PokéStop種別を復元', "if(type==='GYM')return prefix+'gym'", creativePatch],
  ['PowerSpot種別を復元', "if(type==='POWERSPOT')return prefix+'power'", creativePatch],
  ['既存 / 新規ロールを復元', "const prefix=poi?.role==='added'?'new-':'existing-'", creativePatch],
  ['currentPoisを原本selectedPoisより優先', 'Array.isArray(project&&project.currentPois)?project.currentPois', creativePatch],
  ['50m / 40m / 30m円を復元', 'function campsProjectNormalizeCircleRadii(){return [50,40,30]}', creativePatch],
  ['円表示状態をProjectへ再保存', 'project.circleRadii=campsProjectCurrentCircleRadii()', creativePatch],
  ['活動範囲PolygonをProjectへ再保存', 'project.polygon=polygon', creativePatch],
  ['ページ離脱時にProject同期', "window.addEventListener('pagehide',sync)", creativePatch],
  ['編集中も定期的にProject同期', 'setInterval(sync,2500)', creativePatch],
  ['戻る操作前にProject同期', "if(backBtn)backBtn.onclick=()=>{syncCampsiteProjectFromCreative(project);snapshot();location.href='../bridge-gateway.html?campsiteBridgeImport=1'}", creativePatch],
  ['距離チェック結果をProjectへ保存', 'latest.distanceResult = buildDistanceSnapshot(latest)', distanceProject],
  ['保存して作り直すでCreativeへ戻る', "location.href = './creative/index.html?campsiteProject=bridge'", distanceProject],
  ['距離チェックから戻る際にdesign phaseへ復帰', "latest.phase = 'design'", distanceProject],
  ['提出前確認へ進んだ状態を保存', "latest.phase = 'pre-submit'", distanceProject]
];

for (const [name, needle, source] of cases) {
  assert.ok(source.includes(needle), `Recovery contract missing: ${name}`);
}

const orderChecks = [
  ['削除判定後にcurrentへ追加しない', creativePatch.indexOf('if(r.deleted){deleted.push(poi);return}'), creativePatch.indexOf('current.push(poi)')],
  ['Creative状態を同期してから距離画面へ進む', creativePatch.indexOf('const saved=syncCampsiteProjectFromCreative(project)'), creativePatch.indexOf("location.href='../bridge-distance.html?campsiteProject=bridge'")],
  ['保存して作り直すではphaseをdesignへ戻してから遷移', distanceProject.indexOf("latest.phase = 'design'"), distanceProject.indexOf("location.href = './creative/index.html?campsiteProject=bridge'")]
];

for (const [name, before, after] of orderChecks) {
  assert.ok(before >= 0 && after > before, `Recovery order invalid: ${name}`);
}

console.log('Creative Project recovery matrix: OK');
for (const [name] of cases) console.log(`  ✓ ${name}`);
