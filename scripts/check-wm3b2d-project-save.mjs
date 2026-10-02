import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const patchSource = fs.readFileSync('creative/wayfarer-observe-link-patch.js', 'utf8');
const patchWindow = {};
vm.runInContext(
  patchSource,
  vm.createContext({ window:patchWindow, console, String, Object, Set, Date, Math, JSON })
);
assert.equal(typeof patchWindow.applyCreativeWayfarerObserveLinkPatch, 'function');

const input = [
  'function installCampsiteProjectNext(project){}',
  'function loadCampsiteBridgeProject(project){',
  '  installCampsiteProjectNext(project);',
  '}'
].join('\n');
const runtimeSource = patchWindow.applyCreativeWayfarerObserveLinkPatch(input);

const store = new Map();
const sessionStorage = {
  getItem(key) { return store.has(key) ? store.get(key) : null; },
  setItem(key, value) { store.set(key, String(value)); },
  removeItem(key) { store.delete(key); }
};

const listeners = new Map();
const runtimeWindow = {
  addEventListener(type, fn) {
    if (!listeners.has(type)) listeners.set(type, []);
    listeners.get(type).push(fn);
  },
  postMessage() {}
};
const document = {
  getElementById() { return null; }
};
const context = vm.createContext({
  window:runtimeWindow,
  document,
  sessionStorage,
  location:{ origin:'https://kaityo1221.github.io' },
  crypto:{ randomUUID(){ return 'test-id'; } },
  console,
  setTimeout,
  clearTimeout,
  String,
  Object,
  Set,
  Date,
  Math,
  JSON,
  Number,
  Array,
  Promise
});
vm.runInContext(runtimeSource, context);

const api = runtimeWindow.CampsiteCreativeWayfarerLink;
assert.ok(api);
assert.equal(api.version, '0.3.0');
assert.equal(typeof api.saveObservationResult, 'function');

const polygon = [[35,139],[35,139.01],[35.01,139.01],[35.01,139]];
const project = {
  schemaVersion:'1.0',
  projectId:'project-test',
  source:'bridge',
  receivedAt:'2026-10-02T00:00:00.000Z',
  createdAt:'2026-10-02T00:00:00.000Z',
  sourcePois:[{ guid:'source-1', title:'source' }],
  polygon,
  selectedPois:[{ guid:'selected-1', title:'selected' }],
  circleRadii:[50,40,30],
  edits:[{ type:'rename', guid:'selected-1' }],
  currentPois:[{ guid:'current-1', title:'current' }],
  addedPois:[{ guid:'added-1', title:'added' }],
  deletedPois:[{ guid:'deleted-1', title:'deleted' }],
  distanceResult:{ ok:true },
  meta:{
    projectContract:'campsiteProject.v1',
    preserved:'yes'
  },
  futureField:{ keep:true }
};

const protectedSnapshot = JSON.parse(JSON.stringify({
  schemaVersion:project.schemaVersion,
  sourcePois:project.sourcePois,
  polygon:project.polygon,
  selectedPois:project.selectedPois,
  circleRadii:project.circleRadii,
  edits:project.edits,
  currentPois:project.currentPois,
  addedPois:project.addedPois,
  deletedPois:project.deletedPois,
  distanceResult:project.distanceResult,
  meta:project.meta,
  futureField:project.futureField
}));

sessionStorage.setItem('campsiteProject.v1', JSON.stringify(project));
const records = [{ id:'creative-record-sentinel' }];
context.records = records;

const result = {
  version:'0.1.0',
  observedAt:'2026-10-02T00:01:00.000Z',
  polygon,
  counts:{
    interior:{ total:2, active:2, inactive:0 },
    reference100:{ total:1, active:1, inactive:0 },
    reserve200:{ total:1, active:1, inactive:0 }
  },
  zones:{
    interior:[
      { guid:'inside-1', observationZone:'INTERIOR' },
      { guid:'inside-2', observationZone:'INTERIOR' }
    ],
    reference100:[
      { guid:'outer-1', observationZone:'REFERENCE_100' }
    ],
    reserve200:[
      { guid:'reserve-1', observationZone:'RESERVE_200' }
    ]
  },
  visibleTotal:3,
  retainedTotal:4,
  excludedCount:0,
  outsideCount:2,
  canProceed:true,
  acquisition:{
    bufferMeters:200,
    tileCount:3,
    transportComplete:true,
    coverageComplete:false,
    coverageStatus:'unverified',
    sourceComplete:null
  }
};

const fullBefore = JSON.parse(JSON.stringify(project));
const savedObservation = api.saveObservationResult(result);
assert.equal(savedObservation.visibleTotal, 3);
assert.equal(savedObservation.retainedTotal, 4);

const savedProject = JSON.parse(sessionStorage.getItem('campsiteProject.v1'));
assert.equal(savedProject.schemaVersion, '1.0');
assert.equal(savedProject.source, 'bridge');
assert.equal(JSON.stringify(savedProject.wayfarerObservation), JSON.stringify(savedObservation));
assert.deepEqual({
  schemaVersion:savedProject.schemaVersion,
  sourcePois:savedProject.sourcePois,
  polygon:savedProject.polygon,
  selectedPois:savedProject.selectedPois,
  circleRadii:savedProject.circleRadii,
  edits:savedProject.edits,
  currentPois:savedProject.currentPois,
  addedPois:savedProject.addedPois,
  deletedPois:savedProject.deletedPois,
  distanceResult:savedProject.distanceResult,
  meta:savedProject.meta,
  futureField:savedProject.futureField
}, protectedSnapshot);
assert.equal(JSON.stringify(context.records), JSON.stringify(records), 'Creative records must not be mutated by Project observation save');

const savedWithoutObservation = JSON.parse(JSON.stringify(savedProject));
delete savedWithoutObservation.wayfarerObservation;
assert.deepEqual(savedWithoutObservation, fullBefore, 'only wayfarerObservation may change on first observation save');

const secondResult = JSON.parse(JSON.stringify(result));
secondResult.observedAt = '2026-10-02T00:02:00.000Z';
secondResult.zones.interior.push({ guid:'inside-3', observationZone:'INTERIOR' });
secondResult.counts.interior.total = 3;
secondResult.visibleTotal = 4;
secondResult.retainedTotal = 5;
const secondSaved = api.saveObservationResult(secondResult);
const projectAfterSecondSave = JSON.parse(sessionStorage.getItem('campsiteProject.v1'));
const secondWithoutObservation = JSON.parse(JSON.stringify(projectAfterSecondSave));
delete secondWithoutObservation.wayfarerObservation;
assert.deepEqual(secondWithoutObservation, fullBefore, 're-observation must replace only wayfarerObservation');
assert.equal(secondSaved.observedAt, '2026-10-02T00:02:00.000Z');
assert.equal(secondSaved.zones.interior.length, 3);

const staleProject = JSON.parse(JSON.stringify(project));
staleProject.polygon = [[36,140],[36,140.01],[36.01,140.01],[36.01,140]];
sessionStorage.setItem('campsiteProject.v1', JSON.stringify(staleProject));
assert.throws(
  () => api.saveObservationResult(result),
  /観察中に設計範囲が変更/
);
const afterStale = JSON.parse(sessionStorage.getItem('campsiteProject.v1'));
assert.equal(afterStale.wayfarerObservation, undefined, 'stale result must not be saved');

console.log('WM-3B-2D campsiteProject.v1 observation save regression: OK');
