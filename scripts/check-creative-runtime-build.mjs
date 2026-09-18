import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

const manifest=JSON.parse(fs.readFileSync('creative/runtime/next-lab-manifest.json','utf8'));
const baseHtml=fs.readFileSync('creative/base-v7.html','utf8');
const jpPatch=fs.readFileSync('creative/jp-creative-patch.js','utf8');
const bridgePatch=fs.readFileSync('creative/bridge-project-patch.js','utf8');

function gitBlobShaBuffer(body){
  return crypto.createHash('sha1').update(Buffer.from('blob '+body.length+'\0')).update(body).digest('hex');
}

for(const [name,expected] of Object.entries(manifest.assets||{})){
  const body=fs.readFileSync('creative/'+name);
  assert.equal(gitBlobShaBuffer(body),expected,'Pinned Next-Lab asset changed: '+name);
}

const context={window:{},console,JSON,String,URLSearchParams};
vm.createContext(context);
context.window.applyCreativePatches=s=>s;

for(const name of manifest.order.slice(1)){
  const source=fs.readFileSync('creative/runtime/'+name,'utf8');
  new vm.Script(source,{filename:'creative/runtime/'+name}).runInContext(context);
  assert.equal(typeof context.window.applyCreativePatches,'function',name+' registration failed');
}

let html=context.window.applyCreativePatches(baseHtml);

new vm.Script(jpPatch,{filename:'creative/jp-creative-patch.js'}).runInContext(context);
assert.equal(typeof context.window.applyCreativeJpPatch,'function','JP Creative patch registration failed');
html=context.window.applyCreativeJpPatch(html);

new vm.Script(bridgePatch,{filename:'creative/bridge-project-patch.js'}).runInContext(context);
assert.equal(typeof context.window.applyCreativeBridgeProjectPatch,'function','Bridge Creative patch registration failed');
html=context.window.applyCreativeBridgeProjectPatch(html);

assert.ok(html.includes('id="locate"'),'Canonical Next-Lab current-location control missing');
assert.ok(html.includes('cmStandaloneSaveButton'),'Canonical Next-Lab standalone save UI missing');
assert.ok(html.includes('cmV37BottomDockStyle'),'Canonical Next-Lab bottom dock missing');
assert.ok(html.includes('cmLayerPanelTopStyle'),'Canonical Next-Lab layer panel position patch missing');
assert.ok(html.includes('campsiteProjectNext'),'Bridge next action missing from final Creative HTML');
assert.ok(!html.includes('installCampsiteProjectMobileUi'),'Legacy JP mobile UI override must stay removed');
assert.ok(html.includes('JP_MAX_ADDITIONAL=25'),'JP design policy helper missing');
assert.ok(html.includes("./assets/pokestop.png"),'Canonical Next-Lab PokéStop icon reference missing');
assert.ok(html.includes("./assets/gym.png"),'Canonical Next-Lab Gym icon reference missing');
assert.ok(html.includes("./assets/powerspot.png"),'Canonical Next-Lab PowerSpot icon reference missing');


function extractScripts(source){
  const scripts=[];
  let cursor=0;
  const close='</script>';
  while(true){
    const open=source.indexOf('<script',cursor);
    if(open<0)break;
    const bodyStart=source.indexOf('>',open);
    if(bodyStart<0)break;
    const end=source.indexOf(close,bodyStart+1);
    if(end<0)break;
    scripts.push(source.slice(bodyStart+1,end));
    cursor=end+close.length;
  }
  return scripts;
}

const scripts=extractScripts(html);
assert.ok(scripts.length>=1,'Generated Creative HTML scripts missing');
scripts.forEach((code,index)=>{
  if(!code.trim())return;
  new vm.Script(code,{filename:`generated-creative-final-${index}.js`});
});

console.log(`Generated Creative final HTML syntax: OK (${scripts.length} scripts)`);
