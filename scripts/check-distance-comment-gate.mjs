import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const gate = fs.readFileSync('js/bridge-distance-comment-gate.js', 'utf8');
const distanceBridge = fs.readFileSync('bridge-distance.html', 'utf8');

new vm.Script(gate, { filename: 'js/bridge-distance-comment-gate.js' });

assert.ok(gate.includes("'[data-go-pre-submit]'"), 'Gate must intercept the pre-submit action');
assert.ok(gate.includes('event.stopImmediatePropagation()'), 'Gate must stop the original action while the warning is open');
assert.ok(gate.includes('コメントのない50m未満があります。'), 'Gate warning copy missing');
assert.ok(gate.includes('戻って確認'), 'Back-to-Creative action missing');
assert.ok(gate.includes('このまま進む'), 'Continue action missing');
assert.ok(gate.includes('コメントは必須ではありません。'), 'Gate must state that comments are optional');
assert.ok(gate.includes("source: 'distance-comment-warning'"), 'Back action must identify the comment-warning rework source');
assert.ok(gate.includes("location.href = './creative/index.html?campsiteProject=bridge'"), 'Back action must return to the same Bridge Creative project');
assert.ok(gate.includes('bypassNextClick = true'), 'Continue action must be able to replay the original pre-submit click once');
assert.ok(gate.includes('button.click()'), 'Continue action must hand control back to the existing pre-submit flow');

const gatePos = distanceBridge.indexOf('js/bridge-distance-comment-gate.js?v=1');
const projectPos = distanceBridge.indexOf('js/bridge-distance-project.js?v=3');
assert.ok(gatePos >= 0, 'Distance gateway must load the comment gate');
assert.ok(projectPos > gatePos, 'Comment gate must register before the Project tracking capture handler');

console.log('Distance missing-comment pre-submit confirmation: OK');
