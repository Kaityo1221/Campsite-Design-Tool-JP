import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const parserSource = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const classifierSource = fs.readFileSync('bridge-pc/poi-classifier.js', 'utf8');
const receiver = fs.readFileSync('bridge-receiver.html', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(parserSource, sandbox);
vm.runInContext(classifierSource, sandbox);

const parser = sandbox.window.CampsiteBridgePoiParser;
const classifier = sandbox.window.CampsiteBridgePoiClassifier;
assert.ok(parser, 'Parser API must exist');
assert.ok(classifier, 'Classifier API must exist');
assert.deepEqual([...classifier.entityPriority], ['GYM', 'POKESTOP', 'POWERSPOT']);
assert.equal(classifier.supportedBrand, 'HOLOHOLO');
assert.equal(classifier.toBridgePoi, undefined, 'Classifier must not serialize Bridge POIs');
assert.equal(classifier.bridgePoisFromClassified, undefined, 'Classifier must not own Bridge export');

const payload = {
  result: {
    data: [{
      pois: [
        { poiId:'stop-holo', title:'Stop', lat:35.0000, lng:139.0000, gmo:[{ gameBrand:'HOLOHOLO', entity:'POKESTOP', status:'ACTIVE' }] },
        { poiId:'gym-holo', title:'Gym', lat:35.0001, lng:139.0001, gmo:[{ gameBrand:'HOLOHOLO', entity:'GYM', status:'ACTIVE' }] },
        { poiId:'power-holo', title:'Power', lat:35.0002, lng:139.0002, gmo:[{ gameBrand:'HOLOHOLO', entity:'POWERSPOT', status:'ACTIVE', sponsored:true, smr:false, imageUrl:'https://example.test/power.jpg' }] },
        { poiId:'stop-no-brand', title:'No brand', lat:35.0003, lng:139.0003, gmo:[{ entity:'POKESTOP', status:'ACTIVE' }] },
        { poiId:'not-in-game', title:'Portal', lat:35.0004, lng:139.0004, gmo:[] },
        { poiId:'inactive', title:'Inactive Stop', lat:35.0005, lng:139.0005, gmo:[{ gameBrand:'HOLOHOLO', entity:'POKESTOP', status:'INACTIVE' }] },
        { poiId:'inactive-power', title:'Inactive Power', lat:35.00055, lng:139.00055, gmo:[{ gameBrand:'HOLOHOLO', entity:'POWERSPOT', status:'INACTIVE', imageUrl:'https://example.test/inactive-power.jpg' }] },
        { poiId:'other-brand', title:'Other', lat:35.0006, lng:139.0006, gmo:[{ gameBrand:'INGRESS', entity:'GYM', status:'ACTIVE' }] },
        { poiId:'multi', title:'Multi', lat:35.0007, lng:139.0007, gmo:[
          { gameBrand:'HOLOHOLO', entity:'POWERSPOT', status:'ACTIVE' },
          { gameBrand:'HOLOHOLO', entity:'POKESTOP', status:'ACTIVE' },
          { gameBrand:'HOLOHOLO', entity:'GYM', status:'ACTIVE' }
        ] },
        { poiId:'stop-holo', title:'Stop duplicate wins', lat:35.0000, lng:139.0000, gmo:[{ gameBrand:'HOLOHOLO', entity:'POKESTOP', status:'ACTIVE' }] },
        { poiId:'bad-coord', title:'Bad', lat:999, lng:139, gmo:[{ gameBrand:'HOLOHOLO', entity:'POKESTOP', status:'ACTIVE' }] },
        { title:'No guid', lat:35, lng:139, gmo:[{ gameBrand:'HOLOHOLO', entity:'POKESTOP', status:'ACTIVE' }] },
        { poiId:'ambiguous-item', title:'Ambiguous', lat:35.0008, lng:139.0008, gmo:[{ gameBrand:'HOLOHOLO', entity:'', status:'ACTIVE' }] },
        { poiId:'ambiguous-structure', title:'Broken GMO', lat:35.0009, lng:139.0009, gmo:'broken' }
      ]
    }]
  }
};

const parsed = parser.parsePayload(payload);
assert.ok(parsed.pois.every(p => !('poiKind' in p)), 'Parser must hand unclassified POIs to classifier');
const result = classifier.run(parsed);
const byId = new Map(result.pois.map(p => [p.guid, p]));

// Supported ACTIVE entities are owned only by Classifier.
assert.equal(byId.get('stop-holo').poiKind, 'POKESTOP');
assert.equal(byId.get('stop-holo').reasonCode, 'ACTIVE_POKESTOP');
assert.equal(byId.get('stop-holo').referenceKind, null);
assert.equal(byId.get('gym-holo').poiKind, 'GYM');
assert.equal(byId.get('gym-holo').reasonCode, 'ACTIVE_GYM');
assert.equal(byId.get('power-holo').poiKind, 'POWERSPOT');
assert.equal(byId.get('power-holo').reasonCode, 'ACTIVE_POWERSPOT');
assert.equal(byId.get('stop-no-brand').poiKind, 'POKESTOP');

// GMO metadata is selected only after classification.
assert.equal(byId.get('power-holo').sponsored, true);
assert.equal(byId.get('power-holo').smr, false);
assert.equal(byId.get('power-holo').imageUrl, 'https://example.test/power.jpg');

// Generic non-active records become NOT_IN_GAME references.
assert.equal(byId.get('not-in-game').poiKind, 'NOT_IN_GAME');
assert.equal(byId.get('not-in-game').referenceKind, 'NOT_IN_GAME');
assert.equal(byId.get('inactive').poiKind, 'NOT_IN_GAME');
assert.equal(byId.get('inactive').gameStatus, 'INACTIVE');
assert.equal(byId.get('inactive').referenceKind, 'NOT_IN_GAME');
assert.equal(byId.get('other-brand').poiKind, 'NOT_IN_GAME');
assert.equal(byId.get('other-brand').referenceKind, 'NOT_IN_GAME');

// Inactive Power Spot keeps the five-kind taxonomy but gets a distinct referenceKind.
assert.equal(byId.get('inactive-power').poiKind, 'NOT_IN_GAME');
assert.equal(byId.get('inactive-power').gameEntity, 'POWERSPOT');
assert.equal(byId.get('inactive-power').gameStatus, 'INACTIVE');
assert.equal(byId.get('inactive-power').referenceKind, 'INACTIVE_POWERSPOT');
assert.equal(byId.get('inactive-power').reasonCode, 'INACTIVE_POWERSPOT_REFERENCE');
assert.equal(byId.get('inactive-power').imageUrl, 'https://example.test/inactive-power.jpg');

// Deterministic multi-entity priority.
assert.equal(byId.get('multi').poiKind, 'GYM');

// Parser boundary and GUID dedupe diagnostics.
assert.equal(parsed.duplicateCount, 1);
assert.equal(byId.get('stop-holo').title, 'Stop duplicate wins');
assert.equal(parsed.failedCount, 2);
assert.equal(result.diagnostics.sourceCount, 14);
assert.equal(result.diagnostics.validCount, 11);
assert.equal(result.diagnostics.invalidCount, 2);
assert.equal(result.diagnostics.duplicateCount, 1);

// Malformed/ambiguous source metadata stays diagnostic UNKNOWN and is not a reference.
assert.equal(byId.get('ambiguous-item').poiKind, 'UNKNOWN');
assert.equal(byId.get('ambiguous-item').reasonCode, 'AMBIGUOUS_GAME_OBJECT');
assert.equal(byId.get('ambiguous-item').referenceKind, null);
assert.equal(byId.get('ambiguous-structure').poiKind, 'UNKNOWN');
assert.equal(byId.get('ambiguous-structure').reasonCode, 'AMBIGUOUS_GAME_OBJECT');
assert.equal(byId.get('ambiguous-structure').referenceKind, null);

// Classifier only marks Bridge eligibility. Serialization belongs to Bridge exporter.
const activeEnginePois = result.pois.filter(p => p.bridgeEligible === true);
assert.equal(activeEnginePois.length, 5);
assert.deepEqual(new Set(activeEnginePois.map(p => p.gameEntity)), new Set(['POKESTOP', 'GYM', 'POWERSPOT']));
assert.ok(activeEnginePois.every(p => p.gameStatus === 'ACTIVE'));
for (const id of ['not-in-game','inactive','inactive-power','other-brand','ambiguous-item','ambiguous-structure']) {
  assert.equal(byId.get(id).bridgeEligible, false, `${id} must not be Bridge eligible`);
}

assert.ok(receiver.includes('POKESTOP'));
assert.ok(receiver.includes('GYM'));
assert.ok(receiver.includes('POWERSPOT'));
assert.equal(result.diagnostics.pokestopCount, 2);
assert.equal(result.diagnostics.gymCount, 2);
assert.equal(result.diagnostics.powerspotCount, 1);
assert.equal(result.diagnostics.notInGameCount, 4);
assert.equal(result.diagnostics.unknownCount, 2);
assert.equal(result.diagnostics.exportCount, 5);

console.log('check-bridge-poi-classifier: OK');
