import {createCampsiteDistanceConfirmedImportLab}
 from '../../contracts/campsite-distance-confirmed-import-lab.mjs';
const $=id=>document.getElementById(id);
const api=createCampsiteDistanceConfirmedImportLab({
 JSZip:window.JSZip,DOMParser,cryptoProvider:crypto
});
let pending=null,busy=false;
const getIds=()=>({expectedProjectId:$('accept-project').value.trim(),
 expectedHandoffId:$('accept-handoff').value.trim()});
const stop=code=>{const e=new Error(code);e.code=code;throw e;};
const status=(message,kind='neutral')=>{
 $('accept-status').dataset.kind=kind;$('accept-status').textContent=message;
};
function reset(){
 pending=null;$('accept-summary').hidden=true;$('accept-create').hidden=true;
}
function display(row){
 const items=[
 ['送信元保存世代',row.sourceRevision??'再開'],
 ['受信先保存世代',row.existingRevision??row.revision??0],
 ['現在のPOI',row.summary.currentPoiCount],
 ['Creative追加POI',row.summary.addedPoiCount],
 ['設計ポリゴン頂点',row.summary.designPolygonVertices],
 ['観測ポリゴン頂点',row.summary.acquisitionPolygonVertices],
 ['独立した活動エリア',row.summary.independentActivityAreaCount],
 ['50m未満のPOI間警告',row.distanceSummary.under50],
 ['外側参照POIとの50m未満',row.distanceSummary.externalReferenceUnder50],
 ['既存Campsiteへの書き込み','なし（HOLD）']
 ];
 const dl=$('accept-details');dl.replaceChildren();
 for(const [name,value] of items){
  const dt=document.createElement('dt'),dd=document.createElement('dd');
  dt.textContent=name;dd.textContent=String(value);dl.append(dt,dd);
 }
 $('accept-summary').hidden=false;
}
async function locked(work){
 if(busy)return;
 busy=true;for(const id of ['accept-inspect','accept-create','accept-reopen'])
  $(id).disabled=true;
 try{await work();}catch(e){
  reset();status('HOLD：'+String(e?.code||e?.message||'DISTANCE_UNKNOWN').slice(0,130)+
   '。自動上書き・修復・削除はしません。','error');
 }finally{
  busy=false;for(const id of ['accept-inspect','accept-create','accept-reopen'])
   $(id).disabled=false;
 }
}
$('accept-inspect').addEventListener('click',()=>locked(async()=>{
 reset();const ids=getIds(),file=$('accept-file').files?.[0];
 if(!file||!file.name.toLowerCase().endsWith('.zip')||file.size<30||file.size>16*1024*1024)
  stop('DISTANCE_LAB_ZIP_REQUIRED');
 status('Project・NEW_V1 KMZ・距離チェック入力を検証中…');
 const row=await api.prepare({...ids,bytes:new Uint8Array(await file.arrayBuffer())});
 display(row);pending=row;
 $('accept-create').hidden=!row.canCreate;
 status(row.canCreate?'検証成功。受信先は空です。確認後に隔離保存できます。':
  'HOLD：DISTANCE_IMPORT_EXISTING_PROTECTED。受信先には既存の世代があり、上書きしません。',row.canCreate?'ok':'error');
}));
$('accept-create').addEventListener('click',()=>{
 if(!pending)return;
 // Capture the ticket before asking; another inspect invalidates it.
 const ticket=pending.ticket;
 if(!window.confirm('この試験サイトの隔離保存領域に、このProjectを新規保存しますか？\n本番Campsiteには反映されません。'))
  return status('保存をキャンセルしました。既存データを保持します。');
 locked(async()=>{
  const saved=await api.confirmCreate({ticket,confirmed:true});
  reset();status('隔離保存成功。世代 '+saved.revision+'。本番Projectは未変更です。','ok');
 });
});
$('accept-reopen').addEventListener('click',()=>locked(async()=>{
 reset();status('隔離保存データを再読込して検証中…');
 const row=await api.reopen(getIds());
 display(row);status('隔離保存済みの世代 '+row.revision+
  ' を再読込・照合しました。本番データは未変更です。','ok');
}));
window.__distanceImportLabStatus=()=>({
 busy,pending:!!pending,productionReady:false,dbName:api.dbName
});
