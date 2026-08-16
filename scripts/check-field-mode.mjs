import fs from 'node:fs';
import vm from 'node:vm';

const fail=(message)=>{console.error(`❌ ${message}`);process.exitCode=1;};
const pass=(message)=>console.log(`✅ ${message}`);
const read=(path)=>fs.readFileSync(path,'utf8');

const files=[
  'js/field-mode-notes.js',
  'js/field-mode-area.js',
  'js/field-mode-eraser.js',
  'js/field-mode-tool-return.js',
  'js/field-mode-distance-tool.js',
  'js/field-mode-export.js',
  'js/field-mode-creative.js',
  'js/field-mode-session.js',
  'js/field-mode-apac-v4.js'
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

const loaderJs=read('js/field-mode-line.js');
try{
  new vm.Script(loaderJs,{filename:'js/field-mode-line.js'});
  pass('field-mode-line.js 互換ローダー構文OK');
}catch(error){
  fail(`field-mode-line.js 互換ローダー構文エラー: ${error.message}`);
}
for(const token of [
  "loadOnce('js/field-mode-area.js?v=3'",
  "loadOnce('js/field-mode-eraser.js?v=2'",
  "loadOnce('js/field-mode-tool-return.js?v=3'",
  "loadOnce('js/field-mode-distance-tool.js?v=3'",
  "loadOnce('js/field-mode-apac-v4.js?v=1'"
]){
  if(!loaderJs.includes(token))fail(`現地モード互換ローダーが欠けています: ${token}`);
  else pass(`現地モード互換ローダーOK: ${token}`);
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
  'js/field-mode-line.js?v=',
  'js/field-mode-export.js?v=',
  'js/field-mode-creative.js?v=',
  'js/field-mode-session.js?v='
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
  "newPoiButton.textContent='✓ この位置に設置'",
  'window.FieldModeExport={setSourceFile'
]){
  if(!exportJs.includes(token))fail(`新規設置・KMZ復元の安全導線が欠けています: ${token}`);
  else pass(`新規設置・KMZ復元導線OK: ${token}`);
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

const areaJs=read('js/field-mode-area.js');
for(const token of [
  'data-area-action="add"',
  'data-area-action="back"',
  'data-area-action="confirm"',
  "draftPoints.length<3",
  "kind:'area-add'",
  "event.stopImmediatePropagation()",
  "const AREA_FOLDER='活動範囲'",
  "createElement(doc,'Polygon')",
  "createElement(doc,'LinearRing')",
  'const closed=[...record.points,record.points[0]]',
  'areaButton.disabled=false',
  'window.FieldModeArea='
]){
  if(!areaJs.includes(token))fail(`範囲ツールの安全導線が欠けています: ${token}`);
  else pass(`範囲ツール導線OK: ${token}`);
}

const eraserJs=read('js/field-mode-eraser.js');
for(const token of [
  "button.dataset.tool='eraser'",
  "button.innerHTML='<span>🧽</span><small>消去</small>'",
  'data-eraser-action="delete"',
  'data-eraser-action="clear"',
  "kind:'area-delete'",
  "undoStack.push({kind:'delete',record})",
  "event.stopImmediatePropagation()",
  "record.fieldDeleted=true",
  "record.deleted=true",
  'window.FieldModeEraser='
]){
  if(!eraserJs.includes(token))fail(`共通消しゴムの安全導線が欠けています: ${token}`);
  else pass(`共通消しゴム導線OK: ${token}`);
}

const toolReturnJs=read('js/field-mode-tool-return.js');
for(const token of [
  "button.textContent='× 設置中止'",
  "button.textContent='× 位置調整をやめる'",
  "button.textContent='× 消去をやめる'",
  "button.textContent='× 範囲作成をやめる'",
  'cancelAdjustTransient()',
  'creative.openMenu?.()',
  'window.FieldModeToolReturn='
]){
  if(!toolReturnJs.includes(token))fail(`共通ツール終了導線が欠けています: ${token}`);
  else pass(`共通ツール終了導線OK: ${token}`);
}

const distanceJs=read('js/field-mode-distance-tool.js');
for(const token of [
  'data-distance-action="start"',
  'data-distance-action="exit"',
  "button.disabled=false",
  "button.classList.remove('is-coming')",
  "badge.textContent=`📏 ${distance.toFixed(1)} m`",
  "window.FieldModeToolReturn?.toToolbox?.()",
  "window.addEventListener('fieldcreativecancel',cancel)",
  'window.FieldModeDistance='
]){
  if(!distanceJs.includes(token))fail(`距離ツールの安全導線が欠けています: ${token}`);
  else pass(`距離ツール導線OK: ${token}`);
}

const sessionJs=read('js/field-mode-session.js');
for(const token of [
  "const DB_NAME='campsite-field-session'",
  'indexedDB.open(DB_NAME,DB_VERSION)',
  'function persistStateNow()',
  'async function restoreSession(',
  'window.FieldModeSession=',
  '前回の現地作業があります',
  'FieldModeExport?.setSourceFile?.(file)'
]){
  if(!sessionJs.includes(token))fail(`現地作業セッションの復元導線が欠けています: ${token}`);
  else pass(`セッション復元導線OK: ${token}`);
}

const apacJs=read('js/field-mode-apac-v4.js');
for(const token of [
  'const MAX_ADDITIONAL_SPOTS = 25',
  'function recomputeAll(',
  '追加ゲームスポットは最大${MAX_ADDITIONAL_SPOTS}個までです',
  '50m未満だから自動的に設置不可・不合格とは判定しません',
  'function buildExceptionText(',
  'フォーム貼り付け用',
  'spacingExceptionConfirmedSignature',
  'window.FieldModeApacV4 =',
  'noindex'
]){
  if(token==='noindex'){
    if(!html.includes('noindex, nofollow'))fail('CREATIVE MODEの非公開検索制御 noindex が欠けています。');
    else pass('CREATIVE MODE noindex維持');
    continue;
  }
  if(!apacJs.includes(token))fail(`APAC Ver4導線が欠けています: ${token}`);
  else pass(`APAC Ver4導線OK: ${token}`);
}
if(/5\s*[〜~-]\s*15/.test(apacJs))fail('APAC Ver4実装に5〜15個の制限値が混入しています。');
else pass('5〜15個を制限値として使用していません');

if(process.exitCode){
  console.error('\n現地モード安全チェック: NG');
  process.exit(process.exitCode);
}
console.log('\n現地モード安全チェック: ALL GREEN 🟢');
