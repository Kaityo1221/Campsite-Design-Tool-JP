import {createRealEngineOriginalUI} from '../integration/real-engine-original-ui.mjs';
// Isolated r19: reuse original entryFile/startButton, no legacy scripts or browser storage.
export function attachOriginalFileReview({document,JSZip,DOMParser,XMLSerializer,confirmReview=()=>false,onResult=()=>{},onRefresh=()=>{}}={}){
 const input=document.getElementById('entryFile'),start=document.getElementById('startButton'),state=document.getElementById('entryState'),name=document.getElementById('entryFileName');
 if(!input||!start||!state||!name)throw Error('ORIGINAL_ENTRY_MISSING');
 const ui=createRealEngineOriginalUI({document,JSZip,DOMParser,XMLSerializer,onRefresh});
 let prepared=false,busy=false,disposed=false;
 let editorReady=false;
 input.disabled=false;start.disabled=true;
 // The r20 snapshot already removed ALL legacy scripts/handlers.
 // Preserve the original native file input for iOS Safari. Cloning it can break the file activation path.
 const fileClone=input;
 const startClone=start.cloneNode(true);
 start.replaceWith(startClone);
 fileClone.removeAttribute('disabled');
 startClone.disabled=true;
 const onChange=()=>changeFile(fileClone);
 async function changeFile(el){
  if(disposed||busy||editorReady)return;prepared=false;startClone.disabled=true;startClone.classList.remove('ready');
  const file=el.files?.[0];if(!file)return;
  if(!/\.(kmz|kml)$/i.test(file.name)){state.textContent='KMZ / KMLを選択してください';el.value='';return;}
  busy=true;state.textContent='内容を確認しています…';name.textContent=file.name;
  try{
   const result=await ui.prepare(new Uint8Array(await file.arrayBuffer()));
   if(disposed)return;
   prepared=result?.status==='REVIEW';
   startClone.disabled=!prepared;
   startClone.classList.toggle('ready',prepared);
   if(prepared)state.textContent='読み込み準備が完了しました。開始時に承認が必要です。';
   else{
    const code=result?.issues?.find(issue=>typeof issue?.code==='string')?.code||result?.status||'UNKNOWN';
    state.textContent='読み込みを保留しました（'+String(code).slice(0,48)+'）。元のファイルは変更していません。';
   }
   onResult(result);
  }catch(error){
   if(!disposed){
    prepared=false;startClone.disabled=true;startClone.classList.remove('ready');
    state.textContent='読み込みに失敗しました（'+String(error?.code||error?.name||'PREPARE_ERROR').slice(0,48)+'）。';
   }
  }finally{
   busy=false;
   // Same-file selection must trigger change again on iOS.
   if(!disposed&&!editorReady)el.value='';
  }
 }
 const onStart=()=>{
  if(disposed||!prepared||busy)return;
  if(confirmReview()!==true){state.textContent='承認されていないため開始しません';return;}
  try{
   const result=ui.accept({confirmed:true});
   editorReady=result?.applied===true;
   if(!editorReady){state.textContent='開始できませんでした。元のファイルは変更していません。';return;}
   prepared=false;startClone.disabled=true;startClone.classList.remove('ready');
   fileClone.disabled=true;
   state.textContent='隔離エンジンへ読み込みました（保存なし）';
   onResult(result);
  }catch(error){
   state.textContent='開始を保留しました（'+String(error?.code||error?.name||'START_ERROR').slice(0,48)+'）。';
  }
 };
 fileClone.addEventListener('change',onChange);startClone.addEventListener('click',onStart);
 return Object.freeze({engine:ui.engine,syncControls:()=>ui.sync(),dispose(){disposed=true;fileClone.removeEventListener('change',onChange);startClone.removeEventListener('click',onStart);fileClone.disabled=true;startClone.disabled=true;ui.dispose()}});
}
