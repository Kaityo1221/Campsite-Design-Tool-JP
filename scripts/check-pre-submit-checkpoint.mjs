import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('js/bridge-pre-submit-checkpoint.js', 'utf8');
const gateway = fs.readFileSync('bridge-distance.html', 'utf8');

new vm.Script(source, { filename: 'js/bridge-pre-submit-checkpoint.js' });

assert.ok(source.includes("const CHECKPOINT_PREFIX = 'campsitePreSubmitCheckpoint.v1:'"), 'Pre-submit checkpoint storage prefix missing');
assert.ok(source.includes("const MANUAL_KEY = 'campsitePreSubmitManualV2'"), 'Pre-submit checkpoint must track manual checklist state');
assert.ok(source.includes("distanceCheckedAt"), 'Pre-submit checkpoint must bind to the distance check result');
assert.ok(source.includes("missingCommentCount"), 'Pre-submit checkpoint must retain missing-comment status');
assert.ok(source.includes("checklist"), 'Pre-submit checkpoint must persist final checklist state');
assert.ok(source.includes("💾 保存"), 'Final confirmation must expose a save action');
assert.ok(source.includes("✓ 保存済み"), 'Final confirmation must expose saved state');
assert.ok(source.includes('50m未満・コメント未入力'), 'Final confirmation must show non-blocking missing-comment status');
assert.ok(source.includes("project.phase = 'pre-submit'"), 'Saving final confirmation must keep the project in pre-submit phase');
assert.ok(source.includes("workspaceIdOf(project)"), 'Final confirmation save must stay bound to the same workspace');
assert.ok(gateway.includes('js/bridge-pre-submit-checkpoint.js?v=1'), 'Distance gateway must load the final confirmation checkpoint module');

console.log('Pre-submit checkpoint save contract: OK');
