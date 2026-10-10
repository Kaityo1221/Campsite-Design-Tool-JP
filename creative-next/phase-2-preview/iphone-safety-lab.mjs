/* Isolated iPhone Safari QA lab, r13 only.
 * No KMZ import or legacy v7 access. No cleanup of unrelated storage.
 * Native writes are confined to explicit *r13-lab namespaces*.
 */
import {createCreativeSaveJournal} from '../phase-1b/core/journal-save.mjs';
import {createStrictIndexedCheckpoint} from './strict-idb-checkpoint.mjs';

const BASE='campsite-creative-next-v1-iphone-safety-r13-lab';
const CONCURRENT=BASE+'-concurrency';
const JOURNAL=BASE+'-journal';
const CHECKPOINT=BASE+'-checkpoint';
const $=id=>document.getElementById(id);
const state={busy:false,lines:[]};
const fixture=title=>({
  records:[{id:'synthetic-1',role:'existing',kind:'pokestop',title,
    lat:35.643,lng:139.858,memo:'r13 synthetic test only'}],
  activityAreas:[]
});
const message=e=>e?.code||e?.name||String(e);
function show(name,status,detail=''){
  state.lines.push({name,status,detail});
  const line=document.createElement('li');
  line.textContent=status+' | '+name+(detail?' | '+detail:'');
  line.className=status==='PASS'?'pass':status==='HOLD'?'hold':'info';
  $('result').appendChild(line);
}
function summary(ok){
  $('summary').textContent=ok
    ?'合格: r13の隔離検査が完了。Safari再起動後の検査は別途必要です。'
    :'HOLD: すべての検査を完了できません。保存の成功扱いはしません。';
  $('summary').className=ok?'pass':'hold';
}
function journal(storage,namespace){
  return createCreativeSaveJournal({
    storage,namespace,locks:navigator.locks,subtle:crypto.subtle,requireLock:true
  });
}
function fakeStorage(){
  const data=new Map(),writes=[];
  return {
    data,writes,
    getItem:k=>data.get(k)??null,
    setItem(k,v){data.set(k,String(v));writes.push(k)}
  };
}
function capabilities(){
  let storage;
  try{storage=localStorage}catch{storage=null}
  return {
    storage:!!storage&&typeof storage.getItem==='function'&&typeof storage.setItem==='function',
    locks:!!navigator.locks&&typeof navigator.locks.request==='function',
    crypto:!!crypto?.subtle?.digest,
    idb:!!indexedDB?.open,
    storageHandle:storage
  };
}
async function expectReject(task,code){
  try{await task();return false}catch(e){return e?.code===code}
}
async function readonlyInspectionOfCorruptPointer(){
  const st=fakeStorage(),j=journal(st,JOURNAL+'-memory');
  await j.save(fixture('safe'),{expectedRevision:null});
  const old=st.getItem(j.keys.slotA);
  st.setItem(j.keys.pointer,'BROKEN_POINTER');
  const before=new Map(st.data),report=await j.load();
  const blocked=await expectReject(()=>j.save(fixture('blocked'),{expectedRevision:1}),'SAVE_RECOVERY_REQUIRED');
  return report.status==='FALLBACK'&&report.revision===1&&blocked&&
    old===st.getItem(j.keys.slotA)&&
    JSON.stringify([...before])===JSON.stringify([...st.data]);
}
async function simulatedQuota(){
  const st=fakeStorage(),j=journal(st,JOURNAL+'-quota-memory');
  await j.save(fixture('committed'),{expectedRevision:null});
  const before=st.getItem(j.keys.pointer),original=st.setItem;
  st.setItem=function(k,v){
    if(k===j.keys.slotB)throw Object.assign(new Error('Simulated quota'),{name:'QuotaExceededError'});
    return original.call(this,k,v);
  };
  let rejected=false;
  try{await j.save(fixture('uncommitted'),{expectedRevision:1})}
  catch(e){rejected=e.name==='QuotaExceededError'}
  return rejected&&st.getItem(j.keys.pointer)===before&&
    (await j.load()).snapshot.records[0].title==='committed';
}
async function realConcurrentSave(storage){
  const a=journal(storage,CONCURRENT),b=journal(storage,CONCURRENT);
  const before=await a.load();
  if(!['EMPTY','READY'].includes(before.status))throw Error('Concurrency namespace requires recovery');
  const version=before.revision;
  const results=await Promise.allSettled([
    a.save(fixture('concurrent-A'),{expectedRevision:version}),
    b.save(fixture('concurrent-B'),{expectedRevision:version})
  ]);
  const success=results.filter(x=>x.status==='fulfilled');
  const conflicts=results.filter(x=>x.status==='rejected'&&x.reason?.code==='SAVE_CONFLICT');
  const after=await b.load();
  return success.length===1&&conflicts.length===1&&after.status==='READY'&&
    after.revision===(version??0)+1;
}
async function realJournal(storage){
  const j=journal(storage,JOURNAL),before=await j.load();
  if(!['EMPTY','READY'].includes(before.status))throw Error('Journal test data requires explicit recovery');
  const saved=await j.save(fixture('native localStorage verified'),{expectedRevision:before.revision});
  const reopened=await journal(storage,JOURNAL).load();
  return reopened.status==='READY'&&reopened.revision===saved.revision&&
    reopened.snapshot.records[0].title==='native localStorage verified';
}
async function realIndexedDB(){
  const j=createStrictIndexedCheckpoint({namespace:CHECKPOINT});
  try{
    const before=await j.inspect();
    if(!['EMPTY','READY'].includes(before.status))throw Error('Checkpoint test data requires explicit recovery');
    const saved=await j.save(fixture('native IndexedDB verified'),{expectedRevision:before.revision});
    const opened=await j.inspect();
    return opened.status==='READY'&&opened.revision===saved.revision&&
      opened.snapshot.records[0].title==='native IndexedDB verified';
  }finally{await j.close()}
}
function begin(){
  if(state.busy)return false;
  state.busy=true;state.lines=[];$('result').replaceChildren();$('summary').textContent='隔離試験を実行しています。';
  $('run').disabled=$('reopen').disabled=true;
  return true;
}
function end(){
  state.busy=false;$('run').disabled=$('reopen').disabled=false;
  $('copy').disabled=!state.lines.length;
}
$('run').addEventListener('click',async()=>{
  if(!begin())return;
  let okay=true;
  try{
    const caps=capabilities();
    const present=['storage','locks','crypto','idb'].filter(k=>caps[k]);
    show('Safari機能',present.length===4?'PASS':'HOLD',present.join(', ')+' / 4');
    if(present.length!==4){summary(false);return}
    const checks=[
      ['破損ポインタの読取専用保護',readonlyInspectionOfCorruptPointer],
      ['容量不足（安全な模擬）の保存停止',simulatedQuota],
      ['Web Locksによる競合拒否',()=>realConcurrentSave(caps.storageHandle)],
      ['localStorage実保存・再読込',()=>realJournal(caps.storageHandle)],
      ['IndexedDB strict保存・再読込',realIndexedDB]
    ];
    for(const [name,fn] of checks){
      try{
        const pass=await fn();show(name,pass?'PASS':'HOLD');
        if(!pass)okay=false;
      }catch(e){okay=false;show(name,'HOLD',message(e))}
    }
    summary(okay);
  }catch(e){show('全体の実行','HOLD',message(e));summary(false)}
  finally{end()}
});
$('reopen').addEventListener('click',async()=>{
  if(!begin())return;
  let okay=true;
  try{
    const caps=capabilities();
    if(!caps.storage||!caps.crypto||!caps.idb){show('再起動後の保存確認','HOLD','必要なAPIを利用できません');summary(false);return}
    const j=journal(caps.storageHandle,JOURNAL);
    const saved=await j.load();
    const localPass=saved.status==='READY'&&
      saved.snapshot.records[0].title==='native localStorage verified';
    show('localStorage再開',localPass?'PASS':'HOLD','状態: '+saved.status);
    if(!localPass)okay=false;
    const checkpoint=createStrictIndexedCheckpoint({namespace:CHECKPOINT});
    try{
      const read=await checkpoint.inspect();
      const cpPass=read.status==='READY'&&
        read.snapshot.records[0].title==='native IndexedDB verified';
      show('IndexedDB再開',cpPass?'PASS':'HOLD','状態: '+read.status);
      if(!cpPass)okay=false;
    }finally{await checkpoint.close()}
    $('summary').textContent=okay?'再開試験PASS: 両方の保存データを読み取れました。':'HOLD: 少なくとも一方のデータを読み取れません。';
    $('summary').className=okay?'pass':'hold';
  }catch(e){show('再起動後の保存確認','HOLD',message(e));summary(false)}
  finally{end()}
});
$('copy').addEventListener('click',async()=>{
  const result='Creative Next r13 iPhone safety lab\n'+
    navigator.userAgent+'\n'+state.lines.map(x=>[x.status,x.name,x.detail].filter(Boolean).join(' | ')).join('\n')+
    '\n'+$('summary').textContent;
  try{await navigator.clipboard.writeText(result);$('copy-status').textContent='結果をコピーしました。'}
  catch{$('copy-status').textContent='コピーできない場合は、結果部分のスクリーンショットを送ってください。'}
});
$('summary').textContent='テスト専用の名前空間を使用します。実KMZや従来保存データには触れません。';
