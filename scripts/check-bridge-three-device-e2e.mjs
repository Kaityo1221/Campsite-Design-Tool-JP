import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const receiverHtml = fs.readFileSync('bridge-receiver.html', 'utf8');
const nextFlow = fs.readFileSync('js/bridge-next-flow.js', 'utf8');
const creativePatch = fs.readFileSync('creative/bridge-project-patch.js', 'utf8');

const scriptMatches = [...receiverHtml.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(scriptMatches.length > 0, 'Receiver script missing');
const receiverScript = scriptMatches.at(-1)[1];

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

function makeReceiverContext(handshakeId) {
  const sessionStorage = storage();
  const elements = new Map(
    ['total','pokestop','gym','powerspot','sponsored','smr','status','beforeCount','afterCount','failedCount','duplicateCount','adapterStatus','continueBtn','clearBtn']
      .map(id => [id, fakeElement()])
  );
  const body = fakeElement();
  const listeners = new Map();
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
    setTimeout(fn) { return 1; },
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
  vm.runInContext(receiverScript, context);
  return { context, sessionStorage, elements, location, window };
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
  vm.runInContext(nextFlow, context);
  return { context, sessionStorage };
}

function basePois(prefix) {
  return [
    {
      guid: prefix + '-stop',
      title: '公園入口',
      lat: 35.0000,
      lng: 139.0000,
      gameEntity: 'POKESTOP',
      gameStatus: 'ACTIVE',
      sponsored: false,
      smr: false,
      provenance: ['WAYFARER_PASSIVE']
    },
    {
      guid: prefix + '-gym',
      title: '時計塔',
      lat: 35.0010,
      lng: 139.0010,
      gameEntity: 'GYM',
      gameStatus: 'ACTIVE',
      sponsored: true,
      smr: true,
      provenance: ['WAYFARER_PASSIVE']
    },
    {
      guid: prefix + '-power',
      title: '広場',
      lat: 35.0020,
      lng: 139.0020,
      gameEntity: 'POWERSPOT',
      gameStatus: 'ACTIVE',
      sponsored: false,
      smr: null,
      provenance: ['WAYFARER_PASSIVE']
    }
  ];
}

const profiles = [
  {
    name: 'iPhone / iPad Shortcut 1.0.0',
    expectedPlatform: '',
    payload: {
      type: 'CAMPSITE_BRIDGE_POI_V1',
      schemaVersion: '1.4',
      bridgeVersion: '1.0.0',
      handshakeId: 'e2e-apple',
      autoContinue: true,
      pois: basePois('apple')
    }
  },
  {
    name: 'Android Firefox M3.4 / 0.3.4 compatibility',
    expectedPlatform: '',
    payload: {
      type: 'CAMPSITE_BRIDGE_POI_V1',
      schemaVersion: '1.2',
      bridgeVersion: '0.3.4',
      handshakeId: 'e2e-android',
      autoContinue: true,
      pois: basePois('android')
    }
  },
  {
    name: 'PC Chrome 0.1.0',
    expectedPlatform: 'pc',
    payload: {
      type: 'CAMPSITE_BRIDGE_POI_V1',
      schemaVersion: '1.2',
      bridgeVersion: '0.1.0',
      bridgePlatform: 'pc',
      handshakeId: 'e2e-pc',
      autoContinue: true,
      selectedBounds: {
        center: { lat: 35.001, lng: 139.001 },
        zoom: 17
      },
      pois: basePois('pc')
    }
  }
];

for (const profile of profiles) {
  const receiver = makeReceiverContext(profile.payload.handshakeId);
  const result = receiver.window.CampsiteBridgeDevReceive(profile.payload);

  assert.equal(result.accepted, true, profile.name + ': Receiver must accept payload');
  assert.equal(result.count, 3, profile.name + ': Receiver must keep all 3 POIs');

  const adapter = JSON.parse(receiver.sessionStorage.getItem('campsiteBridgeAdapter.v0.3'));
  assert.ok(adapter, profile.name + ': Adapter must be saved');
  assert.equal(adapter.pois.length, 3, profile.name + ': Adapter POI count');
  assert.equal(adapter.bridgePlatform, profile.expectedPlatform, profile.name + ': platform compatibility');
  assert.equal(adapter.handoffId, 'handshake:' + profile.payload.handshakeId, profile.name + ': handoff id');

  assert.equal(receiver.window.CampsiteBridgeGatewayUrl(), './bridge-gateway.html?campsiteBridgeImport=1');

  const next = makeNextContext(adapter);
  const api = next.context.window.CampsiteBridgeNextFlow;
  assert.ok(api, profile.name + ': standard Bridge import must activate Next');

  const selection = {
    version: '0.8.5',
    handoffId: adapter.handoffId,
    sourceCount: 3,
    selectedCount: 3,
    polygon: [
      [34.999, 138.999],
      [35.004, 138.999],
      [35.004, 139.004],
      [34.999, 139.004]
    ],
    pois: adapter.pois
  };

  const project = api.buildProject(selection, adapter);
  assert.ok(project, profile.name + ': Project must build');
  assert.equal(project.source, 'bridge');
  assert.equal(project.currentPois.length, 3);
  assert.equal(project.selectedPois.length, 3);
  assert.equal(project.meta.bridgeHandoffId, adapter.handoffId);
  assert.equal(project.meta.bridgePlatform, profile.expectedPlatform);
  assert.equal(project.meta.flowMode, 'next');
  assert.equal(project.meta.preview, false);
  assert.deepEqual([...project.circleRadii], [50, 40, 30]);
  assert.ok(project.currentPois.every(poi => poi.role === 'existing'));

  console.log('✓ ' + profile.name + ': Receiver -> Adapter -> Project');
}

assert.ok(
  nextFlow.includes("location.href = './creative/index.html?campsiteProject=bridge'"),
  'Project flow must enter Creative'
);
assert.ok(
  creativePatch.includes("if(q.get('campsiteProject')!=='bridge')return"),
  'Creative patch must only autostart for Bridge projects'
);
assert.ok(
  creativePatch.includes('Array.isArray(project&&project.currentPois)?project.currentPois'),
  'Creative must restore the latest Project POIs'
);
assert.ok(
  creativePatch.includes("location.href='../bridge-distance.html?campsiteProject=bridge'"),
  'Creative Next must continue to the distance step'
);

console.log('Three-device Bridge E2E contract: OK');
