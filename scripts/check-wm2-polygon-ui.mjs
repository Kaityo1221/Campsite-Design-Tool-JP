import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/polygon-ui.js', 'utf8');
new vm.Script(source, { filename: 'bridge-pc/polygon-ui.js' });

assert.ok(source.includes("'campsite-bridge-pc:polygon-command'"));
assert.ok(source.includes("'campsite-bridge-pc:polygon-state'"));
assert.ok(source.includes('📐 範囲を決める'));
assert.ok(source.includes('地図上をクリック') === false, 'PC instruction belongs to controller state, not duplicated UI copy');
assert.ok(source.includes('＋ 頂点を追加'));
assert.ok(source.includes('↶ 1つ戻す'));
assert.ok(source.includes('最初からやり直す'));
assert.ok(source.includes('範囲を確定'));
assert.ok(source.includes('前回の作成途中があります。再開しますか？'));
assert.ok(source.includes('範囲を最初からやり直しますか？'));
assert.ok(source.includes('campsite-wm2-crosshair'));
assert.ok(source.includes("state.mode === 'mobile'"));
assert.ok(source.includes('state.selfIntersects'));
assert.ok(source.includes('state.canComplete'));

console.log('WM-2 Wayfarer polygon UI contract: OK');