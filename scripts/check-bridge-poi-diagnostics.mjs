import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const parserSource = fs.readFileSync('bridge-pc/poi-parser.js', 'utf8');
const classifierSource = fs.readFileSync('bridge-pc/poi-classifier.js', 'utf8');
const diagnosticsSource = fs.readFileSync('bridge-pc/poi-diagnostics.js', 'utf8');
const exporterSource = fs.readFileSync('bridge-pc/bridge-v1-exporter.js', 'utf8');
const contentSource = fs.readFileSync('bridge-pc/content.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('bridge-pc/manifest.json', 'utf8'));

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(parserSource, sandbox);
vm.runInContext(classifierSource, sandbox);
vm.runInContext(diagnosticsSource, sandbox);
vm.runInContext(exporterSource, sandbox);

const parser = sandbox.window.CampsiteBridgePoiParser;
const classifier = sandbox.window.CampsiteBridgePoiClassifier;
const diagnostics = sandbox.window.CampsiteBridgePoiDiagnostics;
const exporter = sandbox.window.CampsiteBridgeV1Exporter;
assert.ok(diagnostics, 'Diagnostics API missing');

const payload = { data: { pois: [
  { poiId:'stop', title:'Stop', lat:35, lng:139, gmo:[{ entity:'POKESTOP', status:'ACTIVE' }] },
  { poiId:'unknown', title:'Unknown GMO', lat:35.1, lng:139.1, gmo:[{ entity:'', status:'ACTIVE' }] },
  { poiId:'bad-coord', title:'Bad coord', lat:999, lng:139, gmo:[] },
  { title:'No GUID', lat:35.2, lng:139.2, gmo:[] },
  { poiId:'stop', title:'Stop duplicate', lat:35, lng:139, gmo:[{ entity:'POKESTOP', status:'ACTIVE' }] },
  { poiId:'portal', title:'Game outside', lat:35.3, lng:139.3, gmo:[] }
]}};

const parsed = parser.parsePayload(payload);
const classified = classifier.run(parsed);
const report = diagnostics.build(parsed, classified);

assert.equal(report.hasIssues, true);
assert.equal(report.status, 'warning');
assert.equal(report.counts.missingGuid, 1);
assert.equal(report.counts.invalidCoordinates, 1);
assert.equal(report.counts.invalidObject, 0);
assert.equal(report.counts.unknown, 1);
assert.equal(report.counts.duplicateGuid, 1);
assert.equal(report.issueCount, 4);
assert.equal(report.notInGameCount, 1);
assert.equal(report.exportCount, 1);
assert.ok(report.items.some(item => item.code === 'MISSING_GUID'));
assert.ok(report.items.some(item => item.code === 'INVALID_COORDINATES'));
assert.ok(report.items.some(item => item.code === 'AMBIGUOUS_GAME_OBJECT'));
assert.ok(report.items.some(item => item.code === 'DUPLICATE_GUID'));
assert.equal(diagnostics.summary(report), 'GUID欠損 1 / 座標不正 1 / 分類不能 1 / 重複 1');

const cleanParsed = parser.parsePayload({ data:{ pois:[
  { poiId:'gym', title:'Gym', lat:35, lng:139, gmo:[{ entity:'GYM', status:'ACTIVE' }] }
]}});
const cleanClassified = classifier.run(cleanParsed);
const cleanReport = diagnostics.build(cleanParsed, cleanClassified);
assert.equal(cleanReport.hasIssues, false);
assert.equal(cleanReport.issueCount, 0);
assert.equal(diagnostics.summary(cleanReport), '診断上の問題はありません');

const bridgePayload = exporter.makePayload({
  enginePois: classified.pois,
  diagnosticReport: report,
  diagnostics: parsed.diagnostics,
  classificationDiagnostics: classified.classificationDiagnostics
}, 'diag-test');
assert.equal(bridgePayload.pois.length, 1);
assert.equal('diagnosticReport' in bridgePayload, false, 'Diagnostics must never enter Bridge V1');
assert.equal('diagnostics' in bridgePayload, false);
assert.equal('classificationDiagnostics' in bridgePayload, false);

const main = manifest.content_scripts.find(entry => entry.world === 'MAIN');
assert.ok(main.js.includes('poi-diagnostics.js'));
assert.ok(main.js.indexOf('poi-classifier.js') < main.js.indexOf('poi-diagnostics.js'));
assert.ok(main.js.indexOf('poi-diagnostics.js') < main.js.indexOf('page-collector.js'));
assert.ok(contentSource.includes('⚠ 診断'));
assert.ok(contentSource.includes('diagnosticReport'));
assert.ok(contentSource.includes('GUID欠損'));
assert.ok(contentSource.includes('座標不正'));
assert.ok(contentSource.includes('分類不能'));
assert.ok(contentSource.includes('GUID重複'));

console.log('check-bridge-poi-diagnostics: OK');
