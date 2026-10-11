const fs=require('fs'),path=require('path'),crypto=require('crypto');const ROOT=path.resolve(__dirname,'../../..');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex'),read=p=>fs.readFileSync(path.join(ROOT,p),'utf8').replace(/\r\n/g,'\n');
function build(){const freeze=require('./part-a-freeze.json');if(require('../r31/evidence.cjs').fingerprint()!==freeze.fingerprint)throw Error('PART_A_FULL_FINGERPRINT_DRIFT');for(const f of freeze.files)if(hash(read(f.file))!==f.sha256)throw Error('PART_A_FREEZE_DRIFT:'+f.file);
 const original=read('creative-next/original-ui-r31/ui-runtime.mjs');let code=original;
 const replace=(before,after)=>{if(code.split(before).length!==2)throw Error('B1_PATCH_TARGET_DRIFT');code=code.replace(before,after);};
 replace("import * as source from './source-templates.mjs';","import * as source from '../original-ui-r31/source-templates.mjs';");
 replace('let reader=readView,observer=onRequest,sequence=0,','let commandSink=null;\n let reader=readView,observer=onRequest,sequence=0,');
 replace("const result=Object.freeze({status:'HOLD',changed:false,reason:'PART_A_DATA_DISCONNECTED'});", `if(commandSink){
   const request=Object.freeze({...action,requestId:'r31-b1-ui-'+(++sequence)}),result=commandSink(request);
   observer(request,result);
   if(result?.changed&&result.status==='APPLIED'){if(action.type==='add'||action.type==='move'||action.type==='coordinate-add'){doc.documentElement.classList.remove('cm-v52-panel-open');cancelPlacement();}if(action.type==='delete'||action.type==='undo'||action.type==='redo')closeSheet();if(action.type==='change-kind')openSheet(action.id);message('操作を反映しました');}
   else message(result?.reason==='EDIT_CONFIRM_REQUIRED'?'変更は未確定です':result?.changed?'HOLD：変更済みですが描画を確認できません':'HOLD：操作は反映されていません');
   return result;
  }
  const result=Object.freeze({status:'HOLD',changed:false,reason:'PART_A_DATA_DISCONNECTED'});`);
 replace('render,showMap,transition,openSheet,feedback,setHand:applyHand,','render,showMap,transition,openSheet,feedback,setHand:applyHand,\n  onCommand(sink){if(stopped)throw Error(\'UI_STOPPED\');if(sink!==null&&typeof sink!==\'function\')throw Error(\'COMMAND_SINK_REQUIRED\');commandSink=sink;},');
 replace('stopped=true;observer=()=>{};reader=()=>EMPTY;','stopped=true;commandSink=null;observer=()=>{};reader=()=>EMPTY;');
 replace("mode:'PART_A_VIEW_ONLY',dataConnected:false", "mode:commandSink?'PART_B1_POI_ONLY':'PART_A_VIEW_ONLY',dataConnected:!!commandSink");
 const out=path.join(ROOT,'creative-next/original-ui-r31-b1');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'ui-runtime.mjs'),'// Generated B1 hooks over frozen Part A presentation. No engine copy.\n'+code);
 const html=read('creative-next/original-ui-r31/index.html').replace('../creative-next/original-ui-r31/ui-runtime.mjs','../creative-next/original-ui-r31-b1/ui-runtime.mjs');fs.writeFileSync(path.join(out,'index.html'),html);
 const manifest={partA:freeze.sourceCommit,partAEvidence:freeze.evidenceHead,sourceSha256:hash(original),derivedSha256:hash('// Generated B1 hooks over frozen Part A presentation. No engine copy.\n'+code),patches:6,htmlCssTemplatesUnchanged:true,engineCopied:false};fs.writeFileSync(path.join(__dirname,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');return manifest;}
module.exports={build};if(require.main===module)console.log(JSON.stringify(build()));
