import fs from 'node:fs';
import assert from 'node:assert/strict';

const source=fs.readFileSync('bridge-android-n4/wayfarer-acquisition-coordinator.js','utf8');
const zones=fs.readFileSync('bridge-pc/wayfarer-observation-zone.js','utf8');

assert.match(source,/CampsiteBridgePoiParser/,'use shared PC parser on every tile');
assert.match(source,/CampsiteBridgePoiClassifier/,'use shared PC classifier on every tile');
assert.match(source,/parser\.parsePayload\(\{ payloads: execution\.payloads\.map\(item => item\.body\) \}\)/,'aggregate all tiles before dedup');
assert.doesNotMatch(source,/latestPois = data\.pois/,'latest UI cache may not drive entire observation');
assert.match(source,/CampsiteWayfarerObservationZone/);
assert.match(source,/classifyPois\(points, allClassifiedPois\)/);
assert.match(source,/clearObservation\(\)/,'invalidate prior observations before acquisition');
assert.match(source,/responseVerifier: \(\) => null/,'unverified GCS source must not be marked complete');
assert.match(source,/metadata\.coverageComplete === true && classified\.visibleTotal > 0/,'empty and unverified observations cannot send');
assert.match(source,/buildObservation\(points, lastResult, classified\.pois\)/,'build from all tile classification');
assert.match(source,/lastCompletedSignature = '';\s*clearObservation\(\)/,'on failure allow a new attempt');
assert.match(source,/body = JSON\.parse\(bodyText\)/,'GCS JSON must be parsed before POI normalization');
for (const zone of ['INTERIOR','REFERENCE_100','RESERVE_200','OUTSIDE']) assert.match(zones,new RegExp(zone));
assert.match(zones,/referenceKind === 'INACTIVE_POWERSPOT'/);
console.log('N4-F fixed Wayfarer Observation contract PASS');
