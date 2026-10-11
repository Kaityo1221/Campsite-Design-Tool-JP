const fs=require('node:fs'),path=require('node:path');
const ROOT=path.resolve(__dirname,'../../..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8').replace(/\r\n/g,'\n');
function build(){
 let ui=read('creative-next/original-ui-r31-b2/ui-runtime.mjs');
 const patch=(a,b)=>{if(ui.split(a).length!==2)throw Error('B3_UI_BASELINE_DRIFT:'+a.slice(0,70));ui=ui.replace(a,b);};
 patch('onRequest=()=>{}}={})','onRequest=()=>{},onFile=null,onStart=null,onResume=null,onSave=null}={})');
 patch('let holdTimer=null;',`let holdTimer=null;
 async function fileAction(fn){try{const result=await fn();if(stopped)return;message(result?.status==='SAVED'?'下書きを保存しました':result?.status==='RESTORED'?'保存データを復元しました':result?.status==='DOWNLOADED'?'新しいKMZを出力しました':'HOLD：'+(result?.reason||result?.status||'操作を確認してください'),0);}catch(e){if(!stopped)message('HOLD：'+(e.code||e.message),0);}}`);
 patch("saveMenu.querySelector('#cmStandaloneWorkspaceSave')?.remove();doc.body.append(saveMenu);",`const draftSave=saveMenu.querySelector('#cmStandaloneWorkspaceSave');
  if(onSave&&draftSave){draftSave.id='cmR31DraftSave';draftSave.textContent='下書きを保存';listen(draftSave,'click',()=>fileAction(()=>onSave({type:'draft'})));}else draftSave?.remove();doc.body.append(saveMenu);`);
 patch("listen(id('cmStandaloneKmz'),'click',()=>{hold({type:'exportKmz'});openChooser();});","listen(id('cmStandaloneKmz'),'click',()=>{if(!onSave)hold({type:'exportKmz'});openChooser();});");
 patch("listen(choose,'click',()=>hold({type:'save',destination:'choose'}));listen(download,'click',()=>hold({type:'save',destination:'download'}));", "listen(choose,'click',()=>onSave?fileAction(()=>onSave({type:'choose'})):hold({type:'save',destination:'choose'}));listen(download,'click',()=>onSave?fileAction(()=>onSave({type:'download'})):hold({type:'save',destination:'download'}));");
 patch("listen(id('entryFile'),'change',()=>{const file=id('entryFile').files?.[0];", "listen(id('entryFile'),'change',()=>{const file=id('entryFile').files?.[0];if(onFile){onFile(file);return;}");
 patch("listen(id('startButton'),'click',()=>{hold({type:'acceptPrepared'});transition();});", "listen(id('startButton'),'click',()=>{if(onStart){if(onStart()===true)transition();return;}hold({type:'acceptPrepared'});transition();});\n listen(id('resumeButton'),'click',()=>{if(onResume)fileAction(onResume);});");
 patch("closePanels();id('entry').classList.remove('hidden');});", "closePanels();id('entry').classList.remove('hidden');if(onStart&&commandSink){id('startButton').disabled=false;id('startButton').textContent='編集を続ける';}});");
 patch("if(globalThis.document&&!globalThis.creativeR31)globalThis.creativeR31=mountCreativeUi();", '// Mounted only by the B3/B4 bootstrap with explicit file and storage capabilities.');
 fs.writeFileSync(path.join(ROOT,'creative-next/original-ui-r31-b3-b4/ui-runtime.mjs'),ui);
 const html=read('creative-next/original-ui-r31-b2/index.html').replace('../creative-next/original-ui-r31-b2/ui-runtime.mjs','../creative-next/original-ui-r31-b3-b4/bootstrap.mjs').replace('type="file" multiple','type="file" accept=".kmz,.kml"').replace('編集内容は自動保存されます。','編集後は保存メニューから下書きを保存してください。');
 fs.writeFileSync(path.join(ROOT,'creative-next/original-ui-r31-b3-b4/index.html'),html);
 return {engineCopied:false,b2Unchanged:true};
}
module.exports={build};if(require.main===module)console.log(build());
