import fs from 'node:fs';
import vm from 'node:vm';

const circle=fs.readFileSync('js/field-mode-circle-options.js','utf8');
const loader=fs.readFileSync('js/field-mode-line.js','utf8');
const exporter=fs.readFileSync('js/field-mode-export.js','utf8');
const area=fs.readFileSync('js/field-mode-area.js','utf8');

new vm.Script(circle,{filename:'js/field-mode-circle-options.js'});

for(const token of [
  "CIRCLE_KEY='circle-options-v2'",
  'include30mCircle',
  'include40mCircle',
  '50m 必須',
  '30m参考円：追加しない',
  '40m参考円：追加しない',
  'sourceSignatureFromFile',
  'window.FieldModeCircleOptions='
]){
  if(!circle.includes(token))throw new Error(`reference circle option missing token: ${token}`);
}

if(!loader.includes("loadOnce('js/field-mode-circle-options.js?v=")){
  throw new Error('field-mode-line.js must load field-mode-circle-options.js');
}

for(const [name,code] of [['normal exporter',exporter],['activity-area exporter',area]]){
  if(!code.includes('if(record.include30mCircle)')){
    throw new Error(`${name} must conditionally export 30m reference circles`);
  }
  if(!code.includes('if(record.include40mCircle)')){
    throw new Error(`${name} must conditionally export 40m reference circles`);
  }
  if(!code.includes("allRecords.forEach(record=>folder50.appendChild(createCirclePlacemark(doc,record")){
    throw new Error(`${name} must rebuild 50m circles for every active POI`);
  }
}

if(!exporter.includes('include30mCircle:false,include40mCircle:false')){
  throw new Error('new POIs must default to no 30m/40m reference circles');
}

console.log('FIELD COMPLETE STEP 5 CHECK: GREEN');
