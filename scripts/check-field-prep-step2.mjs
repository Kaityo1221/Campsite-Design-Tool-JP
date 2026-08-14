import fs from 'node:fs';

const html = fs.readFileSync('field-prep.html', 'utf8');
const core = fs.readFileSync('js/field-prep.js', 'utf8');
const session = fs.readFileSync('js/field-prep-session.js', 'utf8');
const map = fs.readFileSync('js/field-prep-map.js', 'utf8');
const guide = fs.readFileSync('docs/field-prep-ca-guide.md', 'utf8');

for (const token of [
  'id="fieldPrepSurveySection"',
  'id="fieldPrepMap"',
  'id="fieldPrepSaveKmlButton"',
  'js/field-prep-session.js?v=1',
  'js/field-prep-map.js?v=3'
]) {
  if (!html.includes(token)) throw new Error(`field-prep.html missing token: ${token}`);
}

for (const token of ['restorePreparedData', 'fieldprep:datachanged']) {
  if (!core.includes(token)) throw new Error(`field-prep.js missing token: ${token}`);
}

for (const token of ['campsite-field-prep', 'window.FieldPrepSession']) {
  if (!session.includes(token)) throw new Error(`field-prep-session.js missing token: ${token}`);
}

for (const token of [
  'pointInPolygon',
  "folder('活動範囲')",
  'spacing.targetCircleFolder',
  'spacing.referenceCircleFolders[40]',
  'spacing.referenceCircleFolders[30]',
  'buildFieldKml',
  'surveyPolygon'
]) {
  if (!map.includes(token)) throw new Error(`field-prep-map.js missing token: ${token}`);
}

if (map.includes("folder('調査範囲'")) {
  throw new Error('survey polygon must never be exported');
}

if (!guide.includes('調査範囲') || !guide.includes('活動範囲') || !/別/.test(guide)) {
  throw new Error('CA guide must separate survey and activity areas');
}

console.log('FIELD PREP STEP 2 CHECK: GREEN');
