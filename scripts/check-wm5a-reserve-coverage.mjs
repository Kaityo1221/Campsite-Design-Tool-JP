import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source = fs.readFileSync('creative/runtime/map-engine/wayfarer-reserve-coverage.js', 'utf8');
new vm.Script(source, { filename:'creative/runtime/map-engine/wayfarer-reserve-coverage.js' });

const sandbox = { window:{}, console, Math, Number, String, Object, Array, JSON, Infinity };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const evaluate = sandbox.window.bridgeMapLab_evaluateWayfarerReserveCoverage;
assert.equal(typeof evaluate, 'function');

const LAT = 35;
const LNG = 139;
const METERS_PER_LAT = 111319.49079327357;
const METERS_PER_LNG = METERS_PER_LAT * Math.cos(LAT * Math.PI / 180);

function point(xMeters, yMeters) {
  return [LAT + yMeters / METERS_PER_LAT, LNG + xMeters / METERS_PER_LNG];
}

function rect(x0, y0, x1, y1) {
  return [point(x0,y0), point(x1,y0), point(x1,y1), point(x0,y1)];
}

function observation(bufferMeters = 200, coverageComplete = false) {
  return {
    polygon: rect(0,0,200,200),
    acquisition: {
      bufferMeters,
      referenceMeters:100,
      reserveMeters:200,
      coverageComplete
    }
  };
}

const same = evaluate(observation(), rect(0,0,200,200));
assert.equal(same.covered, true);
assert.equal(same.reason, 'COVERED');
assert.equal(same.requiredReferenceMeters, 100);
assert.equal(same.acquiredBufferMeters, 200);
assert.equal(same.availableExpansionMeters, 100);
assert.equal(same.acquisitionCoverageComplete, false, 'geometry coverage must not promote acquisition completeness');

const inward = evaluate(observation(), rect(20,20,180,180));
assert.equal(inward.covered, true);
assert.equal(inward.maxDistanceMeters, 0);

const shift80 = evaluate(observation(), rect(80,0,280,200));
assert.equal(shift80.covered, true, '80m polygon shift stays within the 100m expansion budget');
assert.ok(shift80.maxDistanceMeters > 75 && shift80.maxDistanceMeters < 85);

const shift120 = evaluate(observation(), rect(120,0,320,200));
assert.equal(shift120.covered, false);
assert.equal(shift120.reason, 'OUTSIDE_RESERVE');

const buffer150Shift40 = evaluate(observation(150), rect(40,0,240,200));
assert.equal(buffer150Shift40.availableExpansionMeters, 50);
assert.equal(buffer150Shift40.covered, true);

const buffer150Shift60 = evaluate(observation(150), rect(60,0,260,200));
assert.equal(buffer150Shift60.covered, false);
assert.equal(buffer150Shift60.reason, 'OUTSIDE_RESERVE');

const completeSnapshot = evaluate(observation(200, true), rect(40,0,240,200));
assert.equal(completeSnapshot.covered, true);
assert.equal(completeSnapshot.acquisitionCoverageComplete, true);

const noBuffer = evaluate({ polygon:rect(0,0,200,200), acquisition:{} }, rect(0,0,200,200));
assert.equal(noBuffer.covered, false);
assert.equal(noBuffer.reason, 'MISSING_ACQUISITION_BUFFER');

const insufficient = evaluate(observation(80), rect(0,0,200,200));
assert.equal(insufficient.covered, false);
assert.equal(insufficient.reason, 'INSUFFICIENT_ACQUISITION_BUFFER');

const badAcquired = evaluate({ polygon:[[35,139],[35,139.001]], acquisition:{bufferMeters:200} }, rect(0,0,200,200));
assert.equal(badAcquired.covered, false);
assert.equal(badAcquired.reason, 'INVALID_ACQUISITION_POLYGON');

const badCurrent = evaluate(observation(), [[35,139],[35,139.001]]);
assert.equal(badCurrent.covered, false);
assert.equal(badCurrent.reason, 'INVALID_CURRENT_POLYGON');

const huge = evaluate(observation(), [point(0,0),point(200000,0),point(200000,200000),point(0,200000)], { maxSamples:500 });
assert.equal(huge.covered, false);
assert.equal(huge.reason, 'SAMPLE_LIMIT');

console.log('WM-5A reserve coverage evaluator: PASS');
