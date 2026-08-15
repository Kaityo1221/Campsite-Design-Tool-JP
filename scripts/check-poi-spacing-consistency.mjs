import fs from 'node:fs';
import vm from 'node:vm';

const read = path => fs.readFileSync(path, 'utf8');
const fail = message => {
  throw new Error(`POI spacing consistency: ${message}`);
};

const context = { window: {} };
vm.createContext(context);
vm.runInContext(read('js/poi-spacing-config.js'), context, {
  filename: 'js/poi-spacing-config.js'
});

const policy = context.window.CampsitePoiSpacingPolicy;
if (!policy) fail('shared policy was not initialized');
if (policy.targetMeters !== 50) fail('target distance must be 50m');
if (JSON.stringify([...policy.referenceMeters]) !== '[30,40]') {
  fail('reference distances must be 30m and 40m');
}

const expectedBands = new Map([
  [29.9, 'danger'],
  [30, 'caution'],
  [39.9, 'caution'],
  [40, 'near'],
  [49.9, 'near'],
  [50, 'ok']
]);
for (const [distance, expected] of expectedBands) {
  const actual = policy.distanceBand(distance);
  if (actual !== expected) fail(`${distance}m must be ${expected}, got ${actual}`);
}

const fieldHtml = read('field-mode.html');
for (const token of [
  'js/poi-spacing-config.js?v=1',
  'radius:TARGET_DISTANCE',
  'SPACING_POLICY.distanceBand(nearest)',
  '${TARGET_DISTANCE}m未満'
]) {
  if (!fieldHtml.includes(token)) fail(`field mode is missing ${token}`);
}

const prepHtml = read('field-prep.html');
if (!prepHtml.includes('js/poi-spacing-config.js?v=1')) {
  fail('field preparation does not load the shared policy');
}

const prepMap = read('js/field-prep-map.js');
for (const token of [
  'spacing.targetMeters',
  'spacing.targetCircleFolder',
  'spacing.referenceCircleFolders[30]',
  'spacing.referenceCircleFolders[40]'
]) {
  if (!prepMap.includes(token)) fail(`field preparation is missing ${token}`);
}

for (const path of ['js/field-mode-export.js', 'js/field-mode-area.js']) {
  const source = read(path);
  for (const token of [
    'targetCircleFolder',
    'referenceCircleFolders[30]',
    'referenceCircleFolders[40]',
    "allRecords.forEach(record=>folder50.appendChild(createCirclePlacemark(doc,record"
  ]) {
    if (!source.includes(token)) fail(`${path} is missing ${token}`);
  }
}

const distanceTool = read('js/field-mode-distance-tool.js');
if (!distanceTool.includes('return spacing.distanceBand(distance)')) {
  fail('field distance tool does not use the shared distance judgment');
}

const mainLoader = read('js/kmz-upload.js');
const configLoad = mainLoader.indexOf('import("./poi-spacing-config.js?v=1")');
const policyLoad = mainLoader.indexOf('import("./poi-spacing-policy.js?v=5")');
if (configLoad < 0 || policyLoad <= configLoad) {
  fail('main tool must load the shared config before the policy adapters');
}

const mainPolicy = read('js/poi-spacing-policy.js');
for (const token of [
  'POLICY.distanceBand(distance)',
  'window.CampsitePoiSpacingPolicy.targetMeters'
]) {
  if (!mainPolicy.includes(token)) fail(`main distance judgment is missing ${token}`);
}

const mainDistance = read('js/distance.js');
for (const token of [
  'window.CampsitePoiSpacingPolicy?.targetMeters || 50',
  'if (distance < distanceTargetMeters)',
  '30〜50m（参考距離）',
  '50m未満合計',
  '50m未満の組み合わせがあります。'
]) {
  if (!mainDistance.includes(token)) fail(`main distance check is missing ${token}`);
}

const distanceScore = read('js/distance-score.js');
for (const token of [
  'window.CampsitePoiSpacingPolicy?.targetMeters || 50',
  'w.distance < distanceTargetMeters',
  'd < distanceTargetMeters'
]) {
  if (!distanceScore.includes(token)) fail(`distance score is missing ${token}`);
}

console.log('POI SPACING CONSISTENCY CHECK: GREEN');