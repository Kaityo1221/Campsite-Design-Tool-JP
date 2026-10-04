import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/wayfarer-polygon-controller.js', 'utf8');
new vm.Script(source, { filename: 'bridge-pc/wayfarer-polygon-controller.js' });

const listeners = new Map();
const storage = new Map();
storage.set('campsite.wayfarerPolygonDraft.v1', JSON.stringify({
  version:'0.1.0',
  points:[[35.0,139.0],[35.0,139.01],[35.01,139.01]],
  completed:true,
  updatedAt:'2026-10-04T00:00:00.000Z'
}));
let mapClick = null;
const windowCaptureHandlers = new Map();

function capture(type) {
  return windowCaptureHandlers.get(type) || null;
}

class Overlay {
  constructor(options = {}) { this.options = options; this.map = options.map || null; }
  setMap(map) { this.map = map; }
}

const mapDiv = {
  contains() { return true; },
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 1000, height: 500 };
  }
};

const map = {
  addListener(type, fn) {
    if (type === 'click') mapClick = fn;
    return { remove() { mapClick = null; } };
  },
  getDiv() { return mapDiv; },
  getBounds() {
    return {
      getSouthWest() { return { lat() { return 35; }, lng() { return 139; } }; },
      getNorthEast() { return { lat() { return 36; }, lng() { return 140; } }; }
    };
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
  addEventListener(type, fn, options) {
    if (options === true) windowCaptureHandlers.set(type, fn);
    else listeners.set(type, fn);
  },
  removeEventListener(type, fn, options) {
    if (options === true && windowCaptureHandlers.get(type) === fn) windowCaptureHandlers.delete(type);
    else if (listeners.get(type) === fn) listeners.delete(type);
  },
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
assert.equal(storage.has(api.storageKey), false, 'Fresh Wayfarer page load must clear any previous polygon draft');
assert.equal(api.getState().draftAvailable, false, 'Fresh Wayfarer page load must not offer stale resume state');
assert.equal(api.getState().completed, false, 'Fresh Wayfarer page load must not start send-ready');
assert.equal(api.version, '0.1.0');
assert.equal(api.maxPoints, 30);
assert.equal(api.interactionMode(), 'pc');

api.startNew();
assert.equal(api.getState().active, true);
assert.equal(typeof capture('click'), 'function', 'PC mode must capture DOM clicks before Wayfarer POI handlers');
assert.equal(typeof capture('pointerdown'), 'function', 'PC mode must observe pointerdown for drag detection');
assert.equal(typeof capture('pointermove'), 'function', 'PC mode must observe pointermove for drag detection');
assert.equal(typeof capture('pointerup'), 'function', 'PC mode must observe pointerup for drag detection');
assert.equal(mapClick, null, 'PC capture mode must not depend on the Wayfarer map click event');

const mapTarget = { closest() { return null; } };
let prevented = 0;
let stopped = 0;

capture('pointerdown')({
  button: 0,
  pointerId: 1,
  target: mapTarget,
  clientX: 300,
  clientY: 220
});
capture('pointermove')({
  pointerId: 1,
  target: mapTarget,
  clientX: 340,
  clientY: 225
});
capture('pointerup')({
  button: 0,
  pointerId: 1,
  target: mapTarget,
  clientX: 340,
  clientY: 225
});
capture('click')({
  button: 0,
  target: mapTarget,
  clientX: 340,
  clientY: 225,
  preventDefault() { prevented += 1; },
  stopPropagation() { stopped += 1; },
  stopImmediatePropagation() { stopped += 1; }
});
assert.equal(api.getState().pointCount, 0, 'Dragging the map must not add a vertex');
assert.equal(prevented, 1, 'Drag completion click must still be blocked from native Wayfarer POI handlers');
assert.equal(stopped, 2, 'Drag completion click must not leak to downstream handlers');

prevented = 0;
stopped = 0;
capture('click')({
  button: 0,
  target: mapTarget,
  clientX: 500,
  clientY: 250,
  preventDefault() { prevented += 1; },
  stopPropagation() { stopped += 1; },
  stopImmediatePropagation() { stopped += 1; }
});
assert.equal(api.getState().pointCount, 1, 'Captured map click must add one vertex');
assert.equal(prevented, 1, 'Captured map click must prevent the native Wayfarer click');
assert.equal(stopped, 2, 'Captured map click must stop downstream POI handlers');
api.reset();

api.addPoint([35.0, 139.0]);
api.addPoint([35.0, 139.01]);
api.addPoint([35.01, 139.01]);
assert.equal(api.getState().pointCount, 3);
assert.equal(api.getState().canComplete, true);
assert.equal(api.complete(), true);
assert.equal(api.getState().completed, true);
assert.equal(storage.has(api.storageKey), true, 'Completed polygon must remain in draft storage until handoff');
assert.equal(api.getState().active, false, 'Completing a polygon must leave drawing mode');
assert.equal(capture('click'), null, 'Completing a polygon must remove the PC DOM click capture');
assert.equal(api.getState().completed, true);
api.editCompleted();
assert.equal(api.getState().active, true, 'Completed polygon can be reopened for editing');
assert.equal(api.getState().completed, false);

api.exitDrawing();
assert.equal(api.getState().active, false, 'Explicit normal-display exit must leave drawing mode');
assert.equal(api.getState().paused, true, 'Explicit normal-display exit must preserve resumable state');
assert.equal(capture('click'), null);
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
assert.equal(capture('click'), null, 'Mobile mode must not capture map clicks for vertex creation');
assert.equal(api.addCenter(), true);
assert.deepEqual([...api.getPolygon()[0]], [35.1, 139.1]);

console.log('WM-2 Wayfarer polygon controller: OK');
assert.equal(api.getState().message, '', 'Normal polygon state must clear stale transient messages');

assert.ok(source.includes("window.addEventListener('click', handler, true)"), 'PC drawing must preempt native Wayfarer POI clicks');
assert.ok(source.includes("['pointerdown', onPointerDown]"), 'PC drawing must observe pointerdown without blocking map drag');
assert.ok(source.includes('PC_DRAG_THRESHOLD_PX'), 'PC drawing must distinguish drag from click');
assert.ok(source.includes('if (withinTime && nearDragEnd) return;'), 'Drag completion click must not add a vertex');
assert.ok(source.includes('stopImmediatePropagation'), 'PC drawing must stop downstream POI handlers');
assert.ok(source.includes('pointFromClientPosition'), 'PC capture click must translate screen position to coordinates');
assert.ok(source.includes('clearDraftStorage();\n  points = [];\n  active = false;\n  completed = false;'), 'Page-load initialization must clear stale polygon state');
