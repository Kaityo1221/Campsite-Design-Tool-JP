// Fail closed on absent, incomplete, stale or failed measured evidence.
const fs=require('node:fs'),path=require('node:path');
const required=require('./part-a-groups.cjs'),requiredOperations=require('./part-a-operation-requirements.cjs'),{fingerprint}=require('./evidence.cjs');
function evaluate({comparison,regression,auditTests,isolation},expectedFingerprint){
 const blockers=[],groups={};const deny=(group,reason)=>blockers.push({group,reason});
 for(const [name,report]of Object.entries({comparison,regression,auditTests,isolation}))if(!report||report.fingerprint!==expectedFingerprint)deny(name,'MISSING_OR_STALE_EVIDENCE');
 const widths=[390,393,1366],results=comparison?.results||[];
 for(const [group,names]of Object.entries(required)){
  const missing=widths.flatMap(width=>{const r=results.find(r=>r.viewport.width===width);return names.filter(name=>!r?.scenes?.some(s=>s.name===name&&s.status==='PASS')).map(scene=>({width,scene}));});
  const unverified=widths.flatMap(width=>{const r=results.find(r=>r.viewport.width===width);return requiredOperations[group].filter(name=>!r?.operations?.some(c=>c.name===name&&c.pass)).map(operation=>({width,operation}));});
  groups[group]={status:missing.length||unverified.length?'HOLD':'PASS',requiredScenes:names.length,missing,unverified};if(missing.length||unverified.length)deny(group,'INCOMPLETE_OR_DIFFERENT_UI_OR_OPERATION');
 }
 if(comparison?.status!=='PASS'||results.length!==3||results.some(r=>r.status!=='PASS'||r.scenes.some(s=>s.status!=='PASS')))deny('comparison','UNAPPROVED_UI_DIFFERENCE_OR_INCOMPLETE_RUN');
 if(comparison?.forceClicksUsed!==0)deny('operations','FORCE_CLICK_NOT_ALLOWED');
 const mandatory=['coordinate-copy-value','chooser-cancel','area-confirm-hold','area-delete-hold','area-view-immutable','area-cancel-teardown','sheet-handle-swipe','fab-drag-no-menu','map-double-click-zoom','map-double-tap-zoom','map-pinch-zoom','addition-animation-cleanup','startup-transition-completes','all-display-actions-view-immutable'];
 for(const width of widths){const r=results.find(r=>r.viewport.width===width);if(!r){deny('operations','MISSING_WIDTH:'+width);continue;}
  if(mandatory.some(name=>!r.operations?.some(c=>c.name===name&&c.pass))||r.operations?.some(c=>!c.pass)||r.actionErrors?.length)deny('operations','UNVERIFIED_ACTION:'+width);
  if(r.originalFunctionsExecuted!==0||r.hiddenLegacyRequests?.length!==0||r.candidateChecks?.storage?.length!==0||isolation?.legacyScriptCount!==0||isolation?.unprovenFunctionsAllowed!==0)deny('isolation','LEGACY_ACCESS_OR_UNVERIFIED_COUNT:'+width);
  if(r.candidateChecks?.status?.mapCount!==1||r.candidateChecks?.mapStarts!==1||r.candidateChecks?.legacyCapabilities!==false||r.duplicateMountRejected!==true)deny('singleOwner','DUPLICATE_OR_UNVERIFIED_UI_OWNER:'+width);
  if(r.existingReadOnly!==true)deny('existingPOI','EDIT_UI_OR_UNVERIFIED_READ_ONLY:'+width);
  if(!(r.candidateChecks?.proposals?.length>=6)||r.candidateChecks?.proposals?.some(p=>p.result.status!=='HOLD'||p.result.changed!==false))deny('holdBoundary','DATA_REQUEST_NOT_HELD:'+width);
  if(r.disposed?.status?.mapCount!==0||r.disposed?.ownedControls!==0||r.disposed?.independentListeners?.length!==0||!r.disposed?.status?.stopped||Object.values(r.disposed?.status?.resources||{missing:1}).some(n=>n!==0))deny('cleanup','RESOURCES_NOT_RELEASED:'+width);
 }
 if(regression?.status!=='PASS'||regression?.passed!==333||regression?.failed!==0||regression?.skipped!==0)deny('regression','333_REGRESSIONS_NOT_PASSED');
 if(auditTests?.status!=='PASS'||auditTests?.tests!==17||auditTests?.passed!==17||auditTests?.failed!==0||auditTests?.skipped!==0||isolation?.status!=='PASS')deny('audit','AUDIT_NOT_PASSED');
 return{partA:blockers.length?'HOLD':'PASS',partB:'NOT_STARTED',progress:'85% / Phase 1 HOLD',deployed:false,fingerprint:expectedFingerprint,groups,blockers,measured:{originalFunctionsExecuted:results.map(r=>({width:r.viewport.width,count:r.originalFunctionsExecuted})),legacyStorageAccesses:results.map(r=>({width:r.viewport.width,count:r.candidateChecks?.storage?.length})),unprovenFunctionsAllowed:isolation?.unprovenFunctionsAllowed,regressionPassed:regression?.passed,auditPassed:auditTests?.passed},safariRealDevice:'NOT_TESTED'};
}
function run(){const read=name=>{try{return JSON.parse(fs.readFileSync(path.join(__dirname,name+'.json'),'utf8'));}catch{return null;}};const result=evaluate({comparison:read('ui-runtime-comparison'),regression:read('regression-result'),auditTests:read('audit-test-result'),isolation:read('isolation-audit')},fingerprint());fs.writeFileSync(path.join(__dirname,'part-a-status.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return result;}
module.exports={evaluate,run};if(require.main===module)process.exitCode=run().partA==='PASS'?0:2;
