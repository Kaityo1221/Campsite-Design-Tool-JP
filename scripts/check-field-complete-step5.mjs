import fs from 'node:fs';
import vm from 'node:vm';

const circle=fs.readFileSync('js/field-mode-circle-options.js','utf8');
const loader=fs.readFileSync('js/field-mode-line.js','utf8');
const exporter=fs.readFileSync('js/field-mode-export.js','utf8');
const area=fs.readFileSync('js/field-mode-area.js','utf8');

new vm.Script(circle,{filename:'js/field-mode-circle-options.js'});

for(const token of [
  "CIRCLE_KEY='circle-options-v1'",
  'include30mCircle',
  '30m調整円：追加しない',
  '30m調整円：追加する ✓',
  'sourceSignatureFromFile',
  'window.FieldModeCircleOptions='
]){
  if(!circle.includes(token))throw new Error(`30m circle option missing token: ${token}`);
}

if(!loader.includes("loadOnce('js/field-mode-circle-options.js?v=")){
  throw new Error('field-mode-line.js must load field-mode-circle-options.js');
}

for(const [name,code] of [['normal exporter',exporter],['activity-area exporter',area]]){
  if(!code.includes('if(record.include30mCircle)')){
    throw new Error(`${name} must conditionally export 30m circles`);
  }
  if(!code.includes("folder40.appendChild(createCirclePlacemark(doc,record,40")){
    throw new Error(`${name} must always export 40m circles for new POIs`);
  }
}

if(!exporter.includes('include30mCircle:false')){
  throw new Error('new POIs must default to no 30m adjustment circle');
}

console.log('FIELD COMPLETE STEP 5 CHECK: GREEN');
