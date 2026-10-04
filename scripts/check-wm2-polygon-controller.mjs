import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/wayfarer-polygon-controller.js', 'utf8');
new vm.Script(source, { filename: 'bridge-pc/wayfarer-polygon-controller.js' });

const listeners = new Map();
const storage = new Map();
let mapClick = null;

class Overlay {
  constructor(options = {}) { this.options = options; this.map = options.map || null; }
  setMap(map) { this.map = map; }
}

const map = {
  addListener(type, fn) {
    if (type === 'click') mapClick = fn;
    return { remove() { mapClick = null; } };
  },
  getCenter() {
    return { lat() { return 35.1; }, lng() { return 139.1; } };
  }
};

const fakeWindow = {
  __campsiteWayfarerPolygonControllerInstalled: false,
  innerWidth: 1280,
  matchMedia() { return { matches: false }; },
  localStorage: {
    getItem(key) { return storage.has(key) ? storage.get(key) : null; },
    setItem(key, value) { storage.set(key, String(value)); },
    removeItem(key) { storage.delete(key); }
  },
  CampsiteBridgeWayfarerMapAdapter: {
    findMap() { return map; }
  },
  google: {
    maps: {
      Polygon: Overlay,
      Polyline: Overlay,
      Circle: Overlay,
      event: { removeListener() {} }
    }
  },
  addEventListener(type, fn) { listeners.set(type, fn); },
  dispatchEvent() {},
  setInterval() { return 1; },
  setTimeout(fn) { fn(); return 1; }
};

class FakeCustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}

const context = {
  window: fakeWindow,
  document: {},
  CustomEvent: FakeCustomEvent,
  console,
  Date,
  JSON,
  Math,
  Number,
  String,
  Array,
  Object,
  Set,
  Error
};

vm.createContext(context);
vm.runInContext(source, context);

const api = fakeWindow.CampsiteWayfarerPolygonController;
assert.ok(api, 'WM-2 polygon controller API missing');
assert.equal(api.version, '0.1.0');
assert.equal(api.maxPoints, 30);
assert.equal(api.interactionMode(), 'pc');

api.startNew();
assert.equal(api.getState().active, true);
assert.equal(typeof mapClick, 'function', 'PC mode must listen for map clicks');

api.addPoint([35.0, 139.0]);
api.addPoint([35.0, 139.01]);
api.addPoint([35.01, 139.01]);
assert.equal(api.getState().pointCount, 3);
assert.equal(api.getState().canComplete, true);
assert.equal(api.complete(), true);
assert.equal(api.getState().completed, true);
assert.equal(storage.has(api.storageKey), true, 'Completed polygon must remain in draft storage until handoff');
assert.equal(api.getState().active, false, 'Completing a polygon must leave drawing mode');
assert.equal(mapClick, null, 'Completing a polygon must remove the PC map click listener');
assert.equal(api.getState().completed, true);
api.editCompleted();
assert.equal(api.getState().active, true, 'Completed polygon can be reopened for editing');
assert.equal(api.getState().completed, false);

api.exitDrawing();
assert.equal(api.getState().active, false, 'Explicit normal-display exit must leave drawing mode');
assert.equal(api.getState().paused, true, 'Explicit normal-display exit must preserve resumable state');
assert.equal(mapClick, null);
api.resumeDraft();
assert.equal(api.getState().active, true);
assert.equal(api.getState().paused, false);
api.undo();
assert.equal(api.getState().completed, false);
assert.equal(api.getState().pointCount, 2);

api.reset();
api.addPoint([0, 0]);
api.addPoint([1, 1]);
api.addPoint([0, 1]);
api.addPoint([1, 0]);
assert.equal(api.getState().selfIntersects, true, 'Bow-tie polygon must be rejected');
assert.equal(api.getState().canComplete, false);
assert.ok(api.getState().invalidEdgeIndexes.length >= 2);

api.reset();
for (let i = 0; i < 30; i += 1) api.addPoint([35 + i * 0.0001, 139 + i * 0.0001]);
assert.equal(api.getState().pointCount, 30);
assert.equal(api.addPoint([36, 140]), false, '31st vertex must be rejected');
assert.equal(api.getState().pointCount, 30);

fakeWindow.innerWidth = 390;
api.reset();
assert.equal(api.getState().mode, 'mobile');
assert.equal(mapClick, null, 'Mobile mode must not use map-click vertex creation');
assert.equal(api.addCenter(), true);
assert.deepEqual([...api.getPolygon()[0]], [35.1, 139.1]);

console.log('WM-2 Wayfarer polygon controller: OK');