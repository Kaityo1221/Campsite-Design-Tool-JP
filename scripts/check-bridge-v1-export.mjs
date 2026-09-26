import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const classifierSource = fs.readFileSync('bridge-pc/poi-classifier.js', 'utf8');
const referenceSource = fs.readFileSync('bridge-pc/poi-reference-layer.js', 'utf8');
const exporterSource = fs.readFileSync('bridge-pc/bridge-v1-exporter.js', 'utf8');
const receiver = fs.readFileSync('bridge-receiver.html', 'utf8');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(classifierSource, sandbox);
vm.runInContext(referenceSource, sandbox);
vm.runInContext(exporterSource, sandbox);

const referenceLayer = sandbox.window.CampsiteBridgePoiReferenceLayer;
const exporter = sandbox.window.CampsiteBridgeV1Exporter;
assert.ok(referenceLayer, 'Reference Layer API must exist');
assert.ok(exporter, 'Bridge V1 exporter API must exist');
assert.equal(exporter.protocol, 'CAMPSITE_BRIDGE_POI_V1');
assert.equal(exporter.schemaVersion, '1.2');
assert.equal(exporter.platform, 'pc');

const enginePois = [
  {
    guid: 'stop-1', title: 'Stop', lat: 35, lng: 139,
    poiKind: 'POKESTOP', gameEntity:'POKESTOP', gameStatus: 'ACTIVE', referenceKind:null, bridgeEligible: true,
    sponsored: false, smr: null, provenance: ['WAYFARER_PASSIVE'],
    reasonCode: 'ACTIVE_POKESTOP', internalSecret: 'must-not-leak'
  },
  {
    guid: 'gym-1', title: 'Gym', lat: 35.1, lng: 139.1,
    poiKind: 'GYM', gameEntity:'GYM', gameStatus: 'ACTIVE', referenceKind:null, bridgeEligible: true,
    sponsored: true, smr: true, provenance: ['WAYFARER_PASSIVE'],
    reasonCode: 'ACTIVE_GYM'
  },
  {
    guid: 'power-1', title: 'Power', lat: 35.2, lng: 139.2,
    poiKind: 'POWERSPOT', gameEntity:'POWERSPOT', gameStatus: 'ACTIVE', referenceKind:null, bridgeEligible: true,
    sponsored: false, smr: false, provenance: ['WAYFARER_PASSIVE'],
    reasonCode: 'ACTIVE_POWERSPOT'
  },
  {
    guid: 'out-1', title: 'Not in Game', lat: 35.3, lng: 139.3,
    poiKind: 'NOT_IN_GAME', gameEntity:null, gameStatus: 'UNKNOWN', referenceKind:'NOT_IN_GAME', bridgeEligible: false,
    reasonCode: 'NO_ACTIVE_SUPPORTED_GAME_OBJECT'
  },
  {
    guid: 'inactive-power-1', title: 'Inactive Power', lat:35.35, lng:139.35,
    poiKind:'NOT_IN_GAME', gameEntity:'POWERSPOT', gameStatus:'INACTIVE', referenceKind:'INACTIVE_POWERSPOT', bridgeEligible:false,
    imageUrl:'https://example.test/inactive.jpg', reasonCode:'INACTIVE_POWERSPOT_REFERENCE'
  },
  {
    guid: 'unknown-1', title: 'Unknown', lat: 35.4, lng: 139.4,
    poiKind: 'UNKNOWN', gameStatus: 'UNKNOWN', referenceKind:null, bridgeEligible: false,
    reasonCode: 'AMBIGUOUS_GAME_OBJECT'
  },
  {
    guid: '', title: 'Broken', lat: 35.5, lng: 139.5,
    poiKind: 'POKESTOP', gameEntity:'POKESTOP', gameStatus: 'ACTIVE', referenceKind:null, bridgeEligible: true
  }
];

const routed = referenceLayer.splitClassified(enginePois);
assert.equal(routed.activeEnginePois.length, 3);
assert.equal(routed.referencePois.length, 2);
assert.equal(routed.diagnosticPois.length, 2);
assert.deepEqual(new Set(routed.referencePois.map(p => p.referenceKind)), new Set(['NOT_IN_GAME','INACTIVE_POWERSPOT']));

const payload = exporter.makePayload({
  enginePois,
  diagnostics: { unknownCount: 1, secret: 'must-not-leak' },
  classificationDiagnostics: [{ guid: 'unknown-1', reason: 'AMBIGUOUS_GAME_OBJECT' }],
  selectedBounds: {
    center: { lat: 35.0, lng: 139.0 },
    zoom: 16,
    sw: { lat: 34.9, lng: 138.9 },
    ne: { lat: 35.1, lng: 139.1 }
  }
}, 'pc-test-handshake', { bridgeVersion: '0.1.0' });

assert.deepEqual(Object.keys(payload), [
  'type', 'bridgeVersion', 'bridgePlatform', 'schemaVersion',
  'handshakeId', 'selectedBounds', 'autoContinue', 'pois', 'referencePois'
]);
assert.equal(payload.type, 'CAMPSITE_BRIDGE_POI_V1');
assert.equal(payload.bridgeVersion, '0.1.0');
assert.equal(payload.bridgePlatform, 'pc');
assert.equal(payload.schemaVersion, '1.2');
assert.equal(payload.handshakeId, 'pc-test-handshake');
assert.equal(payload.autoContinue, true);
assert.equal(payload.pois.length, 3);
assert.deepEqual([...payload.pois].map(p => p.gameEntity), ['POKESTOP', 'GYM', 'POWERSPOT']);
assert.ok(payload.pois.every(p => p.gameStatus === 'ACTIVE'));
assert.ok(payload.pois.every(p => p.guid));
assert.equal(payload.pois.some(p => p.guid === 'out-1'), false);
assert.equal(payload.pois.some(p => p.guid === 'unknown-1'), false);
assert.equal(payload.referencePois.length, 2);
assert.equal(payload.referencePois.find(p => p.guid === 'out-1')?.referenceKind, 'NOT_IN_GAME');
assert.equal(payload.referencePois.find(p => p.guid === 'inactive-power-1')?.referenceKind, 'INACTIVE_POWERSPOT');
assert.equal(payload.referencePois.find(p => p.guid === 'inactive-power-1')?.gameEntity, 'POWERSPOT');
assert.equal(payload.referencePois.find(p => p.guid === 'inactive-power-1')?.gameStatus, 'INACTIVE');
assert.equal(payload.referencePois.some(p => p.guid === 'unknown-1'), false);
assert.equal('diagnostics' in payload, false);
assert.equal('classificationDiagnostics' in payload, false);
assert.equal('enginePois' in payload, false);
assert.equal('poiKind' in payload.pois[0], false);
assert.equal('reasonCode' in payload.pois[0], false);
assert.equal('bridgeEligible' in payload.pois[0], false);
assert.equal('internalSecret' in payload.pois[0], false);

const allowedPoiKeys = [
  'guid', 'title', 'lat', 'lng', 'gameEntity', 'gameStatus',
  'sponsored', 'smr', 'imageUrl', 'description', 's2L14', 's2L17', 'provenance'
];
for (const poi of payload.pois) {
  assert.deepEqual(Object.keys(poi), allowedPoiKeys);
}

const allowedReferenceKeys = [
  'guid', 'title', 'lat', 'lng', 'referenceKind', 'gameEntity', 'gameStatus',
  'imageUrl', 'description', 'provenance'
];
for (const poi of payload.referencePois) {
  assert.deepEqual(Object.keys(poi), allowedReferenceKeys);
  assert.equal('reasonCode' in poi, false);
  assert.equal('poiKind' in poi, false);
}

const normalizedBounds = JSON.parse(JSON.stringify(payload.selectedBounds));
assert.deepEqual(normalizedBounds, {
  center: { lat: 35, lng: 139 },
  zoom: 16,
  sw: { lat: 34.9, lng: 138.9 },
  ne: { lat: 35.1, lng: 139.1 }
});

const fallback = exporter.makePayload({
  pois: [
    { guid:'dup', title:'old', lat:35, lng:139, gameEntity:'POKESTOP', gameStatus:'ACTIVE' },
    { guid:'dup', title:'new', lat:35, lng:139, gameEntity:'GYM', gameStatus:'ACTIVE' },
    { guid:'inactive', title:'inactive', lat:35, lng:139, gameEntity:'POKESTOP', gameStatus:'INACTIVE' },
    { guid:'unknown', title:'unknown', lat:35, lng:139, gameEntity:'UNKNOWN', gameStatus:'ACTIVE' }
  ],
  referencePois: [
    { guid:'ref', title:'ref old', lat:35.2, lng:139.2, referenceKind:'NOT_IN_GAME' },
    { guid:'ref', title:'ref new', lat:35.2, lng:139.2, referenceKind:'INACTIVE_POWERSPOT', gameEntity:'POWERSPOT', gameStatus:'INACTIVE' },
    { guid:'dup', title:'must lose to active', lat:35, lng:139, referenceKind:'NOT_IN_GAME' }
  ]
}, 'fallback');
assert.equal(fallback.pois.length, 1);
assert.equal(fallback.pois[0].guid, 'dup');
assert.equal(fallback.pois[0].title, 'new');
assert.equal(fallback.pois[0].gameEntity, 'GYM');
assert.deepEqual([...fallback.pois[0].provenance], ['WAYFARER_PASSIVE']);
assert.equal(fallback.referencePois.length, 1);
assert.equal(fallback.referencePois[0].guid, 'ref');
assert.equal(fallback.referencePois[0].title, 'ref new');
assert.equal(fallback.referencePois[0].referenceKind, 'INACTIVE_POWERSPOT');

assert.ok(receiver.includes("data.type !== 'CAMPSITE_BRIDGE_POI_V1'"), 'Receiver protocol check missing');
assert.ok(receiver.includes("new Set(['POKESTOP','GYM','POWERSPOT'])"), 'Receiver entity contract changed');
assert.ok(receiver.includes("new Set(['NOT_IN_GAME','INACTIVE_POWERSPOT'])"), 'Receiver reference contract missing');
assert.ok(receiver.includes("type: 'CAMPSITE_BRIDGE_ACK_V1'"), 'Receiver ACK contract missing');
assert.ok(receiver.includes("type:'CAMPSITE_BRIDGE_READY_V1'"), 'Receiver READY contract missing');
assert.ok(receiver.includes("incomingHandshakeId !== pageHandshakeId"), 'Receiver handshake validation missing');

console.log('check-bridge-v1-export: OK');
