import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const gate = fs.readFileSync('js/bridge-distance-comment-gate.js', 'utf8');
const distanceBridge = fs.readFileSync('bridge-distance.html', 'utf8');

new vm.Script(gate, { filename: 'js/bridge-distance-comment-gate.js' });

assert.ok(gate.includes("'[data-go-pre-submit]'"), 'Gate must intercept the pre-submit action');
assert.ok(gate.includes('event.stopImmediatePropagation()'), 'Gate must stop the original action while the warning is open');
assert.ok(gate.includes('50m未満の候補地にはコメントが必要です。'), 'Required-comment gate warning copy missing');
assert.ok(gate.includes('戻ってコメントを書く'), 'Back-to-Creative action missing');
assert.ok(gate.includes('ひとこと理由を添えてください。'), 'Gentle required-comment guidance missing');
assert.ok(!gate.includes('data-comment-gate-continue'), 'Required comment gate must not allow bypassing the comment');
assert.ok(!gate.includes('bypassNextClick'), 'Required comment gate must not replay pre-submit without a comment');
assert.ok(gate.includes("source: 'distance-comment-warning'"), 'Back action must identify the comment-warning rework source');
assert.ok(gate.includes("location.href = './creative/index.html?campsiteProject=bridge'"), 'Back action must return to the same Bridge Creative project');
assert.ok(gate.includes('warningObserver.disconnect()'), 'Observer must disconnect before changing warning DOM');
assert.ok(gate.includes('title.textContent !== wantedTitle'), 'Warning sync must avoid redundant DOM writes');
assert.ok(gate.includes('detail.textContent !== wantedDetail'), 'Warning sync must avoid redundant DOM writes');

const gatePos = distanceBridge.indexOf('js/bridge-distance-comment-gate.js?v=2');
const projectPos = distanceBridge.indexOf('js/bridge-distance-project.js?v=3');
assert.ok(gatePos >= 0, 'Distance gateway must load comment gate v2');
assert.ok(projectPos > gatePos, 'Comment gate must register before the Project tracking capture handler');

console.log('Distance required-comment pre-submit gate: OK');
