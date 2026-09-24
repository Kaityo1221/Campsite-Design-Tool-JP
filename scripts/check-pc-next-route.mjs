import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const collector = fs.readFileSync('bridge-pc/page-collector.js', 'utf8');
const receiver = fs.readFileSync('bridge-receiver.html', 'utf8');
const gateway = fs.readFileSync('bridge-gateway.html', 'utf8');
const selection = fs.readFileSync('js/bridge-selection.js', 'utf8');
const nextFlow = fs.readFileSync('js/bridge-next-flow.js', 'utf8');
const creative = fs.readFileSync('creative/index.html', 'utf8');

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

assert.ok(
  collector.includes("bridgePlatform: 'pc'"),
  'PC Bridge payload must declare bridgePlatform=pc'
);
assert.ok(
  receiver.includes("bridgePlatform: String(data.bridgePlatform || '').trim().toLowerCase()"),
  'Receiver must retain bridgePlatform from payload'
);
assert.ok(
  receiver.includes("bridgePlatform: String(payload?.bridgePlatform || '').trim().toLowerCase()"),
  'Receiver Adapter must retain bridgePlatform'
);
assert.ok(
  receiver.includes("return './bridge-gateway.html?campsiteBridgeImport=1'"),
  'All Bridge platforms must share the same Gateway URL'
);
assert.ok(
  receiver.includes("location.replace(gatewayUrl())"),
  'Receiver must use the shared Gateway route'
);

const selectionPos = gateway.indexOf('js/bridge-selection.js?v=12');
const nextPos = gateway.indexOf('js/bridge-next-flow.js?v=10');
assert.ok(selectionPos >= 0, 'Gateway must load Bridge selection');
assert.ok(nextPos > selectionPos, 'Gateway must load Next flow after Bridge selection');

assert.ok(
  selection.includes("const LEGACY_FALLBACK_KEY = 'campsiteBridgeLegacyFlow.v1'"),
  'Selection must keep the hidden legacy fallback'
);
assert.ok(
  nextFlow.includes("const LEGACY_FALLBACK_KEY = 'campsiteBridgeLegacyFlow.v1'"),
  'Next flow must keep the hidden legacy fallback'
);

const sessionStorage = storage();
const localStorage = storage(); // No Preview flag: Next is the default.
sessionStorage.setItem('campsiteBridgeAdapter.v0.3', JSON.stringify({
  version: '0.8.9.4',
  adaptedAt: '2026-09-21T12:00:00.000Z',
  handoffId: 'handshake:pc-route',
  bridgePlatform: 'pc',
  sourceCount: 3,
  pois: [
    { guid:'stop', title:'Stop', lat:35.0, lng:139.0, gameEntity:'POKESTOP', gameStatus:'ACTIVE' },
    { guid:'gym', title:'Gym', lat:35.001, lng:139.001, gameEntity:'GYM', gameStatus:'ACTIVE' },
    { guid:'power', title:'Power', lat:35.002, lng:139.002, gameEntity:'POWERSPOT', gameStatus:'ACTIVE' }
  ]
}));

const context = {
  window: {},
  location: {
    search: '?campsiteBridgeImport=1',
    href: ''
  },
  sessionStorage,
  localStorage,
  document: {
    addEventListener() {},
    getElementById() { return null; }
  },
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

const api = context.window.CampsiteBridgeNextFlow;
assert.ok(
  api,
  'PC Bridge must start Next with only the standard Bridge import flag'
);

const project = api.buildProject({
  version: '0.8.5',
  handoffId: 'handshake:pc-route',
  sourceCount: 3,
  selectedCount: 3,
  polygon: [
    [34.999, 138.999],
    [35.004, 138.999],
    [35.004, 139.004],
    [34.999, 139.004]
  ],
  pois: [
    { guid:'stop', title:'Stop', lat:35.0, lng:139.0, gameEntity:'POKESTOP', gameStatus:'ACTIVE' },
    { guid:'gym', title:'Gym', lat:35.001, lng:139.001, gameEntity:'GYM', gameStatus:'ACTIVE' },
    { guid:'power', title:'Power', lat:35.002, lng:139.002, gameEntity:'POWERSPOT', gameStatus:'ACTIVE' }
  ]
}, JSON.parse(sessionStorage.getItem('campsiteBridgeAdapter.v0.3')));

assert.ok(project, 'PC Bridge selection must create a Project');
assert.equal(project.source, 'bridge');
assert.equal(project.meta.bridgePlatform, 'pc');
assert.equal(project.meta.bridgeHandoffId, 'handshake:pc-route');
assert.equal(project.meta.flowMode, 'next');
assert.equal(project.meta.preview, false);
assert.equal(project.currentPois.length, 3);
assert.equal(project.polygon.length, 4);
assert.equal(typeof api.saveProject, 'function', 'Next flow must expose storage recovery save');

assert.ok(
  nextFlow.includes("location.href = './creative/index.html?campsiteProject=bridge'"),
  'Next flow must navigate directly to Bridge Creative'
);
assert.ok(
  creative.includes("new URLSearchParams(location.search).get('campsiteProject')==='bridge'"),
  'Creative must recognize Bridge Project entry'
);
assert.ok(
  creative.includes('html=window.applyCreativeBridgeProjectPatch(html)'),
  'Creative must apply the Bridge Project patch'
);

console.log('PC Receiver -> Gateway -> Project -> Creative route: OK');
