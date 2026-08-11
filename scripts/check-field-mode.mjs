import fs from 'node:fs';
import vm from 'node:vm';

const fail=(message)=>{console.error(`❌ ${message}`);process.exitCode=1;};
const pass=(message)=>console.log(`✅ ${message}`);
const read=(path)=>fs.readFileSync(path,'utf8');

const files=[
  'js/field-mode-notes.js',
  'js/field-mode-export.js',
  'js/field-mode-creative.js'
];

for(const path of files){
  const code=read(path);
  if(code.length<500){
    fail(`${path} が短すぎます (${code.length} bytes)。途中で切れている可能性があります。`);
    continue;
  }
  try{
    new vm.Script(code,{filename:path});
    pass(`${path} 構文OK`);
  }catch(error){
    fail(`${path} 構文エラー: ${error.message}`);
  }
}

const html=read('field-mode.html');
const inlineScripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).filter(Boolean);
if(!inlineScripts.length){
  fail('field-mode.html のインラインJSが見つかりません。');
}else{
  inlineScripts.forEach((code,index)=>{
    try{
      new vm.Script(code,{filename:`field-mode.html:inline-${index+1}`});
      pass(`field-mode.html インラインJS ${index+1} 構文OK`);
    }catch(error){
      fail(`field-mode.html インラインJS ${index+1} 構文エラー: ${error.message}`);
    }
  });
}

const requiredHtml=[
  'id="fieldModeMap"',
  'id="fieldModeNewPoiButton"',
  'id="fieldModeUndoButton"',
  'id="fieldModeRedoButton"',
  'id="fieldModeScanButton"',
  'js/field-mode-export.js?v=',
  'js/field-mode-creative.js?v='
];
for(const token of requiredHtml){
  if(!html.includes(token))fail(`field-mode.html 必須要素がありません: ${token}`);
  else pass(`field-mode.html 必須要素OK: ${token}`);
}

const inline=inlineScripts.join('\n');
if(/function\s+updateHistoryButtons\s*\([^)]*\)\s*\{[^}]*updateHistoryButtons\s*\(/s.test(inline)){
  fail('updateHistoryButtons() が自分自身を呼び出しています。Undo/Redoを壊す再帰バグです。');
}else{
  pass('Undo/Redo 自己再帰なし');
}

const exportJs=read('js/field-mode-export.js');
for(const token of [
  "window.addEventListener('fieldcreativecancel',cancelNewPoiPlacement)",
  'function cancelNewPoiPlacement()',
  "newPoiButton.textContent='＋ 新規設置'",
  "newPoiButton.textContent='✓ この位置に設置'"
]){
  if(!exportJs.includes(token))fail(`新規設置の安全導線が欠けています: ${token}`);
  else pass(`新規設置導線OK: ${token}`);
}

const creativeJs=read('js/field-mode-creative.js');
for(const token of [
  "window.dispatchEvent(new CustomEvent('fieldcreativecancel'))",
  'if(menuOpen)',
  'setMenu(false)',
  'openPalette()'
]){
  if(!creativeJs.includes(token))fail(`クリエイティブパレットの安全導線が欠けています: ${token}`);
  else pass(`パレット導線OK: ${token}`);
}

if(process.exitCode){
  console.error('\n現地モード安全チェック: NG');
  process.exit(process.exitCode);
}
console.log('\n現地モード安全チェック: ALL GREEN 🟢');
