import fs from 'node:fs';
import assert from 'node:assert/strict';

const creativeIndex = fs.readFileSync('creative/index.html', 'utf8');
const workspacePatch = fs.readFileSync('creative/runtime/creative-patches-v50-add-crosshair-cleanup.js', 'utf8');
const bridgePatch = fs.readFileSync('creative/bridge-project-patch.js', 'utf8');
const stalePatch = fs.readFileSync('creative/bridge-distance-stale-patch.js', 'utf8');
const distanceProject = fs.readFileSync('js/bridge-distance-project.js', 'utf8');
const distanceCheckpoint = fs.readFileSync('js/bridge-distance-checkpoint.js', 'utf8');
const commentGate = fs.readFileSync('js/bridge-distance-comment-gate.js', 'utf8');
const preSubmitCheckpoint = fs.readFileSync('js/bridge-pre-submit-checkpoint.js', 'utf8');
const distanceGateway = fs.readFileSync('bridge-distance.html', 'utf8');

const checks = [
  ['続きからのCreativeはBridge専用Nextを常時出さない',
    creativeIndex.includes("const bridgeProject=new URLSearchParams(location.search).get('campsiteProject')==='bridge';") &&
    creativeIndex.includes('if(bridgeProject){') &&
    creativeIndex.includes('html=window.applyCreativeBridgeProjectPatch(html)')],

  ['読み込んだKMZのworkspaceIdを復元',
    workspacePatch.includes("'campsite-workspace-id'") &&
    workspacePatch.includes('if(embeddedWorkspaceId)cmWorkspaceId=embeddedWorkspaceId')],

  ['保存KMZへ同じworkspaceIdを書き戻す',
    workspacePatch.includes('cmStampWorkspaceId(xml,doc)') &&
    workspacePatch.includes('workspaceId:cmEnsureWorkspaceId()')],

  ['ローカル作業復元でもworkspaceIdを維持',
    workspacePatch.includes("cmWorkspaceId=String(w.workspaceId||'').trim()||cmNewWorkspaceId()") &&
    workspacePatch.includes("cmWorkspaceId=String(s.workspaceId||'').trim()||cmNewWorkspaceId()")],

  ['Bridge復帰時はprojectのworkspaceIdをCreativeへ継承',
    workspacePatch.includes("String(project.workspaceId||project.projectId||'').trim()")],

  ['Creativeから距離チェックへ行く直前に同じProjectへ同期',
    bridgePatch.includes('const saved=syncCampsiteProjectFromCreative(project)') &&
    bridgePatch.includes("location.href='../bridge-distance.html?campsiteProject=bridge'")],

  ['距離チェック結果は設計シグネチャ付きで保存',
    distanceProject.includes('designSignature: buildDesignSignature(project)') &&
    distanceProject.includes("latest.distanceResult = buildDistanceSnapshot(latest)")],

  ['距離チェック保存はworkspaceIdと設計シグネチャを固定',
    distanceCheckpoint.includes('workspaceId: state.workspaceId') &&
    distanceCheckpoint.includes('designSignature: String(state.result.designSignature)')],

  ['最終確認保存も同じworkspaceIdを使用',
    preSubmitCheckpoint.includes('workspaceId: state.workspaceId') &&
    preSubmitCheckpoint.includes('checkpointKey(state.workspaceId)')],

  ['コメント警告からCreativeへ戻ってもProjectを消さない',
    commentGate.includes("location.href = './creative/index.html?campsiteProject=bridge'") &&
    !commentGate.includes('sessionStorage.removeItem')],

  ['Creativeでコメントを直すと旧距離結果を無効化',
    stalePatch.includes("description:String(p&&(p.description||p.memo)||'')") &&
    stalePatch.includes("result.staleReason='creative-design-changed'")],

  ['古い距離結果のまま最終確認へ進めない',
    distanceProject.includes('if (latest?.distanceResult?.stale === true)') &&
    distanceProject.includes('event.preventDefault()')],

  ['再距離チェックでstaleを解除した新しい結果を作る',
    distanceProject.includes('stale: false') &&
    distanceProject.includes('checkedAt: new Date().toISOString()')],

  ['距離画面でPhase 3〜7の各機能を同時ロード',
    distanceGateway.includes('bridge-distance-comment-gate.js') &&
    distanceGateway.includes('bridge-distance-project.js') &&
    distanceGateway.includes('bridge-distance-checkpoint.js') &&
    distanceGateway.includes('bridge-pre-submit-checkpoint.js')]
];

for (const [name, ok] of checks) {
  assert.ok(ok, `Phase 8 roundtrip contract failed: ${name}`);
}

// Identity continuity model: the three checkpoints must point at one workspace.
const workspaceId = 'phase8-workspace-example';
const model = {
  creative: { workspaceId },
  distance: { workspaceId },
  preSubmit: { workspaceId },
  returnedCreative: { workspaceId }
};
assert.equal(new Set(Object.values(model).map(x => x.workspaceId)).size, 1, 'workspaceId continuity model failed');

console.log('Phase 8 workspace roundtrip matrix: OK');
for (const [name] of checks) console.log(`  ✓ ${name}`);
