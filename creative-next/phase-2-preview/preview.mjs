import {createIsolatedEditorSession} from '../phase-1b/integration/isolated-editor-session.mjs';
import {circleRingAt} from '../phase-1b/core/dependent-circles.mjs';
import {createLeafletMapView} from './leaflet-map-view.mjs';
import {probePreviewEnvironment} from './browser-capabilities.mjs';
import {recoveryChoices,exactRecoveryChoice} from './recovery-choices.mjs';
import {createStrictIndexedCheckpoint} from './strict-idb-checkpoint.mjs';
import {namespaceForPreviewPath} from './workspace-namespace.mjs';
const $=id=>document.getElementById(id);
const capabilities=probePreviewEnvironment(globalThis);
const workspaceNamespace=namespaceForPreviewPath(globalThis.location?.pathname||'');
// Experimental durability sidecar, separate from the existing two-generation
// localStorage journal. The browser cannot claim successful *protected* save
// until the strict IndexedDB checkpoint transaction has completed.
let strictCheckpoint=null;
try{
 if(globalThis.indexedDB && globalThis.crypto?.subtle)
  strictCheckpoint=createStrictIndexedCheckpoint({namespace:workspaceNamespace});
}catch{/* Fail closed: the save control below is disabled without protection. */}

const session=createIsolatedEditorSession({JSZip:globalThis.JSZip,DOMParser:globalThis.DOMParser,XMLSerializer:globalThis.XMLSerializer,storage:capabilities.storage,cryptoProvider:globalThis.crypto,locks:globalThis.navigator?.locks,requireSaveLock:true,namespace:workspaceNamespace});
$('strict-checkpoint-info').textContent=strictCheckpoint?'IndexedDB耐久性チェックポイント: 準備中（実保存は未検証）':'IndexedDBチェックポイントを利用できません。安全な保存は停止しています。';
$('capability-status').textContent=capabilities.warnings.length
  ?'環境確認: '+capabilities.warnings.join(' ')
  :'環境確認: 必要な読込機能が見つかりました。保存の実書き込みは保存操作時に検証します。';
const labels={pokestop:'ポケストップ',gym:'ジム',power:'パワースポット'};
let activeId=null,coordsOnCanvas=[];
let leafletView=null,fitMapNext=false,placementArmed=false;
let recoveryReport=null,recoveryOptions=[];
function setMapStatus(message){$('map-engine').textContent=message;}
function updateMapMode(){
 const s=shape(),target=!$('new-poi').hidden?'new':!$('editor').hidden&&activeId&&s.records.find(p=>p.id===activeId)?.role==='new'?'edit':null;
 $('map-place').disabled=!leafletView||!s.hasActive||s.recoveredFallback||!target;
 if(!target||$('map-place').disabled)placementArmed=false;
 $('map-place').textContent=placementArmed?'位置指定をキャンセル':'地図から緯度・経度を指定';
 $('map-mode-help').textContent=placementArmed?'次の地図タップで緯度・経度を入力します。編集はまだ確定しません。':
  '新規POIの追加または編集欄を開いて位置を指定。数値を確認して確定してください。';
}
function receiveMapPoint({lat,lng}){
 if(!placementArmed)return;
 if(!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180){announce('地図上の座標が不正です。','error');return;}
 const isNew=!$('new-poi').hidden;
 const target=isNew?['new-lat','new-lng']:!$('editor').hidden&&shape().records.find(p=>p.id===activeId)?.role==='new'?['lat','lng']:null;
 if(!target){placementArmed=false;updateMapMode();return;}
 $(target[0]).value=String(lat);$(target[1]).value=String(lng);
 placementArmed=false;updateMapMode();announce('地図の位置を座標欄に反映しました。保存するには追加・編集を確定してください。');
}
function receiveVertexDrop({id,index,lat,lng}){
 try{
  if(shape().recoveredFallback)throw new Error('読み取り専用の復旧中は編集できません。');
  if(!confirm(`活動範囲の頂点 ${index+1} を移動しますか？ Undoで戻せます。`))return;
  const result=session.commandArea({type:'area-move-vertex',id,index,lat,lng},{confirmed:true});
  if(result.ok){$('area-select').value=id;$('area-vertex').value=String(index);announce('地図上の頂点を更新しました。');}
 }catch(e){failure(e)}finally{redraw()}
}
function receiveVertexSelect({id,index}){
 if(!shape().areas.some(a=>a.id===id))return;
 $('area-select').value=id;renderAreaControls(shape());$('area-vertex').value=String(index);updateAreaCoordinates();redraw();
}
function layerVisibility(){return {poi:$('layer-poi').checked,circles:$('layer-circles').checked,areas:$('layer-areas').checked};}

try{
 if(globalThis.L){
  $('leaflet-map').hidden=false;
  leafletView=createLeafletMapView({L:globalThis.L,root:$('leaflet-map'),onSelect:id=>openEditor(id),onMapClick:receiveMapPoint,onVertexDrop:receiveVertexDrop,onVertexSelect:receiveVertexSelect,onTilesState:state=>{if(state==='READY')setMapStatus('Leaflet地図: 地図タイル読込済み');else if(state==='ERROR')setMapStatus('Leaflet地図: タイル取得に失敗。座標と編集機能は利用可能');else setMapStatus('Leaflet地図: タイル読込待ち');}});
 }
}catch(error){$('leaflet-map').hidden=true;leafletView=null;} // Fall back to the local coordinate map.
if(!leafletView)setMapStatus('簡易位置図（地図タイルなし）。Leafletが利用できません。');

function announce(msg,kind='normal'){$('status').textContent=msg;$('status').style.color=kind==='error'?'#a33d31':'#295648';}
function failure(e){announce(`${e?.code?e.code+': ':''}${e?.message||String(e)}`,'error');}
function shape(){const s=session.state();return s;}
function renderAreaControls(s){
 const areaSelect=$('area-select'),vertexSelect=$('area-vertex');
 const oldArea=areaSelect.value,oldVertex=Number(vertexSelect.value||0);
 const options=s.areas.map((a,i)=>({id:a.id,name:`活動範囲 ${i+1}（${a.points.length}頂点）`}));
 areaSelect.replaceChildren(...options.map(o=>new Option(o.name,o.id)));
 areaSelect.value=options.some(o=>o.id===oldArea)?oldArea:(options[0]?.id||'');
 const area=s.areas.find(a=>a.id===areaSelect.value);
 const index=area?Math.min(Math.max(0,oldVertex),area.points.length-1):0;
 vertexSelect.replaceChildren(...(area?.points??[]).map((_,i)=>new Option(`頂点 ${i+1}`,String(i))));
 vertexSelect.value=String(index);
 areaSelect.disabled=vertexSelect.disabled=!area;
 for(const id of ['area-lat','area-lng','area-move','area-add','area-delete'])$(id).disabled=!area;
 $('area-delete').disabled=!area||area.points.length<=3;
 $('area-create-open').disabled=!s.hasActive||s.recoveredFallback||s.areas.length>=64;
 $('area-remove').disabled=!area||s.recoveredFallback;
 if(area){$('area-lat').value=area.points[index][0];$('area-lng').value=area.points[index][1];}
 else{$('area-lat').value='';$('area-lng').value='';}
}
function updateAreaCoordinates(){
 const area=shape().areas.find(a=>a.id===$('area-select').value);
 const p=area?.points[Number($('area-vertex').value)];
 if(p){$('area-lat').value=p[0];$('area-lng').value=p[1];}
}
async function refreshStrictCheckpoint(){
 $('strict-restore').hidden=true;
 if(!strictCheckpoint)return;
 try{
  const [disk,journal]=await Promise.all([strictCheckpoint.inspect(),session.inspectDraft()]);
  if(disk.status==='READY' && journal.status==='EMPTY' && !shape().hasActive){
   $('strict-restore').hidden=false;
   $('strict-checkpoint-info').textContent=`緊急復旧候補: IndexedDB ${disk.revision}世代。従来保存が空です。復旧には確認が必要です。`;
  }else if(disk.status==='READY')
   $('strict-checkpoint-info').textContent=`IndexedDBチェックポイント ${disk.revision}世代を検査済み（保存の絶対保証ではありません）。`;
  else if(disk.status==='EMPTY')
   $('strict-checkpoint-info').textContent='IndexedDBチェックポイントはまだありません。';
  else $('strict-checkpoint-info').textContent='IndexedDBチェックポイントの検査に問題があります。自動復元は行いません。';
 }catch(e){$('strict-checkpoint-info').textContent='IndexedDBの読込に失敗しました。保存データの上書きは行いません。';}
}
$('strict-restore').addEventListener('click',async()=>{
 if(!strictCheckpoint)return;
 if(!confirm('通常保存が空のため、確認済みIndexedDBバックアップから復元しますか？既存の作業は上書きしません。'))return;
 try{
  const [checkpoint,local]=await Promise.all([strictCheckpoint.inspect(),session.inspectDraft()]);
  if(checkpoint.status!=='READY'||local.status!=='EMPTY')throw new Error('復元候補の状態が変更されました。再確認してください。');
  await session.restoreStrictCheckpoint({checkpointSnapshot:checkpoint.snapshot,confirmed:true});
  clearRecoveryReview();fitMapNext=true;announce('確認済みIndexedDBチェックポイントから復元しました。');redraw();
  await refreshStrictCheckpoint();
 }catch(e){failure(e);await refreshStrictCheckpoint();}
});
function redraw(){
 const s=shape(),filtered=s.records.filter(p=>!p.deleted),term=$('filter').value.trim().toLowerCase();
 updateMapMode();$('map-fit').disabled=!s.hasActive;
 $('inspect').disabled=!capabilities.canInspect; $('resume').disabled=!capabilities.canSave;
 $('counts').textContent=s.hasActive?`既存 ${s.counts.existing.count} / 700 ｜ 新規 ${s.counts.new.count} / 25 ｜ 距離円 ${s.shapes?.circles??0} ｜ 活動範囲 ${s.areas.length}`:'未読み込み';
 renderAreaControls(s);
 $('accept').disabled=!s.hasPending;$('discard').disabled=!s.hasPending;
 $('filter').disabled=!s.hasActive; $('save').disabled=!s.hasActive||!capabilities.canSave||!strictCheckpoint; $('export').disabled=!s.hasActive||!capabilities.canExport;
 $('add-new').disabled=!s.hasActive||s.counts.new.count>=25;
 for(const option of $('new-kind').options)option.disabled=!s.hasActive||!s.counts.new.types[option.value]?.canAdd;
 $('undo').disabled=!s.hasActive||!s.history.undo;$('redo').disabled=!s.hasActive||!s.history.redo;
 const items=filtered.filter(p=>p.title.toLowerCase().includes(term));
 const tbody=$('pois');tbody.replaceChildren();const shown=items.slice(0,100);
 for(const p of shown){const tr=document.createElement('tr');for(const value of [p.title,labels[p.kind],p.role==='existing'?'既存':'新規']){const td=document.createElement('td');td.textContent=value;tr.appendChild(td)}
  const td=document.createElement('td'),b=document.createElement('button');b.type='button';b.textContent='編集';b.addEventListener('click',()=>openEditor(p.id));td.appendChild(b);tr.appendChild(td);tbody.appendChild(tr);
 }
 if(!shown.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent=s.hasActive?'該当するPOIがありません':'KMZを読み込んでください';tr.appendChild(td);tbody.appendChild(tr)}
 $('listed').textContent=s.hasActive?`表示 ${shown.length} / 検索結果 ${items.length}件 （最大100件ずつ表示）`:'';
 if(leafletView){leafletView.render(s,{selectedId:activeId,selectedAreaId:$('area-select').value,selectedVertexIndex:Number($('area-vertex').value),visibility:layerVisibility(),editable:!s.recoveredFallback,fit:fitMapNext});fitMapNext=false;}
 else drawMap(layerVisibility().poi?filtered:[],layerVisibility().areas?s.areas:[],layerVisibility().circles?s.circles||[]:[]);
}
function drawMap(records,areas,circles=[]){const c=$('map'),ctx=c.getContext('2d');if(!ctx)return;const width=c.width,height=c.height;ctx.clearRect(0,0,width,height);coordsOnCanvas=[];
 const all=[...records.map(p=>[p.lat,p.lng]),...areas.flatMap(a=>a.points)];if(!all.length){ctx.fillStyle='#456d5e';ctx.font='24px system-ui';ctx.fillText('KMZの読込後に位置を表示',34,68);return;}
 const minLat=Math.min(...all.map(x=>x[0])),maxLat=Math.max(...all.map(x=>x[0])),minLng=Math.min(...all.map(x=>x[1])),maxLng=Math.max(...all.map(x=>x[1]));const cos=Math.cos((minLat+maxLat)*Math.PI/360);
 const pad=33,w=width-2*pad,h=height-2*pad,dx=Math.max(.00002,(maxLng-minLng)*cos),dy=Math.max(.00002,maxLat-minLat),scale=Math.min(w/dx,h/dy);
 const midLat=(minLat+maxLat)/2,midLng=(minLng+maxLng)/2;
 const project=(lat,lng)=>[width/2+(lng-midLng)*cos*scale,height/2-(lat-midLat)*scale];
 ctx.strokeStyle='#c0dfc8';ctx.lineWidth=1;for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(width*i/6,0);ctx.lineTo(width*i/6,height);ctx.stroke();}
 for(const a of areas){if(!a.points.length)continue;ctx.beginPath();a.points.forEach((p,i)=>{const [x,y]=project(p[0],p[1]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.closePath();ctx.fillStyle='rgba(37,116,92,.12)';ctx.strokeStyle='#3c8b62';ctx.lineWidth=3;ctx.fill();ctx.stroke();}
 for(const c of circles){const pts=circleRingAt(c.lat,c.lng,c.radius).split(/\s+/).map(v=>v.split(',').map(Number));ctx.beginPath();pts.forEach(([lng,lat],i)=>{const [x,y]=project(lat,lng);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.closePath();ctx.strokeStyle='#259aae';ctx.lineWidth=1.6;ctx.stroke();}
 for(const p of records){const [x,y]=project(p.lat,p.lng);coordsOnCanvas.push({id:p.id,x,y});ctx.beginPath();ctx.arc(x,y,p.id===activeId?9:4.5,0,Math.PI*2);ctx.fillStyle=p.kind==='gym'?'#d8665d':p.kind==='power'?'#8655bf':p.role==='new'?'#e3a12c':'#277bbd';ctx.fill();if(p.id===activeId){ctx.strokeStyle='#17251f';ctx.lineWidth=2;ctx.stroke();}}
}
function openEditor(id){placementArmed=false;const p=shape().records.find(x=>x.id===id);if(!p||p.deleted)return;activeId=id;$('editor').hidden=false;$('selected').textContent=`${p.title}（${p.role==='existing'?'既存':'新規'}）`;
 $('title').value=p.title;$('memo').value=p.memo;$('kind').value=p.kind;
 $('kind').disabled=false; // Exporter separately verifies layer/folder/style migrations.
 $('lat').value=p.lat;$('lng').value=p.lng;
 // The canonical store enforces that existing POI positions remain immutable.
 $('lat').disabled=$('lng').disabled=p.role==='existing';
 $('delete').disabled=false; // Isolated exporter removes owned circles with deleted POIs.
 redraw();$('editor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
for(const id of ['layer-poi','layer-circles','layer-areas'])$(id).addEventListener('change',redraw);
$('map-fit').addEventListener('click',()=>{fitMapNext=true;redraw();});
$('map-place').addEventListener('click',()=>{placementArmed=!placementArmed;updateMapMode();});
$('map').addEventListener('click',e=>{const rect=$('map').getBoundingClientRect(),x=(e.clientX-rect.left)*$('map').width/rect.width,y=(e.clientY-rect.top)*$('map').height/rect.height;const item=coordsOnCanvas.reduce((best,p)=>{const d=Math.hypot(p.x-x,p.y-y);return d<(best?.d??18)?{...p,d}:best},null);if(item)openEditor(item.id)});
$('inspect').addEventListener('click',async()=>{const f=$('file').files?.[0];if(!f){announce('KMZファイルを選択してください。','error');return;}
 $('inspect').disabled=true;announce('ファイル全体を検査しています…');
 try{const result=await session.prepare(new Uint8Array(await f.arrayBuffer()));$('candidate').hidden=false;
  if(result.status==='REVIEW'){$('candidate').textContent=`検査完了。まだ編集画面には反映していません。\n既存 ${result.counts.existing}件｜新規 ${result.counts.newTotal}件｜距離円 ${result.counts.circles}件｜活動範囲 ${result.counts.activityAreas}件\n旧KMZからの隔離変換: ${result.converted?'あり':'なし'}\n問題がなければ「確認して編集を開始」を押してください。`;announce('検査できました。読み込みを開始するには最終確認が必要です。');}
  else{
    let auditText='';
    if(result.legacyAudit?.status==='REPORT_ONLY'){
      const a=result.legacyAudit.summary;
      const lengths=Object.entries(a.ringsByLength).sort((x,y)=>Number(x[0])-Number(y[0])).map(([k,v])=>k+'座標点='+v).join('、');
      const issues=result.legacyAudit.issues.map(x=>x.code+': '+x.count+'件').join(' / ');
      auditText='\\n\\n【旧KMZの読取専用診断】\\nPOI候補 '+a.pois+'件・距離円候補 '+a.circleCandidates+'件（30m='+a.circleByRadius[30]+'、40m='+a.circleByRadius[40]+'、50m='+a.circleByRadius[50]+'）'+
        '\\n円の座標点数: '+(lengths||'なし')+
        '\\n形状確認済 '+a.verifiedCircleGeometry+'件・未確認 '+a.unverifiedCircleGeometry+'件'+
        '\\n所有者不明 '+a.orphanVerifiedCircles+'件・曖昧 '+a.ambiguousVerifiedCircles+'件・同一半径重複 '+a.duplicatedVerifiedOwnerRadius+'件'+
        (issues?'\\n要調査: '+issues:'')+
        '\\n※診断のみ。安全確認を省略した取込や自動修復は行いません。';
    }
    $('candidate').textContent=`${result.status}: 読み込み保留\\n${(result.issues||[]).slice(0,12).map(i=>i.message||i.code).join('\\n')}${auditText}`;
    announce('読み込みを停止しました。編集中のデータはそのままです。','error');
   }
 }catch(e){failure(e);}finally{$('inspect').disabled=false;redraw();}});
$('accept').addEventListener('click',()=>{if(!confirm('現在の画面を、検査済みKMZの内容へ置き換えますか？保存済みの別作業は削除しません。'))return;
 try{const r=session.acceptPrepared({confirmed:true});if(r.ok){clearRecoveryReview();$('candidate').hidden=true;$('editor').hidden=true;activeId=null;placementArmed=false;fitMapNext=true;$('area-vertex').value='0';announce('隔離プレビューへ反映しました。正式なCreative Modeには反映されていません。');redraw();}}
 catch(e){failure(e)}});
$('discard').addEventListener('click',()=>{session.discardPending();$('candidate').hidden=true;announce('検査を取り消しました。');redraw();});
$('filter').addEventListener('input',redraw);
$('add-new').addEventListener('click',()=>{
 $('new-poi').hidden=false;$('editor').hidden=true;activeId=null;placementArmed=false;
 const available=[...$('new-kind').options].find(o=>!o.disabled);
 if(available)$('new-kind').value=available.value;
 $('new-poi').scrollIntoView({behavior:'smooth',block:'nearest'});redraw();
});
$('new-cancel').addEventListener('click',()=>{$('new-poi').hidden=true;redraw();});
$('new-poi').addEventListener('submit',e=>{e.preventDefault();try{
 const title=$('new-title').value.trim(),kind=$('new-kind').value;
 const rawLat=$('new-lat').value.trim(),rawLng=$('new-lng').value.trim();
 const lat=Number(rawLat),lng=Number(rawLng);
 if(!title||!rawLat||!rawLng||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error('名称と緯度・経度を正しく入力してください。');
 if(Math.abs(lat)>89.9)throw new Error('極地付近では50mの距離円を安全に生成できません。');
 const r=session.command({type:'add',poi:{role:'new',kind,title,memo:$('new-memo').value,lat,lng}},{confirmed:true});
 if(!r.ok){announce(r.error?.message||'追加できませんでした','error');return;}
 $('new-poi').reset();$('new-poi').hidden=true;announce('新規POIを追加しました。50mの距離円も作成します。');redraw();
 }catch(error){failure(error);}});
$('editor').addEventListener('submit',e=>{e.preventDefault();if(!activeId)return;try{const patch={title:$('title').value.trim(),memo:$('memo').value};const kind=$('kind').value;const previous=shape().records.find(x=>x.id===activeId);if(previous&&kind!==previous.kind)patch.kind=kind;
 if(previous?.role==='new'){
  const rawLat=$('lat').value.trim(),rawLng=$('lng').value.trim();
  const lat=Number(rawLat),lng=Number(rawLng);
  if(!rawLat||!rawLng||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new Error('緯度・経度を正しく入力してください。');
  if(lat!==previous.lat||lng!==previous.lng){patch.lat=lat;patch.lng=lng;}
 }
 const result=session.command({type:'edit',id:activeId,patch},{confirmed:true});if(result.ok){$('editor').hidden=true;activeId=null;announce('編集しました。必要なら「この作業を保存」を押してください。');redraw();}else announce(result.error?.message||'編集できません','error');}catch(err){failure(err)}});
$('edit-cancel').addEventListener('click',()=>{$('editor').hidden=true;activeId=null;redraw();});
$('delete').addEventListener('click',()=>{if(!activeId||!confirm('このPOIを削除しますか？紐づく距離円も同時に除外します。Undoで戻せます。'))return;try{const r=session.command({type:'delete',id:activeId},{confirmed:true});if(r.ok){$('editor').hidden=true;activeId=null;redraw();}else announce(r.error?.message||'削除できません','error')}catch(e){failure(e)}});
for(const action of ['undo','redo'])$(action).addEventListener('click',()=>{try{const result=session[action]();if(result.ok){$('editor').hidden=true;activeId=null;announce('履歴を更新しました。');redraw();}else announce(result.error?.message||'履歴操作できません','error')}catch(e){failure(e)}});
$('area-create-open').addEventListener('click',()=>{
 if(!shape().hasActive||shape().recoveredFallback)return;
 $('area-create-form').hidden=false;$('area-create-points').focus();
});
$('area-create-cancel').addEventListener('click',()=>{$('area-create-form').hidden=true;});
$('area-create-form').addEventListener('submit',event=>{event.preventDefault();try{
 const lines=$('area-create-points').value.trim().split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 if(lines.length<3||lines.length>512)throw new Error('頂点は3〜512件にしてください。');
 const points=lines.map(line=>{
  const parts=line.split(',').map(t=>t.trim());
  if(parts.length!==2||parts.some(t=>!t||!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(t)))throw new Error('「緯度,経度」を1行ずつ入力してください。');
  return parts.map(Number);
 });
 if(!globalThis.crypto?.randomUUID)throw new Error('安全な一意IDを作成できません。HTTPSまたはlocalhostから操作してください。');
 if(!confirm(`新しい活動範囲（${points.length}頂点）を追加しますか？ Undoで戻せます。`))return;
 const id='area-'+globalThis.crypto.randomUUID();
 const result=session.commandArea({type:'area-create',id,points},{confirmed:true});
 if(!result.changed)throw new Error('活動範囲の作成が拒否されました。');
 $('area-create-form').reset();$('area-create-form').hidden=true;
 announce('活動範囲を追加しました。Undoで元に戻せます。');
 redraw();$('area-select').value=id;renderAreaControls(shape());
}catch(e){failure(e)}});
$('area-remove').addEventListener('click',()=>{
 const id=$('area-select').value;if(!id||shape().recoveredFallback)return;
 if(!confirm('この活動範囲を丸ごと削除しますか？ 距離円やPOIは削除しません。Undoで戻せます。'))return;
 try{const result=session.commandArea({type:'area-remove',id},{confirmed:true});if(result.changed){announce('活動範囲を削除しました。Undoで戻せます。');redraw();}}catch(e){failure(e)}
});
$('area-select').addEventListener('change',()=>redraw());
$('area-vertex').addEventListener('change',()=>{updateAreaCoordinates();redraw();});
for(const [button,type] of [['area-move','area-move-vertex'],['area-add','area-add-vertex'],['area-delete','area-delete-vertex']]){
 $(button).addEventListener('click',()=>{
  try{
   const id=$('area-select').value,index=Number($('area-vertex').value);
   if(!id||!Number.isInteger(index))throw new Error('活動範囲と頂点を選んでください。');
   if(type==='area-delete-vertex'&&!confirm('この頂点を削除しますか？Undoで戻せます。'))return;
   const command={type,id,index};
   if(type!=='area-delete-vertex'){
    const rawLat=$('area-lat').value.trim(),rawLng=$('area-lng').value.trim();
    if(!rawLat||!rawLng)throw new Error('緯度・経度を入力してください。');
    command.lat=Number(rawLat);command.lng=Number(rawLng);
   }
   const result=session.commandArea(command,{confirmed:true});
   if(result.ok){announce(result.changed?'活動範囲を更新しました。Undoで元に戻せます。':'変更はありません。');redraw();}
  }catch(e){failure(e)}
 });
}
$('save').addEventListener('click',async()=>{
 try{
  $('save').disabled=true;
  if(!strictCheckpoint)throw new Error('耐久性チェックポイントが利用できません。KMZ書き出しをご利用ください。');
  const saved=await session.saveDraft();
  // Local journal first, strict checkpoint second. Never tell the user the
  // entire protected save completed if IndexedDB fails.
  const draft=await session.inspectDraft();
  if(draft.status!=='READY'||draft.revision!==saved.revision)throw new Error('保存直後の世代照合に失敗');
  const current=await strictCheckpoint.inspect();
  if(!['EMPTY','READY'].includes(current.status))throw new Error('IndexedDBの復旧確認が必要。KMZバックアップを推奨します。');
  const checkpointed=await strictCheckpoint.save(draft.snapshot,{expectedRevision:current.revision});
  clearRecoveryReview();
  $('save-info').textContent=`保存確認完了（第${saved.revision}世代）。IndexedDB耐久性チェックポイント${checkpointed.revision}世代の完了も確認しました。ただし強制終了や端末故障への絶対保証ではありません。`;
  announce('2世代保存とIndexedDBチェックポイントを確認しました。');
  await refreshStrictCheckpoint();
 }catch(e){
  $('save-info').textContent='保護付き保存は未完了です。KMZを書き出して退避してください。';
  failure(e);
 }finally{redraw();}
});
$('resume').addEventListener('click',async()=>{try{const r=await session.inspectDraft();if(r.status==='EMPTY'){announce('保存済みの隔離作業はありません。');return;}if(r.status==='CORRUPT'){announce('保存データが壊れています。自動削除・上書きはしません。','error');return;}
 if(!confirm(`保存データ（${r.status}）を読み込んで、現在のプレビューを置き換えますか？`))return;
 const restored=await session.resumeDraft({confirmed:true});if(restored.applied){clearRecoveryReview();activeId=null;placementArmed=false;fitMapNext=true;$('area-vertex').value='0';$('editor').hidden=true;announce(restored.readonlyRecovery?'旧世代から表示のみ復旧しました。保存には別の復旧手順が必要です。':'保存データから編集内容を復元しました。');redraw();}}
 catch(e){failure(e)}});
function clearRecoveryReview(){
 recoveryReport=null;recoveryOptions=[];$('recovery-review').hidden=true;
 $('recovery-choice').replaceChildren(new Option('保存世代を選択してください',''));
 $('recovery-apply').disabled=true;
}
$('recovery-inspect').disabled=!capabilities.storage||!capabilities.cryptoReady;
$('recovery-inspect').addEventListener('click',async()=>{
 try{
  clearRecoveryReview();
  const report=await session.inspectRecovery();
  if(report.status!=='FALLBACK'){
   announce(report.status==='READY'?'保存内容は正常です。復旧は必要ありません。':report.status==='EMPTY'?'復旧する保存データはありません。':'正常な保存世代が見つかりません。データを削除しません。',report.status==='CORRUPT'?'error':undefined);
   return;
  }
  recoveryOptions=recoveryChoices(report);
  if(!recoveryOptions.length){announce('安全に選択できる保存世代がありません。','error');return;}
  recoveryReport=report;
  $('recovery-choice').replaceChildren(new Option('保存世代を選択してください',''),
   ...recoveryOptions.map(c=>new Option(c.label,c.key)));
  $('recovery-info').textContent=`検査で確認した正常な保存世代: ${recoveryOptions.length}件。選択するまで保存内容は変更されません。`;
  $('recovery-review').hidden=false;
  announce('保存世代を確認しました。復旧する世代を選択してください。');
 }catch(e){clearRecoveryReview();failure(e)}
});
$('recovery-choice').addEventListener('change',()=>{
 $('recovery-apply').disabled=!capabilities.locksReady||!exactRecoveryChoice(recoveryOptions,$('recovery-choice').value);
});
$('recovery-cancel').addEventListener('click',()=>{clearRecoveryReview();announce('復旧を中止しました。保存内容は変更していません。')});
$('recovery-apply').addEventListener('click',async()=>{
 const choice=exactRecoveryChoice(recoveryOptions,$('recovery-choice').value);
 if(!choice||!recoveryReport){announce('保存世代を先に選択してください。','error');return;}
 if(!confirm(`第${choice.revision}世代（保存枠${choice.slot.toUpperCase()}）を復旧しますか？\n現在の編集画面は置き換わります。元の保存枠は削除しません。`))return;
 $('recovery-apply').disabled=true;
 try{
  const repaired=await session.recoverDraft({report:recoveryReport,candidate:choice,confirmed:true});
  if(!repaired.applied)throw new Error('復旧した編集内容を検証できませんでした。');
  activeId=null;placementArmed=false;fitMapNext=true;$('editor').hidden=true;
  $('save-info').textContent=`第${repaired.revision}世代へ復旧しました。保存枠は両方保持しています。`;
  clearRecoveryReview();redraw();announce('保存世代の復旧と読み込みを検証できました。');
 }catch(e){clearRecoveryReview();failure(e);announce('復旧結果を確認できません。再診断してから操作してください。','error')}
});
$('export').addEventListener('click',async()=>{try{$('export').disabled=true;const out=await session.exportKmz();const url=URL.createObjectURL(new Blob([out.bytes],{type:'application/vnd.google-earth.kmz'}));const a=document.createElement('a');a.href=url;a.download='creative-next-preview.kmz';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);announce('安全性の再検査に合格したKMZを作成しました。');}catch(e){failure(e)}finally{redraw();}});
redraw();

void refreshStrictCheckpoint();
