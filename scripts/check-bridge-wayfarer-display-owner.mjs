import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('js/bridge-wayfarer-display-owner.js', 'utf8');
new vm.Script(source, { filename: 'js/bridge-wayfarer-display-owner.js' });

assert.ok(source.includes("const DECK_SELECTOR = 'canvas#deckgl-overlay'"));
assert.equal(source.includes('setInterval('), false, 'Display owner must not poll');
assert.equal(source.includes('MutationObserver'), false, 'Display owner must not observe the document');
assert.equal(source.includes('.remove()'), false, 'Display owner must not remove Wayfarer canvases');

function makeMap(canvases = []) {
  const mapDiv = {
    isConnected: true,
    querySelectorAll(selector) {
      assert.equal(selector, 'canvas#deckgl-overlay');
      return canvases;
    }
  };
  return {
    getBounds() { return {}; },
    getCenter() { return {}; },
    getZoom() { return 16; },
    getDiv() { return mapDiv; },
    addListener() { return { remove() {} }; }
  };
}

function runScenario({ wayfarerMap = null, wfmm = undefined, canvases = [] } = {}) {
  let removeCalls = 0;
  for (const canvas of canvases) {
    canvas.remove = () => { removeCalls += 1; };
  }

  const host = { isConnected: true };
  const fakeWindow = {
    __campsiteBridgeWayfarerDisplayOwnerInstalled: false,
    CampsiteBridgeWayfarerMapAdapter: {
      looksLikeGoogleMap(value) {
        return Boolean(value && typeof value.getBounds === 'function' && typeof value.getDiv === 'function');
      },
      findMapContext() {
        return wayfarerMap ? {
          map: wayfarerMap,
          host,
          component: {},
          surface: 'mapview',
          adapter: 'wfmm-mapview-component'
        } : null;
      }
    },
    getComputedStyle(canvas) {
      return { pointerEvents: canvas.__pointerEvents || '' };
    }
  };
  if (wfmm !== undefined) fakeWindow.WFMM = wfmm;

  const context = {
    window: fakeWindow,
    document: {},
    console,
    JSON,
    Object,
    Array,
    Boolean,
    String,
    Number,
    Error
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const api = fakeWindow.CampsiteBridgeWayfarerDisplayOwner;
  assert.ok(api, 'Display owner API missing');
  return { api, removeCalls: () => removeCalls };
}

const wayfarerCanvases = [
  { id: 'deckgl-overlay', isConnected: true, __pointerEvents: 'auto' },
  { id: 'deckgl-overlay', isConnected: true, __pointerEvents: 'none' }
];
const wayfarerMap = makeMap(wayfarerCanvases);
const wayfarer = runScenario({ wayfarerMap, canvases: wayfarerCanvases });
const wayfarerResult = wayfarer.api.resolve();
assert.equal(wayfarerResult.owner, 'WAYFARER');
assert.equal(wayfarerResult.diagnostics.readOnly, true);
assert.equal(wayfarerResult.diagnostics.map.wayfarerResolved, true);
assert.equal(wayfarerResult.diagnostics.map.wfmmPresent, false);
assert.equal(wayfarerResult.diagnostics.deck.canvasCount, 2);
assert.equal(wayfarerResult.diagnostics.deck.interactiveCount, 1);
assert.equal(wayfarerResult.diagnostics.deck.passiveCount, 1);
assert.equal(wayfarer.removeCalls(), 0, 'Diagnostics must never remove canvases');

const wfmmSame = runScenario({
  wayfarerMap,
  canvases: wayfarerCanvases,
  wfmm: { map: { get() { return wayfarerMap; } } }
});
const wfmmSameResult = wfmmSame.api.resolve();
assert.equal(wfmmSameResult.owner, 'WFMM');
assert.equal(wfmmSameResult.diagnostics.map.sameMap, true);
assert.equal(wfmmSameResult.diagnostics.map.wfmmResolved, true);
assert.equal(wfmmSame.removeCalls(), 0);

const wfmmMap = makeMap([]);
const wfmmDifferent = runScenario({
  wayfarerMap,
  wfmm: { map: { get() { return wfmmMap; } } }
});
const wfmmDifferentResult = wfmmDifferent.api.resolve();
assert.equal(wfmmDifferentResult.owner, 'WFMM');
assert.equal(wfmmDifferentResult.map, wfmmMap);
assert.equal(wfmmDifferentResult.diagnostics.map.sameMap, false);

const wfmmThrows = runScenario({
  wayfarerMap,
  wfmm: { map: { get() { throw new Error('boom'); } } }
});
const wfmmThrowsResult = wfmmThrows.api.resolve();
assert.equal(wfmmThrowsResult.owner, 'WAYFARER');
assert.equal(wfmmThrowsResult.diagnostics.map.wfmmPresent, true);
assert.equal(wfmmThrowsResult.diagnostics.map.wfmmGetError, true);

const none = runScenario();
const noneResult = none.api.resolve();
assert.equal(noneResult.owner, 'NONE');
assert.equal(noneResult.map, null);
assert.equal(noneResult.diagnostics.deck.canvasCount, 0);
assert.equal(none.api.getLastDiagnostics().owner, 'NONE');

console.log('Campsite Bridge Wayfarer display owner diagnostics: OK');
