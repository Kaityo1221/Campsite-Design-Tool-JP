import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const fixture = JSON.parse(fs.readFileSync('scripts/fixtures/bridge-poi-engine-kwajalein-v1.1.json', 'utf8'));
const parserSource = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const classifierSource = fs.readFileSync('bridge-pc/poi-classifier.js', 'utf8');
const referenceSource = fs.readFileSync('bridge-pc/poi-reference-layer.js', 'utf8');
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
vm.runInContext(referenceSource, context);
vm.runInContext(exporterSource, context);

const parser = context.window.CampsiteBridgePoiParser;
const classifier = context.window.CampsiteBridgePoiClassifier;
const referenceLayer = context.window.CampsiteBridgePoiReferenceLayer;
const exporter = context.window.CampsiteBridgeV1Exporter;
assert.ok(parser && classifier && referenceLayer && exporter, 'POI Engine v1.1 APIs missing');

const { generator, expected } = fixture;
const pois = [];
const entities = generator.activeEntityCycle;

for (let i = 0; i < generator.activeCount; i += 1) {
  const entity = entities[i % entities.length];
  pois.push({
    poiId: `kwajalein-active-${String(i + 1).padStart(2, '0')}`,
    title: `Kwajalein ACTIVE test ${String(i + 1).padStart(2, '0')}`,
    latE6: generator.baseLatE6 + (i * generator.coordinateStepE6),
    lngE6: generator.baseLngE6 + (i * generator.coordinateStepE6),
    gmo: [{ gameBrand: 'HOLOHOLO', entity, status: 'ACTIVE' }]
  });
}

for (let i = 0; i < generator.notInGameCount; i += 1) {
  const index = generator.activeCount + i;
  pois.push({
    poiId: `kwajalein-not-in-game-${String(i + 1).padStart(2, '0')}`,
    title: `Kwajalein Not in Game test ${String(i + 1).padStart(2, '0')}`,
    latE6: generator.baseLatE6 + (index * generator.coordinateStepE6),
    lngE6: generator.baseLngE6 + (index * generator.coordinateStepE6),
    gmo: []
  });
}

for (let i = 0; i < generator.inactivePowerSpotCount; i += 1) {
  const index = generator.activeCount + generator.notInGameCount + i;
  pois.push({
    poiId: `kwajalein-inactive-power-${String(i + 1).padStart(2, '0')}`,
    title: `Kwajalein Inactive Power Spot test ${String(i + 1).padStart(2, '0')}`,
    latE6: generator.baseLatE6 + (index * generator.coordinateStepE6),
    lngE6: generator.baseLngE6 + (index * generator.coordinateStepE6),
    gmo: [{ gameBrand: 'HOLOHOLO', entity: 'POWERSPOT', status: 'INACTIVE' }]
  });
}

const rawWayfarer = { result: { data: [{ pois }] } };
const parsed = parser.parsePayload(rawWayfarer);
const classified = classifier.run(parsed);
const routed = referenceLayer.splitClassified(classified.pois);
const payload = exporter.makePayload({
  enginePois: routed.activeEnginePois,
  referencePois: routed.referencePois,
  selectedBounds: {
    center: { lat: generator.baseLatE6 / 1e6, lng: generator.baseLngE6 / 1e6 },
    zoom: 17,
    sw: { lat: 8.70, lng: 167.70 },
    ne: { lat: 8.75, lng: 167.76 }
  },
  diagnostics: classified.diagnostics,
  classificationDiagnostics: classified.classificationDiagnostics
}, 'kwajalein-v1.1-regression', { bridgeVersion: '0.1.0' });

const notInGameReferences = routed.referencePois.filter(poi => poi.referenceKind === 'NOT_IN_GAME');
const inactivePowerReferences = routed.referencePois.filter(poi => poi.referenceKind === 'INACTIVE_POWERSPOT');
const visibleMapCount = routed.activeEnginePois.length + inactivePowerReferences.length;
const distanceReviewCount = routed.activeEnginePois.length + inactivePowerReferences.length;

assert.equal(parsed.sourceCount, expected.sourceCount, 'Kwajalein source count changed');
assert.equal(parsed.parsedCount, expected.parsedCount, 'Kwajalein parsed count changed');
assert.equal(parsed.failedCount, 0, 'Kwajalein baseline must parse without failures');
assert.equal(parsed.duplicateCount, 0, 'Kwajalein baseline must not contain duplicate GUIDs');

assert.equal(classified.diagnostics.exportCount, expected.activeCount, 'Kwajalein ACTIVE count changed');
assert.equal(classified.diagnostics.notInGameCount, expected.referenceCount, 'Kwajalein reference-classified count changed');
assert.equal(classified.diagnostics.unknownCount, expected.unknownCount, 'Kwajalein UNKNOWN count changed');

assert.equal(routed.activeEnginePois.length, expected.activeCount, 'Reference Layer ACTIVE count changed');
assert.equal(routed.referencePois.length, expected.referenceCount, 'Reference Layer reference count changed');
assert.equal(routed.diagnosticPois.length, expected.unknownCount, 'Kwajalein baseline must have no diagnostics-only POIs');
assert.equal(notInGameReferences.length, expected.notInGameCount, 'Not in Game baseline changed');
assert.equal(inactivePowerReferences.length, expected.inactivePowerSpotCount, 'Inactive Power Spot baseline changed');

assert.equal(payload.pois.length, expected.bridgePoisCount, 'Bridge active export baseline changed');
assert.equal(payload.referencePois.length, expected.bridgeReferenceCount, 'Bridge reference export baseline changed');
assert.ok(payload.pois.every(poi => poi.gameStatus === 'ACTIVE'), 'Bridge pois[] must stay ACTIVE-only');
assert.ok(inactivePowerReferences.every(poi => poi.gameEntity === 'POWERSPOT' && poi.gameStatus === 'INACTIVE'));
assert.equal(visibleMapCount, expected.visibleMapCount, 'Visible map baseline must stay Active 37 + Inactive PS 1 = 38');
assert.equal(distanceReviewCount, expected.distanceReviewCount, 'Distance-review baseline must stay 38');
assert.equal(
  routed.referencePois.filter(poi => poi.referenceKind === 'NOT_IN_GAME').length,
  4,
  'Not in Game references must remain retained but hidden from map/distance review'
);

console.log('Kwajalein POI Engine v1.1 regression: OK');
console.log(`Active ${routed.activeEnginePois.length} + Not in Game ${notInGameReferences.length} + Inactive Power Spot ${inactivePowerReferences.length} = ${parsed.parsedCount}`);
console.log(`Visible map ${visibleMapCount}; distance review ${distanceReviewCount}`);
