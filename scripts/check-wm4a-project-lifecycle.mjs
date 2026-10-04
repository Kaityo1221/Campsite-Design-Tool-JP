import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { buildWm3cCreativeTestRuntime } from './build-wm3c-test-runtime.mjs';

const KEY = 'campsiteProject.v1';
const copy = value => JSON.parse(JSON.stringify(value));
const patches = { window: {}, console };
vm.createContext(patches);
for (const path of ['creative/bridge-project-patch.js', 'creative/wayfarer-reference-layer-patch.js']) {
  vm.runInContext(fs.readFileSync(path, 'utf8'), patches);
}
const fixture = `<html><body><script>
(()=>{'use strict';
let records=[];
let polygons=[];
function cmCandidateShadowScene(){return Object.freeze({items:Object.freeze([])})}
function beginEditor(){}
window.lifecycle={sync:project=>syncCampsiteProjectFromCreative(project),install:project=>installCampsiteProjectNext(project),setRecords:value=>{records=value},setPolygon:value=>{polygons=[{points:value}]}};
})();
</script></body></html>`;
const base = patches.window.applyCreativeBridgeProjectPatch(fixture);

buildWm3cCreativeTestRuntime();
function FakeDocument() {}
FakeDocument.prototype.write = function() {};
const packaged = { window: { Document: FakeDocument }, console };
vm.runInNewContext(fs.readFileSync('bridge-pc/creative-wm3c-test-runtime.js', 'utf8'), packaged);
const transforms = [
  ['feature patch', patches.window.applyCreativeWayfarerReferenceLayerPatch],
  ['packaged public-page TEST', packaged.window.__campsiteWm3cCreativeRuntime.transformCreativeHtml]
];

for (const [name, transform] of transforms) {
  let stored;
  const sessionStorage = { getItem:()=>stored ?? null, setItem:(_key,value)=>{stored=value} };
  const listeners = new Map();
  let autosave;
  const window = { addEventListener:(name,callback)=>listeners.set(name,callback) };
  const button = {style:{},setAttribute(){}};
  const document = {getElementById:()=>null,createElement:()=>button,body:{appendChild(){}}};
  const html = transform(base);
  assert.equal(transform(html), html, `${name}: patch must be idempotent`);
  const start = html.indexOf("(()=>{'use strict';");
  const core = html.slice(start, html.indexOf('</script>', start));
  const context = { window, document, sessionStorage, console, location:{href:''}, circleExtras:[], crypto:{randomUUID:()=> 'test-poi'}, setInterval:callback=>{autosave=callback} };
  vm.runInNewContext(core, context);
  const api = window.lifecycle;
  const polygon = [[35,139],[35,139.01],[35.01,139.01]];
  const project = {
    schemaVersion:'1.0', source:'bridge', projectId:'wm4a-project',
    polygon, selectedPois:[], currentPois:[], meta:{bridgeHandoffId:'handoff:a'},
    futureField:{preserved:true}
  };
  const observation = {
    version:'0.1.0', observedAt:'2026-10-02T06:00:00.000Z', polygon,
    zones:{
      interior:[{guid:'inside', gameStatus:'ACTIVE'}],
      reference100:[{guid:'outer', gameStatus:'ACTIVE'}],
      reserve200:[{guid:'reserve', gameStatus:'INACTIVE'}]
    },
    acquisition:{bufferMeters:200, transportComplete:true, coverageComplete:false, sourceComplete:null, coverageStatus:'unverified'}
  };
  const stale = copy(project); // Object captured by Creative before RESULT arrives.
  stored = JSON.stringify({...project, wayfarerObservation:observation});
  api.setRecords([{id:'local',layer:'new-pokestop',latlng:[35.002,139.002],title:'Local candidate'}]);
  api.setPolygon(polygon);
  api.install(stale);
  assert.equal(typeof autosave, 'function');
  autosave();
  assert.deepEqual(JSON.parse(stored).wayfarerObservation, observation, `${name}: autosave must retain asynchronous RESULT`);
  assert.equal(JSON.parse(stored).currentPois.length, 1);
  assert.equal(JSON.parse(stored).currentPois[0].id, 'local', 'Reference must never enter editable POIs');
  assert.deepEqual(JSON.parse(stored).futureField, project.futureField);
  assert.equal(JSON.parse(stored).schemaVersion, '1.0');

  const second = {...observation, observedAt:'2026-10-02T06:01:00.000Z'};
  stored = JSON.stringify({...JSON.parse(stored), wayfarerObservation:second});
  listeners.get('pagehide')();
  assert.deepEqual(JSON.parse(stored).wayfarerObservation, second, `${name}: re-observation must survive later sync`);
  button.onclick();
  assert.equal(context.location.href, '../bridge-distance.html?campsiteProject=bridge');
  assert.deepEqual(JSON.parse(stored).wayfarerObservation, second, `${name}: Next handoff must preserve observation`);
  const resumed = JSON.parse(stored);
  api.sync(resumed);
  assert.deepEqual(JSON.parse(stored).wayfarerObservation, second, `${name}: resumed Project must preserve all observation fields`);

  const changedPolygon = [[36,140],[36,140.01],[36.01,140.01]];
  api.setPolygon(changedPolygon);
  api.sync(stale);
  assert.deepEqual(JSON.parse(stored).polygon, changedPolygon, 'Creative polygon remains SoT');
  assert.deepEqual(JSON.parse(stored).wayfarerObservation.polygon, polygon, 'Acquired geometry must stay tied to its snapshot');

  const without = JSON.parse(stored);
  delete without.wayfarerObservation;
  stored = JSON.stringify(without);
  api.sync(stale);
  assert.equal(JSON.parse(stored).wayfarerObservation, undefined, 'Removed observation must not be resurrected');

  for (const replacement of [
    {...project,projectId:'other-project'},
    {...project,meta:{bridgeHandoffId:'handoff:b'}},
    {...project,source:'other'}, null
  ]) {
    stored = replacement === null ? undefined : JSON.stringify(replacement);
    const before = stored;
    assert.equal(api.sync(stale), null, `${name}: detached callback must stop`);
    assert.equal(stored, before, `${name}: detached callback must not overwrite a different/removed Project`);
  }
  stored = '{invalid';
  assert.equal(api.sync(stale), null);
  assert.equal(stored, '{invalid', 'Unreadable storage must not be overwritten');
  console.log(`WM-4A Project lifecycle (${name}): PASS`);
}
