import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/wm3b-tab-link.js', 'utf8');
new vm.Script(source, { filename: 'bridge-pc/wm3b-tab-link.js' });

const bus = [];
class FakeBroadcastChannel {
  constructor(name) {
    this.name = name;
    this.onmessage = null;
    bus.push(this);
  }
  postMessage(data) {
    for (const channel of bus) {
      if (channel === this || channel.name !== this.name) continue;
      channel.onmessage?.({ data });
    }
  }
  close() {}
}

let idCounter = 0;
function makeRuntime() {
  const listeners = new Map();
  const observedPolygons = [];
  let mapVisible = true;
  const fakeWindow = {
    __campsiteWm3bTabLinkInstalled: false,
    CampsiteWayfarerObserveController: {
      getState() { return { busy:false }; },
      async runPolygon(polygon) {
        observedPolygons.push(JSON.parse(JSON.stringify(polygon)));
        return { visibleTotal:1 };
      }
    },
    addEventListener(type, fn) { listeners.set(type, fn); }
  };
  const document = {
    visibilityState: 'visible',
    querySelector(selector) {
      return selector === 'app-wf-base-map' && mapVisible ? {} : null;
    }
  };
  const location = {
    href: 'https://wayfarer.scopely.com/new/mapview?z=16',
    origin: 'https://wayfarer.scopely.com'
  };
  const crypto = {
    randomUUID() {
      idCounter += 1;
      return 'id-' + idCounter;
    }
  };
  const context = vm.createContext({
    window: fakeWindow,
    document,
    location,
    crypto,
    BroadcastChannel: FakeBroadcastChannel,
    console,
    setTimeout,
    clearTimeout,
    Map,
    Set,
    Promise,
    Object,
    String,
    Number,
    Math,
    Date,
    JSON
  });
  vm.runInContext(source, context);
  return {
    fakeWindow,
    listeners,
    observedPolygons,
    setMapPresent(value) { mapVisible = value === true; }
  };
}

const first = makeRuntime();
const second = makeRuntime();

const result = await first.fakeWindow.CampsiteWayfarerTabLink.probeMapTabs(45);
assert.equal(result.verified, true);
assert.equal(result.mapTabCount, 2);
assert.equal(result.duplicateMapTabs, true);

let pong = null;
const sourceWindow = {
  postMessage(message, origin) {
    pong = { message, origin };
  }
};
const handler = first.listeners.get('message');
assert.equal(typeof handler, 'function');

handler({
  origin: 'https://kaityo1221.github.io',
  source: sourceWindow,
  data: {
    type: 'CAMPSITE_WAYFARER_OBSERVE_PING_V1',
    requestId: 'creative-test-1'
  }
});

await new Promise(resolve => setTimeout(resolve, 300));
assert.ok(pong, 'Creative PING must receive a PONG');
assert.equal(pong.origin, 'https://kaityo1221.github.io');
assert.equal(pong.message.type, 'CAMPSITE_WAYFARER_OBSERVE_PONG_V1');
assert.equal(pong.message.requestId, 'creative-test-1');
assert.equal(pong.message.mapPresent, true);
assert.equal(pong.message.tabCountVerified, true);
assert.equal(pong.message.mapTabCount, 2);
assert.equal(pong.message.duplicateMapTabs, true);
assert.ok(String(pong.message.warning).includes('複数タブ'));

const creativePolygon = [[35,139],[35,139.01],[35.01,139.01],[35.01,139]];

pong = null;
handler({
  origin: 'https://kaityo1221.github.io',
  source: sourceWindow,
  data: {
    type: 'CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1',
    requestId: 'observe-blocked-duplicate',
    polygon: creativePolygon
  }
});
await new Promise(resolve => setTimeout(resolve, 300));
assert.ok(pong);
assert.equal(pong.message.type, 'CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1');
assert.equal(pong.message.accepted, false);
assert.ok(String(pong.message.warning).includes('複数タブ'));
assert.equal(first.observedPolygons.length, 0);

second.setMapPresent(false);
pong = null;
handler({
  origin: 'https://kaityo1221.github.io',
  source: sourceWindow,
  data: {
    type: 'CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1',
    requestId: 'observe-accepted-1',
    polygon: creativePolygon
  }
});
await new Promise(resolve => setTimeout(resolve, 300));
assert.ok(pong, 'Creative observation request must receive an acceptance ACK');
assert.equal(pong.message.type, 'CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1');
assert.equal(pong.message.requestId, 'observe-accepted-1');
assert.equal(pong.message.accepted, true);
assert.equal(pong.message.observationStarted, true);
assert.equal(pong.message.polygonVertexCount, 4);
assert.deepEqual(first.observedPolygons[0], creativePolygon);

pong = null;
handler({
  origin: 'https://example.com',
  source: sourceWindow,
  data: {
    type: 'CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1',
    requestId: 'blocked-origin',
    polygon: creativePolygon
  }
});
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(pong, null, 'Untrusted origins must not receive a response');
assert.equal(first.observedPolygons.length, 1);

console.log('WM-3B-0 / WM-3B-2A / WM-3B-2B Wayfarer tab-link: OK');
