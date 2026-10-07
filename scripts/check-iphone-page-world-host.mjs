import fs from 'node:fs';
import assert from 'node:assert/strict';

const hostPath = 'dist/bridge-shortcut/1.0.0/runtime.part-08a.iphone-page-world-host.js';
const uiPath = 'dist/bridge-shortcut/1.0.0/runtime.part-08.iphone-activity-area-ui.js';
const host = fs.readFileSync(hostPath, 'utf8');
const ui = fs.readFileSync(uiPath, 'utf8');

assert.match(host, /cbs-i3:cmd/);
assert.match(host, /cbs-i3:evt/);
assert.match(host, /new maps\.Circle/);
assert.match(host, /new maps\.Polyline/);
assert.match(host, /new maps\.Polygon/);
assert.match(host, /clickable:\s*false/g);
assert.match(host, /dx \/ scale/);
assert.match(host, /dy \/ scale/);
assert.match(host, /POLL_MS = 1500/);
assert.match(host, /visibilityState === 'hidden'/);
assert.match(host, /typeof tilt === 'number'/);
assert.match(host, /typeof heading === 'number'/);
assert.doesNotMatch(host, /setCustomLayers\s*\(/);
assert.doesNotMatch(host, /gameEntity|latestRangeBounds|WFMM/);

assert.match(ui, /getBoundingClientRect/);
assert.match(ui, /send\('add', p\)/);
assert.doesNotMatch(ui, /latestRangeBounds|mercatorY|svgOverlay|drawScreenOverlay|window\.google|WFMM|__campsiteBridgeGoogleMap/);

console.log('iPhone page-world host checks: PASS');
