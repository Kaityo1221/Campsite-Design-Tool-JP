const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const ROOT=path.resolve(__dirname,'../../..');
async function run(){
 const frozen=['stage-kmz','export-kmz','legacy-reversed-circle','legacy-kasai-convert','dependent-circles','activity-membership','journal-save','journal-web-locks','journal-explicit-recovery','isolated-editor-session'].map(n=>'creative-next/phase-1b/test/'+n+'.test.mjs');
 const files=['creative-next/qa/r31-b3-b4/workspace.test.mjs','creative-next/qa/r31-b3-b4/scope.test.cjs','creative-next/qa/r31-b2/adapter.test.mjs','creative-next/qa/r31-b2/b1-compatible.test.mjs',...frozen];
 const unit=spawnSync(process.execPath,['--test','--test-reporter=tap',...files],{cwd:ROOT,encoding:'utf8'});fs.writeFileSync(path.join(__dirname,'unit-tests.log'),unit.stdout+unit.stderr);if(unit.status!==0)throw Error('UNIT_HOLD: '+unit.stdout.slice(-3000)+unit.stderr);
 const regression=await require('./regression.cjs').run();if(regression.status!=='PASS')throw Error('B2_REGRESSION_HOLD');
 const browser=await require('./browser.cjs').run();
 const result={status:browser.status==='PASS'?'PASS':'HOLD',unitPassed:Number(unit.stdout.match(/^# pass (\d+)$/m)?.[1]),unitFailed:0,b2Regression:regression.status,b3b4Browser:browser.status,sourceBase:'7ef98ad4250af8f2d1a1458d289d3ed1989a8da7',safariRealDevice:'NOT_TESTED',productionMerged:false,published:false};
 fs.writeFileSync(path.join(__dirname,'final-status.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));return result;
}
module.exports={run};if(require.main===module)run().then(r=>process.exitCode=r.status==='PASS'?0:1).catch(e=>{console.error(e);process.exitCode=1;});
