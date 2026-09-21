import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));
const collector = fs.readFileSync('bridge-pc/page-collector.js', 'utf8');
const content = fs.readFileSync('bridge-pc/content.js', 'utf8');
const receiver = fs.readFileSync('bridge-receiver.html', 'utf8');

assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.version, '0.1.0');
assert.deepEqual(manifest.permissions, []);
assert.deepEqual(manifest.host_permissions.sort(), [
  'https://wayfarer.nianticlabs.com/*',
  'https://wayfarer.scopely.com/*'
]);
assert.equal(manifest.host_permissions.some(value => value.includes('<all_urls>')), false);

const mainWorld = manifest.content_scripts.find(item => item.world === 'MAIN');
const isolatedWorld = manifest.content_scripts.find(item => item.world === 'ISOLATED');
assert.ok(mainWorld?.js?.includes('page-collector.js'), 'MAIN collector missing');
assert.ok(isolatedWorld?.js?.includes('content.js'), 'ISOLATED UI missing');

new vm.Script(collector, { filename: 'bridge-pc/page-collector.js' });
new vm.Script(content, { filename: 'bridge-pc/content.js' });

const listeners = new Map();
const fakeWindow = {
  __campsiteBridgePcCollectorInstalled: false,
  addEventListener(type, fn) { listeners.set(type, fn); },
  dispatchEvent() {}
};
const fakeDocument = { querySelector() { return null; } };
class FakeCustomEvent {
  constructor(type, init = {}) { this.type = type; this.detail = init.detail; }
}
const context = {
  window: fakeWindow,
  document: fakeDocument,
  fetch: async () => { throw new Error('not used'); },
  CustomEvent: FakeCustomEvent,
  console,
  setTimeout,
  clearTimeout,
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
vm.runInContext(collector, context);

const api = fakeWindow.CampsiteBridgePcCollector;
assert.ok(api, 'PC collector API missing');
assert.equal(api.version, '0.1.0');
assert.equal(api.mapDataPath, '/api/v1/vault/mapview/gcs');

const sample = {
  result: {
    data: [
      {
        pois: [
          {
            poiId: 'stop-1',
            title: '公園入口',
            latE6: 35000000,
            lngE6: 139000000,
            gmo: [{ status: 'ACTIVE', entity: 'POKESTOP' }]
          },
          {
            poiId: 'gym-1',
            title: '時計塔',
            latE6: 35000100,
            lngE6: 139000100,
            sponsored: true,
            gmo: [{ status: 'ACTIVE', entity: 'GYM' }]
          },
          {
            poiId: 'power-1',
            title: '広場',
            latE6: 35000200,
            lngE6: 139000200,
            gmo: [{ status: 'ACTIVE', entity: 'POWERSPOT' }]
          },
          {
            poiId: 'inactive-1',
            latE6: 35000300,
            lngE6: 139000300,
            gmo: [{ status: 'INACTIVE', entity: 'POKESTOP' }]
          }
        ]
      },
      {
        pois: [
          {
            poiId: 'stop-1',
            title: '公園入口',
            latE6: 35000000,
            lngE6: 139000000,
            gmo: [{ status: 'ACTIVE', entity: 'POKESTOP' }]
          }
        ]
      }
    ]
  }
};

const pois = api.normalizeMapData(sample);
assert.equal(pois.length, 3, 'Only active Pokémon GO entities should be exported');
assert.equal(pois.find(p => p.guid === 'stop-1')?.gameEntity, 'POKESTOP');
assert.equal(pois.find(p => p.guid === 'gym-1')?.gameEntity, 'GYM');
assert.equal(pois.find(p => p.guid === 'power-1')?.gameEntity, 'POWERSPOT');
assert.equal(pois.find(p => p.guid === 'gym-1')?.sponsored, true);
assert.equal(pois.find(p => p.guid === 'stop-1')?.lat, 35);
assert.equal(pois.find(p => p.guid === 'stop-1')?.lng, 139);
assert.deepEqual([...pois.find(p => p.guid === 'stop-1').provenance], ['WAYFARER_PASSIVE']);

assert.ok(collector.includes('/api/v1/vault/mapview/gcs'));
assert.ok(collector.includes('credentials: \'include\''));
assert.ok(collector.includes("document.querySelector('app-wf-base-map')"));
assert.ok(collector.includes("type: 'CAMPSITE_BRIDGE_POI_V1'"));
assert.ok(collector.includes("data.type === 'CAMPSITE_BRIDGE_READY_V1'"));
assert.ok(collector.includes("data.type === 'CAMPSITE_BRIDGE_ACK_V1'"));
assert.ok(collector.includes("event.origin !== RECEIVER_ORIGIN"));
assert.ok(collector.includes("event.source !== popup"));
assert.ok(collector.includes("String(data.handshakeId || '') !== handshakeId"));
assert.ok(collector.includes("window.open('about:blank'"));
assert.ok(collector.includes('Wayfarer Mapを表示してからもう一度お試しください'));
assert.ok(collector.includes('Wayfarerはこのまま使えます'));
assert.ok(collector.includes("'campsite-bridge-pc:start'"), 'MAIN collector must own the start event');
assert.ok(collector.includes("'campsite-bridge-pc:status'"), 'MAIN collector must report status to the UI');
assert.ok(content.includes("'campsite-bridge-pc:start'"), 'ISOLATED UI must dispatch the start event');
assert.ok(content.includes("'campsite-bridge-pc:status'"), 'ISOLATED UI must listen for status');
assert.equal(content.includes('popup.postMessage'), false, 'ISOLATED UI must not post to Receiver directly');
assert.equal(content.includes('RECEIVER_ORIGIN'), false, 'ISOLATED UI must not own Receiver origin checks');
assert.ok(receiver.includes("'https://wayfarer.scopely.com'"));
assert.ok(receiver.includes("'https://wayfarer.nianticlabs.com'"));

execFileSync(process.execPath, ['scripts/build-pc-bridge.mjs'], { stdio: 'inherit' });
const zip = fs.readFileSync('downloads/campsite-bridge-pc-0.1.0.zip');
assert.ok(zip.length > 1000, 'PC Bridge ZIP is unexpectedly small');
assert.equal(zip.readUInt32LE(0), 0x04034b50, 'PC Bridge output is not a ZIP');
assert.ok(zip.includes(Buffer.from('manifest.json')), 'ZIP must contain manifest.json');
assert.ok(zip.includes(Buffer.from('page-collector.js')), 'ZIP must contain page-collector.js');
assert.ok(zip.includes(Buffer.from('content.js')), 'ZIP must contain content.js');

console.log('Campsite Bridge PC 0.1.0 contract: OK');
