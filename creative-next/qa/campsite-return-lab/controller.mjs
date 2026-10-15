/*
 * Read-only Campsite Return UI: isolated r31 IndexedDB -> verified pair -> summary.
 * No writes, migrations, window postMessage, or legacy production receiver calls.
 */
import {createX01IndexedDbSaveLab} from '../../contracts/x01-indexeddb-save-lab.mjs';
import {inspectCampsiteReturnLab} from '../../contracts/campsite-return-receiver-lab.mjs';

const dbName='campsite-creative-next-x01-idb-lab-r31-save-ui-20261012';
const $=id=>document.getElementById(id);
const status=(message,kind='neutral')=>{
 $('return-status').textContent=message;$('return-status').dataset.kind=kind;
};
const render=rows=>{
 const detail=$('return-details');detail.replaceChildren();
 for(const [name,value] of rows){
  const dt=document.createElement('dt'),dd=document.createElement('dd');
  dt.textContent=name;dd.textContent=String(value);detail.append(dt,dd);
 }
 $('return-summary').hidden=false;
};
let busy=false;
$('return-verify').addEventListener('click',async()=>{
 if(busy)return;
 $('return-summary').hidden=true;
 const expectedProjectId=$('return-project-id').value.trim();
 const expectedHandoffId=$('return-handoff-id').value.trim();
 if(!expectedProjectId||!expectedHandoffId){
  status('HOLD：RETURN_IDS_REQUIRED。現在の保存データを変更しません。','error');return;
 }
 busy=true;$('return-verify').disabled=true;status('保存済みProject・KMZの整合性を検証しています…');
 try{
  if(!window.JSZip)throw Object.assign(new Error('RETURN_JSZIP_UNAVAILABLE'),{code:'RETURN_JSZIP_UNAVAILABLE'});
  const opts={expectedProjectId,expectedHandoffId,JSZip:window.JSZip,DOMParser,
   cryptoProvider:crypto};
  const store=createX01IndexedDbSaveLab({...opts,dbName});
  const saved=await store.read({expectedProjectId,expectedHandoffId});
  if(!saved)throw Object.assign(new Error('RETURN_SAVED_PROJECT_NOT_FOUND'),{code:'RETURN_SAVED_PROJECT_NOT_FOUND'});
  const ready=await inspectCampsiteReturnLab({project:saved.project,
   activityAreas:saved.activityAreas,kmzBytes:saved.kmzBytes,...opts});
  if(ready.productionReady!==false||ready.writeAllowed!==false)
   throw Object.assign(new Error('RETURN_WRITE_GATE'),{code:'RETURN_WRITE_GATE'});
  const r=ready.summary;
  render([
   ['保存世代',saved.revision],['Project ID',r.projectId],['Handoff ID',r.handoffId],
   ['Wayfarer Snapshot ID',r.snapshotId],['観測完了',r.coverageComplete?'Yes':'No'],
   ['設計ポリゴン頂点',r.designPolygonVertices],['観測ポリゴン頂点',r.acquisitionPolygonVertices],
   ['独立した活動エリア',r.activityAreaCount],['現在のPOI',r.currentPoiCount],
   ['Creative追加POI',r.addedPoiCount],['設計範囲内の観測POI',r.interiorCount],
   ['外側100mの参照',r.reference100Count],['予備100〜200m',r.reserve200Count],
   ['従来Bridgeへの送信','HOLD（形式未承認）']
  ]);
  status('検証成功。世代 '+saved.revision+'。Project・NEW_V1 KMZは整合しています。保存・書換は行いません。','ok');
 }catch(e){
  const code=String(e?.code||e?.message||'RETURN_UNKNOWN').slice(0,140);
  status('HOLD：'+code+'。元データの自動修復・削除・上書きは行いません。','error');
 }finally{busy=false;$('return-verify').disabled=false;}
});
