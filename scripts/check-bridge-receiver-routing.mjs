import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const html = fs.readFileSync('bridge-receiver.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
assert.ok(scripts.length > 0, 'Receiver inline script missing');
const receiverSource = scripts.at(-1)[1];

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
  const values = new Set();
  return {
    textContent: '',
    className: '',
    style: {},
    classList: {
      values,
      add(...items) { for (const item of items) values.add(item); },
      remove(...items) { for (const item of items) values.delete(item); },
      contains(item) { return values.has(item); }
    },
    addEventListener() {}
  };
}

function makeContext(handshakeId = 'receiver-route-test') {
  const sessionStorage = storage();
  const elements = new Map(
    ['total','pokestop','gym','powerspot','notInGame','inactivePowerSpot','sponsored','smr','status','beforeCount','afterCount','failedCount','duplicateCount','adapterStatus','continueBtn','clearBtn']
      .map(id => [id, fakeElement()])
  );
  const body = fakeElement();
  const listeners = new Map();
  const timers = new Map();
  let nextTimerId = 1;

  const setTimeoutFake = (fn, delay = 0) => {
    const id = nextTimerId++;
    timers.set(id, { fn, delay:Number(delay || 0), cleared:false });
    return id;
  };
  const clearTimeoutFake = id => {
    const timer = timers.get(id);
    if (timer) timer.cleared = true;
  };

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
    search: `?campsiteBridgeDev=1&handshake=${encodeURIComponent(handshakeId)}`,
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
    setTimeout: setTimeoutFake,
    clearTimeout: clearTimeoutFake,
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
  return { context, window, document, location, elements, listeners, timers };
}

function dispatch(receiver, payload) {
  const listener = receiver.listeners.get('message');
  assert.equal(typeof listener, 'function', 'Receiver message listener missing');
  const acks = [];
  listener({
    origin: 'https://wayfarer.scopely.com',
    data: payload,
    source: { postMessage(value) { acks.push(value); } }
  });
  return acks;
}

function runTimerByDelay(receiver, delay) {
  const match = [...receiver.timers.values()].find(timer => timer.delay === delay && !timer.cleared);
  if (!match) return false;
  match.fn();
  return true;
}

const clean = makeContext('clean-route');
const cleanPayload = {
  type: 'CAMPSITE_BRIDGE_POI_V1',
  schemaVersion: '1.2',
  bridgeVersion: '0.1.0',
  bridgePlatform: 'pc',
  handshakeId: 'clean-route',
  pois: [
    { guid:'active-1', title:'Active', lat:35, lng:139, gameEntity:'POKESTOP', gameStatus:'ACTIVE', provenance:['WAYFARER_PASSIVE'] }
  ],
  referencePois: [
    { guid:'inactive-power-1', title:'Inactive Power', lat:35.001, lng:139.001, referenceKind:'INACTIVE_POWERSPOT', gameEntity:'POWERSPOT', gameStatus:'INACTIVE', provenance:['WAYFARER_PASSIVE'] }
  ]
};
const cleanAcks = dispatch(clean, cleanPayload);
assert.equal(clean.window.CampsiteBridgeAdapter.integrity.requiresReview, false, 'Clean payload must not require review');
assert.equal(clean.document.body.classList.contains('bridge-receiver-detail'), false, 'Clean payload must keep Receiver detail hidden');
assert.equal(cleanAcks[0]?.accepted, true);
assert.equal(cleanAcks[0]?.requiresReview, false);
assert.equal(runTimerByDelay(clean, 450), true, 'Clean payload must schedule automatic handoff');
assert.equal(clean.location.replaced, './bridge-gateway.html?campsiteBridgeImport=1', 'Clean payload must auto-route to Campsite');
assert.equal(
  [...clean.timers.values()].some(timer => timer.delay === 2500 && !timer.cleared),
  false,
  'Clean payload must cancel delayed Receiver detail display'
);

const conflict = makeContext('conflict-route');
const conflictPayload = {
  ...cleanPayload,
  handshakeId: 'conflict-route',
  pois: [
    { guid:'same-guid', title:'Active wins', lat:35, lng:139, gameEntity:'GYM', gameStatus:'ACTIVE', provenance:['WAYFARER_PASSIVE'] }
  ],
  referencePois: [
    { guid:'same-guid', title:'Conflicting reference', lat:35, lng:139, referenceKind:'NOT_IN_GAME', gameEntity:'', gameStatus:'UNKNOWN', provenance:['WAYFARER_PASSIVE'] }
  ]
};
const conflictAcks = dispatch(conflict, conflictPayload);
assert.equal(conflict.window.CampsiteBridgeAdapter.integrity.requiresReview, true, 'Cross-channel GUID conflict must require review');
assert.equal(conflict.window.CampsiteBridgeAdapter.integrity.crossChannelDuplicateCount, 1);
assert.equal(conflict.window.CampsiteBridgeAdapter.referencePois.length, 0, 'Active GUID ownership must win');
assert.equal(conflict.document.body.classList.contains('bridge-receiver-detail'), true, 'Conflict must reveal Receiver detail');
assert.equal(conflictAcks[0]?.accepted, true, 'Recoverable conflict is received successfully');
assert.equal(conflictAcks[0]?.requiresReview, true, 'ACK must tell sender review is required');
assert.equal(
  [...conflict.timers.values()].some(timer => timer.delay === 450 && !timer.cleared),
  false,
  'Conflict must not schedule automatic handoff'
);
assert.equal(conflict.location.replaced, '', 'Conflict must stay on Receiver until user confirms');

const invalidReference = makeContext('invalid-reference-route');
const invalidReferencePayload = {
  ...cleanPayload,
  handshakeId: 'invalid-reference-route',
  referencePois: [
    { guid:'bad-ref', title:'Bad ref', lat:35.1, lng:139.1, referenceKind:'UNKNOWN_KIND', gameStatus:'UNKNOWN' }
  ]
};
const invalidAcks = dispatch(invalidReference, invalidReferencePayload);
assert.equal(invalidReference.window.CampsiteBridgeAdapter.integrity.invalidReferenceCount, 1);
assert.equal(invalidReference.window.CampsiteBridgeAdapter.integrity.requiresReview, true);
assert.equal(invalidReference.document.body.classList.contains('bridge-receiver-detail'), true);
assert.equal(invalidAcks[0]?.requiresReview, true);
assert.equal(invalidReference.location.replaced, '');

console.log('Bridge Receiver routing regression: OK');
console.log('clean -> hidden Receiver -> automatic Campsite handoff');
console.log('integrity anomaly -> Receiver detail -> manual confirmation');
