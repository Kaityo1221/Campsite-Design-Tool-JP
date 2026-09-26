import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const manifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));
const mapAdapterSource = fs.readFileSync('js/bridge-wayfarer-map-adapter.js', 'utf8');
const parserSource = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const classifierSource = fs.readFileSync('bridge-pc/poi-classifier.js', 'utf8');
const referenceSource = fs.readFileSync('bridge-pc/poi-reference-layer.js', 'utf8');
const exporterSource = fs.readFileSync('bridge-pc/bridge-v1-exporter.js', 'utf8');
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
assert.ok(mainWorld?.js?.includes('wayfarer-map-adapter.js'), 'MAIN Wayfarer map adapter missing');
assert.ok(mainWorld?.js?.includes('poi-parser.js'), 'MAIN parser missing');
assert.ok(mainWorld?.js?.includes('poi-classifier.js'), 'MAIN classifier missing');
assert.ok(mainWorld?.js?.includes('poi-reference-layer.js'), 'MAIN reference layer missing');
assert.ok(mainWorld?.js?.includes('bridge-v1-exporter.js'), 'MAIN Bridge V1 exporter missing');
assert.ok(mainWorld?.js?.includes('page-collector.js'), 'MAIN collector missing');
assert.ok(mainWorld.js.indexOf('wayfarer-map-adapter.js') < mainWorld.js.indexOf('page-collector.js'), 'Map adapter must load before collector');
assert.ok(mainWorld.js.indexOf('poi-parser.js') < mainWorld.js.indexOf('poi-classifier.js'), 'Parser must load before classifier');
assert.ok(mainWorld.js.indexOf('poi-classifier.js') < mainWorld.js.indexOf('poi-reference-layer.js'), 'Classifier must load before reference layer');
assert.ok(mainWorld.js.indexOf('poi-reference-layer.js') < mainWorld.js.indexOf('bridge-v1-exporter.js'), 'Reference layer must load before exporter');
assert.ok(mainWorld.js.indexOf('bridge-v1-exporter.js') < mainWorld.js.indexOf('page-collector.js'), 'Exporter must load before collector');
assert.ok(isolatedWorld?.js?.includes('content.js'), 'ISOLATED UI missing');

new vm.Script(mapAdapterSource, { filename: 'js/bridge-wayfarer-map-adapter.js' });
new vm.Script(parserSource, { filename: 'bridge-pc/poi-parser.js' });
new vm.Script(classifierSource, { filename: 'bridge-pc/poi-classifier.js' });
new vm.Script(referenceSource, { filename: 'bridge-pc/poi-reference-layer.js' });
new vm.Script(exporterSource, { filename: 'bridge-pc/bridge-v1-exporter.js' });
new vm.Script(collector, { filename: 'bridge-pc/page-collector.js' });
new vm.Script(content, { filename: 'bridge-pc/content.js' });

const listeners = new Map();
const fakeWindow = {
  __campsiteBridgeWayfarerMapAdapterInstalled: false,
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
vm.runInContext(mapAdapterSource, context);
vm.runInContext(parserSource, context);
vm.runInContext(classifierSource, context);
vm.runInContext(referenceSource, context);
vm.runInContext(exporterSource, context);
vm.runInContext(collector, context);

const api = fakeWindow.CampsiteBridgePcCollector;
assert.ok(api, 'PC collector API missing');
assert.equal(api.version, '0.1.0');
assert.equal(api.mapDataPath, '/api/v1/vault/mapview/gcs');
assert.ok(fakeWindow.CampsiteBridgeWayfarerMapAdapter, 'Wayfarer map adapter API missing');
assert.ok(fakeWindow.CampsiteBridgePoiParser, 'POI parser API missing');
assert.ok(fakeWindow.CampsiteBridgePoiClassifier, 'POI classifier API missing');
assert.ok(fakeWindow.CampsiteBridgePoiReferenceLayer, 'POI reference layer API missing');
assert.ok(fakeWindow.CampsiteBridgeV1Exporter, 'Bridge V1 exporter API missing');
assert.equal(typeof api.classifyMapData, 'function', 'Collector must expose classification stage');
assert.equal(api.findMap(), null, 'Collector should fail quietly when Wayfarer map host is absent');

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
            title: '旧ポケストップ',
            latE6: 35000300,
            lngE6: 139000300,
            gmo: [{ status: 'INACTIVE', entity: 'POKESTOP' }]
          },
          {
            poiId: 'inactive-power-1',
            title: '休止パワースポット',
            latE6: 35000350,
            lngE6: 139000350,
            gmo: [{ status: 'INACTIVE', entity: 'POWERSPOT' }]
          },
          {
            poiId: 'portal-only-1',
            title: 'ゲーム外POI',
            latE6: 35000400,
            lngE6: 139000400,
            gmo: []
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

const parsed = api.parseMapData(sample);
assert.equal(parsed.sourceCount, 7);
assert.equal(parsed.parsedCount, 6);
assert.equal(parsed.duplicateCount, 1);
assert.equal(parsed.failedCount, 0);

const engine = api.classifyMapData(sample);
assert.equal(engine.pois.find(p => p.guid === 'portal-only-1')?.poiKind, 'NOT_IN_GAME');
assert.equal(engine.pois.find(p => p.guid === 'inactive-1')?.poiKind, 'NOT_IN_GAME');
assert.equal(engine.pois.find(p => p.guid === 'inactive-1')?.gameStatus, 'INACTIVE');
assert.equal(engine.pois.find(p => p.guid === 'inactive-power-1')?.referenceKind, 'INACTIVE_POWERSPOT');
assert.equal(engine.diagnostics.sourceCount, 7);
assert.equal(engine.diagnostics.validCount, 6);
assert.equal(engine.diagnostics.duplicateCount, 1);
assert.equal(engine.diagnostics.exportCount, 3);

const routed = fakeWindow.CampsiteBridgePoiReferenceLayer.splitClassified(engine.pois);
assert.equal(routed.activeEnginePois.length, 3);
assert.equal(routed.referencePois.length, 3);
assert.equal(routed.referencePois.find(p => p.guid === 'inactive-power-1')?.referenceKind, 'INACTIVE_POWERSPOT');
assert.equal(routed.referencePois.find(p => p.guid === 'portal-only-1')?.referenceKind, 'NOT_IN_GAME');

const pois = api.normalizeMapData(sample);
assert.equal(pois.length, 3, 'Only active supported Pokémon GO entities should be exported');
assert.equal(pois.find(p => p.guid === 'stop-1')?.gameEntity, 'POKESTOP');
assert.equal(pois.find(p => p.guid === 'gym-1')?.gameEntity, 'GYM');
assert.equal(pois.find(p => p.guid === 'power-1')?.gameEntity, 'POWERSPOT');
assert.equal(pois.find(p => p.guid === 'gym-1')?.sponsored, true);
assert.equal(pois.find(p => p.guid === 'stop-1')?.lat, 35);
assert.equal(pois.find(p => p.guid === 'stop-1')?.lng, 139);
assert.deepEqual([...pois.find(p => p.guid === 'stop-1').provenance], ['WAYFARER_PASSIVE']);
assert.equal(pois.some(p => p.guid === 'portal-only-1'), false, 'NOT_IN_GAME must not enter Bridge V1 active pois');
assert.equal(pois.some(p => p.guid === 'inactive-1'), false, 'INACTIVE must not enter Bridge V1 active pois');
assert.equal(pois.some(p => p.guid === 'inactive-power-1'), false, 'Inactive Power Spot must remain reference-only');

const bridgePayload = api.makePayload({
  enginePois: engine.pois,
  referencePois: routed.referencePois,
  selectedBounds: {
    center: { lat: 35, lng: 139 },
    zoom: 16,
    sw: { lat: 34.9, lng: 138.9 },
    ne: { lat: 35.1, lng: 139.1 }
  },
  diagnostics: { mustNotLeak: true }
}, 'pc-contract-test');
assert.equal(bridgePayload.type, 'CAMPSITE_BRIDGE_POI_V1');
assert.equal(bridgePayload.bridgePlatform, 'pc');
assert.equal(bridgePayload.schemaVersion, '1.2');
assert.equal(bridgePayload.handshakeId, 'pc-contract-test');
assert.equal(bridgePayload.pois.length, 3);
assert.equal(bridgePayload.referencePois.length, 3);
assert.equal(bridgePayload.referencePois.find(p => p.guid === 'inactive-power-1')?.referenceKind, 'INACTIVE_POWERSPOT');
assert.equal('enginePois' in bridgePayload, false);
assert.equal('diagnostics' in bridgePayload, false);
assert.ok(bridgePayload.pois.every(p => p.gameStatus === 'ACTIVE'));

assert.ok(collector.includes('/api/v1/vault/mapview/gcs'));
assert.ok(collector.includes('credentials: \'include\''));
assert.ok(collector.includes('CampsiteBridgeWayfarerMapAdapter'), 'Collector must use the shared Wayfarer map adapter');
assert.equal(collector.includes("document.querySelector('app-wf-base-map')"), false, 'Collector must not scan Wayfarer Angular context directly');
assert.ok(collector.includes('CampsiteBridgePoiReferenceLayer'), 'Collector must use the Reference Layer');
assert.ok(collector.includes('CampsiteBridgeV1Exporter'), 'Collector must use the V1 exporter');
assert.ok(exporterSource.includes("const PROTOCOL = 'CAMPSITE_BRIDGE_POI_V1'"));
assert.ok(exporterSource.includes("const PLATFORM = 'pc'"));
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
assert.ok(receiver.includes("function gatewayUrl()"), 'Receiver must expose the shared Gateway route');
assert.ok(receiver.includes("location.replace(gatewayUrl())"), 'Receiver must send every Bridge platform to the shared Gateway');

execFileSync(process.execPath, ['scripts/check-bridge-wayfarer-map-adapter.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/check-bridge-poi-parser.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/check-bridge-poi-classifier.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/check-bridge-v1-export.mjs'], { stdio: 'inherit' });
execFileSync(process.execPath, ['scripts/build-pc-bridge.mjs'], { stdio: 'inherit' });
const zip = fs.readFileSync('downloads/campsite-bridge-pc-0.1.0.zip');
assert.ok(zip.length > 1000, 'PC Bridge ZIP is unexpectedly small');
assert.equal(zip.readUInt32LE(0), 0x04034b50, 'PC Bridge output is not a ZIP');
assert.ok(zip.includes(Buffer.from('manifest.json')), 'ZIP must contain manifest.json');
assert.ok(zip.includes(Buffer.from('wayfarer-map-adapter.js')), 'ZIP must contain Wayfarer map adapter');
assert.ok(zip.includes(Buffer.from('poi-parser.js')), 'ZIP must contain poi-parser.js');
assert.ok(zip.includes(Buffer.from('poi-classifier.js')), 'ZIP must contain poi-classifier.js');
assert.ok(zip.includes(Buffer.from('poi-reference-layer.js')), 'ZIP must contain poi-reference-layer.js');
assert.ok(zip.includes(Buffer.from('bridge-v1-exporter.js')), 'ZIP must contain bridge-v1-exporter.js');
assert.ok(zip.includes(Buffer.from('page-collector.js')), 'ZIP must contain page-collector.js');
assert.ok(zip.includes(Buffer.from('content.js')), 'ZIP must contain content.js');

console.log('Campsite Bridge PC 0.1.0 + POI Engine v1.1 routing + V1 export contract: OK');
