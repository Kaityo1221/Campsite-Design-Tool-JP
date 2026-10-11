// Build a script-free, visual-only snapshot from the ACTUAL Creative Mode source.
// Not an alternate design: original base-v7 and ordered production CSS patch transformations.
// The snapshot intentionally cannot read/write user data. No old app scripts execute.
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'../..');
const base=fs.readFileSync(path.join(root,'creative/base-v7.html'),'utf8');
const entry=fs.readFileSync(path.join(root,'creative/index.html'),'utf8');
const m=entry.match(/const PATCH_FILES=(\[[^;]+\]);/);
if(!m)throw Error('Production patch order missing');
const names=JSON.parse(m[1]);
const context=vm.createContext({window:{applyCreativePatches:(s)=>s},console});
for(const name of names){
 const code=fs.readFileSync(path.join(root,'creative/runtime',name),'utf8');
 vm.runInContext(code,context,{filename:name,timeout:2000});
}
let html=context.window.applyCreativePatches(base);
if(!html.includes('cmV58NewEntryStyle')||!html.includes('cmV73ProductionVisualStyle'))throw Error('Expected visual patches not applied');
// Remove all executable code and dynamic external content, retaining original HTML / CSS / class names.
html=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
html=html.replace(/<script\b[^>]*\/>/gi,'');
html=html.replace(/<script\b[^>]*src=[^>]*>/gi,'');
html=html.replace(/<link\b[^>]*rel=["']?modulepreload[^>]*>/gi,'');
html=html.replace(/\bon(?:click|input|change|submit|load|error|touchstart|touchend|pointerdown|pointerup)\s*=\s*(?:"[^"]*"|'[^']*')/gi,'');
html=html.replace(/https:\/\/raw\.githubusercontent\.com\/Kaityo1221\/campsite-design-tool-adv-lab\/main\/creative\/runtime\/assets\/creative-mode-opening\.png/g,'../assets/creative-mode-opening-final.webp');
html=html.replace(/url\(['"]?\.\.\/assets\/creative-mode-opening-final\.webp['"]?\)/g,"url('../assets/creative-mode-opening-final.webp')");
html=html.replace(/<title>[^<]*<\/title>/i,'<title>Creative Next | 現行UI表示検証</title>');
// Match production v58 runtime visible text, without running its original storage-aware scripting.
html=html.replace(/(<[^>]*class=["'][^"']*entry-title[^"']*["'][^>]*>)[\s\S]*?(<\/[^>]+>)/i,'$1CREATIVE MODE$2');
html=html.replace(/(<[^>]*class=["'][^"']*entry-copy[^"']*["'][^>]*>)[\s\S]*?(<\/[^>]+>)/i,'$1新しい世界の幕開けへ。$2');
html=html.replace(/(<button\b[^>]*id=["']startButton["'][^>]*>)[\s\S]*?(<\/button>)/i,'$1創作をはじめる$2');
html=html.replace(/(<strong\b[^>]*>)(?:CSV|KMZ|[^<]*データ[^<]*)(<\/strong>)/i,'$1地図データ（KMZ）を選択$2');
// Ensure content is truly read-only: all controls disabled; no iframe/script capable of running.
html=html.replace(/<(button|input|select|textarea)\b([^>]*)>/gi,(all,tag,attrs)=>'<'+tag+attrs.replace(/\s+disabled(?:=(?:"[^"]*"|'[^']*'|\S+))?/gi,'')+' disabled>');
html=html.replace(/<iframe\b[\s\S]*?<\/iframe>/gi,'');
html=html.replace(/<iframe\b[^>]*>/gi,'');
html=html.replace('</head>','<meta name="robots" content="noindex,nofollow,noarchive"></head>');
const out=path.join(root,'creative-next/exact-ui-snapshot');
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'index.html'),html);
const interactive=path.join(root,'creative-next/original-ui-r17');
fs.mkdirSync(interactive,{recursive:true});
fs.writeFileSync(path.join(interactive,'index.html'),html.replace('</body>','<script type="module" src="./r17-undo-redo.mjs"></script></body>'));
const r18=path.join(root,'creative-next/original-ui-r18');
fs.mkdirSync(r18,{recursive:true});
fs.writeFileSync(path.join(r18,'index.html'),html.replace('</body>','<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script><script type="module" src="./r18-real-engine.mjs"></script></body>'));


const r19=path.join(root,'creative-next/original-ui-r19');
fs.mkdirSync(r19,{recursive:true});
fs.writeFileSync(path.join(r19,'index.html'),html.replace('</body>','<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script><script type="module" src="./r19-file-review.mjs"></script></body>'));
const r20=path.join(root,'creative-next/original-ui-r20');
fs.mkdirSync(r20,{recursive:true});
fs.writeFileSync(path.join(r20,'index.html'),html.replace('</body>','<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script type="module" src="./r20-readonly-map.mjs"></script></body>'));
// r22 iOS: native picker must be enabled BEFORE any module/CND load.
const r22=path.join(root,'creative-next/original-ui-r22');
fs.mkdirSync(r22,{recursive:true});
let foundNative=false;
let native=html.replace(/<input[^>]*id=["']entryFile["'][^>]*>/i,tag=>{foundNative=true;return tag.replace(/\sdisabled(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi,'')});
if(!foundNative)throw Error('Original native picker missing');
// Gate the generated HTML, not merely the regex or the original source template.
const nativeInput=native.match(/<input\b[^>]*\bid=["']entryFile["'][^>]*>/i)?.[0];
if(!nativeInput || !/\btype=["']file["']/i.test(nativeInput) || /\sdisabled\b/i.test(nativeInput)){
  throw Error('R22_NATIVE_FILE_PICKER_DISABLED: generated #entryFile must be an enabled file input');
}
native=native.replace('</body>', '<script>window.addEventListener("error",function(e){var el=document.getElementById("entryState");if(el)el.textContent="起動エラー: "+String(e.message||"unknown").slice(0,90)});document.getElementById("entryFile").addEventListener("change",function(){var f=this.files&&this.files[0];if(f){document.getElementById("entryFileName").textContent=f.name;document.getElementById("entryState").textContent="ファイルを選択しました。読み込み準備中…"}});</script></body>');
native=native.replace('</body>','<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script type="module" src="./r22-readonly-map.mjs"></script></body>');
fs.writeFileSync(path.join(r22,'index.html'),native);
// r25: exact same approved HTML/CSS; only attach isolated behavior to map controls.
// The invisible touch-action rule suppresses Safari double-tap page zoom on controls.
const r25=path.join(root,'creative-next/original-ui-r25');
fs.mkdirSync(r25,{recursive:true});
const r25html=native
 .replace('./r22-readonly-map.mjs','./r25-map-controls.mjs')
 .replace('</head>','<style id="cmNextTapGuard">button,.filebar{touch-action:manipulation!important;-webkit-tap-highlight-color:transparent}</style></head>');
if(!r25html.includes('./r25-map-controls.mjs')||!r25html.includes('id="cmNextTapGuard"'))throw Error('R25_CONTROL_BUILD_FAILED');
fs.writeFileSync(path.join(r25,'index.html'),r25html);
// r26: retain the exact approved r25 visual HTML; restrict only map-control gestures.
// This guard is a classic script so Safari receives its non-passive touch listeners
// before the deferred Creative Next map module can be used.
const r26=path.join(root,'creative-next/original-ui-r26');
fs.mkdirSync(r26,{recursive:true});
const r26Style='<style id="cmNextR26TapGuard">#map,.leaflet-container,.topbtn,.toolbox,.save,.bottom-bar button,#toolMenu button,#layerPanel button,#circlePanel button{touch-action:none!important}.topbtn,.toolbox,.save,.bottom-bar button,#toolMenu button,#layerPanel button,#circlePanel button{-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}</style>';
const r26Guard='<script src="./r26-ios-tap-guard.js"></script>';
const r26html=r25html
 .replace('</head>',r26Style+'</head>')
 .replace('<script type="module" src="./r25-map-controls.mjs"></script>',r26Guard+'<script type="module" src="./r25-map-controls.mjs"></script>');
if(!r26html.includes('id="cmNextR26TapGuard"')||!r26html.includes(r26Guard))throw Error('R26_TAP_GUARD_BUILD_FAILED');
fs.writeFileSync(path.join(r26,'index.html'),r26html);
// r27: original POI popup, preserving r26 HTML and all visual patch styling.
const r27=path.join(root,'creative-next/original-ui-r27');
fs.mkdirSync(r27,{recursive:true});
const r27Style='<style id="cmNextR27PopupTapGuard">.popup-form button,.popup-form select{touch-action:none!important;-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}</style>';
const r27html=r26html
 .replace('./r26-ios-tap-guard.js','./r27-ios-tap-guard.js')
 .replace('./r25-map-controls.mjs','./r27-poi-editor.mjs')
 .replace('</head>',r27Style+'</head>');
if(!r27html.includes('id="cmNextR27PopupTapGuard"')||!r27html.includes('./r27-poi-editor.mjs')||!r27html.includes('./r27-ios-tap-guard.js'))throw Error('R27_GENERATION_MISSING');
fs.writeFileSync(path.join(r27,'index.html'),r27html);
// r28: POI sheet visual rules are extracted from the actual production v6 patch,
// rather than recreating their layout with a new design. Only new POIs are editable.
const r28=path.join(root,'creative-next/original-ui-r28');
fs.mkdirSync(r28,{recursive:true});
const v6=fs.readFileSync(path.join(root,'creative/runtime/creative-patches-v6-intuitive.js'),'utf8');
const sheetBegin=v6.indexOf('.cm-sheet{'),sheetEnd=v6.indexOf('.cm-list,',sheetBegin);
if(sheetBegin<0||sheetEnd<sheetBegin)throw Error('R28_SOURCE_SHEET_CSS_NOT_FOUND');
const sourceSheetCss=v6.slice(sheetBegin,sheetEnd);
if(!sourceSheetCss.includes('.cm-sheet-handle')||!sourceSheetCss.includes('.cm-type-picker'))
 throw Error('R28_SOURCE_SHEET_CSS_INCOMPLETE');
const r28Style='<style id="cmNextR28OriginalSheetStyle">'+sourceSheetCss+
'.cm-existing-readonly{margin-top:10px;font-size:12px;color:#756650}' +
'.cm-sheet button{touch-action:none!important;-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important}' +
'</style>';
const r28html=r26html
 .replace('./r26-ios-tap-guard.js','./r28-ios-tap-guard.js')
 .replace('./r25-map-controls.mjs','./r28-poi-editor.mjs')
 .replace('</head>',r28Style+'</head>');
if(!r28html.includes('id="cmNextR28OriginalSheetStyle"')||!r28html.includes('./r28-poi-editor.mjs'))
 throw Error('R28_GENERATION_MISSING');
fs.writeFileSync(path.join(r28,'index.html'),r28html);

// r29: exactly the approved r28 visual shell, with a versioned controller.
// The only behavior delta synchronizes the six existing layer count labels.
const r29=path.join(root,'creative-next/original-ui-r29');
fs.mkdirSync(r29,{recursive:true});
const r29html=r28html
 .replace('./r28-ios-tap-guard.js','./r29-ios-tap-guard.js')
 .replace('./r28-poi-editor.mjs','./r29-poi-editor.mjs');
if(!r29html.includes('id="cmNextR28OriginalSheetStyle"')||
   !r29html.includes('./r29-poi-editor.mjs')||!r29html.includes('./r29-ios-tap-guard.js'))
 throw Error('R29_EXACT_VISUAL_BUILD_FAILED');
fs.writeFileSync(path.join(r29,'index.html'),r29html);




if(/<script\b/i.test(html))throw Error('Runtime script escaped snapshot');
console.log('PASS: production source snapshot',names.length,'patches, scripts stripped, original visual CSS retained');
