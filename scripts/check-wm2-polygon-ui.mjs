import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/polygon-ui.js', 'utf8');
new vm.Script(source, { filename: 'bridge-pc/polygon-ui.js' });

assert.ok(source.includes("'campsite-bridge-pc:polygon-command'"));
assert.ok(source.includes("'campsite-bridge-pc:polygon-state'"));
assert.equal(source.includes('📐 範囲を決める'), false, 'Idle range-start CTA belongs in the Bridge side panel, not on the map');
assert.equal(source.includes("'campsite-bridge-pc:start'"), false, 'Polygon UI must not own Bridge handoff');
assert.equal(source.includes("'campsite-bridge-pc:status'"), false, 'Polygon UI must not own Bridge status');
assert.equal(source.includes('🌉 Campsiteで設計する'), false, 'Polygon UI must stay drawing-only');
assert.equal(source.includes('🔭 拠点内を観察'), false, 'User-facing observation step must stay removed');
assert.ok(source.includes("host.style.display = state.active === true ? '' : 'none'"), 'Drawing panel must be hidden outside active polygon editing');

assert.ok(source.includes('＋ 頂点を追加'));
assert.ok(source.includes('↶ 1つ戻す'));
assert.ok(source.includes('最初からやり直す'));
assert.ok(source.includes('範囲を確定'));
assert.ok(source.includes('範囲を最初からやり直しますか？'));
assert.ok(source.includes('campsite-wm2-crosshair'));
assert.ok(source.includes("state.mode === 'mobile'"));
assert.ok(source.includes('state.selfIntersects'));
assert.ok(source.includes('state.canComplete'));
assert.ok(source.includes('findWayfarerDrawingObstructions'));
assert.ok(source.includes('位置を検索'));
assert.ok(source.includes('ポケストップ'));
assert.ok(source.includes('パワースポット'));
assert.ok(source.includes('コミュニティ'));
assert.ok(source.includes('isMapTopControl'));
assert.ok(source.includes("state.active === true && state.completed !== true"));
assert.ok(source.includes("element.style.visibility = 'hidden'"));
assert.ok(source.includes('restoreWayfarerDrawingControls'));
assert.ok(source.includes('← Wayfarer通常表示に戻る'));
assert.ok(source.includes("'exit-drawing'"));
assert.ok(source.includes('document.evaluate'));
assert.ok(source.includes('XPathResult.ORDERED_NODE_SNAPSHOT_TYPE'));

assert.ok(source.includes('findWayfarerPoiInteractionLayers'));
assert.ok(source.includes("canvas#deckgl-overlay"));
assert.ok(source.includes('suppressWayfarerPoiInteraction'));
assert.ok(source.includes('restoreWayfarerPoiInteraction'));
assert.ok(source.includes("layer.style.pointerEvents = 'none'"));

assert.ok(source.includes('campsite-wm2-drawing-cursor'));
assert.ok(source.includes('cursor: crosshair !important'));
assert.equal(
  source.includes('app-wf-base-map button, app-wf-base-map a, app-wf-base-map input, app-wf-base-map select { cursor: pointer !important; }'),
  false,
  'Drawing mode must not revert Wayfarer top controls to the normal pointer cursor'
);
assert.ok(source.includes('syncDrawingCursor'));

console.log('WM-2 Wayfarer polygon UI contract: drawing-only panel OK');
