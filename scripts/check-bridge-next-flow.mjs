import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const nextFlow = fs.readFileSync('js/bridge-next-flow.js', 'utf8');
const creativePatch = fs.readFileSync('creative/bridge-project-patch.js', 'utf8');
const creativeBridge = fs.readFileSync('creative/bridge.html', 'utf8');
const distanceBridge = fs.readFileSync('bridge-distance.html', 'utf8');
const distanceProject = fs.readFileSync('js/bridge-distance-project.js', 'utf8');
const gateway = fs.readFileSync('bridge-gateway.html', 'utf8');

function storage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(key) ? data.get(key) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); }
  };
}

const sessionStorage = storage();
const nextContext = {
  window: {},
  location: { search: '?campsiteBridgeImport=1', href: '' },
  sessionStorage,
  document: { addEventListener() {}, getElementById() { return null; } },
  URLSearchParams,
  console,
  setTimeout() {},
  crypto: crypto.webcrypto,
  Math,
  Date,
  JSON,
  Map,
  Object,
  Number,
  String,
  Array
};
vm.createContext(nextContext);
vm.runInContext(nextFlow, nextContext);

const api = nextContext.window.CampsiteBridgeNextFlow;
assert.ok(api, 'Bridge Next API missing');
assert.equal(api.projectKey, 'campsiteProject.v1');

const project = api.buildProject({
  version: '0.8.5',
  sourceCount: 3,
  polygon: [[35.0, 139.0], [35.1, 139.0], [35.1, 139.1]],
  pois: [
    { guid: 'a', title: 'Stop', lat: 35.05, lng: 139.05, gameEntity: 'POKESTOP' },
    { guid: 'b', title: 'Gym', lat: 35.06, lng: 139.06, gameEntity: 'GYM' }
  ]
}, {
  version: '0.8.9.4',
  adaptedAt: '2026-09-18T00:00:00.000Z',
  pois: [
    { guid: 'a', title: 'Stop', lat: 35.05, lng: 139.05, gameEntity: 'POKESTOP', provenance: ['WAYFARER_PASSIVE'] },
    { guid: 'b', title: 'Gym', lat: 35.06, lng: 139.06, gameEntity: 'GYM', sponsored: true },
    { guid: 'c', title: 'Power', lat: 35.07, lng: 139.07, gameEntity: 'POWERSPOT' }
  ]
});

assert.equal(project.schemaVersion, '1.0');
assert.equal(project.source, 'bridge');
assert.equal(project.sourcePois.length, 3);
assert.equal(project.selectedPois.length, 2);
assert.equal(project.currentPois.length, 2);
assert.equal(project.polygon.length, 3);
assert.deepEqual([...project.selectedPois[0].provenance], ['WAYFARER_PASSIVE']);
assert.equal(project.selectedPois[1].sponsored, true);
assert.deepEqual([...project.edits], []);
assert.deepEqual([...project.addedPois], []);
assert.deepEqual([...project.deletedPois], []);
assert.equal(project.distanceResult, null);

const patchContext = { window: {}, console, JSON, String };
vm.createContext(patchContext);
vm.runInContext(creativePatch, patchContext);
assert.equal(typeof patchContext.window.applyCreativeBridgeProjectPatch, 'function');
const transformed = patchContext.window.applyCreativeBridgeProjectPatch(`before\n  document.open();document.write(html);document.close();\nafter`);
assert.ok(transformed.includes('loadCampsiteBridgeProject'));
assert.ok(transformed.includes('syncCampsiteProjectFromCreative'));
assert.ok(transformed.includes('installCampsiteProjectNext'));
assert.ok(transformed.includes("role:campsProjectRole(r.layer)"));
assert.ok(transformed.includes("location.href='../bridge-distance.html?campsiteProject=bridge'"));
assert.ok(transformed.includes("type==='GYM'"));
assert.ok(transformed.includes("type==='POWERSPOT'"));
assert.ok(transformed.includes("return'existing-pokestop'"));
assert.ok(transformed.includes("sessionStorage.getItem(CAMPSITE_PROJECT_KEY)"));

assert.ok(creativeBridge.includes('./bridge-project-patch.js?v=1'));
assert.ok(creativeBridge.includes('applyCreativeBridgeProjectPatch'));
assert.ok(creativeBridge.includes("campsiteProject=bridge") === false, 'Bridge entry should not hard-code a second redirect');

assert.ok(distanceBridge.includes('js/bridge-distance-project.js?v=1'));
assert.ok(distanceBridge.includes("fetch('./index.html'"));
assert.ok(distanceBridge.includes("params.get('campsiteProject')!=='bridge'"));
assert.ok(distanceProject.includes("const PROJECT_KEY = 'campsiteProject.v1'"));
assert.ok(distanceProject.includes("'既存 PokéStop'"));
assert.ok(distanceProject.includes("'既存 Gym'"));
assert.ok(distanceProject.includes("'既存 PowerSpot'"));
assert.ok(distanceProject.includes("'新規 PokéStop'"));
assert.ok(distanceProject.includes("'新規 Gym'"));
assert.ok(distanceProject.includes("'新規 PowerSpot'"));
assert.ok(distanceProject.includes('window._layerPoints = groups'));
assert.ok(distanceProject.includes('window._activityPolygons'));
assert.ok(distanceProject.includes("window._inputType = 'project'"));
assert.ok(distanceProject.includes('buildDistanceSnapshot'));
assert.ok(distanceProject.includes("latest.phase = 'distance'"));
assert.ok(distanceProject.includes("latest.phase = 'pre-submit'"));
assert.ok(distanceProject.includes("'[data-go-pre-submit]'"));

const selectionPos = gateway.indexOf('js/bridge-selection.js?v=3');
const nextPos = gateway.indexOf('js/bridge-next-flow.js?v=1');
assert.ok(selectionPos >= 0 && nextPos > selectionPos, 'Next flow must load after polygon selection');

console.log('Bridge -> Project -> Creative -> Distance -> Pre-submit contract: OK');
