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
let native=html.replace(/<input[^>]*id=["']entryFile["'][^>]*>/i,tag=>{foundNative=true;return tag.replace(/\\sdisabled(?:=["']?disabled["']?)?/i,'')});
if(!foundNative)throw Error('Original native picker missing');
native=native.replace('</body>', '<script>window.addEventListener("error",function(e){var el=document.getElementById("entryState");if(el)el.textContent="起動エラー: "+String(e.message||"unknown").slice(0,90)});document.getElementById("entryFile").addEventListener("change",function(){var f=this.files&&this.files[0];if(f){document.getElementById("entryFileName").textContent=f.name;document.getElementById("entryState").textContent="ファイルを選択しました。読み込み準備中…"}});</script></body>');
native=native.replace('</body>','<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script type="module" src="./r22-readonly-map.mjs"></script></body>');
fs.writeFileSync(path.join(r22,'index.html'),native);
if(/<script\b/i.test(html))throw Error('Runtime script escaped snapshot');
console.log('PASS: production source snapshot',names.length,'patches, scripts stripped, original visual CSS retained');
