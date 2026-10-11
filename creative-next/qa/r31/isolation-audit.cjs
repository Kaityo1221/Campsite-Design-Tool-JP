const fs=require('node:fs'),path=require('node:path'),acorn=require('acorn');
const {ROOT,digest}=require('./production-source.cjs');
const {compile,checkExpression}=require('./source-ui-compiler.cjs');
const {classify}=require('./functional-groups.cjs');
const {verify}=require('./source-freeze.cjs');
function walk(n,visit){if(!n?.type)return;visit(n);for(const [k,v]of Object.entries(n)){if(['loc','start','end'].includes(k))continue;if(Array.isArray(v))v.forEach(x=>walk(x,visit));else if(v?.type)walk(v,visit);}}
function inspectRuntime(code){
 const ast=acorn.parse(code,{ecmaVersion:'latest',sourceType:'module'}),errors=[];
 const forbidden=new Set(['eval','Function','AsyncFunction','GeneratorFunction','localStorage','sessionStorage','indexedDB','createIsolatedEditorSession','snapshot','cmPersistCurrent','undoStack','redoStack','drawAll','bridgeMapLab_createMapRenderer','fetch','XMLHttpRequest','WebSocket','Worker','importScripts','showSaveFilePicker']);
 walk(ast,n=>{
  if(n.type==='Identifier'&&forbidden.has(n.name))errors.push('FORBIDDEN_CAPABILITY:'+n.name);
  if(n.type==='ImportExpression')errors.push('DYNAMIC_IMPORT');
  if(n.type==='ImportDeclaration'&&n.source.value!=='./source-templates.mjs')errors.push('UNAPPROVED_MODULE:'+n.source.value);
  if(n.type==='MemberExpression'&&((n.computed&&n.property.type==='Literal'&&['constructor','prototype','__proto__','eval','Function'].includes(n.property.value))||(!n.computed&&['constructor','prototype','__proto__','eval','Function'].includes(n.property.name))))errors.push('INDIRECT_CAPABILITY');
  if(n.type==='MemberExpression'&&n.computed&&!(n.property.type==='Literal'&&typeof n.property.value==='number')&&n.object.type!=='ObjectExpression'){
   let receiver=n.object;while(receiver.type==='MemberExpression')receiver=receiver.object;
   if(receiver.type!=='Identifier'||!['n','source','map','ui','tabs','cards'].includes(receiver.name))errors.push('UNAPPROVED_COMPUTED_RECEIVER:'+receiver.type+':'+(receiver.name||''));
  }
  if(n.type==='CallExpression'&&['setTimeout','setInterval'].includes(n.callee.property?.name||n.callee.name)&&n.arguments[0]?.type==='Literal')errors.push('STRING_TIMER');
 });return{status:errors.length?'FAIL':'PASS',errors};
}
async function audit(){
 const x=await compile(),runtime=fs.readFileSync(path.join(ROOT,'creative-next/original-ui-r31/ui-runtime.mjs'),'utf8'),inspection=inspectRuntime(runtime),policy=classify(require('./source-inventory.json'));
 const generated=acorn.parse(x.templateModule,{ecmaVersion:'latest',sourceType:'module'}),templateErrors=[];
 walk(generated,n=>{if(n.type==='ExportNamedDeclaration')for(const d of n.declaration?.declarations||[])if(d.init?.type==='ArrowFunctionExpression')try{checkExpression(d.init.body,d.init.params.map(p=>p.name));}catch(e){templateErrors.push(d.id.name+':'+e.message);}});
 const emittedScripts=[...x.html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map(m=>m[1].match(/src="([^"]+)"/)?.[1]);
 const approvedScripts=['https://unpkg.com/leaflet@1.9.4/dist/leaflet.js','../creative-next/original-ui-r31/ui-runtime.mjs'];
 const denied=policy.definitions.filter(d=>d.execution==='DENIED_ORIGINAL_FUNCTION').length;
 const result={status:inspection.status==='PASS'&&!templateErrors.length&&denied===369&&JSON.stringify(emittedScripts)===JSON.stringify(approvedScripts)&&verify().status==='PASS'?'PASS':'FAIL',runtimeSha256:digest(runtime.replace(/\r\n/g,'\n')),historicalDefinitions:policy.definitions.length,deniedDefinitions:denied,unprovenFunctionsAllowed:policy.definitions.filter(d=>d.classification==='UNPROVEN'&&d.execution!=='DENIED_ORIGINAL_FUNCTION').length,emittedScripts,legacyScriptCount:emittedScripts.filter(s=>!approvedScripts.includes(s)).length,staticRuntime:inspection,templateErrors,allowlist:x.proofs,proofBoundary:'Only Leaflet and the new presentation module are emitted. No old core/renderer/store/history module or binding is reachable. Browser precise coverage measures executed application script identities.'};
 fs.writeFileSync(path.join(__dirname,'isolation-audit.json'),JSON.stringify(result,null,2)+'\n');return result;
}
module.exports={audit,inspectRuntime};if(require.main===module)audit().then(x=>{console.log(JSON.stringify(x));process.exitCode=x.status==='PASS'?0:1;}).catch(e=>{console.error(e);process.exitCode=1;});
