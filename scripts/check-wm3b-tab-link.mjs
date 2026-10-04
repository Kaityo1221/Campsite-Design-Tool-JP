import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/wm3b-tab-link.js', 'utf8');
new vm.Script(source, { filename:'bridge-pc/wm3b-tab-link.js' });

for (const token of [
  'campsiteWm3bDiagBadge',
  'CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1',
  'CAMPSITE_WAYFARER_OBSERVE_RESULT_V1',
  'CAMPSITE_EXTENSION_TO_WAYFARER_MAIN_V1',
  'CAMPSITE_WAYFARER_MAIN_TO_EXTENSION_V1',
  '/ RESULT送信済み'
]) {
  assert.ok(source.includes(token), 'missing token: ' + token);
}

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
  const observationResult = {
    version:'0.1.0',
    observedAt:'2026-10-02T00:00:00.000Z',
    polygon:null,
    counts:{
      interior:{ total:1, active:1, inactive:0 },
      reference100:{ total:1, active:1, inactive:0 },
      reserve200:{ total:1, active:1, inactive:0 }
    },
    zones:{
      interior:[{ guid:'inside-1', observationZone:'INTERIOR' }],
      reference100:[{ guid:'outer-1', observationZone:'REFERENCE_100' }],
      reserve200:[{ guid:'reserve-1', observationZone:'RESERVE_200' }]
    },
    visibleTotal:2,
    retainedTotal:3,
    excludedCount:0,
    outsideCount:0,
    canProceed:true,
    acquisition:{
      bufferMeters:200,
      tileCount:2,
      transportComplete:true,
      coverageComplete:true,
      coverageStatus:'complete',
      sourceComplete:true
    }
  };

  const fakeWindow = {
    __campsiteWm3bTabLinkInstalled:false,
    CampsiteWayfarerObserveController:{
      getState() { return { busy:false }; },
      async runPolygon(polygon) {
        const copy = JSON.parse(JSON.stringify(polygon));
        observedPolygons.push(copy);
        return { ...JSON.parse(JSON.stringify(observationResult)), polygon:copy };
      }
    },
    addEventListener(type, fn) { listeners.set(type, fn); },
    postMessage() {}
  };

  const document = {
    visibilityState:'visible',
    querySelector(selector) {
      return selector === 'app-wf-base-map' && mapVisible ? {} : null;
    },
    getElementById() { return null; }
  };
  const location = {
    href:'https://wayfarer.scopely.com/new/mapview?z=16',
    origin:'https://wayfarer.scopely.com'
  };
  const crypto = {
    randomUUID() {
      idCounter += 1;
      return 'id-' + idCounter;
    }
  };
  const context = vm.createContext({
    window:fakeWindow,
    document,
    location,
    crypto,
    BroadcastChannel:FakeBroadcastChannel,
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

const duplicate = await first.fakeWindow.CampsiteWayfarerTabLink.probeMapTabs(45);
assert.equal(duplicate.verified, true);
assert.equal(duplicate.mapTabCount, 2);
assert.equal(duplicate.duplicateMapTabs, true);

const responses = [];
const sourceWindow = {
  postMessage(message, origin) {
    responses.push({ message:JSON.parse(JSON.stringify(message)), origin });
  }
};
const handler = first.listeners.get('message');
assert.equal(typeof handler, 'function');

handler({
  origin:'https://kaityo1221.github.io',
  source:sourceWindow,
  data:{
    type:'CAMPSITE_WAYFARER_OBSERVE_PING_V1',
    requestId:'creative-test-1'
  }
});
await new Promise(resolve => setTimeout(resolve, 300));
const pong = responses.find(item => item.message.type === 'CAMPSITE_WAYFARER_OBSERVE_PONG_V1');
assert.ok(pong);
assert.equal(pong.origin, 'https://kaityo1221.github.io');
assert.equal(pong.message.requestId, 'creative-test-1');
assert.equal(pong.message.duplicateMapTabs, true);

responses.length = 0;
const creativePolygon = [[35,139],[35,139.01],[35.01,139.01],[35.01,139]];
handler({
  origin:'https://kaityo1221.github.io',
  source:sourceWindow,
  data:{
    type:'CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1',
    requestId:'observe-blocked-duplicate',
    polygon:creativePolygon
  }
});
await new Promise(resolve => setTimeout(resolve, 300));
assert.equal(responses.length, 1);
assert.equal(responses[0].message.type, 'CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1');
assert.equal(responses[0].message.accepted, false);
assert.equal(first.observedPolygons.length, 0);

second.setMapPresent(false);
responses.length = 0;
handler({
  origin:'https://kaityo1221.github.io',
  source:sourceWindow,
  data:{
    type:'CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1',
    requestId:'observe-result-1',
    polygon:creativePolygon
  }
});
await new Promise(resolve => setTimeout(resolve, 350));

const accepted = responses.find(item =>
  item.message.type === 'CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1'
);
const result = responses.find(item =>
  item.message.type === 'CAMPSITE_WAYFARER_OBSERVE_RESULT_V1'
);
assert.ok(accepted, 'observation must ACK before final result');
assert.equal(accepted.message.accepted, true);
assert.equal(accepted.message.observationStarted, true);
assert.ok(result, 'observation must return a final RESULT');
assert.equal(result.message.ok, true);
assert.equal(result.message.requestId, 'observe-result-1');
assert.equal(result.message.result.visibleTotal, 2);
assert.equal(result.message.result.retainedTotal, 3);
assert.equal(JSON.stringify(result.message.result.polygon), JSON.stringify(creativePolygon));
assert.equal(JSON.stringify(first.observedPolygons[0]), JSON.stringify(creativePolygon));
assert.ok(
  responses.findIndex(item => item.message.type === 'CAMPSITE_WAYFARER_OBSERVE_ACCEPTED_V1') <
  responses.findIndex(item => item.message.type === 'CAMPSITE_WAYFARER_OBSERVE_RESULT_V1'),
  'ACK must precede RESULT'
);

responses.length = 0;
handler({
  origin:'https://example.com',
  source:sourceWindow,
  data:{
    type:'CAMPSITE_WAYFARER_OBSERVE_REQUEST_V1',
    requestId:'blocked-origin',
    polygon:creativePolygon
  }
});
await new Promise(resolve => setTimeout(resolve, 20));
assert.equal(responses.length, 0, 'untrusted origin must not receive a response');

console.log('WM-3B-2C Wayfarer ACK + RESULT contract: OK');
