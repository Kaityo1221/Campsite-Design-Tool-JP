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
  receiver.includes("(normalized === 'pc' ? '&campsiteBridgeNext=1' : '')"),
  'Only PC routing must append the Next query flag'
);
assert.ok(
  receiver.includes("location.replace(gatewayUrlForPlatform(platform))"),
  'Receiver must use platform-aware Gateway routing'
);

const selectionPos = gateway.indexOf('js/bridge-selection.js?v=10');
const nextPos = gateway.indexOf('js/bridge-next-flow.js?v=7');
assert.ok(selectionPos >= 0, 'Gateway must load Bridge selection');
assert.ok(nextPos > selectionPos, 'Gateway must load Next flow after Bridge selection');

assert.ok(
  selection.includes("params.get('campsiteBridgeNext') === '1'"),
  'Polygon selection must recognize the per-session Next query flag'
);
assert.ok(
  nextFlow.includes("params.get('campsiteBridgeNext') === '1'"),
  'Next flow must recognize the per-session Next query flag'
);

const sessionStorage = storage();
const localStorage = storage(); // Intentionally no global Preview flag.
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
    search: '?campsiteBridgeImport=1&campsiteBridgeNext=1',
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
  'PC query flag must start Next flow even when the global Preview flag is OFF'
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
assert.equal(project.currentPois.length, 3);
assert.equal(project.polygon.length, 4);

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
