import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('bridge-pc/creative-wm3b2b-test-injector.js','utf8');

for (const label of [
  'Relay接続',
  'Polygon受信',
  'GCS開始',
  'RESULT返却',
  'Project保存'
]) {
  assert.ok(source.includes(label), 'diagnostic label missing: '+label);
}

assert.ok(source.includes("diagnostics:{ relay:'done' }"), 'PONG must mark Relay as done');
assert.ok(
  source.includes("polygon:'active'") &&
  source.includes("gcs:'wait'") &&
  source.includes("result:'wait'") &&
  source.includes("save:'wait'"),
  'observation start must activate Polygon and leave later stages waiting'
);
assert.ok(
  source.includes("polygon:'done'") &&
  source.includes("gcs:'active'"),
  'accepted observation must mark Polygon done and GCS active'
);
assert.ok(
  source.includes("gcs:'done'") &&
  source.includes("result:'done'") &&
  source.includes("save:'active'"),
  'RESULT reception must mark GCS and RESULT done before save'
);
assert.ok(source.includes("diagnostics:{ save:'done' }"), 'Project save must mark the final stage done');
assert.ok(source.includes('campsiteWm3b2bTestDiagnostics'), 'diagnostic panel container missing');
assert.ok(source.includes('data-diag-step='), 'diagnostic rows must expose stable step markers');
assert.ok(source.includes("value === 'done' ? '✅'"), 'done state must be visually obvious');
assert.ok(source.includes("value === 'active' ? '🟡'"), 'active state must be visually obvious');

console.log('WM-3B-2D five-stage live diagnostic UI contract: OK');
