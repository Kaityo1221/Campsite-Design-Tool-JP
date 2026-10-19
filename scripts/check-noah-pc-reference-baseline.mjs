// Canonical PC reference contract guard (documentation/QA only).
// This is NOT an authenticated Wayfarer or physical-device E2E test.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(path, 'utf8');
const cases = [
  ['bridge-pc/wayfarer-polygon-controller.js', 'const MAX_POINTS = 30;', '30-vertex polygon cap'],
  ['bridge-pc/wayfarer-acquisition-engine.js', 'const DEFAULT_BUFFER_METERS = 200;', '200m acquisition buffer'],
  ['bridge-pc/wm3-observe-controller.js', 'const BUFFER_METERS = 200;', 'observation 200m buffer'],
  ['bridge-pc/wm3-observe-controller.js', 'const MAX_TILE_METERS = 500;', 'observation 500m tiles'],
  ['bridge-pc/wm3-observe-controller.js', 'maxTileMeters: MAX_TILE_METERS', 'shared tile plan usage'],
  ['bridge-pc/wayfarer-acquisition-engine.js', 'sourceComplete === true;', 'source completeness gate'],
  ['bridge-pc/wayfarer-observation-zone.js', "REFERENCE_100: 'REFERENCE_100'", 'read-only 100m zone'],
  ['bridge-pc/wayfarer-observation-zone.js', "RESERVE_200: 'RESERVE_200'", 'hidden 200m reserve zone'],
  ['bridge-pc/wayfarer-observation-zone.js', "referenceKind === 'INACTIVE_POWERSPOT'", 'explicit inactive power spot classification'],
  ['bridge-pc/wayfarer-observation-zone.js', 'counts.interior.total + counts.reference100.total', 'visible zone count'],
  ['bridge-pc/wayfarer-observation-zone.js', 'counts.interior.total + counts.reference100.total + counts.reserve200.total', 'retained reserve count'],
  ['bridge-pc/bridge-v1-exporter.js', "const PROTOCOL = 'CAMPSITE_BRIDGE_POI_V1';", 'shared Receiver protocol'],
  ['bridge-pc/bridge-v1-exporter.js', "const SCHEMA_VERSION = '1.2';", 'shared Receiver payload schema'],
  ['js/bridge-next-flow.js', "const PROJECT_KEY = 'campsiteProject.v1';", 'canonical Project storage key'],
  ['js/bridge-next-flow.js', "const PROJECT_SCHEMA_VERSION = '1.0';", 'Project schema version'],
  ['js/bridge-next-flow.js', 'project.wayfarerObservation = observation;', 'optional preserved observation'],
  ['js/bridge-observation-inactive.js', "String(raw.referenceKind || '').toUpperCase() !== 'INACTIVE_POWERSPOT'", 'strict inactive reference kind'],
  ['js/bridge-observation-inactive.js', 'const seen = new Set(activeGuids);', 'active/reference GUID dedup'],
  ['js/bridge-observation-inactive.js', 'zone, readOnly: true', 'non-editable observation references'],
  ['bridge-receiver.html', 'observedInactive?.count', 'Receiver observed inactive total'],
  ['bridge-receiver.html', 'observedInactive?.reserveCount', 'Receiver hidden reserve count'],
  ['bridge-gateway.html', 'bridge-observation-inactive.js?v=1', 'Gateway reads observation counts'],
  ['creative/wayfarer-reference-layer-patch.js', 'cmWm7ExportInactiveReferences(buildMyMapsKml())', 'KMZ read-only export integration'],
  ['creative/wayfarer-reference-layer-patch.js', "['campsite-reference-only','true']", 'read-only KMZ ExtendedData'],
  ['creative/wayfarer-reference-layer-patch.js', "const inactive=adapted.displayPois.filter(p=>p.renderKind==='INACTIVE_POWERSPOT');", 'visible inactive-only KMZ selection'],
  ['creative/wayfarer-reference-layer-patch.js', 'if(!derived?.local?.canUseLocal){', 'stale observation KMZ rejection'],
  ['creative/wayfarer-reference-layer-patch.js', 'd.getAttribute(\'name\')===\'campsite-reference-only\'', 'read-only KMZ reimport guard'],
  ['creative/wayfarer-reference-layer-patch.js', 'if(cmCandidateShadowDisplayState().radii.includes(50))return scene;', '50m reference circle display state'],
  ['creative/wayfarer-reference-layer-patch.js', "scene.items.filter(item=>item.layerKey!=='circle-50')", '50m OFF suppresses only reference circles'],
];
const cache = new Map();
let passed = 0;
for (const [path, expected, label] of cases) {
  if (!cache.has(path)) cache.set(path, read(path));
  assert.ok(cache.get(path).includes(expected), 'PC reference drift: ' + label + ' (' + path + ')');
  passed++;
}
const baseline = read('docs/noah-pc-reference-baseline-2026-10-19.md');
assert.ok(baseline.includes('0e73b4984fc3719f1a4ee08c35854d8f76ff3397'), 'pinned reference commit missing');
for (let n = 1; n <= 11; n++) {
  const id = 'R' + String(n).padStart(2, '0');
  assert.ok(baseline.includes('| ' + id + ' |'), id + ' baseline entry missing');
}
assert.match(baseline, /Phase 1 HOLD/);
assert.match(baseline, /17 active POIs \+ 100 inactive Power Spots/);
assert.match(baseline, /50 INTERIOR, 40 REFERENCE_100, 10 RESERVE_200/);
console.log('Noah PC canonical baseline: ' + passed + ' static invariants + 11 documented contract items PASS.');
console.log('This is NOT live Wayfarer, hardware parity, or production readiness.');
