import fs from 'node:fs';

const exporter = fs.readFileSync('js/field-mode-export.js', 'utf8');
const area = fs.readFileSync('js/field-mode-area.js', 'utf8');

for (const folder of ['追加希望ポケスト', '追加希望ジム', '追加希望パワスポ']) {
  if (!exporter.includes(folder)) throw new Error(`field-mode-export.js missing formal folder: ${folder}`);
}

for (const token of ['ADDITIONAL_FOLDER_BY_TYPE', 'additionalFolderName(type.value)', 'additionalFolderName(record.poiType,record.folder)', 'window.FieldModeExport={setSourceFile,additionalFolderName}']) {
  if (!exporter.includes(token)) throw new Error(`field-mode-export.js missing routing token: ${token}`);
}

if (!area.includes('additionalFolderName(record)')) {
  throw new Error('activity-area exporter must route new POIs through formal folders');
}

if (/ensureTargetFolder\(doc,documentNode,'追加希望POI'\)/.test(exporter)) {
  throw new Error('normal exporter still targets generic 追加希望POI');
}

if (/ensureTargetFolder\(doc,documentNode,'追加希望POI'\)/.test(area)) {
  throw new Error('activity-area exporter still targets generic 追加希望POI');
}

console.log('FIELD LAYER STEP 4 CHECK: GREEN');
