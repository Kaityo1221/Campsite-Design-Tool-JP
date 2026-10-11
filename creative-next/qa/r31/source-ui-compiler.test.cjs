const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),acorn=require('acorn');
const {compile,checkExpression,ROOT}=require('./source-ui-compiler.cjs');
const {classify}=require('./functional-groups.cjs');
test('all historical function definitions stay denied and all seven groups account for 46 mixed functions',()=>{
 const x=classify(require('./source-inventory.json'));
 assert.deepEqual(x.counts,{mixed:46,effectful:147,unproven:176});
 assert.equal(x.groups.reduce((n,g)=>n+g.mixed.length,0),46);
 assert(x.definitions.every(d=>d.execution==='DENIED_ORIGINAL_FUNCTION'));
});
test('presentation extraction rejects writes, legacy capabilities, calls and unbound names',()=>{
 for(const expression of ["r.title='changed'","localStorage.getItem('next-lab-creative-v7')","snapshot()","records.push(r)","r.constructor.constructor('return window')()","(()=>{return fetch('/')})()","unknownState.title", "'<img src=x onerror=snapshot()>'"]){
  const ast=acorn.parse('('+expression+')',{ecmaVersion:'latest'}).body[0].expression;
  assert.throws(()=>checkExpression(ast,['r']),expression);
 }
});
test('official production assembly yields only source CSS/templates plus new runtime; no legacy core executes',async()=>{
 const x=await compile();
 assert.equal(x.manifest.patchCount,65);assert.equal(x.manifest.originalFunctionsExecuted,0);assert.equal(x.manifest.unprovenFunctionsAllowed,0);
 assert.equal(x.manifest.legacyScriptsEmitted,0);
 assert(!x.html.includes('const STORE='));assert(!x.html.includes('runtime/map-engine'));
 assert(!x.html.includes('cmPersistCurrent'));assert(!x.html.includes('jp-creative-patch.js'));
 assert(x.html.includes('ui-runtime.mjs'));
 assert(x.manifest.templates.length>=16);
 assert.equal(x.manifest.dynamicStyles[0].id,'cmStyle');
 assert.equal(x.manifest.dynamicStyles[1].id,'cmLayerTapStyle');
});
test('r31 connection code cannot acquire legacy storage, editor/session, history or KMZ capabilities',()=>{
 const code=fs.readFileSync(path.resolve(__dirname,'../../original-ui-r31/ui-runtime.mjs'),'utf8');
 assert.doesNotMatch(code,/\b(?:localStorage|sessionStorage|indexedDB|createIsolatedEditorSession|acceptPrepared\s*\(|exportKmz\s*\(|snapshot\s*\(|records\s*=|undoStack|redoStack)\b/);
 const imports=[...code.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(x=>x[1]);
 assert.deepEqual(imports,['./source-templates.mjs']);
 assert.match(code,/status:'HOLD',changed:false,reason:'PART_A_DATA_DISCONNECTED'/);
});
