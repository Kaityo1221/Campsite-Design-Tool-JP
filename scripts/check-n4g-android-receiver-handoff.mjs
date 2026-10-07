import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const signed='downloads/campsite-bridge-android-0.3.5.xpi';
const expected='f5c7d300c6cdd82758f88f651116c1b7af42863ef03e80f8ac89e39afa0fa7b7';
assert.equal(crypto.createHash('sha256').update(fs.readFileSync(signed)).digest('hex'),expected,'public signed 0.3.5 changed');

execFileSync(process.execPath,['scripts/build-android-bridge-0.3.7-unsigned.mjs'],{stdio:'inherit'});
const xpi='downloads/campsite-bridge-android-0.3.7-unsigned.xpi';
const ui=execFileSync('unzip',['-p',xpi,'bridge-ui.js'],{encoding:'utf8'});
const coord=execFileSync('unzip',['-p',xpi,'wayfarer-acquisition-coordinator.js'],{encoding:'utf8'});

assert.match(coord,/type: 'WAYFARER_OBSERVATION'/,'MAIN must expose fixed Observation');
assert.match(coord,/source: PAGE_CHANNEL/,'Observation must use existing page channel');
assert.match(ui,/data\.type === 'WAYFARER_OBSERVATION'/,'ISOLATED UI must receive Observation');
assert.match(ui,/wayfarerObservation\.canProceed !== true/,'send must wait for completed fixed Observation');
assert.match(ui,/wayfarerObservation\?\.zones\?\.interior/,'editable payload must derive from INTERIOR');
assert.match(ui,/makeSendPois\(\)\.filter\(poi => interiorGuids\.has/,'Receiver POIs must be INTERIOR only');
assert.match(ui,/wayfarerObservation: JSON\.parse\(JSON\.stringify\(wayfarerObservation\)\)/,'payload must carry fixed Observation');
assert.match(ui,/receiver\.postMessage\(payload, RECEIVER_ORIGIN\)/,'existing Receiver transport changed');
assert.match(ui,/const RECEIVER_ORIGIN = 'https:\/\/kaityo1221\.github\.io'/);
assert.match(ui,/const PROTOCOL = 'CAMPSITE_BRIDGE_POI_V1'/);
assert.match(ui,/handshakeId,/);
assert.doesNotMatch(ui,/zones\?\.reference100.*makeSendPois|zones\?\.reserve200.*makeSendPois/,'reference zones must never become editable payload POIs');

const builder=fs.readFileSync('scripts/build-android-bridge-0.3.7-unsigned.mjs','utf8');
assert.doesNotMatch(builder,/creative\//i,'N4-G builder must not modify Creative');
console.log('N4-G Receiver handoff contract PASS');
