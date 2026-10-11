import {createRealEngineOriginalUI} from '../integration/real-engine-original-ui.mjs';
// Isolated r19: reuse original entryFile/startButton, no legacy scripts or browser storage.
export function attachOriginalFileReview({document,JSZip,DOMParser,XMLSerializer,confirmReview=()=>false,onResult=()=>{}}={}){
 const input=document.getElementById('entryFile'),start=document.getElementById('startButton'),state=document.getElementById('entryState'),name=document.getElementById('entryFileName');
 if(!input||!start||!state||!name)throw Error('ORIGINAL_ENTRY_MISSING');
 const ui=createRealEngineOriginalUI({document,JSZip,DOMParser,XMLSerializer});
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
  if(disposed||busy||editorReady)return;prepared=false;startClone.disabled=true;
  const file=el.files?.[0];if(!file)return;
  if(!/\.(kmz|kml)$/i.test(file.name)){state.textContent='KMZ / KMLを選択してください';return;}
  busy=true;state.textContent='内容を確認しています…';name.textContent=file.name;
  try{const result=await ui.prepare(new Uint8Array(await file.arrayBuffer()));
   if(disposed)return;prepared=result.status==='REVIEW';startClone.disabled=!prepared;
   state.textContent=prepared?'読み込み候補を確認しました。開始時に承認が必要です。':'このファイルは読み込めません';onResult(result);
  }catch{if(!disposed)state.textContent='読み込みを保留しました';}
  finally{busy=false;}
 }
 const onStart=()=>{
  if(disposed||!prepared||busy)return;
  if(confirmReview()!==true){state.textContent='承認されていないため開始しません';return;}
  const result=ui.accept({confirmed:true});prepared=false;startClone.disabled=true;
  editorReady=result.applied===true;fileClone.disabled=editorReady;
  state.textContent=result.applied?'隔離エンジンへ読み込みました（保存なし）':'開始できませんでした';onResult(result);
 };
 fileClone.addEventListener('change',onChange);startClone.addEventListener('click',onStart);
 return Object.freeze({engine:ui.engine,dispose(){disposed=true;fileClone.removeEventListener('change',onChange);startClone.removeEventListener('click',onStart);fileClone.disabled=true;startClone.disabled=true;ui.dispose()}});
}
