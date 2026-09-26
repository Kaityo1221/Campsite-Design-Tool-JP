import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const parser = sandbox.window.CampsiteBridgePoiParser;
assert.ok(parser, 'Parser API must exist');
assert.equal(parser.version, '1.2.0');
assert.equal(typeof parser.parsePoi, 'function');
assert.equal(typeof parser.parsePayload, 'function');
assert.equal(typeof parser.normalizeGameObjects, 'function');
assert.equal(parser.classifyGameObject, undefined, 'Parser must not classify POIs');
assert.equal(parser.toBridgePoi, undefined, 'Parser must not export Bridge POIs');
assert.equal(parser.bridgePoisFromParsed, undefined, 'Parser must not own Bridge export');

const payload = {
  result: {
    data: [{
      pois: [
        {
          poiId: 'stop', title: 'Stop', latE6: 35000000, lngE6: 139000000,
          gmo: [{ gameBrand:'HOLOHOLO', entity:'POKE_STOP', status:'active', sponsored:true, smr:false, title:'GMO Stop', imageUrl:'https://example.test/stop.jpg' }]
        },
        {
          poiId: 'inactive-power', title: 'Inactive Power', lat:35.0001, lng:139.0001,
          gmo: [{ gameBrand:'HOLOHOLO', entity:'POWER_SPOT', status:'INACTIVE' }]
        },
        { poiId:'portal', title:'Portal', lat:35.0002, lng:139.0002, gmo:[] },
        { poiId:'other-brand', title:'Other', lat:35.0003, lng:139.0003, gmo:[{ gameBrand:'INGRESS', entity:'GYM', status:'ACTIVE' }] },
        {
          poiId: 'stop', title: 'Stop updated', latE6: 35000000, lngE6: 139000000,
          gmo: [{ gameBrand:'HOLOHOLO', entity:'POKESTOP', status:'ACTIVE' }]
        },
        { poiId:'broken-gmo', title:'Broken GMO', lat:35.0004, lng:139.0004, gmo:'broken' },
        { poiId:'bad-coord', title:'Bad', lat:999, lng:139, gmo:[] },
        { title:'Missing GUID', lat:35.0005, lng:139.0005, gmo:[] }
      ]
    }]
  }
};

const parsed = parser.parsePayload(payload);
assert.equal(parsed.sourceCount, 8);
assert.equal(parsed.parsedCount, 5);
assert.equal(parsed.duplicateCount, 1);
assert.equal(parsed.failedCount, 2);
assert.equal(parsed.pois.find(p => p.guid === 'stop')?.title, 'Stop updated', 'Later duplicate must win');
assert.ok(parsed.diagnostics.some(item => item.reason === 'INVALID_COORDINATES'));
assert.ok(parsed.diagnostics.some(item => item.reason === 'MISSING_GUID'));

for (const poi of parsed.pois) {
  assert.equal('classification' in poi, false, 'Parser must not emit classification');
  assert.equal('poiKind' in poi, false, 'Parser must not emit poiKind');
  assert.equal('gameEntity' in poi, false, 'Parser must not emit gameEntity');
  assert.equal('gameStatus' in poi, false, 'Parser must not emit gameStatus');
  assert.equal('referenceKind' in poi, false, 'Parser must not emit referenceKind');
  assert.equal('bridgeEligible' in poi, false, 'Parser must not emit Bridge eligibility');
}

const first = parser.parsePoi({
  poiId:'normalize-test', latE6:35000000, lngE6:139000000,
  gmo:[{ gameBrand:'holoholo', entity:'power_spot', status:'inactive', sponsored:true, smr:false, title:'Source title', imageUrl:'https://example.test/source.jpg' }]
});
assert.equal(first.ok, true);
assert.equal(first.poi.lat, 35);
assert.equal(first.poi.lng, 139);
assert.equal(first.poi.sponsored, null, 'GMO metadata must not be selected as top-level classification metadata by Parser');
assert.equal(first.poi.sourceGameObjects.length, 1);
assert.equal(first.poi.sourceGameObjects[0].entity, 'POWERSPOT');
assert.equal(first.poi.sourceGameObjects[0].status, 'INACTIVE');
assert.equal(first.poi.sourceGameObjects[0].gameBrand, 'HOLOHOLO');
assert.equal(first.poi.sourceGameObjects[0].sponsored, true);
assert.equal(first.poi.sourceGameObjects[0].smr, false);
assert.equal(first.poi.sourceGameObjects[0].title, 'Source title');
assert.equal(first.poi.sourceGameObjects[0].imageUrl, 'https://example.test/source.jpg');

const broken = parsed.pois.find(p => p.guid === 'broken-gmo');
assert.equal(broken.sourceGameObjectMeta.structureMalformed, true);
assert.equal(broken.sourceGameObjectMeta.malformedCount, 1);

console.log('check-bridge-poi-parser: OK');
