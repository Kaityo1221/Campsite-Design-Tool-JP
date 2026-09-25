import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const fixture = JSON.parse(fs.readFileSync('scripts/fixtures/bridge-poi-engine-regression.json', 'utf8'));
const parserSource = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const classifierSource = fs.readFileSync('bridge-pc/poi-classifier.js', 'utf8');
const exporterSource = fs.readFileSync('bridge-pc/bridge-v1-exporter.js', 'utf8');

const context = {
  window: {},
  console,
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
vm.runInContext(exporterSource, context);

const parser = context.window.CampsiteBridgePoiParser;
const classifier = context.window.CampsiteBridgePoiClassifier;
const exporter = context.window.CampsiteBridgeV1Exporter;
assert.ok(parser, 'POI Parser API missing');
assert.ok(classifier, 'POI Classifier API missing');
assert.ok(exporter, 'Bridge V1 Exporter API missing');

const parsed = parser.parsePayload(fixture.rawWayfarer);
const classified = classifier.run(parsed);
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
}, 'poi-engine-regression', { bridgeVersion: '0.1.0' });

const kinds = Object.fromEntries(
  [...classified.pois]
    .sort((a, b) => String(a.guid).localeCompare(String(b.guid)))
    .map(poi => [poi.guid, poi.poiKind])
);

const snapshot = {
  parser: {
    sourceCount: parsed.sourceCount,
    parsedCount: parsed.parsedCount,
    duplicateCount: parsed.duplicateCount,
    failedCount: parsed.failedCount,
    laterDuplicateTitle: parsed.pois.find(poi => poi.guid === 'e2e-stop')?.title || null
  },
  classifier: {
    pokestopCount: classified.diagnostics.pokestopCount,
    gymCount: classified.diagnostics.gymCount,
    powerspotCount: classified.diagnostics.powerspotCount,
    notInGameCount: classified.diagnostics.notInGameCount,
    unknownCount: classified.diagnostics.unknownCount,
    exportCount: classified.diagnostics.exportCount
  },
  kinds,
  inactiveStatus: classified.pois.find(poi => poi.guid === 'e2e-inactive')?.gameStatus || null,
  export: {
    count: payload.pois.length,
    guids: [...payload.pois].map(poi => poi.guid).sort()
  }
};

// Parser/classifier/exporter execute in a VM context. Normalize realm-specific
// Array/Object prototypes so this regression lock compares only serialized data.
const normalizedSnapshot = JSON.parse(JSON.stringify(snapshot));
assert.deepEqual(normalizedSnapshot, fixture.expected, 'POI Engine regression snapshot changed');
assert.equal(payload.type, 'CAMPSITE_BRIDGE_POI_V1');
assert.equal(payload.schemaVersion, '1.2');
assert.equal(payload.bridgePlatform, 'pc');
assert.equal(payload.handshakeId, 'poi-engine-regression');
assert.ok(payload.pois.every(poi => poi.gameStatus === 'ACTIVE'), 'Only ACTIVE POIs may be exported');
assert.equal('diagnostics' in payload, false, 'Internal diagnostics must not leak into Bridge V1');
assert.equal('enginePois' in payload, false, 'Internal Engine POIs must not leak into Bridge V1');

console.log('POI Engine regression snapshot: OK');
console.log(JSON.stringify(normalizedSnapshot));
