import {createCampsiteDistanceConfirmedImportLab}
 from '../../contracts/campsite-distance-confirmed-import-lab.mjs';
import {createPortableReturnBundleLab}
 from '../../contracts/portable-return-bundle-lab.mjs';
import {previewX01AreaSelectionLab}
 from '../../contracts/x01-x04-transition-gate-lab.mjs';
const $=id=>document.getElementById(id);
const api=createCampsiteDistanceConfirmedImportLab({
 JSZip:window.JSZip,DOMParser,cryptoProvider:crypto
});
let pending=null,busy=false,exportReady=null,geometryStage=null,x01Reviewed=false;
const geometryStatus=(message,kind='neutral')=>{
 $('accept-x01-status').dataset.kind=kind;$('accept-x01-status').textContent=message;
};
function clearGeometry(){
 geometryStage=null;x01Reviewed=false;
 $('accept-x01').hidden=true;$('accept-x01-details').replaceChildren();
 $('accept-x01-choices').replaceChildren();
 $('accept-x01-zero').checked=false;
 $('accept-x01-zero-label').hidden=true;
 geometryStatus('未確認。活動エリアの全件を選択してください。');
}
function showGeometry(stage){
 if(stage?.status!=='LAB_DISTANCE_INPUT_STAGED_READ_ONLY'||stage.productionReady!==false||
   stage.writeAllowed!==false||stage.legacyDistanceCommitAllowed!==false)
  stop('X01_REVIEW_STAGE_REQUIRED');
 geometryStage=stage;x01Reviewed=false;
 const d=stage.distanceInput;
 const rows=[
  ['設計ポリゴン','独立（'+d.designPolygon.length+'頂点）'],
  ['Wayfarer観測ポリゴン','履歴（'+d.acquisitionPolygon.length+'頂点）'],
  ['Creative活動エリア',d.activityAreas.length+'件（独立）'],
  ['正式Distance対応','未承認・保存しない']
 ];
 const dl=$('accept-x01-details');dl.replaceChildren();
 for(const [name,value] of rows){
  const dt=document.createElement('dt'),dd=document.createElement('dd');
  dt.textContent=name;dd.textContent=value;dl.append(dt,dd);
 }
 const group=$('accept-x01-choices');group.replaceChildren();
 for(const area of d.activityAreas){
  const label=document.createElement('label'),checkbox=document.createElement('input');
  checkbox.type='checkbox';checkbox.value=area.id;checkbox.dataset.x01Area='yes';
  const span=document.createElement('span');
  span.textContent=area.id+'（'+area.points.length+'頂点）';
  label.append(checkbox,span);group.append(label);
 }
 $('accept-x01-zero-label').hidden=d.activityAreas.length!==0;
 $('accept-x01-zero').checked=false;
 geometryStatus('未確認。全活動エリアを選択してください。');
 $('accept-x01').hidden=false;
}
$('accept-x01-choices').addEventListener('change',()=>{
 x01Reviewed=false;geometryStatus('選択内容を変更しました。確認をやり直してください。');
});
$('accept-x01-zero').addEventListener('change',()=>{
 x01Reviewed=false;geometryStatus('0件の確認状態を変更しました。確認をやり直してください。');
});
$('accept-x01-review').addEventListener('click',()=>{
 if(busy||!geometryStage)return;
 try{
  const areas=geometryStage.distanceInput.activityAreas;
  if(areas.length===0&&!$('accept-x01-zero').checked)stop('X01_ZERO_EXPLICIT_CONFIRM_REQUIRED');
  const ids=[...document.querySelectorAll('[data-x01-area="yes"]:checked')].map(x=>x.value);
  const result=previewX01AreaSelectionLab({
   distanceStage:geometryStage,selectedActivityAreaIds:ids
  });
  if(result.writeAllowed!==false||result.approvedMapping!==false||
    result.legacyDistanceCommitAllowed!==false)stop('X01_REVIEW_WRITE_GATE');
  x01Reviewed=true;
  geometryStatus('照合済み：活動エリア '+result.mappedAreaIds.length+
   '件、設計範囲 '+result.designPolygon.length+
   '頂点、観測履歴 '+result.acquisitionPolygon.length+
   '頂点。X-01正式マッピングは未承認（HOLD）。','ok');
 }catch(e){x01Reviewed=false;
  geometryStatus('HOLD：'+String(e?.code||e?.message||'X01_REVIEW_UNKNOWN').slice(0,100)+
   '。既存データは変更しません。','error');
 }
});
const getIds=()=>({expectedProjectId:$('accept-project').value.trim(),
 expectedHandoffId:$('accept-handoff').value.trim()});
const stop=code=>{const e=new Error(code);e.code=code;throw e;};
const status=(message,kind='neutral')=>{
 $('accept-status').dataset.kind=kind;$('accept-status').textContent=message;
};
function reset(){
 pending=null;exportReady=null;$('accept-summary').hidden=true;$('accept-create').hidden=true;
 $('accept-reedit').hidden=true;clearGeometry();
}
// Invalidate previously verified exports whenever their source identity changes.
for(const id of ['accept-project','accept-handoff','accept-file']){
 $(id).addEventListener(id==='accept-file'?'change':'input',()=>{
  if(busy)return;
  reset();status('入力が変更されました。受信検証または保存データ再開をやり直してください。');
 });
}
function display(row){
 const items=[
 ['送信元保存世代',row.sourceRevision??'再開'],
 ['受信先保存世代',row.existingRevision??row.revision??0],
 ['転送元の認証','未認証（整合性と送信者の証明は別）'],
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
 busy=true;for(const id of ['accept-inspect','accept-create','accept-reopen',
  'accept-project','accept-handoff','accept-file'])
  $(id).disabled=true;
 try{await work();}catch(e){
  reset();status('HOLD：'+String(e?.code||e?.message||'DISTANCE_UNKNOWN').slice(0,130)+
   '。自動上書き・修復・削除はしません。','error');
 }finally{
  busy=false;for(const id of ['accept-inspect','accept-create','accept-reopen',
   'accept-project','accept-handoff','accept-file'])
   $(id).disabled=false;
 }
}
$('accept-inspect').addEventListener('click',()=>locked(async()=>{
 reset();const ids=getIds(),file=$('accept-file').files?.[0];
 if(!file||!file.name.toLowerCase().endsWith('.zip')||file.size<30||file.size>16*1024*1024)
  stop('DISTANCE_LAB_ZIP_REQUIRED');
 status('Project・NEW_V1 KMZ・距離チェック入力を検証中…');
 const row=await api.prepare({...ids,bytes:new Uint8Array(await file.arrayBuffer())});
 display(row);showGeometry(row.x01Stage);pending=row;
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
 display(row);showGeometry(row.x01Stage);
 // Bundle preparation is read-only. A failed check never exposes half-verified files.
 const ids=getIds();
 const transfer=await createPortableReturnBundleLab({
  project:row.project,activityAreas:row.activityAreas,
  kmzBytes:row.kmzBytes,revision:row.revision,...ids,
  JSZip:window.JSZip,DOMParser,cryptoProvider:crypto
 });
 if(transfer.productionReady!==false||transfer.writeAllowed!==false||
   transfer.transportAuthenticated!==false)stop('DISTANCE_REEDIT_ZIP_UNSAFE');
 exportReady={project:row.project,kmzBytes:new Uint8Array(row.kmzBytes),
  portableBytes:new Uint8Array(transfer.bytes),...ids};
 $('accept-reedit').hidden=false;
 status('隔離保存済みの世代 '+row.revision+
  ' を再読込・照合しました。再編集用2ファイルを手動で保存できます。','ok');
}));
function directDownload(data,name,type){
 if(!exportReady||busy||getIds().expectedProjectId!==exportReady.expectedProjectId||
   getIds().expectedHandoffId!==exportReady.expectedHandoffId)return;
 const blob=new Blob([data],{type}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
$('accept-project-download').addEventListener('click',()=>{
 if(!exportReady)return;
 directDownload(JSON.stringify(exportReady.project,null,2)+'\n',
  'distance-reedit-project.json','application/json');
});
$('accept-kmz-download').addEventListener('click',()=>{
 if(!exportReady)return;
 directDownload(exportReady.kmzBytes,'distance-reedit-new-v1.kmz',
  'application/vnd.google-earth.kmz');
});
$('accept-portable-download').addEventListener('click',()=>{
 if(!exportReady)return;
 directDownload(exportReady.portableBytes,'distance-reedit-test-only.zip',
  'application/zip');
});
window.__distanceImportLabStatus=()=>({
 busy,pending:!!pending,x01Reviewed,
 x01StageReady:!!geometryStage,productionReady:false,dbName:api.dbName
});
