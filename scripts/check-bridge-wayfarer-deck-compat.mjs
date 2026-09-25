import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('js/bridge-wayfarer-deck-compat.js', 'utf8');
new vm.Script(source, { filename: 'js/bridge-wayfarer-deck-compat.js' });

assert.equal(source.includes('setInterval('), false, 'Deck compat must not poll');
assert.equal(source.includes('MutationObserver'), false, 'Deck compat must not observe the document');
assert.equal(source.includes('.remove()'), false, 'Deck compat must never remove Wayfarer deck canvases');
assert.ok(source.includes("defaultPolicy: 'preserve-native-deck'"));

function makeCanvas(pointerEvents = 'auto', visibility = '') {
  return {
    id: 'deckgl-overlay',
    isConnected: true,
    style: { pointerEvents, visibility },
    __computedPointerEvents: pointerEvents
  };
}

function makeResolution({ owner, canvases = [], sameMap = true, surface = 'mapview' } = {}) {
  const wayfarerMap = owner === 'NONE' ? null : { id: 'wayfarer-map' };
  let wfmmMap = null;
  if (owner === 'WFMM') {
    wfmmMap = sameMap ? wayfarerMap : { id: 'wfmm-map' };
  }
  const map = owner === 'WFMM' ? wfmmMap : wayfarerMap;
  return {
    owner,
    map,
    wayfarerMap,
    wfmmMap,
    wayfarerContext: wayfarerMap ? { surface } : null,
    __canvases: canvases
  };
}

function loadWith(initialResolution) {
  let current = initialResolution;
  const fakeWindow = {
    __campsiteBridgeWayfarerDeckCompatInstalled: false,
    CampsiteBridgeWayfarerDisplayOwner: {
      resolve() { return current; },
      findDeckCanvases(resolutionMap) {
        if (!current?.map || resolutionMap !== current.map) return [];
        return current.__canvases || [];
      }
    },
    getComputedStyle(canvas) {
      return { pointerEvents: canvas.__computedPointerEvents ?? canvas.style.pointerEvents ?? '' };
    }
  };
  const context = {
    window: fakeWindow,
    document: {},
    console,
    Map,
    Object,
    Array,
    Boolean,
    String,
    Number,
    Error
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  const api = fakeWindow.CampsiteBridgeWayfarerDeckCompat;
  assert.ok(api, 'Deck compat API missing');
  return {
    api,
    setResolution(next) { current = next; }
  };
}

const wayfarerCanvas = makeCanvas('auto', 'visible');
const wayfarer = loadWith(makeResolution({ owner: 'WAYFARER', canvases: [wayfarerCanvas] }));
const wayfarerPolicy = wayfarer.api.policy();
assert.equal(wayfarerPolicy.mode, 'PRESERVE_WAYFARER');
assert.equal(wayfarerPolicy.defaultMutation, false);
assert.equal(wayfarerPolicy.explicitMutationEligible, false);
const wayfarerAttempt = wayfarer.api.requestSuppression({
  allowMutation: true,
  scope: 'mapview',
  reason: 'test'
});
assert.equal(wayfarerAttempt.ok, false);
assert.equal(wayfarerAttempt.reason, 'owner-wayfarer');
assert.equal(wayfarerCanvas.style.visibility, 'visible');
assert.equal(wayfarerCanvas.style.pointerEvents, 'auto');

const none = loadWith(makeResolution({ owner: 'NONE' }));
const noneAttempt = none.api.requestSuppression({
  allowMutation: true,
  scope: 'mapview',
  reason: 'test'
});
assert.equal(noneAttempt.ok, false);
assert.equal(noneAttempt.reason, 'owner-none');

const activeCanvas = makeCanvas('auto', 'visible');
const passiveCanvas = makeCanvas('none', 'visible');
const wfmmResolution = makeResolution({
  owner: 'WFMM',
  canvases: [activeCanvas, passiveCanvas],
  sameMap: true,
  surface: 'mapview'
});
const wfmm = loadWith(wfmmResolution);

const defaultAttempt = wfmm.api.requestSuppression({ scope: 'mapview', reason: 'test' });
assert.equal(defaultAttempt.ok, false);
assert.equal(defaultAttempt.reason, 'explicit-approval-required');
assert.equal(activeCanvas.style.visibility, 'visible');

const wrongScope = wfmm.api.requestSuppression({ allowMutation: true, scope: 'details', reason: 'test' });
assert.equal(wrongScope.ok, false);
assert.equal(wrongScope.reason, 'scope-not-mapview');

const missingReason = wfmm.api.requestSuppression({ allowMutation: true, scope: 'mapview' });
assert.equal(missingReason.ok, false);
assert.equal(missingReason.reason, 'explicit-reason-required');

const approved = wfmm.api.requestSuppression({
  allowMutation: true,
  scope: 'mapview',
  reason: 'duplicate-prevention-test'
});
assert.equal(approved.ok, true);
assert.equal(approved.mutated, true);
assert.equal(approved.suppressedCount, 1);
assert.equal(approved.passiveSkippedCount, 1);
assert.equal(activeCanvas.style.visibility, 'hidden');
assert.equal(activeCanvas.style.pointerEvents, 'none');
assert.equal(passiveCanvas.style.visibility, 'visible');
assert.equal(passiveCanvas.style.pointerEvents, 'none');

activeCanvas.__computedPointerEvents = 'auto';
const repeated = wfmm.api.requestSuppression({
  allowMutation: true,
  scope: 'mapview',
  reason: 'duplicate-prevention-test'
});
assert.equal(repeated.ok, true);
assert.equal(repeated.suppressedCount, 0);
assert.equal(repeated.alreadySuppressedCount, 1);
assert.equal(repeated.activeSuppressionCount, 1);

const restored = wfmm.api.restoreSuppressed('test-complete');
assert.equal(restored.restoredCount, 1);
assert.equal(restored.activeSuppressionCount, 0);
assert.equal(activeCanvas.style.visibility, 'visible');
assert.equal(activeCanvas.style.pointerEvents, 'auto');

const mismatchCanvas = makeCanvas('auto', 'visible');
const mismatch = loadWith(makeResolution({
  owner: 'WFMM',
  canvases: [mismatchCanvas],
  sameMap: false,
  surface: 'mapview'
}));
const mismatchAttempt = mismatch.api.requestSuppression({
  allowMutation: true,
  scope: 'mapview',
  reason: 'test'
});
assert.equal(mismatchAttempt.ok, false);
assert.equal(mismatchAttempt.reason, 'map-mismatch');
assert.equal(mismatchCanvas.style.visibility, 'visible');

const wrongSurfaceCanvas = makeCanvas('auto', 'visible');
const wrongSurface = loadWith(makeResolution({
  owner: 'WFMM',
  canvases: [wrongSurfaceCanvas],
  sameMap: true,
  surface: 'review'
}));
const wrongSurfaceAttempt = wrongSurface.api.requestSuppression({
  allowMutation: true,
  scope: 'mapview',
  reason: 'test'
});
assert.equal(wrongSurfaceAttempt.ok, false);
assert.equal(wrongSurfaceAttempt.reason, 'surface-not-mapview');
assert.equal(wrongSurfaceCanvas.style.visibility, 'visible');

const reconcileCanvas = makeCanvas('auto', 'visible');
const reconcileWfmm = makeResolution({
  owner: 'WFMM',
  canvases: [reconcileCanvas],
  sameMap: true,
  surface: 'mapview'
});
const reconcileHarness = loadWith(reconcileWfmm);
reconcileHarness.api.requestSuppression({
  allowMutation: true,
  scope: 'mapview',
  reason: 'route-change-test'
});
assert.equal(reconcileCanvas.style.visibility, 'hidden');
reconcileHarness.setResolution(makeResolution({ owner: 'WAYFARER', canvases: [reconcileCanvas] }));
const reconciled = reconcileHarness.api.reconcile();
assert.equal(reconciled.restore.restoredCount, 1);
assert.equal(reconcileCanvas.style.visibility, 'visible');
assert.equal(reconcileCanvas.style.pointerEvents, 'auto');

console.log('Campsite Bridge guarded Wayfarer deck compatibility: OK');
