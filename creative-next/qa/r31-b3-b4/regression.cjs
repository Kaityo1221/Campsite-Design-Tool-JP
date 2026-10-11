// Execute frozen B1/B2 browser requirements against the derived presentation.
// Only import/output locations are adapted in memory. Never run frozen builders
// or write their evidence. No assertions, thresholds or action sequences change.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
function derivedBrowser(browser){const make=browser.newContext.bind(browser);browser.newContext=async(...args)=>{
 const context=await make(...args),route=context.route.bind(context);
 context.route=(pattern,handler)=>route(pattern,async request=>{
  if(new URL(request.request().url()).pathname==='/creative-next/original-ui-r31/ui-runtime.mjs')return request.fulfill({status:200,contentType:'application/javascript',body:fs.readFileSync(path.resolve(__dirname,'../../original-ui-r31-b3-b4/ui-runtime.mjs'),'utf8')+'\nif(globalThis.document&&!globalThis.creativeR31)globalThis.creativeR31=mountCreativeUi();'});
  return handler(request);
 });return context;
};return browser;}
function load(name){const file=path.resolve(__dirname,'../r31-b2',name),code=fs.readFileSync(file,'utf8');
 if(code.split("require('./build.cjs').build();").length!==2)throw Error('FROZEN_BROWSER_TARGET_DRIFT');
 const loaded=new Module(file,module);loaded.filename=file;loaded.paths=Module._nodeModulePaths(path.dirname(file));const requireOriginal=loaded.require.bind(loaded);
 loaded.require=id=>{
  if(id==='./b1-compatible-browser.cjs')return {derivedBrowser};
  if(id==='fs')return {...fs,writeFileSync(file,bytes,...args){if(path.dirname(file)!==path.resolve(__dirname,'../r31-b2'))throw Error('FROZEN_WRITE_ATTEMPT');return fs.writeFileSync(path.join(__dirname,'b2-'+path.basename(file)),bytes,...args);}};
  return requireOriginal(id);
 };
 loaded._compile(code.replace("require('./build.cjs').build();",''),file);return loaded.exports;
}
async function run(){const b1=await load('b1-compatible-browser.cjs').run(),b2=await load('browser.cjs').run();const result={status:b1.status==='PASS'&&b2.status==='PASS'?'PASS':'HOLD',b1:b1.status,b2:b2.status,unchangedAssertions:true,frozenFilesWritten:0};console.log(JSON.stringify(result));return result;}
module.exports={run};if(require.main===module)run().then(r=>process.exitCode=r.status==='PASS'?0:1).catch(e=>{console.error(e);process.exitCode=1;});
