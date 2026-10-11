const fs=require('fs'),path=require('path'),crypto=require('crypto');
const ROOT=path.resolve(__dirname,'../../..'),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8').replace(/\r\n/g,'\n');
function freeze(){return ['creative-next/original-ui-r31','creative-next/original-ui-r31-b1','creative-next/qa/r31','creative-next/qa/r31-b1'].flatMap(dir=>{const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?(e.name==='artifacts'?[]:walk(path.join(d,e.name))):/\.(mjs|cjs|html|json|png|md)$/.test(e.name)?[path.join(d,e.name)]:[]);return walk(path.join(ROOT,dir));}).sort().map(f=>({file:path.relative(ROOT,f).replace(/\\/g,'/'),sha256:hash(/\.(png)$/.test(f)?fs.readFileSync(f):fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n'))}));}
function checkFreeze(){const expected=require('./baseline-freeze.json');const actual=freeze();if(JSON.stringify(actual)!==JSON.stringify(expected.files))throw Error('PART_A_B1_FREEZE_DRIFT');require('../r31-b1/build.cjs').build();}
function build(){checkFreeze();const patches=[];
 function transform(input,name,edits){let code=input;for(const [before,after]of edits){if(code.split(before).length!==2)throw Error('B2_PATCH_TARGET_DRIFT:'+name+':'+before.slice(0,60));code=code.replace(before,after);patches.push({file:name,target:before.slice(0,80)});}return code;}
 const ui=transform(read('creative-next/original-ui-r31-b1/ui-runtime.mjs'),'ui-runtime.mjs',[
 ['let draftPoints=[]','let viewInitialized=false,circleTouched=false,viewAreaCount=0;\n let draftPoints=[]'],
 ["if(action.type==='change-kind')openSheet(action.id);message", "if(action.type==='change-kind')openSheet(action.id);if(['area-create','area-redraw','area-delete'].includes(action.type)){clearTools();closeSheet();}message"],
 ["function beginArea(){clearTools();cancelPlacement();closePanels();", "function beginArea(){clearTools();cancelPlacement();if(commandSink)closeSheet();closePanels();"],
 ["listen(draw,'click',()=>{hold({type:'area-redraw'});beginArea();});", "listen(draw,'click',()=>{const result=hold({type:'area-redraw',...(commandSink?{id:frame().areas[0]?.id}:{})});if(!commandSink||result.status==='APPLIED')beginArea();});"],
 ["listen(b,'click',()=>{ui.circleRadii=", "listen(b,'click',()=>{circleTouched=true;ui.circleRadii="],
 ["setViewReader(provider){if(stopped||typeof provider!=='function')throw Error('READ_VIEW_REQUIRED');reader=provider;ui.areaVisible=frame().areas.length>0;ui.circleRadii=[...new Set(frame().circles.map(c=>c.radius))];render();}", "setViewReader(provider){if(stopped||typeof provider!=='function')throw Error('READ_VIEW_REQUIRED');const hadAreas=viewAreaCount>0;reader=provider;viewAreaCount=frame().areas.length;if(!commandSink||!viewInitialized)ui.areaVisible=viewAreaCount>0;else if(!hadAreas&&viewAreaCount)ui.areaVisible=true;if(!commandSink||!circleTouched)ui.circleRadii=[...new Set(frame().circles.map(c=>c.radius))];viewInitialized=true;render();}"],
 ["mode:commandSink?'PART_B1_POI_ONLY'", "mode:commandSink?'PART_B2_POI_AREA'"],
 ["preview:previewCircle?", "drawing:{areas:viewLayers.filter(x=>x.key==='area'&&map?.hasLayer(x.layer)).length,draftLayers:draftLayers.length,deleteLayers:deleteLayers.length,circles:recordCircles.map(c=>({position:[c.getLatLng().lat,c.getLatLng().lng],radius:c.getRadius()}))},preview:previewCircle?"],
 ]);
 // The established 50/40/30m source presentation draws reference overlays
 // around visible POIs; verified Session circles supply the initial radius set.
 const adapter=transform(read('creative-next/original-ui-r31-b1/adapter.mjs'),'adapter.mjs',[
 ['export function connectB1(', 'export function connectB2('],
 ["const POI=new Set", "const AREA=new Set(['area-create','area-redraw','area-delete']);\nconst POI=new Set"],
 ["const seen=new Set(),pending=new Map()", "const usedAreaIds=new Set(initial.areas.map(a=>a.id));\n const seen=new Set(),pending=new Map()"],
 ["if(!action||(!POI.has(action.type)&&!['undo','redo'].includes(action.type)))return hold('B1_SCOPE');", "if(!action||(!POI.has(action.type)&&!AREA.has(action.type)&&!['undo','redo'].includes(action.type)))return hold('B1_SCOPE');"],
 ['let payload;\n  if(POI.has', `let payload;
  if(AREA.has(action.type)){
   if(action.type==='area-create'){
    if(action.id||action.metadata||action.ownerId)return hold('AREA_SOURCE_ID_HOLD');
    let id;do{id='area-r31-b2-'+(++sequence);}while(usedAreaIds.has(id));usedAreaIds.add(id);
    payload={type:'area-create',id,points:action.points};
   }else{
    if(typeof action.id!=='string'||!engine.state().areas.some(a=>a.id===action.id))return hold('AREA_NOT_FOUND');
    payload={type:'area-remove',id:action.id};
   }
  }
  if(POI.has`],
 ["type:POI.has(action.type)?'poi':action.type", "type:POI.has(action.type)?'poi':AREA.has(action.type)?'area':action.type"],
 ['seen.clear();view=null;', 'seen.clear();usedAreaIds.clear();view=null;'],
 ]);
 const out=path.join(ROOT,'creative-next/original-ui-r31-b2');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'ui-runtime.mjs'),ui);fs.writeFileSync(path.join(out,'adapter.mjs'),adapter);
 fs.writeFileSync(path.join(__dirname,'b1-compatible.test.mjs'),read('creative-next/qa/r31-b1/adapter.test.mjs').replace("import {connectB1} from '../../original-ui-r31-b1/adapter.mjs';","import {connectB2 as connectB1} from '../../original-ui-r31-b2/adapter.mjs';"));
 fs.writeFileSync(path.join(__dirname,'b1-compatible-browser.cjs'),read('creative-next/qa/r31-b1/browser.cjs').replaceAll('../../original-ui-r31-b1/ui-runtime.mjs','../../original-ui-r31-b2/ui-runtime.mjs').replace("{connectB1}=await import('/creative-next/original-ui-r31-b1/adapter.mjs')","{connectB2:connectB1}=await import('/creative-next/original-ui-r31-b2/adapter.mjs')").replace("'browser-result.json'","'b1-compatible-browser-result.json'"));
 fs.writeFileSync(path.join(out,'index.html'),read('creative-next/original-ui-r31-b1/index.html').replace('../creative-next/original-ui-r31-b1/ui-runtime.mjs','../creative-next/original-ui-r31-b2/ui-runtime.mjs'));
 const manifest={baseline:'e8436035bf89ee653747c6afbed08e2f43099e9e',uiSha256:hash(ui),adapterSha256:hash(adapter),patches,engineCopied:false,templatesCssUnchanged:true};fs.writeFileSync(path.join(__dirname,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;
}
module.exports={build,freeze,checkFreeze};if(require.main===module)console.log(JSON.stringify(build()));
