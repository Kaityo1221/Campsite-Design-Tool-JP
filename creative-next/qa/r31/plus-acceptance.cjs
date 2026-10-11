// Independent fresh candidate-only contexts; native tap, no force/input handler invocation.
const fs=require('node:fs'),path=require('node:path'),{chromium}=require('playwright');
const {fingerprint}=require('./evidence.cjs'),policy=require('./plus-policy.cjs');
async function run(){
 const {contextFor}=require('./ui-runtime-comparison.cjs');
 const browser=await chromium.launch({channel:process.env.R31_BROWSER_CHANNEL||undefined,headless:true}),results=[];
 try{for(const viewport of [{width:390,height:844},{width:393,height:852},{width:1366,height:768}]){
  let item;const checks=[];try{
   item=await contextFor(browser,viewport,'candidate','');
   await item.page.evaluate(()=>{window.__plusView={pois:[],circles:[],areas:[],history:{undo:0,redo:0}};creativeR31.onRequest((action,result)=>__r31Requests.push({action,result}));creativeR31.setViewReader(()=>__plusView);creativeR31.showMap();});
   for(const kind of policy.kinds){
    const before=await item.page.evaluate(()=>({requests:__r31Requests.length,view:JSON.stringify(__plusView)}));
    await item.page.locator('#cmAddFab').tap();await item.page.waitForTimeout(120);
    const opened=await item.page.evaluate(()=>({status:creativeR31.status(),view:JSON.stringify(__plusView),requests:__r31Requests.length,bubbles:[...document.querySelectorAll('.cm-bubble')].filter(n=>{const r=n.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(n).visibility!=='hidden'&&getComputedStyle(n).display!=='none';}).map(n=>n.dataset.layer),bar:!!document.getElementById('cmSafeAddBar')}));
    const stageOne=opened.status.ui.menu===true&&opened.status.ui.mode===null&&opened.status.preview===null&&!opened.bar&&opened.bubbles.length===3&&policy.kinds.every(k=>opened.bubbles.includes(k))&&opened.requests===before.requests&&opened.view===before.view;
    await item.page.locator('.cm-bubble[data-layer="'+kind+'"]').tap();await item.page.waitForTimeout(120);
    const selected=await item.page.evaluate(()=>({status:creativeR31.status(),view:JSON.stringify(__plusView),requests:__r31Requests.length,bar:!!document.getElementById('cmSafeAddBar')}));
    const stageTwo=selected.status.ui.menu===false&&selected.status.ui.mode==='add'&&selected.status.ui.layer===kind&&selected.status.preview?.radius===50&&selected.bar&&selected.requests===before.requests&&selected.view===before.view;
    await item.page.locator('#cmSafeAddConfirm').tap();
    const held=await item.page.evaluate(()=>({requests:__r31Requests.length,last:__r31Requests.at(-1),view:JSON.stringify(__plusView)}));
    const confirm=held.requests===before.requests+1&&held.last.result.status==='HOLD'&&held.last.result.changed===false&&held.view===before.view;
    await item.page.locator('#cmSafeAddCancel').tap();
    const cancelled=await item.page.evaluate(()=>creativeR31.status().ui.mode===null&&creativeR31.status().preview===null);
    checks.push({name:'plus-two-step-'+kind,pass:stageOne&&stageTwo&&confirm&&cancelled,details:{stageOne,stageTwo,confirm,cancelled,opened,selected,held}});
   }
   const beforeDispose=await item.page.evaluate(()=>({storage:__r31Storage,mapStarts:__r31MapStarts,requests:__r31Requests}));
   const coverage=await item.coverage.send('Profiler.takePreciseCoverage');const legacy=coverage.result.filter(s=>/\/creative\/runtime\/|\/creative\/index.html|creative-next\/(phase-1|integration)/.test(s.url));
   const oldCalls=legacy.reduce((n,s)=>n+s.functions.reduce((n,f)=>n+f.ranges.reduce((n,r)=>n+r.count,0),0),0);
   const hiddenRequests=item.trace.filter(u=>u.includes('/creative/runtime/')||/creative-next\/(phase-1|integration)/.test(u));
   await item.page.evaluate(()=>creativeR31.dispose());
   const disposed=await item.page.evaluate(()=>({status:creativeR31.status(),listeners:__r31LiveListeners()}));
   const safe=beforeDispose.storage.length===0&&beforeDispose.mapStarts===1&&oldCalls===0&&hiddenRequests.length===0&&disposed.status.mapCount===0&&disposed.listeners.length===0&&Object.values(disposed.status.resources).every(n=>n===0)&&item.errors.length===0;
   results.push({viewport,status:checks.length===3&&checks.every(c=>c.pass)&&safe?'PASS':'HOLD',checks,safe,beforeDispose,originalFunctionsExecuted:oldCalls,hiddenRequests,disposed,errors:item.errors});
  }catch(e){results.push({viewport,status:'HOLD',checks,error:e.message});}finally{if(item)await item.context.close();}
 }}finally{await browser.close();}
 const report={fingerprint:fingerprint(),policyId:policy.id,status:results.length===3&&results.every(r=>r.status==='PASS')?'PASS':'HOLD',forceClicksUsed:0,independentContexts:true,results};
 fs.writeFileSync(path.join(__dirname,'plus-acceptance.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({plusAcceptance:report.status,results:results.map(r=>({width:r.viewport.width,status:r.status,error:r.error,checks:r.checks.map(c=>({name:c.name,pass:c.pass}))}))}));return report;
}
module.exports={run};if(require.main===module)run().then(r=>{process.exitCode=r.status==='PASS'?0:2;}).catch(e=>{console.error(e);process.exitCode=1;});
