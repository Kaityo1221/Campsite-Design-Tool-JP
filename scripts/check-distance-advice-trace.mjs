import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const trace = fs.readFileSync('js/bridge-distance-advice-trace.js', 'utf8');
const bridge = fs.readFileSync('bridge-distance.html', 'utf8');
const checkpoint = fs.readFileSync('js/bridge-distance-checkpoint.js', 'utf8');
const ruleset = JSON.parse(fs.readFileSync('data/distance-advice/ruleset-v0.1.json', 'utf8'));

new vm.Script(trace, { filename: 'js/bridge-distance-advice-trace.js' });

assert.ok(trace.includes("const TRACE_VERSION = '0.1.0'"), 'Advice trace schema version missing');
assert.ok(trace.includes(`const RULESET_ID = '${ruleset.ruleset_id}'`), 'Advice trace ruleset id must match ruleset metadata');
assert.ok(trace.includes('distanceAdviceResult'), 'Advice trace must persist into the Campsite Project');
assert.ok(trace.includes('designSignature'), 'Advice trace must preserve the checked design signature');
assert.ok(trace.includes('matchedRuleIds'), 'Advice trace must preserve matched rule ids');
assert.ok(trace.includes('selectedCompoundRuleIds'), 'Advice trace must preserve selected compound rule ids');
assert.ok(trace.includes('fallbackIds'), 'Advice trace must preserve fallback ids');
assert.ok(trace.includes('shownAdvice'), 'Advice trace must preserve the advice actually shown');
assert.ok(trace.includes('factsUsed'), 'Advice trace must preserve facts used by each shown advice');
assert.ok(trace.includes('behaviorTags'), 'Advice trace must preserve behavior tags for future training');
assert.ok(trace.includes('group_size'), 'Advice trace must include optional Campsite AI group size input');
assert.ok(trace.includes('cluster_length_m'), 'Advice trace must include optional Campsite AI cluster length input');
assert.ok(trace.includes('expected_stop_points'), 'Advice trace must include optional Campsite AI stop-point input');
assert.ok(trace.includes("status: 'stale'"), 'Stale designs must invalidate the recorded advice trace');
assert.ok(trace.includes('staleAt'), 'Advice trace must record when it became stale');
assert.ok(trace.includes('accepted: null'), 'Future CA acceptance feedback field missing');
assert.ok(trace.includes('eventOutcomeNotes: null'), 'Future event outcome feedback field missing');
assert.ok(!trace.includes('fetch('), 'Advice trace must not transmit project/training data externally');

// 💾 セーブする must preserve the whole Campsite Project, including distanceAdviceResult,
// inside campsites-project.json. Do not replace this with a filtered export object later.
assert.ok(checkpoint.includes("zip.file('campsite-project.json', JSON.stringify(project, null, 2))"), 'Backup KMZ must serialize the full Campsite Project so advice provenance survives');
assert.ok(!checkpoint.includes("delete project.distanceAdviceResult"), 'Backup KMZ must not strip distanceAdviceResult');

const enginePos = bridge.indexOf('js/distance-advice-engine.js?v=1');
const uiPos = bridge.indexOf('js/bridge-distance-mission-ui.js?v=1');
const gatePos = bridge.indexOf('js/bridge-distance-mission-gate.js?v=1');
const tracePos = bridge.indexOf('js/bridge-distance-advice-trace.js?v=1');
assert.ok(enginePos >= 0, 'Advice engine must stay loaded');
assert.ok(uiPos > enginePos, 'Mission UI must load after advice engine');
assert.ok(gatePos > uiPos, 'Mission gate must load after mission UI');
assert.ok(tracePos > gatePos, 'Advice trace must load last, after mission rendering/gating');

console.log('Distance advice provenance trace checks: OK');
