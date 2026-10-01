import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/wm1-live-verifier.js', 'utf8');
new vm.Script(source, { filename: 'bridge-pc/wm1-live-verifier.js' });

function makeSnapshot(guids, tileCount) {
  return {
    enginePois: guids.map(guid => ({ guid })),
    pois: guids.slice(0, Math.max(0, guids.length - 1)).map(guid => ({ guid })),
    referencePois: guids.slice(-1).map(guid => ({ guid })),
    parserStats: { duplicateCount: 0, failedCount: 0 },
    acquisition: {
      tileCount,
      transportComplete: true,
      coverageStatus: 'unverified'
    }
  };
}

const runs = [];
const fakeWindow = {
  CampsiteBridgePcCollector: {
    serializeBounds() {
      return {
        swLat: 35,
        swLng: 139,
        neLat: 35.01,
        neLng: 139.01,
        zoom: 15,
        center: { lat: 35.005, lng: 139.005 }
      };
    },
    findMap() { return {}; },
    async collectPolygon(_polygon, options = {}) {
      runs.push(options.maxTileMeters || null);
      if (!options.maxTileMeters) return makeSnapshot(['a', 'b', 'c'], 1);
      if (options.maxTileMeters === 1000) return makeSnapshot(['a', 'b', 'c'], 4);
      return makeSnapshot(['a', 'b', 'c'], 9);
    }
  },
  CampsiteWayfarerAcquisitionEngine: {
    compareGuidSets(left, right) {
      const a = [...new Set(left.map(x => x.guid))].sort();
      const b = [...new Set(right.map(x => x.guid))].sort();
      const bs = new Set(b);
      const as = new Set(a);
      return {
        equal: a.length === b.length && a.every(x => bs.has(x)),
        onlyLeft: a.filter(x => !bs.has(x)),
        onlyRight: b.filter(x => !as.has(x)),
        leftCount: a.length,
        rightCount: b.length
      };
    }
  },
  CampsiteBridgeWayfarerDisplayOwner: {
    diagnose() {
      return {
        map: {
          wayfarerResolved: true,
          wfmmPresent: false,
          wfmmResolved: false
        }
      };
    }
  },
  addEventListener() {},
  dispatchEvent() {}
};

class CustomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.detail = init.detail;
  }
}

const context = vm.createContext({
  window: fakeWindow,
  document: {},
  CustomEvent,
  console,
  Date,
  JSON,
  Number,
  String,
  Array,
  Object,
  Set,
  Error,
  Promise
});
vm.runInContext(source, context, { filename: 'bridge-pc/wm1-live-verifier.js' });

const api = fakeWindow.CampsiteWayfarerWm1LiveVerifier;
assert.ok(api);
assert.equal(api.version, '0.1.0');
const result = await api.run();
assert.deepEqual(runs, [null, 1000, 500]);
assert.equal(result.sourceConsistencyVerified, true);
assert.equal(result.wfmmIndependentObserved, true);
assert.equal(result.verdict, 'CONSISTENT_WFMM_ABSENT');
assert.equal(result.snapshots.length, 3);
assert.ok(result.comparisons.every(x => x.equal));

fakeWindow.CampsiteBridgePcCollector.collectPolygon = async (_polygon, options = {}) => {
  if (!options.maxTileMeters) return makeSnapshot(['a', 'b'], 1);
  if (options.maxTileMeters === 1000) return makeSnapshot(['a', 'b', 'c'], 4);
  return makeSnapshot(['a', 'b', 'c'], 9);
};
const mismatch = await api.run();
assert.equal(mismatch.sourceConsistencyVerified, false);
assert.equal(mismatch.verdict, 'GUID_MISMATCH');
assert.ok(mismatch.comparisons.some(x => !x.equal));

fakeWindow.CampsiteBridgeWayfarerDisplayOwner.diagnose = () => ({
  map: { wayfarerResolved: true, wfmmPresent: true, wfmmResolved: true }
});
fakeWindow.CampsiteBridgePcCollector.collectPolygon = async (_polygon, options = {}) =>
  makeSnapshot(['a', 'b', 'c'], options.maxTileMeters ? 4 : 1);
const wfmmPresent = await api.run();
assert.equal(wfmmPresent.wfmmIndependentObserved, false);
assert.equal(wfmmPresent.verdict, 'CONSISTENT_WFMM_PRESENT');

console.log('WM-1 authenticated live verifier contract: OK');
