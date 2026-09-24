import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const parserSource = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const classifierSource = fs.readFileSync('bridge-pc/poi-classifier.js', 'utf8');
const displaySource = fs.readFileSync('js/bridge-wayfarer-poi-colors.js', 'utf8');
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
    setInterval() { return 1; },
    clearInterval() {},
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
  vm.runInContext(displaySource, context);
  vm.runInContext(exporterSource, context);
  return context;
}

function makeReceiverContext(handshakeId) {
  const sessionStorage = storage();
  const elements = new Map(
    ['total','pokestop','gym','powerspot','sponsored','smr','status','beforeCount','afterCount','failedCount','duplicateCount','adapterStatus','continueBtn','clearBtn']
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

const rawWayfarer = {
  result: {
    data: [{
      pois: [
        {
          poiId: 'e2e-stop',
          title: '公園入口',
          latE6: 35000000,
          lngE6: 139000000,
          gmo: [{ gameBrand: 'HOLOHOLO', entity: 'POKESTOP', status: 'ACTIVE' }]
        },
        {
          poiId: 'e2e-gym',
          title: '時計塔',
          latE6: 35000100,
          lngE6: 139000100,
          sponsored: true,
          gmo: [{ gameBrand: 'HOLOHOLO', entity: 'GYM', status: 'ACTIVE' }]
        },
        {
          poiId: 'e2e-power',
          title: '広場',
          latE6: 35000200,
          lngE6: 139000200,
          gmo: [{ gameBrand: 'HOLOHOLO', entity: 'POWERSPOT', status: 'ACTIVE' }]
        },
        {
          poiId: 'e2e-not-in-game',
          title: 'ゲーム外POI',
          latE6: 35000300,
          lngE6: 139000300,
          gmo: []
        },
        {
          poiId: 'e2e-inactive',
          title: '旧ポケストップ',
          latE6: 35000400,
          lngE6: 139000400,
          gmo: [{ gameBrand: 'HOLOHOLO', entity: 'POKESTOP', status: 'INACTIVE' }]
        },
        {
          poiId: 'e2e-unknown',
          title: '判定不能POI',
          latE6: 35000500,
          lngE6: 139000500,
          gmo: [{ gameBrand: 'HOLOHOLO', entity: '', status: 'ACTIVE' }]
        },
        {
          poiId: 'e2e-stop',
          title: '公園入口 更新',
          latE6: 35000000,
          lngE6: 139000000,
          gmo: [{ gameBrand: 'HOLOHOLO', entity: 'POKESTOP', status: 'ACTIVE' }]
        }
      ]
    }]
  }
};

// 1. Raw Wayfarer -> Parser.
const engineContext = makeEngineContext();
const parser = engineContext.window.CampsiteBridgePoiParser;
const classifier = engineContext.window.CampsiteBridgePoiClassifier;
const display = engineContext.window.CampsiteBridgePoiColors;
const exporter = engineContext.window.CampsiteBridgeV1Exporter;

const parsed = parser.parsePayload(rawWayfarer);
assert.equal(parsed.sourceCount, 7, 'E2E parser source count');
assert.equal(parsed.parsedCount, 6, 'E2E parser valid unique count');
assert.equal(parsed.duplicateCount, 1, 'E2E parser duplicate count');
assert.equal(parsed.failedCount, 0, 'E2E parser failure count');
assert.equal(parsed.pois.find(p => p.guid === 'e2e-stop')?.title, '公園入口 更新', 'Later duplicate must win');

// 2. Parser -> Classifier.
const classified = classifier.run(parsed);
assert.equal(classified.diagnostics.pokestopCount, 1);
assert.equal(classified.diagnostics.gymCount, 1);
assert.equal(classified.diagnostics.powerspotCount, 1);
assert.equal(classified.diagnostics.notInGameCount, 2);
assert.equal(classified.diagnostics.unknownCount, 1);
assert.equal(classified.diagnostics.exportCount, 3);
assert.equal(classified.pois.find(p => p.guid === 'e2e-not-in-game')?.poiKind, 'NOT_IN_GAME');
assert.equal(classified.pois.find(p => p.guid === 'e2e-inactive')?.gameStatus, 'INACTIVE');
assert.equal(classified.pois.find(p => p.guid === 'e2e-unknown')?.poiKind, 'UNKNOWN');

// 3. Classifier -> Map display model.
// The renderer accepts the same Engine POIs and keeps only the three active display kinds.
const displayedCount = display.update(classified.pois);
assert.equal(displayedCount, 3, 'Map display must contain exactly 3 active Pokémon GO POIs');
assert.equal(display.getState().count, 3, 'Map display state count');
assert.ok(display.getStyle('POKESTOP'), 'PokéStop map style missing');
assert.ok(display.getStyle('GYM'), 'Gym map style missing');
assert.ok(display.getStyle('POWERSPOT'), 'Power Spot map style missing');
assert.equal(display.getStyle('NOT_IN_GAME'), null, 'Not in Game must stay hidden on map');

// 4. Engine snapshot -> Bridge V1 payload.
const handshakeId = 'e2e-raw-wayfarer-to-campsite';
const payload = exporter.makePayload({
  enginePois: classified.pois,
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
assert.equal(payload.pois.length, 3, 'Bridge V1 export count');
assert.deepEqual([...payload.pois.map(p => p.guid)].sort(), ['e2e-gym','e2e-power','e2e-stop']);
assert.ok(payload.pois.every(p => p.gameStatus === 'ACTIVE'));
assert.equal('diagnostics' in payload, false, 'Internal diagnostics must not leak into Bridge V1');
assert.equal('enginePois' in payload, false, 'Internal Engine POIs must not leak into Bridge V1');

// 5. Bridge V1 -> Receiver -> Campsite adapter.
const receiver = makeReceiverContext(handshakeId);
const received = receiver.window.CampsiteBridgeDevReceive(payload);
assert.equal(received.accepted, true, 'Receiver must accept E2E payload');
assert.equal(received.count, 3, 'Receiver accepted count');
assert.equal(received.sourceCount, 3, 'Receiver source count');

const adapter = JSON.parse(receiver.sessionStorage.getItem('campsiteBridgeAdapter.v0.3'));
assert.ok(adapter, 'Campsite Adapter must be stored');
assert.equal(adapter.bridgePlatform, 'pc');
assert.equal(adapter.handoffId, 'handshake:' + handshakeId);
assert.equal(adapter.pois.length, 3);
assert.deepEqual([...adapter.pois.map(p => p.guid)].sort(), ['e2e-gym','e2e-power','e2e-stop']);
assert.equal(receiver.window.CampsiteBridgeGatewayUrl(), './bridge-gateway.html?campsiteBridgeImport=1');

// 6. Campsite adapter -> Project -> Creative entry contract.
const nextContext = makeNextContext(adapter);
const next = nextContext.window.CampsiteBridgeNextFlow;
assert.ok(next, 'Campsite Next flow must activate');

const project = next.buildProject({
  version: '0.8.5',
  handoffId: adapter.handoffId,
  sourceCount: 3,
  selectedCount: 3,
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
assert.equal(project.currentPois.length, 3);
assert.deepEqual([...project.currentPois.map(p => p.guid)].sort(), ['e2e-gym','e2e-power','e2e-stop']);
assert.ok(project.currentPois.every(p => p.role === 'existing'));
assert.deepEqual([...project.circleRadii], [50, 40, 30]);
assert.ok(
  creativeHtml.includes("new URLSearchParams(location.search).get('campsiteProject')==='bridge'"),
  'Creative must recognize the Bridge Project entry'
);

console.log('✓ Raw Wayfarer: 7 source records');
console.log('✓ Parser: 6 unique valid POIs, 1 duplicate');
console.log('✓ Classifier: 3 active + 2 Not in Game + 1 Unknown');
console.log('✓ Map display: 3 active POIs');
console.log('✓ Bridge V1: 3 POIs, no internal diagnostics leaked');
console.log('✓ Receiver/Adapter: 3 POIs accepted');
console.log('✓ Campsite Project: same 3 GUIDs preserved');
console.log('Raw Wayfarer -> Campsite POI Engine E2E: OK');
