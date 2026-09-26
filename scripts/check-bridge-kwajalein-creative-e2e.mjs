import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const fixture = JSON.parse(fs.readFileSync('scripts/fixtures/bridge-poi-engine-kwajalein-v1.1.json', 'utf8'));
const parserSource = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const classifierSource = fs.readFileSync('bridge-pc/poi-classifier.js', 'utf8');
const referenceSource = fs.readFileSync('bridge-pc/poi-reference-layer.js', 'utf8');
const exporterSource = fs.readFileSync('bridge-pc/bridge-v1-exporter.js', 'utf8');
const receiverHtml = fs.readFileSync('bridge-receiver.html', 'utf8');
const inactiveReviewSource = fs.readFileSync('js/bridge-inactive-review.js', 'utf8');
const nextFlowSource = fs.readFileSync('js/bridge-next-flow.js', 'utf8');
const referenceVisualSource = fs.readFileSync('js/bridge-reference-visuals.js', 'utf8');
const creativePatchSource = fs.readFileSync('creative/bridge-project-patch.js', 'utf8');

const receiverScripts = [...receiverHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(receiverScripts.length > 0, 'Receiver inline script missing');
const receiverSource = receiverScripts.at(-1)[1];

function storage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    dump() { return new Map(data); }
  };
}

function fakeClassList() {
  const values = new Set();
  return {
    add(...items) { for (const item of items) values.add(item); },
    remove(...items) { for (const item of items) values.delete(item); },
    contains(item) { return values.has(item); },
    toggle(item, force) {
      if (force === true) values.add(item);
      else if (force === false) values.delete(item);
      else if (values.has(item)) values.delete(item);
      else values.add(item);
      return values.has(item);
    }
  };
}

function fakeElement() {
  return {
    textContent: '',
    className: '',
    hidden: false,
    style: {},
    classList: fakeClassList(),
    addEventListener() {},
    closest() { return null; }
  };
}

function buildRawKwajalein() {
  const { generator } = fixture;
  const pois = [];
  const entities = generator.activeEntityCycle;

  for (let i = 0; i < generator.activeCount; i += 1) {
    const entity = entities[i % entities.length];
    pois.push({
      poiId: `kwajalein-active-${String(i + 1).padStart(2, '0')}`,
      title: `Kwajalein ACTIVE test ${String(i + 1).padStart(2, '0')}`,
      latE6: generator.baseLatE6 + (i * generator.coordinateStepE6),
      lngE6: generator.baseLngE6 + (i * generator.coordinateStepE6),
      gmo: [{ gameBrand: 'HOLOHOLO', entity, status: 'ACTIVE' }]
    });
  }

  for (let i = 0; i < generator.notInGameCount; i += 1) {
    const index = generator.activeCount + i;
    pois.push({
      poiId: `kwajalein-not-in-game-${String(i + 1).padStart(2, '0')}`,
      title: `Kwajalein Not in Game test ${String(i + 1).padStart(2, '0')}`,
      latE6: generator.baseLatE6 + (index * generator.coordinateStepE6),
      lngE6: generator.baseLngE6 + (index * generator.coordinateStepE6),
      gmo: []
    });
  }

  for (let i = 0; i < generator.inactivePowerSpotCount; i += 1) {
    const index = generator.activeCount + generator.notInGameCount + i;
    pois.push({
      poiId: `kwajalein-inactive-power-${String(i + 1).padStart(2, '0')}`,
      title: `Kwajalein Inactive Power Spot test ${String(i + 1).padStart(2, '0')}`,
      latE6: generator.baseLatE6 + (index * generator.coordinateStepE6),
      lngE6: generator.baseLngE6 + (index * generator.coordinateStepE6),
      gmo: [{ gameBrand: 'HOLOHOLO', entity: 'POWERSPOT', status: 'INACTIVE' }]
    });
  }

  return { result: { data: [{ pois }] } };
}

function makePoiEngineContext() {
  const context = {
    window: {},
    console,
    Map,
    Set,
    WeakSet,
    Object,
    Number,
    String,
    Array,
    JSON,
    Math,
    Date,
    Promise,
    Error
  };
  vm.createContext(context);
  vm.runInContext(parserSource, context);
  vm.runInContext(classifierSource, context);
  vm.runInContext(referenceSource, context);
  vm.runInContext(exporterSource, context);
  return context;
}

function makeReceiverContext(sessionStorage, handshakeId) {
  const elements = new Map(
    ['total','pokestop','gym','powerspot','notInGame','inactivePowerSpot','sponsored','smr','status','beforeCount','afterCount','failedCount','duplicateCount','adapterStatus','continueBtn','clearBtn']
      .map(id => [id, fakeElement()])
  );
  const listeners = new Map();
  const document = {
    body: fakeElement(),
    title: '',
    referrer: '',
    getElementById(id) { return elements.get(id) || null; }
  };
  const window = {
    opener: null,
    focus() {},
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); }
  };
  const context = {
    window,
    document,
    location: {
      search: `?campsiteBridgeDev=1&handshake=${encodeURIComponent(handshakeId)}`,
      replaced: '',
      replace(value) { this.replaced = value; }
    },
    sessionStorage,
    URLSearchParams,
    URL,
    console,
    setTimeout() { return 1; },
    clearTimeout() {},
    Map,
    Set,
    Object,
    Number,
    String,
    Array,
    JSON,
    Math,
    Date,
    Promise,
    Error
  };
  vm.createContext(context);
  vm.runInContext(receiverSource, context);
  return context;
}

function makeInactiveReviewContext(sessionStorage) {
  const clickListeners = [];
  const context = {
    window: {},
    document: {
      addEventListener(type, fn) { if (type === 'click') clickListeners.push(fn); },
      getElementById() { return null; }
    },
    sessionStorage,
    console,
    Map,
    Set,
    Object,
    Number,
    String,
    Array,
    JSON,
    Math,
    Date,
    Promise,
    Error
  };
  vm.createContext(context);
  vm.runInContext(inactiveReviewSource, context);
  return context;
}

function makeNextFlowContext(sessionStorage) {
  const localStorage = storage();
  const context = {
    window: {},
    location: { search: '?campsiteBridgeImport=1', href: '' },
    sessionStorage,
    localStorage,
    document: { addEventListener() {}, getElementById() { return null; } },
    URLSearchParams,
    console,
    setTimeout() {},
    crypto: crypto.webcrypto,
    Math,
    Date,
    JSON,
    Map,
    Set,
    Object,
    Number,
    String,
    Array,
    Error
  };
  vm.createContext(context);
  vm.runInContext(nextFlowSource, context);
  return context;
}

const engine = makePoiEngineContext();
const parser = engine.window.CampsiteBridgePoiParser;
const classifier = engine.window.CampsiteBridgePoiClassifier;
const referenceLayer = engine.window.CampsiteBridgePoiReferenceLayer;
const exporter = engine.window.CampsiteBridgeV1Exporter;
assert.ok(parser && classifier && referenceLayer && exporter, 'POI Engine v1.1 APIs missing');

const raw = buildRawKwajalein();
const parsed = parser.parsePayload(raw);
const classified = classifier.run(parsed);
const routed = referenceLayer.splitClassified(classified.pois);
const payload = exporter.makePayload({
  enginePois: routed.activeEnginePois,
  referencePois: routed.referencePois,
  selectedBounds: {
    center: { lat: fixture.generator.baseLatE6 / 1e6, lng: fixture.generator.baseLngE6 / 1e6 },
    zoom: 17,
    sw: { lat: 8.70, lng: 167.70 },
    ne: { lat: 8.75, lng: 167.76 }
  },
  diagnostics: classified.diagnostics,
  classificationDiagnostics: classified.classificationDiagnostics
}, 'kwajalein-creative-e2e', { bridgeVersion: '0.1.0', bridgePlatform: 'pc' });

assert.equal(parsed.parsedCount, fixture.expected.parsedCount);
assert.equal(payload.pois.length, fixture.expected.bridgePoisCount);
assert.equal(payload.referencePois.length, fixture.expected.bridgeReferenceCount);
assert.equal(payload.referencePois.filter(poi => poi.referenceKind === 'NOT_IN_GAME').length, 4);
assert.equal(payload.referencePois.filter(poi => poi.referenceKind === 'INACTIVE_POWERSPOT').length, 1);

const sessionStorage = storage();
const receiver = makeReceiverContext(sessionStorage, payload.handshakeId);
const receiveResult = receiver.window.CampsiteBridgeDevReceive(payload);
assert.equal(receiveResult.accepted, true, 'Receiver must accept clean Kwajalein payload');
assert.equal(receiveResult.requiresReview, false, 'Clean Kwajalein payload must not require Receiver review');
assert.equal(receiveResult.activeCount, 37, 'Receiver must retain 37 active POIs');
assert.equal(receiveResult.referenceCount, 5, 'Receiver must retain all 5 references');

const adapter = JSON.parse(sessionStorage.getItem('campsiteBridgeAdapter.v0.3'));
assert.ok(adapter, 'Receiver must save Bridge adapter');
assert.equal(adapter.pois.length, 37, 'Adapter active count changed');
assert.equal(adapter.referencePois.length, 5, 'Adapter reference count changed');
assert.equal(adapter.integrity.requiresReview, false, 'Adapter should be clean');

const allCoordinates = [...adapter.pois, ...adapter.referencePois].map(poi => [Number(poi.lat), Number(poi.lng)]);
const lats = allCoordinates.map(point => point[0]);
const lngs = allCoordinates.map(point => point[1]);
const pad = 0.001;
const polygon = [
  [Math.min(...lats) - pad, Math.min(...lngs) - pad],
  [Math.max(...lats) + pad, Math.min(...lngs) - pad],
  [Math.max(...lats) + pad, Math.max(...lngs) + pad],
  [Math.min(...lats) - pad, Math.max(...lngs) + pad]
];

const selectionKey = 'campsiteBridgeSelection.v0.8.5';
const handoffId = String(adapter.handoffId || '');
sessionStorage.setItem(selectionKey, JSON.stringify({
  version: '0.8.5',
  handoffId,
  selectedAt: new Date().toISOString(),
  sourceCount: adapter.pois.length,
  selectedCount: adapter.pois.length,
  polygon,
  pois: adapter.pois
}));

const inactiveReview = makeInactiveReviewContext(sessionStorage);
const addedInactive = inactiveReview.window.CampsiteBridgeInactiveReview.mergeInactiveReviewTargets();
assert.equal(addedInactive, 1, 'Exactly one Inactive Power Spot must join the selected design set');

const selection = JSON.parse(sessionStorage.getItem(selectionKey));
assert.equal(selection.pois.length, 38, 'Creative selection must be 37 active + 1 inactive PS');
assert.equal(selection.selectedCount, 38);
assert.equal(selection.inactiveReviewCount, 1);
assert.equal(selection.pois.filter(poi => poi.gameStatus === 'INACTIVE').length, 1);
assert.equal(selection.pois.filter(poi => poi.referenceKind === 'INACTIVE_POWERSPOT').length, 1);
assert.equal(selection.pois.filter(poi => poi.referenceKind === 'NOT_IN_GAME').length, 0, 'Not in Game must never enter Creative selection');

const next = makeNextFlowContext(sessionStorage);
const nextApi = next.window.CampsiteBridgeNextFlow;
assert.ok(nextApi, 'Bridge Next Flow must activate');
const project = nextApi.buildProject(selection, adapter);
assert.ok(project, 'Creative project must build');
assert.equal(project.currentPois.length, 38, 'Creative Project currentPois must contain 38 review targets');
assert.equal(project.selectedPois.length, 38);
assert.equal(project.sourcePois.length, 37, 'Project sourcePois must remain active-only');
assert.equal(project.currentPois.filter(poi => poi.gameStatus === 'INACTIVE').length, 1, 'Inactive status must survive Project build');
assert.equal(project.currentPois.filter(poi => poi.referenceKind === 'INACTIVE_POWERSPOT').length, 1, 'Inactive reference identity must survive Project build');
assert.equal(project.currentPois.filter(poi => poi.referenceKind === 'NOT_IN_GAME').length, 0, 'Not in Game must stay out of Creative Project');
assert.deepEqual([...project.circleRadii], [50, 40, 30]);

assert.equal(nextApi.saveProject(project), true, 'Creative Project must save');
const savedProject = JSON.parse(sessionStorage.getItem('campsiteProject.v1'));
assert.equal(savedProject.currentPois.length, 38, 'Saved Creative Project count changed');
assert.equal(savedProject.currentPois.filter(poi => poi.gameStatus === 'INACTIVE').length, 1);

assert.ok(
  referenceVisualSource.includes("references.filter(poi => poi.referenceKind === 'INACTIVE_POWERSPOT')"),
  'Bridge map must only expose Inactive Power Spot references visually'
);
assert.ok(
  referenceVisualSource.includes('#f3a8c9') && referenceVisualSource.includes('rotate(45deg)'),
  'Inactive Power Spot must retain the light-pink diamond Bridge visual contract'
);
assert.ok(
  creativePatchSource.includes("gameStatus:String(poi.gameStatus||'UNKNOWN')"),
  'Creative loader must preserve gameStatus so INACTIVE remains distinguishable downstream'
);
assert.ok(
  creativePatchSource.includes('Array.isArray(project&&project.currentPois)?project.currentPois'),
  'Creative must load Project currentPois rather than reverting to active-only source data'
);
assert.ok(
  nextFlowSource.includes("location.href = './creative/index.html?campsiteProject=bridge'"),
  'Next Flow must navigate directly into Creative Mode'
);

console.log('Kwajalein Wayfarer -> Creative E2E: OK');
console.log('Wayfarer 42 -> Bridge active 37 + references 5 -> Creative 38');
console.log('Creative targets: 37 ACTIVE + 1 INACTIVE_POWERSPOT; Not in Game 4 retained internally only');
