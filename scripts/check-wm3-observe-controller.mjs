import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/wm3-observe-controller.js', 'utf8');
new vm.Script(source, { filename: 'bridge-pc/wm3-observe-controller.js' });

const events = [];
let collectOptions = null;
const polygon = [[35,139],[35,139.01],[35.01,139.01],[35.01,139]];
let expectedPolygon = polygon;

const fakeWindow = {
  __campsiteWm3ObserveControllerInstalled: false,
  CampsiteWayfarerPolygonController: {
    getState() { return { active:false, completed:true }; },
    getPolygon() { return polygon; }
  },
  CampsiteBridgePcCollector: {
    async collectPolygon(input, options) {
      assert.equal(JSON.stringify(input), JSON.stringify(expectedPolygon));
      collectOptions = options;
      return {
        enginePois: [{ guid:'a' }],
        acquisition: {
          engineVersion:'wm1-test',
          bufferMeters:200,
          cellLevel:14,
          acquisitionBounds:{ south:34.99, west:138.99, north:35.02, east:139.02 },
          tileCount:4,
          geometryCoverageComplete:true,
          transportComplete:true,
          coverageComplete:false,
          coverageStatus:'unverified',
          sourceComplete:null
        }
      };
    }
  },
  CampsiteWayfarerObservationZone: {
    classifyPois(input, pois) {
      assert.equal(JSON.stringify(input), JSON.stringify(expectedPolygon));
      assert.equal(pois.length, 1);
      return {
        polygon: input,
        zones:{ interior:[{guid:'a'}], reference100:[{guid:'b'}], reserve200:[{guid:'c'}] },
        counts:{
          interior:{pokestop:1,gym:0,activePowerSpot:0,inactivePowerSpot:0,total:1},
          reference100:{pokestop:0,gym:1,activePowerSpot:0,inactivePowerSpot:0,total:1},
          reserve200:{pokestop:0,gym:0,activePowerSpot:1,inactivePowerSpot:0,total:1}
        },
        visibleTotal:2, retainedTotal:3, excludedCount:0, outsideCount:0
      };
    }
  },
  addEventListener() {},
  dispatchEvent(event) { events.push(event); },
  setTimeout(fn) { fn(); return 1; }
};

class FakeCustomEvent {
  constructor(type, init={}) { this.type=type; this.detail=init.detail; }
}

const context = vm.createContext({ window:fakeWindow, CustomEvent:FakeCustomEvent, console, Date, JSON, Number, String, Object, Array, Error, Promise });
vm.runInContext(source, context);

const api = fakeWindow.CampsiteWayfarerObserveController;
assert.ok(api, 'WM-3 observe controller missing');
assert.equal(api.bufferMeters, 200);
assert.equal(api.maxTileMeters, 500);

const result = await api.run();
assert.equal(collectOptions.bufferMeters, 200);
assert.equal(collectOptions.maxTileMeters, 500);
assert.equal(result.visibleTotal, 2);
assert.equal(result.retainedTotal, 3);
assert.equal(result.canProceed, true);
assert.ok(String(result.snapshotId).startsWith('wm3:'), 'snapshot identity must be explicit');
assert.equal(result.acquisition.engineVersion, 'wm1-test');
assert.equal(result.acquisition.referenceMeters, 100);
assert.equal(result.acquisition.reserveMeters, 200);
assert.equal(result.acquisition.cellLevel, 14);
assert.equal(result.acquisition.tileCount, 4);
assert.equal(result.acquisition.geometryCoverageComplete, true);
assert.equal(result.acquisition.transportComplete, true);
assert.equal(result.acquisition.coverageComplete, false, 'transport success must not promote completeness');
assert.equal(result.acquisition.coverageStatus, 'unverified');
assert.deepEqual(JSON.parse(JSON.stringify(result.acquisition.acquisitionBounds)), { south:34.99, west:138.99, north:35.02, east:139.02 });
assert.equal(api.getState().status, 'success');
assert.equal(api.getState().summary.reference100.gym, 1);
assert.ok(events.some(event => event.type === 'campsite-bridge-pc:observe-state'));

const remotePolygon = [[35.02,139.02],[35.02,139.03],[35.03,139.03],[35.03,139.02]];
expectedPolygon = remotePolygon;
const remoteResult = await api.runPolygon(remotePolygon);
assert.equal(remoteResult.visibleTotal, 2);
assert.equal(JSON.stringify(remoteResult.polygon), JSON.stringify(remotePolygon));
assert.equal(collectOptions.bufferMeters, 200);
assert.equal(collectOptions.maxTileMeters, 500);

await assert.rejects(
  () => api.runPolygon([[35,139],[35,139.01]]),
  /観察する設計範囲/
);

console.log('WM-3 / WM-3B-2B observe controller: OK');