import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const fixture = JSON.parse(fs.readFileSync('scripts/fixtures/bridge-poi-engine-regression.json', 'utf8'));
const parserSource = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const classifierSource = fs.readFileSync('bridge-pc/poi-classifier.js', 'utf8');
const referenceSource = fs.readFileSync('bridge-pc/poi-reference-layer.js', 'utf8');
const exporterSource = fs.readFileSync('bridge-pc/bridge-v1-exporter.js', 'utf8');
const receiverHtml = fs.readFileSync('bridge-receiver.html', 'utf8');
const nextFlowSource = fs.readFileSync('js/bridge-next-flow.js', 'utf8');
const creativeHtml = fs.readFileSync('creative/index.html', 'utf8');

const receiverScripts = [...receiverHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(receiverScripts.length > 0, 'Receiver script missing');
const receiverSource = receiverScripts.at(-1)[1];

function storage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(index) { return [...data.keys()][index] ?? null; },
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); }
  };
}

function fakeElement() {
  return {
    textContent: '',
    className: '',
    hidden: false,
    style: {},
    classList: {
      values: new Set(),
      add(value) { this.values.add(value); },
      remove(value) { this.values.delete(value); },
      toggle(value, force) {
        if (force === true) this.values.add(value);
        else if (force === false) this.values.delete(value);
        else if (this.values.has(value)) this.values.delete(value);
        else this.values.add(value);
      }
    },
    addEventListener() {}
  };
}

function makeEngineContext() {
  const listeners = new Map();
  const document = {
    getElementById() { return null; },
    querySelector() { return null; },
    createElement() { return fakeElement(); },
    createDocumentFragment() { return { appendChild() {} }; }
  };
  const window = {
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); }
  };
  const context = {
    window,
    document,
    console,
    setTimeout() { return 1; },
    clearTimeout() {},
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

function makeReceiverContext(handshakeId) {
  const sessionStorage = storage();
  const elements = new Map(
    ['total','pokestop','gym','powerspot','notInGame','inactivePowerSpot','sponsored','smr','status','beforeCount','afterCount','failedCount','duplicateCount','adapterStatus','continueBtn','clearBtn']
      .map(id => [id, fakeElement()])
  );
  const listeners = new Map();
  const body = fakeElement();
  const window = {
    opener: null,
    focus() {},
    addEventListener(type, fn) { listeners.set(type, fn); },
    removeEventListener(type) { listeners.delete(type); }
  };
  const document = {
    body,
    title: '',
    referrer: '',
    getElementById(id) { return elements.get(id) || null; }
  };
  const location = {
    search: '?campsiteBridgeDev=1&handshake=' + encodeURIComponent(handshakeId),
    replaced: '',
    replace(value) { this.replaced = value; }
  };
  const context = {
    window,
    document,
    location,
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
  return { context, window, sessionStorage, location };
}

function makeNextContext(adapter) {
  const sessionStorage = storage();
  const localStorage = storage();
  sessionStorage.setItem('campsiteBridgeAdapter.v0.3', JSON.stringify(adapter));
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
    Object,
    Number,
    String,
    Array
  };
  vm.createContext(context);
  vm.runInContext(nextFlowSource, context);
  return context;
}

const rawWayfarer = fixture.rawWayfarer;
const expected = fixture.expected;

// 1. Raw Wayfarer -> Parser.
const engineContext = makeEngineContext();
const parser = engineContext.window.CampsiteBridgePoiParser;
const classifier = engineContext.window.CampsiteBridgePoiClassifier;
const referenceLayer = engineContext.window.CampsiteBridgePoiReferenceLayer;
const exporter = engineContext.window.CampsiteBridgeV1Exporter;

const parsed = parser.parsePayload(rawWayfarer);
assert.equal(parsed.sourceCount, expected.parser.sourceCount, 'E2E parser source count');
assert.equal(parsed.parsedCount, expected.parser.parsedCount, 'E2E parser valid unique count');
assert.equal(parsed.duplicateCount, expected.parser.duplicateCount, 'E2E parser duplicate count');
assert.equal(parsed.failedCount, expected.parser.failedCount, 'E2E parser failure count');
assert.equal(parsed.pois.find(p => p.guid === 'e2e-stop')?.title, expected.parser.laterDuplicateTitle, 'Later duplicate must win');

// 2. Parser -> Classifier -> Reference Layer.
const classified = classifier.run(parsed);
assert.equal(classified.diagnostics.pokestopCount, expected.classifier.pokestopCount);
assert.equal(classified.diagnostics.gymCount, expected.classifier.gymCount);
assert.equal(classified.diagnostics.powerspotCount, expected.classifier.powerspotCount);
assert.equal(classified.diagnostics.notInGameCount, expected.classifier.notInGameCount);
assert.equal(classified.diagnostics.unknownCount, expected.classifier.unknownCount);
assert.equal(classified.diagnostics.exportCount, expected.classifier.exportCount);
for (const [guid, kind] of Object.entries(expected.kinds)) {
  assert.equal(classified.pois.find(p => p.guid === guid)?.poiKind, kind, `Unexpected POI kind for ${guid}`);
}
assert.equal(classified.pois.find(p => p.guid === 'e2e-inactive')?.gameStatus, expected.inactiveStatus);

const routed = referenceLayer.splitClassified(classified.pois);
assert.equal(routed.activeEnginePois.length, expected.export.count);
assert.equal(routed.referencePois.length, 2);
assert.deepEqual(
  new Set(routed.referencePois.map(p => p.guid)),
  new Set(['e2e-not-in-game', 'e2e-inactive'])
);
assert.ok(routed.referencePois.every(p => p.referenceKind === 'NOT_IN_GAME'));
assert.equal(routed.diagnosticPois.some(p => p.guid === 'e2e-unknown'), true);

// 3. Engine snapshot -> Bridge V1 payload. Bridge does not render POIs.
const handshakeId = 'e2e-raw-wayfarer-to-campsite';
const payload = exporter.makePayload({
  enginePois: routed.activeEnginePois,
  referencePois: routed.referencePois,
  selectedBounds: {
    center: { lat: 35.001, lng: 139.001 },
    zoom: 17,
    sw: { lat: 34.999, lng: 138.999 },
    ne: { lat: 35.006, lng: 139.006 }
  },
  diagnostics: classified.diagnostics,
  classificationDiagnostics: classified.classificationDiagnostics
}, handshakeId, { bridgeVersion: '0.1.0' });

assert.equal(payload.type, 'CAMPSITE_BRIDGE_POI_V1');
assert.equal(payload.bridgePlatform, 'pc');
assert.equal(payload.schemaVersion, '1.2');
assert.equal(payload.handshakeId, handshakeId);
assert.equal(payload.pois.length, expected.export.count, 'Bridge V1 export count');
assert.deepEqual([...payload.pois.map(p => p.guid)].sort(), expected.export.guids);
assert.ok(payload.pois.every(p => p.gameStatus === 'ACTIVE'));
assert.equal(payload.referencePois.length, 2, 'Bridge V1 reference count');
assert.equal(payload.referencePois.some(p => p.guid === 'e2e-unknown'), false, 'UNKNOWN must not leak into referencePois');
assert.equal('diagnostics' in payload, false, 'Internal diagnostics must not leak into Bridge V1');
assert.equal('enginePois' in payload, false, 'Internal Engine POIs must not leak into Bridge V1');

// 4. Bridge V1 -> Receiver -> Campsite adapter.
const receiver = makeReceiverContext(handshakeId);
const received = receiver.window.CampsiteBridgeDevReceive(payload);
assert.equal(received.accepted, true, 'Receiver must accept E2E payload');
assert.equal(received.count, expected.export.count, 'Receiver accepted active count');
assert.equal(received.sourceCount, expected.export.count, 'Receiver active source count');

const adapter = JSON.parse(receiver.sessionStorage.getItem('campsiteBridgeAdapter.v0.3'));
assert.ok(adapter, 'Campsite Adapter must be stored');
assert.equal(adapter.bridgePlatform, 'pc');
assert.equal(adapter.handoffId, 'handshake:' + handshakeId);
assert.equal(adapter.pois.length, expected.export.count);
assert.equal(adapter.referencePois.length, 2, 'Receiver must retain referencePois separately');
assert.deepEqual([...adapter.pois.map(p => p.guid)].sort(), expected.export.guids);
assert.deepEqual(
  new Set(adapter.referencePois.map(p => p.guid)),
  new Set(['e2e-not-in-game', 'e2e-inactive'])
);
assert.equal(receiver.window.CampsiteBridgeGatewayUrl(), './bridge-gateway.html?campsiteBridgeImport=1');

// 5. Campsite adapter -> Project -> Creative entry contract.
const nextContext = makeNextContext(adapter);
const next = nextContext.window.CampsiteBridgeNextFlow;
assert.ok(next, 'Campsite Next flow must activate');

const project = next.buildProject({
  version: '0.8.5',
  handoffId: adapter.handoffId,
  sourceCount: expected.export.count,
  selectedCount: expected.export.count,
  polygon: [
    [34.999, 138.999],
    [35.006, 138.999],
    [35.006, 139.006],
    [34.999, 139.006]
  ],
  pois: adapter.pois
}, adapter);

assert.ok(project, 'Campsite Project must build');
assert.equal(project.source, 'bridge');
assert.equal(project.meta.bridgePlatform, 'pc');
assert.equal(project.meta.bridgeHandoffId, 'handshake:' + handshakeId);
assert.equal(project.currentPois.length, expected.export.count);
assert.deepEqual([...project.currentPois.map(p => p.guid)].sort(), expected.export.guids);
assert.ok(project.currentPois.every(p => p.role === 'existing'));
assert.deepEqual([...project.circleRadii], [50, 40, 30]);
assert.ok(
  creativeHtml.includes("new URLSearchParams(location.search).get('campsiteProject')==='bridge'"),
  'Creative must recognize the Bridge Project entry'
);

console.log(`✓ Raw Wayfarer: ${expected.parser.sourceCount} source records`);
console.log(`✓ Parser: ${expected.parser.parsedCount} unique valid POIs, ${expected.parser.duplicateCount} duplicate`);
console.log(`✓ Classifier: ${expected.classifier.exportCount} active + ${expected.classifier.notInGameCount} Not in Game + ${expected.classifier.unknownCount} Unknown`);
console.log(`✓ Reference Layer: ${routed.referencePois.length} reference POIs separated`);
console.log(`✓ Bridge V1: ${expected.export.count} active POIs + ${payload.referencePois.length} references, no internal diagnostics leaked`);
console.log(`✓ Receiver/Adapter: ${expected.export.count} active + ${adapter.referencePois.length} references retained`);
console.log(`✓ Campsite Project: same ${expected.export.count} active GUIDs preserved`);
console.log('Raw Wayfarer -> Campsite data-only E2E: OK');
