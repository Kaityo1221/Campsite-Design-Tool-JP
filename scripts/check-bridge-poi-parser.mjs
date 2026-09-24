import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);
const parser = sandbox.window.CampsiteBridgePoiParser;
assert.ok(parser, 'parser API must be exposed');

const payload = {
  result: {
    data: [
      { pois: [
        { poiId:'stop', title:'Stop', latE6:35000000, lngE6:139000000, gmo:[{entity:'POKESTOP',status:'ACTIVE'}] },
        { poiId:'gym', title:'Gym', lat:35.001, lng:139.001, gmo:[{entity:'POKESTOP',status:'ACTIVE'},{entity:'GYM',status:'ACTIVE'}] },
        { poiId:'power', title:'Power', lat:35.002, lng:139.002, gmo:[{entity:'POWERSPOT',status:'ACTIVE'}] },
        { poiId:'notgame', title:'Portal only', lat:35.003, lng:139.003, gmo:[] },
        { poiId:'inactive', title:'Old stop', lat:35.004, lng:139.004, gmo:[{entity:'POKESTOP',status:'INACTIVE'}] },
        { poiId:'badcoord', title:'Bad', lat:999, lng:139, gmo:[{entity:'POKESTOP',status:'ACTIVE'}] },
        { title:'No guid', lat:35, lng:139, gmo:[{entity:'POKESTOP',status:'ACTIVE'}] },
        { poiId:'stop', title:'Stop duplicate', lat:35, lng:139, gmo:[{entity:'POKESTOP',status:'ACTIVE'}] }
      ] }
    ]
  }
};

const result = parser.parsePayload(payload);
assert.equal(result.sourceCount, 8);
assert.equal(result.parsedCount, 5);
assert.equal(result.duplicateCount, 1);
assert.equal(result.failedCount, 2);

const byId = new Map(result.pois.map(p => [p.guid, p]));
assert.equal(byId.get('stop').classification, 'POKESTOP');
assert.equal(byId.get('gym').classification, 'GYM');
assert.equal(byId.get('power').classification, 'POWERSPOT');
assert.equal(byId.get('notgame').classification, 'NOT_IN_GAME');
assert.equal(byId.get('inactive').classification, 'UNKNOWN');
assert.equal(byId.get('inactive').gameStatus, 'INACTIVE');

const bridgePois = parser.bridgePoisFromParsed(result.pois);
assert.equal(bridgePois.length, 3);
assert.deepEqual(new Set(bridgePois.map(p => p.gameEntity)), new Set(['POKESTOP','GYM','POWERSPOT']));
assert.ok(!bridgePois.some(p => p.guid === 'notgame'));
assert.ok(!bridgePois.some(p => p.guid === 'inactive'));

console.log('check-bridge-poi-parser: OK');
