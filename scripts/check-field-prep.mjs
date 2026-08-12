import fs from 'node:fs';

const requiredFiles = [
  'field-prep.html',
  'css/field-prep.css',
  'js/field-prep.js',
  'docs/field-prep-ca-guide.md',
  'docs/field-prep-development.md'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    throw new Error(`missing: ${file}`);
  }
}

const html = fs.readFileSync('field-prep.html', 'utf8');
const js = fs.readFileSync('js/field-prep.js', 'utf8');
const guide = fs.readFileSync('docs/field-prep-ca-guide.md', 'utf8');

const htmlTokens = [
  'id="fieldPrepFiles"',
  'multiple',
  'id="fieldPrepAnalyzeButton"',
  'id="fieldPrepResults"',
  'js/util.js?v=3',
  'js/field-prep.js?v='
];

for (const token of htmlTokens) {
  if (!html.includes(token)) throw new Error(`field-prep.html missing token: ${token}`);
}

const jsTokens = [
  'window.parseCSV',
  'window.removeDuplicate',
  'sourceName: file.name',
  'window.FieldPrep'
];

for (const token of jsTokens) {
  if (!js.includes(token)) throw new Error(`field-prep.js missing token: ${token}`);
}

if (!guide.includes('調査範囲') || !guide.includes('活動範囲') || !/別/.test(guide)) {
  throw new Error('CA guide must explain that survey range and activity area are separate');
}

console.log('FIELD PREP CHECK: GREEN');
