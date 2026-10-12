import {mountCreativeUi} from './ui-runtime.mjs';
import {createWorkspace} from './workspace.mjs';
import {connectB2} from './adapter-review.mjs';

export function mountWorkspace({document:doc=globalThis.document,L=globalThis.L,JSZip=globalThis.JSZip,storage=null,locks=null,confirmEdit=()=>false,confirmRestore=()=>false,download=null}={}){
 const win=doc.defaultView,id=n=>doc.getElementById(n);
 const workspace=createWorkspace({JSZip,DOMParser:win.DOMParser,XMLSerializer:win.XMLSerializer,cryptoProvider:win.crypto,storage,locks});
 let adapter=null,stopped=false,selectGeneration=0,controller=null,exportBusy=false,prepared=null,prepareGeneration=0;
 const urls=new Set(),timers=new Set();
 function clearPrepared(){prepareGeneration++;if(prepared?.url){urls.delete(prepared.url);win.URL.revokeObjectURL(prepared.url);}prepared=null;}

 const entryMessage=text=>{id('entryState').textContent=text;};
 const startReady=ready=>{id('startButton').disabled=!ready;id('startButton').classList.toggle('ready',ready);};
 function connect(){adapter=connectB2({session:workspace.session,ui,document:doc,confirmEdit});id('entryFile').disabled=true;id('resumeButton').disabled=true;}
 async function onFile(file){
  const ticket=++selectGeneration;controller?.abort();controller=new win.AbortController();startReady(false);
  id('entryFileName').textContent=file?.name||'未選択';
  if(!file){workspace.discardPending();entryMessage('KMZ / KMLを選択してください');return;}
  entryMessage('地図データを安全確認中…');
  try{const result=await workspace.prepare(file,{signal:controller.signal});if(stopped||ticket!==selectGeneration)return;
   const ready=result.status==='REVIEW';startReady(ready);entryMessage(ready?'確認済み：既存POIは読取専用です。「創作をはじめる」で反映します。':result.status+'：'+(result.issues?.[0]?.code||'IMPORT_HOLD'));
  }catch(e){if(!stopped&&ticket===selectGeneration)entryMessage('HOLD：'+(e.code||e.message));}
 }
 function onStart(){try{if(adapter){if(adapter.status().fault)throw Error('B2_RENDER_FAULT');return true;}const result=workspace.acceptPrepared({confirmed:true});if(!result.applied)return false;connect();return true;}catch(e){startReady(false);entryMessage('HOLD：'+(e.code||e.message));return false;}}
 async function onResume(){
  if(!confirmRestore())return {status:'HOLD',reason:'復元をキャンセルしました'};
  selectGeneration++;controller?.abort();workspace.discardPending();startReady(false);
  id('entryFile').disabled=true;let result;try{result=await workspace.resumeDraft({confirmed:true});}finally{if(!workspace.session.state().hasActive)id('entryFile').disabled=false;}if(stopped)return {status:'HOLD'};
  if(result.applied){connect();ui.transition();return {status:'RESTORED'};}
  entryMessage('HOLD：'+result.reason);return result;
 }
 async function onSave(action){
  if(action?.type==='cancel-prepared'){clearPrepared();return {status:'CANCELLED'};}
  if(exportBusy||workspace.status().busy)return {status:'HOLD',reason:'処理中です'};
  if(!adapter||adapter.status().fault)return {status:'HOLD',reason:'編集状態の確認が必要です'};
  const uiState=ui.status();
  if(uiState.ui.mode||uiState.ui.tool==='polygon'||adapter.status().pendingEdits)
   return {status:'HOLD',reason:'編集中の操作を確定または取消してください'};
  if(action.type==='draft')return workspace.saveDraft({confirmed:true});
  if(action.type==='choose')return {status:'HOLD',reason:'原本の上書きを避けるためダウンロードしてください'};
  if(action.type==='prepare'){
   clearPrepared();const ticket=++prepareGeneration;exportBusy=true;
   try{
    // Validate/round-trip the entire new archive *before* exposing a download.
    const exported=await workspace.exportKmz();
    if(stopped||ticket!==prepareGeneration)return {status:'HOLD',reason:'KMZの準備をキャンセルしました'};
    const blob=new win.Blob([exported.bytes],{type:'application/vnd.google-earth.kmz'});
    const url=win.URL.createObjectURL(blob);urls.add(url);
    prepared={blob,url,filename:'creative-next-r31-edited.kmz',state:JSON.stringify(workspace.session.state())};
    return {status:'PREPARED'};
   }finally{exportBusy=false;}
  }
  if(action.type!=='download')return {status:'HOLD',reason:'操作対象が不明です'};
  if(!prepared)return {status:'HOLD',reason:'KMZを準備してからダウンロードしてください'};
  if(JSON.stringify(workspace.session.state())!==prepared.state){
   clearPrepared();return {status:'HOLD',reason:'編集中のデータが変更されたため、KMZを再生成してください'};
  }
  // This click executes synchronously in the Safari user gesture, without
  // an awaited exporter step between the tap and anchor.click().
  const current=prepared;
  if(download)await download(current.blob,current.filename);
  else{
   const anchor=doc.createElement('a');anchor.href=current.url;anchor.download=current.filename;
   doc.body.append(anchor);anchor.click();anchor.remove();
  }
  const ticket=prepareGeneration;
  const timer=win.setTimeout(()=>{timers.delete(timer);if(!stopped&&prepared===current&&ticket===prepareGeneration)clearPrepared();},60000);
  timers.add(timer);
  return {status:'DOWNLOADED'};
 }
 const ui=mountCreativeUi({document:doc,L,onFile,onStart,onResume,onSave});startReady(false);
 id('entryFile').accept='.kmz,.kml';entryMessage('KMZ / KMLを選択してください');
 // Explicit inspection of only this version's isolated journal. Never auto-resume.
 if(storage)workspace.inspectDraft().then(result=>{if(!stopped&&['READY','FALLBACK','CORRUPT'].includes(result.status)){id('resumeButton').style.setProperty('display','block','important');if(result.status!=='READY')entryMessage('HOLD：保存データ '+result.status+'。自動修復は行いません。');}}).catch(e=>{if(!stopped)entryMessage('HOLD：'+(e.code||e.message));});
 return Object.freeze({ui,workspace,status:()=>({adapter:adapter?.status()||null,workspace:workspace.status(),exportBusy,objectUrls:urls.size}),
  dispose(){if(stopped)return;if(exportBusy||workspace.status().busy)throw Error('WORKSPACE_BUSY');stopped=true;selectGeneration++;controller?.abort();adapter?adapter.dispose():ui.dispose();workspace.dispose();clearPrepared();for(const t of timers)win.clearTimeout(t);timers.clear();for(const url of urls)win.URL.revokeObjectURL(url);urls.clear();}
 });
}
if(globalThis.document){
 // Packaged, frozen JSZip vendor; no network or old runtime import for file parsing.
 const script=document.createElement('script');script.src=new URL('../phase-2-preview/vendor/jszip.min.js',import.meta.url).href;
 script.onload=()=>{let storage=null;try{storage=globalThis.localStorage;}catch{}
  globalThis.creativeR31Workspace=mountWorkspace({storage,locks:globalThis.navigator?.locks,confirmEdit:()=>confirm('名前・メモの変更を確定しますか？'),confirmRestore:()=>confirm('この画面専用の保存データを復元しますか？ 編集履歴は復元時に新しく開始します。')});globalThis.creativeR31=creativeR31Workspace.ui;
 };
 script.onerror=()=>{document.getElementById('entryState').textContent='HOLD：KMZライブラリを読み込めません';};document.head.append(script);
}
