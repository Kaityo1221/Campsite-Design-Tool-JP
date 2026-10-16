/*
 * Isolated read-only Campsite Return LAB.
 * 1. Verified local r31 IndexedDB -> staged manual-download portable bundle.
 * 2. Manual file select on a different origin -> verified read-only summary.
 * No network upload/postMessage or production/session storage write.
 */
import {createX01IndexedDbSaveLab} from '../../contracts/x01-indexeddb-save-lab.mjs';
import {inspectCampsiteReturnLab} from '../../contracts/campsite-return-receiver-lab.mjs';
import {inspectCampsiteDistanceReturnStageLab} from '../../contracts/campsite-distance-return-stage-lab.mjs';
import {previewDistanceCalculationLab} from '../../contracts/campsite-distance-math-preview-lab.mjs';
import {createPortableReturnBundleLab,inspectPortableReturnBundleLab}
 from '../../contracts/portable-return-bundle-lab.mjs';

const dbName='campsite-creative-next-x01-idb-lab-r31-save-ui-20261012';
const $=id=>document.getElementById(id),maxArchive=16*1024*1024;
let busy=false,staged=null;
const sources=['return-project-id','return-handoff-id','return-file'];
// Never leave a verified download visible after the source or typed identity
// changes. Browser-origin IDB rows are scoped by exact Project/Handoff IDs.
for(const name of sources){
 $(name).addEventListener(name==='return-file'?'change':'input',()=>{
  if(busy)return;
  reset();status('入力が変更されました。保存データまたはZIPの検証をやり直してください。');
 });
}
const hold=code=>{const e=new Error(code);e.code=code;throw e;};
const status=(message,kind='neutral')=>{
 $('return-status').textContent=message;$('return-status').dataset.kind=kind;
};
function reset(){
 staged=null;$('return-download').hidden=true;$('return-summary').hidden=true;
 $('return-distance-panel').hidden=true;
}
function render(rows){
 const detail=$('return-details');detail.replaceChildren();
 for(const [name,value] of rows){
  const dt=document.createElement('dt'),dd=document.createElement('dd');
  dt.textContent=name;dd.textContent=String(value);detail.append(dt,dd);
 }
 $('return-summary').hidden=false;
}
function showDistanceStage(stage,preview){
 const detail=$('return-distance-details');detail.replaceChildren();
 const rows=[
  ['確認済みPOI数',stage.summary.currentPoiCount],
  ['追加したPOI',stage.summary.addedPoiCount],
  ['設計ポリゴンの頂点',stage.summary.designPolygonVertices],
  ['観測ポリゴンの頂点',stage.summary.acquisitionPolygonVertices],
  ['独立した活動エリア数',stage.summary.independentActivityAreaCount],
  ['50m未満（編集対象POI同士）',preview.summary.under50],
  ['20m未満（密集）',preview.summary.dense],
  ['20〜30m（滞留）',preview.summary.stay],
  ['30〜50m（参考）',preview.summary.light],
  ['外側100mの参照POIとの50m未満',preview.summary.externalReferenceUnder50],
  ['地図用活動エリア（独立）',preview.mapPreview.activityPolygons.length],
  ['計算結果の扱い','LAB計算プレビュー（本番判定ではありません）'],
  ['距離再計算','必須'],
  ['本番の距離チェックへ投入','HOLD（未承認）'],
  ['判定',stage.reason]
 ];
 for(const [name,value] of rows){
  const dt=document.createElement('dt'),dd=document.createElement('dd');
  dt.textContent=name;dd.textContent=String(value);detail.append(dt,dd);
 }
 $('return-distance-panel').hidden=false;
}
function showVerified(ready,revision,suffix){
 const r=ready.summary;
 render([
  ['保存世代',revision],['Project ID',r.projectId],['Handoff ID',r.handoffId],
  ['Wayfarer Snapshot ID',r.snapshotId],['観測完了',r.coverageComplete?'Yes':'No'],
  ['設計ポリゴン頂点',r.designPolygonVertices],['観測ポリゴン頂点',r.acquisitionPolygonVertices],
  ['独立した活動エリア',r.activityAreaCount],['現在のPOI',r.currentPoiCount],
  ['Creative追加POI',r.addedPoiCount],['設計範囲内の観測POI',r.interiorCount],
  ['外側100mの参照',r.reference100Count],['予備100〜200m',r.reserve200Count],
  ['従来Bridgeへの送信','HOLD（形式未承認）']
 ]);
 status('検証成功。世代 '+revision+'。'+suffix+'本番への保存・書換は行いません。','ok');
}
function options(){
 const expectedProjectId=$('return-project-id').value.trim(),
  expectedHandoffId=$('return-handoff-id').value.trim();
 if(!expectedProjectId||!expectedHandoffId||expectedProjectId.length>128||
    expectedHandoffId.length>128)hold('RETURN_IDS_REQUIRED');
 if(!window.JSZip)hold('RETURN_JSZIP_UNAVAILABLE');
 return {expectedProjectId,expectedHandoffId,JSZip:window.JSZip,DOMParser,
  cryptoProvider:crypto};
}
async function locked(work){
 if(busy)return;
 busy=true;
 for(const name of ['return-verify','return-upload-verify',...sources])$(name).disabled=true;
 reset();
 try{await work();}
 catch(e){
  status('HOLD：'+String(e?.code||e?.message||'RETURN_UNKNOWN').slice(0,140)+
   '。元データの自動修復・削除・上書きは行いません。','error');
 }finally{
  busy=false;
  for(const name of ['return-verify','return-upload-verify',...sources])$(name).disabled=false;
 }
}
$('return-verify').addEventListener('click',()=>locked(async()=>{
 const opts=options();
 status('隔離IndexedDBから保存済みProject・KMZを読み取って検証しています…');
 const store=createX01IndexedDbSaveLab({...opts,dbName});
 const saved=await store.read(opts);
 if(!saved)hold('RETURN_SAVED_PROJECT_NOT_FOUND');
 const ready=await inspectCampsiteReturnLab({project:saved.project,
  activityAreas:saved.activityAreas,kmzBytes:saved.kmzBytes,...opts});
 if(ready.productionReady!==false||ready.writeAllowed!==false)hold('RETURN_WRITE_GATE');
 // Expensive crypto checks and ZIP creation happen before user asks for a
 // download; the download click below stays synchronous for mobile Safari.
 const bundle=await createPortableReturnBundleLab({project:saved.project,
  activityAreas:saved.activityAreas,kmzBytes:saved.kmzBytes,revision:saved.revision,...opts});
 const distance=await inspectCampsiteDistanceReturnStageLab({
  project:saved.project,activityAreas:saved.activityAreas,kmzBytes:saved.kmzBytes,...opts
 });
 if(distance.legacyDistanceCommitAllowed!==false||distance.writeAllowed!==false)
  hold('DISTANCE_LIVE_WRITE_GATE');
 const math=previewDistanceCalculationLab(distance,{
  referencePois:ready.project.wayfarerObservation.zones.reference100
 });
 if(math.productionReady!==false||math.writeAllowed!==false)hold('DISTANCE_MATH_WRITE_GATE');
 showVerified(ready,saved.revision,'Project・NEW_V1 KMZは整合しています。');
 showDistanceStage(distance,math);
 staged={bytes:new Uint8Array(bundle.bytes),
  projectId:opts.expectedProjectId,handoffId:opts.expectedHandoffId};
 $('return-download').hidden=false;
}));
$('return-upload-verify').addEventListener('click',()=>locked(async()=>{
 const opts=options(),file=$('return-file').files?.[0];
 if(!file||!(/\.zip$/i).test(file.name)||file.size===0||file.size>maxArchive)
  hold('PORTABLE_FILE_REQUIRED');
 status('選択されたLAB転送セットのハッシュとProjectを検証しています…');
 const bytes=new Uint8Array(await file.arrayBuffer());
 const received=await inspectPortableReturnBundleLab({bytes,...opts});
 if(received.productionReady!==false||received.writeAllowed!==false)hold('RETURN_WRITE_GATE');
 const distance=await inspectCampsiteDistanceReturnStageLab({
  project:received.project,activityAreas:received.activityAreas,kmzBytes:received.kmzBytes,...opts
 });
 if(distance.legacyDistanceCommitAllowed!==false||distance.writeAllowed!==false)
  hold('DISTANCE_LIVE_WRITE_GATE');
 showVerified(received,received.revision,'LAB転送ファイルのProjectとKMZは整合しています。');
 const math=previewDistanceCalculationLab(distance,{
  referencePois:received.project.wayfarerObservation.zones.reference100
 });
 if(math.productionReady!==false||math.writeAllowed!==false)hold('DISTANCE_MATH_WRITE_GATE');
 showDistanceStage(distance,math);
}));
$('return-download').addEventListener('click',()=>{
 if(busy||!staged||$('return-project-id').value.trim()!==staged.projectId||
   $('return-handoff-id').value.trim()!==staged.handoffId)return;
 const b=new Blob([staged.bytes],{type:'application/zip'});
 const u=URL.createObjectURL(b);
 const a=document.createElement('a');a.href=u;
 a.download='campsite-return-test-only.zip';document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(u),30000);
});
window.__campsiteReturnLabStatus=()=>({busy,downloadPrepared:!!staged,
 productionReady:false,writeAllowed:false});
