import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('bridge-android-n4/wayfarer-acquisition-coordinator.js','utf8');
const zones=fs.readFileSync('bridge-pc/wayfarer-observation-zone.js','utf8');

assert.match(source,/UI_CHANNEL = 'CAMPSITE_BRIDGE_ANDROID_M24_UI'/);
assert.match(source,/data\.source !== UI_CHANNEL \|\| data\.type !== 'SYNC_STATE'/,'Observation must consume existing normalized SYNC_STATE POIs');
assert.match(source,/latestPois = data\.pois\.filter\(poi => poi\?\.guid\)/,'normalized POIs must retain stable GUID identity');
assert.match(source,/CampsiteWayfarerObservationZone/);
assert.match(source,/classifyPois\(points, latestPois\)/);
assert.match(source,/if \(lastObservation\) return lastObservation/,'fixed Observation must not be silently replaced');
assert.match(source,/if \(!result\.coverageComplete\) throw/,'Observation must require complete 200m acquisition');
const coverageIndex=source.indexOf("if (!result.coverageComplete) throw");
const observationIndex=source.indexOf('buildObservation(points, lastResult)');
assert.ok(coverageIndex>=0 && observationIndex>coverageIndex,'Observation must be built only after coverageComplete gate');
assert.match(source,/lastObservation = null;\s*acquire\(state\.points\)/,'new confirmed polygon may create a new Observation');
assert.doesNotMatch(source,/JSON\.parse\(.*bodyText|parseGcsBundle/,'N4-F must not reparse raw GCS payload');
for (const zone of ['INTERIOR','REFERENCE_100','RESERVE_200','OUTSIDE']) assert.match(zones,new RegExp(zone));
assert.match(zones,/referenceKind === 'INACTIVE_POWERSPOT'/);
console.log('N4-F fixed Wayfarer Observation contract PASS');
