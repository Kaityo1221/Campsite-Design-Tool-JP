const test=require('node:test'),assert=require('node:assert/strict');
const {assemble,patchOrder,scripts}=require('./production-source.cjs');
const {audit,analyze,effects}=require('./source-audit.cjs');
const {verify}=require('./source-freeze.cjs');
test('normal production uses exactly PATCH_FILES and canonical source freeze passes',()=>{
 const names=patchOrder();assert.equal(names.length,65);
 assert.equal(names[0],'creative-patches-v2.js');assert.equal(names.at(-1),'creative-patches-v77-phase-e-ux.js');
 assert(!names.includes('creative-patches-v72-preview-visual-fixes.js'));
 assert.equal(verify().status,'PASS');
});
test('capture runtime transformations and JP without executing the storage-aware application',async()=>{
 const result=await assemble();
 assert.match(result.html,/pendingFiles=\[\]/);
 assert.match(result.html,/id="labModal"/);
 assert.match(result.html,/cmJpFieldFollowupRuntime/);
 assert.match(result.html,/function cmInstallFab\(/);
 assert.match(result.html,/function cmV58NewEntryTransition\(/);
 assert.match(result.html,/const STORE='next-lab-creative-v7'/); // retained as source, never run
 assert(!result.inputs.some(x=>/bridge-|wayfarer-/.test(x.source)));
 assert.deepEqual(result.stages.filter(x=>/creative-patches-/.test(x.source)).map(x=>x.source.split('/').pop()),patchOrder());
});
test('stable function provenance survives inserted script tags; mixed UI never receives PASS',async()=>{
 const result=await audit();
 const get=name=>result.definitions.find(x=>x.name===name);
 assert.equal(result.status,'HOLD');assert.equal(result.partB,'NOT_STARTED');
 assert.equal(get('cmInstallFab').source,'creative/runtime/creative-patches-v6-intuitive.js');
 assert.equal(get('cmOpenRecord').source,'creative/jp-creative-patch.js');
 for(const name of ['cmInstallFab','cmInstallEntryHistory','cmOpenRecord','cmSafeInstallAddBar','cmOpenSaveMenu']){
  assert.equal(get(name).classification,'MIXED_UI_REQUIRES_SEPARATION');
  assert(get(name).transitiveReasons.includes('LEGACY_PERSISTENCE'));
 }
 assert(get('cmOpenRecord').reasons.includes('LEGACY_DATA_WRITE'));
 assert(get('cmInstallUi').transitiveReasons.includes('LEGACY_KMZ'));
});
test('static scanner finds direct mutation, save, render and timer effects inside event closures',()=>{
 const fn=analyze("function sheet(r){const el=document.createElement('div');el.onclick=()=>{r.title='x';records.push(r);snapshot();pushHistory({});drawAll();setInterval(snapshot,2500)};return el}").functions[0];
 const result=effects(fn);
 for(const reason of ['LEGACY_DATA_WRITE','LEGACY_PERSISTENCE','LEGACY_HISTORY','LEGACY_MAP_RENDER','TIMER_REQUIRES_TEARDOWN'])assert(result.reasons.includes(reason));
 assert(result.ui.includes('DYNAMIC_DOM'));
});
test('source assembly includes dynamic CSS/UI code that script removal would lose',async()=>{
 const {html}=await assemble();
 const parsed=scripts(html),core=parsed.find(s=>s.id==='production-core');
 assert(core);assert.match(core.code,/function cmAddStyle\(/);
 assert.match(core.code,/cm-sheet-handle/);
 const stripped=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 assert(!stripped.includes('function cmInstallFab('));
 assert(!stripped.includes('id="cmAddFab"'));
 assert(!stripped.includes('id="cmV59HelpButton"'));
 assert(!stripped.includes('id="cmV60RulesPanel"'));
});
