import {createIsolatedEditorSession} from '../phase-1b/integration/isolated-editor-session.mjs';
const $=id=>document.getElementById(id);
const session=createIsolatedEditorSession({JSZip:globalThis.JSZip,DOMParser:globalThis.DOMParser,XMLSerializer:globalThis.XMLSerializer,storage:globalThis.localStorage,cryptoProvider:globalThis.crypto});
const labels={pokestop:'ポケストップ',gym:'ジム',power:'パワースポット'};
let activeId=null,coordsOnCanvas=[];
function announce(msg,kind='normal'){$('status').textContent=msg;$('status').style.color=kind==='error'?'#a33d31':'#295648';}
function failure(e){announce(`${e?.code?e.code+': ':''}${e?.message||String(e)}`,'error');}
function shape(){const s=session.state();return s;}
function redraw(){
 const s=shape(),filtered=s.records.filter(p=>!p.deleted),term=$('filter').value.trim().toLowerCase();
 $('counts').textContent=s.hasActive?`既存 ${s.counts.existing.count} / 700 ｜ 新規 ${s.counts.new.count} / 25 ｜ 距離円 ${s.shapes?.circles??0} ｜ 活動範囲 ${s.areas.length}`:'未読み込み';
 $('accept').disabled=!s.hasPending;$('discard').disabled=!s.hasPending;
 for(const id of ['filter','save','export'])$(id).disabled=!s.hasActive;
 $('undo').disabled=!s.hasActive||!s.history.undo;$('redo').disabled=!s.hasActive||!s.history.redo;
 const items=filtered.filter(p=>p.title.toLowerCase().includes(term));
 const tbody=$('pois');tbody.replaceChildren();const shown=items.slice(0,100);
 for(const p of shown){const tr=document.createElement('tr');for(const value of [p.title,labels[p.kind],p.role==='existing'?'既存':'新規']){const td=document.createElement('td');td.textContent=value;tr.appendChild(td)}
  const td=document.createElement('td'),b=document.createElement('button');b.type='button';b.textContent='編集';b.addEventListener('click',()=>openEditor(p.id));td.appendChild(b);tr.appendChild(td);tbody.appendChild(tr);
 }
 if(!shown.length){const tr=document.createElement('tr'),td=document.createElement('td');td.colSpan=4;td.textContent=s.hasActive?'該当するPOIがありません':'KMZを読み込んでください';tr.appendChild(td);tbody.appendChild(tr)}
 $('listed').textContent=s.hasActive?`表示 ${shown.length} / 検索結果 ${items.length}件 （最大100件ずつ表示）`:'';
 drawMap(filtered,s.areas);
}
function drawMap(records,areas){const c=$('map'),ctx=c.getContext('2d');if(!ctx)return;const width=c.width,height=c.height;ctx.clearRect(0,0,width,height);coordsOnCanvas=[];
 const all=[...records.map(p=>[p.lat,p.lng]),...areas.flatMap(a=>a.points)];if(!all.length){ctx.fillStyle='#456d5e';ctx.font='24px system-ui';ctx.fillText('KMZの読込後に位置を表示',34,68);return;}
 const minLat=Math.min(...all.map(x=>x[0])),maxLat=Math.max(...all.map(x=>x[0])),minLng=Math.min(...all.map(x=>x[1])),maxLng=Math.max(...all.map(x=>x[1]));const cos=Math.cos((minLat+maxLat)*Math.PI/360);
 const pad=33,w=width-2*pad,h=height-2*pad,dx=Math.max(.00002,(maxLng-minLng)*cos),dy=Math.max(.00002,maxLat-minLat),scale=Math.min(w/dx,h/dy);
 const midLat=(minLat+maxLat)/2,midLng=(minLng+maxLng)/2;
 const project=(lat,lng)=>[width/2+(lng-midLng)*cos*scale,height/2-(lat-midLat)*scale];
 ctx.strokeStyle='#c0dfc8';ctx.lineWidth=1;for(let i=1;i<6;i++){ctx.beginPath();ctx.moveTo(width*i/6,0);ctx.lineTo(width*i/6,height);ctx.stroke();}
 for(const a of areas){if(!a.points.length)continue;ctx.beginPath();a.points.forEach((p,i)=>{const [x,y]=project(p[0],p[1]);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y)});ctx.closePath();ctx.fillStyle='rgba(37,116,92,.12)';ctx.strokeStyle='#3c8b62';ctx.lineWidth=3;ctx.fill();ctx.stroke();}
 for(const p of records){const [x,y]=project(p.lat,p.lng);coordsOnCanvas.push({id:p.id,x,y});ctx.beginPath();ctx.arc(x,y,p.id===activeId?9:4.5,0,Math.PI*2);ctx.fillStyle=p.kind==='gym'?'#d8665d':p.kind==='power'?'#8655bf':p.role==='new'?'#e3a12c':'#277bbd';ctx.fill();if(p.id===activeId){ctx.strokeStyle='#17251f';ctx.lineWidth=2;ctx.stroke();}}
}
function openEditor(id){const p=shape().records.find(x=>x.id===id);if(!p||p.deleted)return;activeId=id;$('editor').hidden=false;$('selected').textContent=`${p.title}（${p.role==='existing'?'既存':'新規'}）`;
 $('title').value=p.title;$('memo').value=p.memo;$('kind').value=p.kind;
 const sourceLegacy=p.metadata?.originalLayer?.length>0;$('kind').disabled=sourceLegacy;
 $('lat').value=p.lat;$('lng').value=p.lng;
 // Until circle sync is complete, coordinate operations in this UI are disabled.
 $('lat').disabled=$('lng').disabled=true;
 $('delete').disabled=shape().shapes?.circles>0; // conservative; controller enforces per-owner rules.
 redraw();$('editor').scrollIntoView({behavior:'smooth',block:'nearest'});
}
$('map').addEventListener('click',e=>{const rect=$('map').getBoundingClientRect(),x=(e.clientX-rect.left)*$('map').width/rect.width,y=(e.clientY-rect.top)*$('map').height/rect.height;const item=coordsOnCanvas.reduce((best,p)=>{const d=Math.hypot(p.x-x,p.y-y);return d<(best?.d??18)?{...p,d}:best},null);if(item)openEditor(item.id)});
$('inspect').addEventListener('click',async()=>{const f=$('file').files?.[0];if(!f){announce('KMZファイルを選択してください。','error');return;}
 $('inspect').disabled=true;announce('ファイル全体を検査しています…');
 try{const result=await session.prepare(new Uint8Array(await f.arrayBuffer()));$('candidate').hidden=false;
  if(result.status==='REVIEW'){$('candidate').textContent=`検査完了。まだ編集画面には反映していません。\n既存 ${result.counts.existing}件｜新規 ${result.counts.newTotal}件｜距離円 ${result.counts.circles}件｜活動範囲 ${result.counts.activityAreas}件\n旧KMZからの隔離変換: ${result.converted?'あり':'なし'}\n問題がなければ「確認して編集を開始」を押してください。`;announce('検査できました。読み込みを開始するには最終確認が必要です。');}
  else{$('candidate').textContent=`${result.status}: 読み込み保留\n${(result.issues||[]).slice(0,12).map(i=>i.message||i.code).join('\n')}`;announce('読み込みを停止しました。編集中のデータはそのままです。','error');}
 }catch(e){failure(e);}finally{$('inspect').disabled=false;redraw();}});
$('accept').addEventListener('click',()=>{if(!confirm('現在の画面を、検査済みKMZの内容へ置き換えますか？保存済みの別作業は削除しません。'))return;
 try{const r=session.acceptPrepared({confirmed:true});if(r.ok){$('candidate').hidden=true;$('editor').hidden=true;activeId=null;announce('隔離プレビューへ反映しました。正式なCreative Modeには反映されていません。');redraw();}}
 catch(e){failure(e)}});
$('discard').addEventListener('click',()=>{session.discardPending();$('candidate').hidden=true;announce('検査を取り消しました。');redraw();});
$('filter').addEventListener('input',redraw);
$('editor').addEventListener('submit',e=>{e.preventDefault();if(!activeId)return;try{const patch={title:$('title').value.trim(),memo:$('memo').value};const kind=$('kind').value;const previous=shape().records.find(x=>x.id===activeId);if(previous&&kind!==previous.kind)patch.kind=kind;
 const result=session.command({type:'edit',id:activeId,patch},{confirmed:true});if(result.ok){$('editor').hidden=true;activeId=null;announce('編集しました。必要なら「この作業を保存」を押してください。');redraw();}else announce(result.error?.message||'編集できません','error');}catch(err){failure(err)}});
$('edit-cancel').addEventListener('click',()=>{$('editor').hidden=true;activeId=null;redraw();});
$('delete').addEventListener('click',()=>{if(!activeId||!confirm('このPOIを削除しますか？Undoで戻せます。'))return;try{const r=session.command({type:'delete',id:activeId},{confirmed:true});if(r.ok){$('editor').hidden=true;activeId=null;redraw();}else announce(r.error?.message||'削除できません','error')}catch(e){failure(e)}});
for(const action of ['undo','redo'])$(action).addEventListener('click',()=>{try{const result=session[action]();if(result.ok){$('editor').hidden=true;activeId=null;announce('履歴を更新しました。');redraw();}else announce(result.error?.message||'履歴操作できません','error')}catch(e){failure(e)}});
$('save').addEventListener('click',async()=>{try{$('save').disabled=true;const saved=await session.saveDraft();$('save-info').textContent=`保存確認完了（第${saved.revision}世代）。ブラウザ内の隔離領域だけに保存しました。`;announce('保存内容の読み直しが成功しました。');}catch(e){failure(e)}finally{redraw();}});
$('resume').addEventListener('click',async()=>{try{const r=await session.inspectDraft();if(r.status==='EMPTY'){announce('保存済みの隔離作業はありません。');return;}if(r.status==='CORRUPT'){announce('保存データが壊れています。自動削除・上書きはしません。','error');return;}
 if(!confirm(`保存データ（${r.status}）を読み込んで、現在のプレビューを置き換えますか？`))return;
 const restored=await session.resumeDraft({confirmed:true});if(restored.applied){activeId=null;$('editor').hidden=true;announce(restored.readonlyRecovery?'旧世代から表示のみ復旧しました。保存には別の復旧手順が必要です。':'保存データから編集内容を復元しました。');redraw();}}
 catch(e){failure(e)}});
$('export').addEventListener('click',async()=>{try{$('export').disabled=true;const out=await session.exportKmz();const url=URL.createObjectURL(new Blob([out.bytes],{type:'application/vnd.google-earth.kmz'}));const a=document.createElement('a');a.href=url;a.download='creative-next-preview.kmz';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);announce('安全性の再検査に合格したKMZを作成しました。');}catch(e){failure(e)}finally{redraw();}});
redraw();
