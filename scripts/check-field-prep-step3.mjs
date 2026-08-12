import fs from 'node:fs';

const prepSession = fs.readFileSync('js/field-prep-session.js', 'utf8');
const prepMap = fs.readFileSync('js/field-prep-map.js', 'utf8');
const handoff = fs.readFileSync('js/field-mode-handoff.js', 'utf8');
const loader = fs.readFileSync('js/field-mode-line.js', 'utf8');
const fieldMode = fs.readFileSync('field-mode.html', 'utf8');

for (const token of ['createHandoff', 'loadHandoff', 'deleteHandoff', "HANDOFF_PREFIX = 'handoff:'"]) {
  if (!prepSession.includes(token)) throw new Error(`field-prep-session.js missing token: ${token}`);
}

for (const token of ['fieldPrepStartFieldModeButton', '現地モードを開始', 'field-mode.html?handoff=', 'createHandoff']) {
  if (!prepMap.includes(token)) throw new Error(`field-prep-map.js missing token: ${token}`);
}

for (const token of ['campsite-field-prep', 'DataTransfer', "dispatchEvent(new Event('change'", 'waitForFieldLoad', 'replaceState']) {
  if (!handoff.includes(token)) throw new Error(`field-mode-handoff.js missing token: ${token}`);
}

for (const token of ['handoff', 'js/field-mode-handoff.js?v=1', 'data-field-handoff-loader']) {
  if (!loader.includes(token)) throw new Error(`field-mode-line.js missing token: ${token}`);
}

if (!fieldMode.includes('id="fieldModeFile" type="file"')) {
  throw new Error('ordinary field mode file input must remain available');
}

console.log('FIELD PREP STEP 3 CHECK: GREEN');
