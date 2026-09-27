import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const creativeIndex = fs.readFileSync('creative/index.html', 'utf8');
const stalePatch = fs.readFileSync('creative/bridge-distance-stale-patch.js', 'utf8');
const distanceProject = fs.readFileSync('js/bridge-distance-project.js', 'utf8');
const distanceBackup = fs.readFileSync('js/bridge-distance-checkpoint.js', 'utf8');
const commentGate = fs.readFileSync('js/bridge-distance-comment-gate.js', 'utf8');

assert.ok(creativeIndex.includes("fetch('./bridge-distance-stale-patch.js'"), 'Creative must load the stale-distance patch');
assert.ok(creativeIndex.includes('html=window.applyCreativeBridgeDistanceStalePatch(html)'), 'Creative must apply the stale-distance patch for Bridge projects');

const context = { window: {}, console, String };
vm.createContext(context);
vm.runInContext(stalePatch, context);
assert.equal(typeof context.window.applyCreativeBridgeDistanceStalePatch, 'function');
const transformed = context.window.applyCreativeBridgeDistanceStalePatch('before\nfunction syncCampsiteProjectFromCreative(project){return project}\nfunction restore(){return true}\nafter');
assert.ok(transformed.includes('function campsProjectDesignSignature(project){'), 'Creative patch must create a deterministic design signature');
assert.ok(transformed.includes("result.stale=true"), 'Creative patch must mark prior distance results stale after design changes');
assert.ok(transformed.includes("result.staleReason='creative-design-changed'"), 'Creative patch must record the stale reason');

assert.ok(distanceProject.includes('designSignature: buildDesignSignature(project)'), 'Distance result must persist the checked design signature');
assert.ok(distanceProject.includes('stale: false'), 'A fresh distance check must clear stale state');
assert.ok(distanceProject.includes('CREATIVE MODEで設計が変更されています。距離チェックを再実行してください。'), 'Distance page must show the rerun warning');
assert.ok(distanceProject.includes("latest?.distanceResult?.stale === true"), 'Pre-submit navigation must reject stale distance results');

assert.ok(distanceBackup.includes('💾 セーブする'), 'Distance backup action must remain available');
assert.ok(distanceBackup.includes("zip.file('campsite-project.json'"), 'Backup KMZ must embed the Campsite Project payload');
assert.ok(distanceBackup.includes('saveBackupKmz'), 'Distance backup must expose the KMZ save action');

assert.ok(commentGate.includes("project?.distanceResult?.stale === true"), 'Comment gate must yield to stale-distance rerun handling');

console.log('distance stale invalidation check: ok');
