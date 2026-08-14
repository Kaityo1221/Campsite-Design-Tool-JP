(() => {
  'use strict';

  const AREA_FOLDER='活動範囲';
  const DB_NAME='campsite-field-session';
  const DB_VERSION=1;
  const DB_STORE='state';
  const DB_KEY='field-areas-v1';
  let draftPoints=[];
  let previewLayer=null;
  let draftPointLayer=null;
  let controls=null;
  let areaRecords=[];
  let areaSeq=0;
  let sourcePromise=Promise.resolve(null);
  let sourceIdentity='';
  let initialized=false;
  let saveWrapperInstalled=false;

  function centerLatLng(){const c=map.getCenter();return[c.lat,c.lng];}
  function activeAreas(){return areaRecords.filter(record=>!record.deleted);}
  function areaChangedCount(){return activeAreas().length;}
  function sourceId(file){return file?`${file.name}:${file.size}:${file.lastModified||0}`:'';}

  function openDb(){
    return new Promise((resolve,reject)=>{
      const request=indexedDB.open(DB_NAME,DB_VERSION);
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('IndexedDBを開けませんでした。'));
      request.onblocked=()=>reject(new Error('IndexedDBが使用中です。'));
    });
  }

  async function areaStoreGet(){
    const db=await openDb();
    try{return await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly'),request=tx.objectStore(DB_STORE).get(DB_KEY);request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error||tx.error);});}
    finally{db.close();}
  }

  async function areaStorePut(value){
    const db=await openDb();
    try{await new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite'),request=tx.objectStore(DB_STORE).put(value,DB_KEY);request.onerror=()=>reject(request.error||tx.error);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});}
    finally{db.close();}
  }

  function areaActionIds(stack){return stack.filter(action=>action?.kind==='area-add'&&action.areaRecord?.id).map(action=>action.areaRecord.id);}
  function snapshotAreas(){return areaRecords.map(record=>({id:record.id,name:record.name,points:record.points.map(point=>[...point]),deleted:!!record.deleted}));}

  function persistAreas(){
    if(!sourceIdentity)return;
    const payload={version:1,sourceIdentity,seq:areaSeq,records:snapshotAreas(),undoIds:areaActionIds(undoStack),redoIds:areaActionIds(redoStack),savedAt:Date.now()};
    areaStorePut(payload).catch(error=>console.warn('field area IndexedDB save failed',error));
  }

  function findKmlPath(zip){
    const names=Object.keys(zip.files).filter(name=>name.toLowerCase().endsWith('.kml')&&!zip.files[name].dir);
    if(!names.length)throw new Error('KMZ内にKMLがありません。');
    return names.find(name=>/(^|\/)doc\.kml$/i.test(name))||names[0];
  }

  async function captureSource(file){
    if(!file)return null;
    const lower=file.name.toLowerCase();
    if(lower.endsWith('.kml'))return{file,zip:null,kmlPath:'doc.kml',kmlText:await file.text()};
    const zip=await JSZip.loadAsync(await file.arrayBuffer()),kmlPath=findKmlPath(zip);
    return{file,zip,kmlPath,kmlText:await zip.files[kmlPath].async('string')};
  }

  function clearAreas(){
    areaRecords.forEach(record=>{if(record.layer&&dataLayer.hasLayer(record.layer))dataLayer.removeLayer(record.layer);});
    areaRecords=[];
    areaSeq=0;
    refreshSaveButton();
  }

  function makeAreaLayer(record){
    const layer=L.polygon(record.points,{pane:'fieldPoiPane',color:'#e06b2d',weight:4,opacity:.95,fillColor:'#f3a35b',fillOpacity:.16,lineJoin:'round'});
    layer.bindPopup(`<strong>${record.name}</strong><br><small>現地モードで追加した活動範囲</small>`);
    record.layer=layer;
    if(!record.deleted)layer.addTo(dataLayer);
    return layer;
  }

  function restoreAreas(snapshots=[]){
    clearAreas();
    areaRecords=(snapshots||[]).filter(item=>Array.isArray(item.points)&&item.points.length>=3).map(item=>({
      id:item.id||`area:${Date.now().toString(36)}:${++areaSeq}`,
      name:item.name||`活動範囲 ${areaSeq+1}`,
      points:item.points.map(point=>[Number(point[0]),Number(point[1])]),
      deleted:!!item.deleted,
      layer:null
    }));
    areaSeq=Math.max(areaSeq,areaRecords.length);
    areaRecords.forEach(makeAreaLayer);
    refreshSaveButton();
    return new Map(areaRecords.map(record=>[record.id,record]));
  }

  function waitForFileLoaded(callback,attempt=0){
    if(fileLoaded){callback();return;}
    if(attempt<80)setTimeout(()=>waitForFileLoaded(callback,attempt+1),50);
  }

  async function restoreStoredAreas(identity){
    try{
      const payload=await areaStoreGet();
      if(!payload||payload.version!==1||payload.sourceIdentity!==identity)return;
      waitForFileLoaded(()=>{
        if(sourceIdentity!==identity)return;
        const areaMap=restoreAreas(payload.records||[]);
        areaSeq=Math.max(areaSeq,Number(payload.seq)||0);
        const existingUndoIds=new Set(areaActionIds(undoStack));
        const existingRedoIds=new Set(areaActionIds(redoStack));
        for(const id of payload.undoIds||[]){const record=areaMap.get(id);if(record&&!existingUndoIds.has(id))undoStack.push({kind:'area-add',areaRecord:record});}
        for(const id of payload.redoIds||[]){const record=areaMap.get(id);if(record&&!existingRedoIds.has(id))redoStack.push({kind:'area-add',areaRecord:record});}
        updateHistoryButtons();
        refreshSaveButton();
      });
    }catch(error){console.warn('field area IndexedDB restore failed',error);}
  }

  function setSourceFile(file){
    if(!file)return;
    clearAreas();
    sourceIdentity=sourceId(file);
    sourcePromise=captureSource(file).catch(error=>{console.error('field area source capture failed',error);return null;});
    restoreStoredAreas(sourceIdentity);
  }

  function ensureControls(){
    if(controls)return controls;
    controls=document.createElement('div');
    controls.id='fieldModeAreaActions';
    Object.assign(controls.style,{display:'none',position:'fixed',left:'50%',bottom:'var(--field-action-bottom)',transform:'translateX(-50%)',width:'min(calc(100% - 24px), 560px)',gridTemplateColumns:'1.2fr 1fr 1fr',gap:'8px',padding:'8px',border:'1px solid rgba(73,57,30,.24)',borderRadius:'16px',background:'rgba(59,49,37,.93)',boxShadow:'0 5px 16px rgba(0,0,0,.22)',backdropFilter:'blur(8px)',zIndex:'1190'});
    controls.innerHTML=`
      <button type="button" data-area-action="add">＋ 点を追加</button>
      <button type="button" data-area-action="back">↶ 1点戻す</button>
      <button type="button" data-area-action="confirm">✓ 範囲を確定</button>
      <button type="button" data-area-action="cancel" style="grid-column:1 / -1">× 範囲を取消</button>`;
    controls.querySelectorAll('button').forEach(button=>Object.assign(button.style,{minHeight:'44px',border:'1px solid #b89a57',borderRadius:'12px',background:'rgba(255,248,230,.97)',color:'#49391e',fontWeight:'900'}));
    controls.addEventListener('click',event=>{
      const button=event.target.closest('[data-area-action]');
      if(!button)return;
      const action=button.dataset.areaAction;
      if(action==='add')addDraftPoint();
      if(action==='back')removeDraftPoint();
      if(action==='confirm')confirmArea();
      if(action==='cancel')cancelDraft({exit:true});
    });
    document.body.appendChild(controls);
    return controls;
  }

  function refreshControls(){
    if(!controls)return;
    controls.querySelector('[data-area-action="back"]').disabled=!draftPoints.length;
    controls.querySelector('[data-area-action="confirm"]').disabled=draftPoints.length<3;
    selectionTitle.textContent=`⬡ 活動範囲を作成中（${draftPoints.length}点）`;
    selectionDetail.textContent=draftPoints.length<3?'地図中央の十字を合わせて「＋ 点を追加」。3点以上で範囲を確定できます。':'最後は自動で最初の点へつながります。橙色の面が完成イメージです。';
  }

  function redrawPreview(){
    if(previewLayer){dataLayer.removeLayer(previewLayer);previewLayer=null;}
    if(draftPointLayer){dataLayer.removeLayer(draftPointLayer);draftPointLayer=null;}
    const center=centerLatLng();
    const previewPoints=draftPoints.length?[...draftPoints,center]:[center];
    if(previewPoints.length>=3)previewLayer=L.polygon(previewPoints,{pane:'fieldPoiPane',color:'#e06b2d',weight:4,opacity:.78,dashArray:'8 7',fillColor:'#f3a35b',fillOpacity:.12,interactive:false}).addTo(dataLayer);
    else if(previewPoints.length>=2)previewLayer=L.polyline(previewPoints,{pane:'fieldPoiPane',color:'#e06b2d',weight:4,opacity:.72,dashArray:'8 7',interactive:false}).addTo(dataLayer);
    if(draftPoints.length){
      draftPointLayer=L.layerGroup(draftPoints.map((point,index)=>L.circleMarker(point,{pane:'fieldPoiPane',radius:5,weight:2,color:'#9d481d',fillColor:'#fff2df',fillOpacity:1,interactive:false}).bindTooltip(String(index+1),{permanent:true,direction:'top',offset:[0,-6]}))).addTo(dataLayer);
    }
  }

  function beginArea(){
    if(!fileLoaded)return;
    draftPoints=[];
    resetPoiSelection();
    window.FieldCreative?.selectTool('area',{collapse:false});
    window.FieldCreative?.closeMenu();
    crosshair.style.display='block';
    ensureControls().style.display='grid';
    modeStatus.textContent='活動範囲を作成';
    refreshControls();
    redrawPreview();
  }

  function addDraftPoint(){
    draftPoints.push(centerLatLng());
    redrawPreview();
    refreshControls();
    modeStatus.textContent=`活動範囲：${draftPoints.length}点`;
  }

  function removeDraftPoint(){if(!draftPoints.length)return;draftPoints.pop();redrawPreview();refreshControls();}
  function clearPreview(){if(previewLayer){dataLayer.removeLayer(previewLayer);previewLayer=null;}if(draftPointLayer){dataLayer.removeLayer(draftPointLayer);draftPointLayer=null;}}

  function cancelDraft({exit=false}={}){
    draftPoints=[];clearPreview();crosshair.style.display='none';if(controls)controls.style.display='none';
    if(exit)window.FieldCreative?.exit({cancel:false});
    modeStatus.textContent='範囲作成を取消';
    selectionTitle.textContent='追加予定POIを選択してください';
    selectionDetail.textContent='地図上の黄色い追加予定POIをタップしてください。';
  }

  function confirmArea(){
    if(draftPoints.length<3)return;
    areaSeq+=1;
    const record={id:`area:${Date.now().toString(36)}:${areaSeq}`,name:`活動範囲 ${areaSeq}`,points:draftPoints.map(point=>[...point]),deleted:false,layer:null};
    areaRecords.push(record);makeAreaLayer(record);
    undoStack.push({kind:'area-add',areaRecord:record});redoStack.length=0;updateHistoryButtons();
    draftPoints=[];clearPreview();crosshair.style.display='none';if(controls)controls.style.display='none';
    refreshSaveButton();persistAreas();modeStatus.textContent='活動範囲を追加';
    selectionTitle.textContent=`追加：${record.name}`;
    selectionDetail.textContent=`${record.points.length}点の外周を閉じた範囲として追加しました。KMZ保存でPolygonとして出力します。`;
    window.FieldCreative?.exit({cancel:false});
  }

  function undoArea(event){
    const action=undoStack[undoStack.length-1];if(action?.kind!=='area-add')return;
    event.preventDefault();event.stopImmediatePropagation();undoStack.pop();
    const record=action.areaRecord;record.deleted=true;if(record.layer&&dataLayer.hasLayer(record.layer))dataLayer.removeLayer(record.layer);
    redoStack.push(action);updateHistoryButtons();refreshSaveButton();persistAreas();modeStatus.textContent='範囲追加を戻しました';
  }

  function redoArea(event){
    const action=redoStack[redoStack.length-1];if(action?.kind!=='area-add')return;
    event.preventDefault();event.stopImmediatePropagation();redoStack.pop();
    const record=action.areaRecord;record.deleted=false;if(record.layer&&!dataLayer.hasLayer(record.layer))record.layer.addTo(dataLayer);
    undoStack.push(action);updateHistoryButtons();refreshSaveButton();persistAreas();modeStatus.textContent='範囲追加をやり直しました';
  }

  undoButton.addEventListener('click',undoArea,true);
  redoButton.addEventListener('click',redoArea,true);
  map.on('move',()=>{if(controls?.style.display==='grid')redrawPreview();});
  window.addEventListener('fieldcreativecancel',()=>cancelDraft({exit:false}));

  function createElement(doc,name,text){const el=doc.createElementNS(doc.documentElement.namespaceURI||'http://www.opengis.net/kml/2.2',name);if(text!==undefined)el.textContent=text;return el;}
  function directName(node){return Array.from(node.children||[]).find(el=>el.localName==='name')?.textContent?.trim()||'';}
  function findFolderByName(doc,name){return Array.from(doc.getElementsByTagNameNS('*','Folder')).find(folder=>directName(folder)===name)||null;}
  function ensureTargetFolder(doc,documentNode,name){let folder=findFolderByName(doc,name);if(folder)return folder;folder=createElement(doc,'Folder');folder.appendChild(createElement(doc,'name',name));documentNode.appendChild(folder);return folder;}
  function additionalFolderName(record){const helper=window.FieldModeExport?.additionalFolderName;if(typeof helper==='function')return helper(record?.poiType,record?.folder);const value=String(record?.poiType||'').toLowerCase();if(value==='gym')return'追加希望ジム';if(value==='power'||value==='power_spot')return'追加希望パワスポ';return'追加希望ポケスト';}
  function removeOldFieldCircleFolders(doc){Array.from(doc.getElementsByTagNameNS('*','Folder')).forEach(folder=>{const name=directName(folder);if(name==='現地モード_30m円'||name==='現地モード_40m円'||name==='現地モード_50m円'||name==='現地モード_距離円')folder.remove();});}
  function canonicalCircleFolder(doc,documentNode,canonical,aliases=[]){const names=new Set([canonical,...aliases]),matches=Array.from(doc.getElementsByTagNameNS('*','Folder')).filter(folder=>names.has(directName(folder)));let target=matches.find(folder=>directName(folder)===canonical)||matches[0];if(!target){target=ensureTargetFolder(doc,documentNode,canonical);}else{const nameNode=Array.from(target.children||[]).find(el=>el.localName==='name');if(nameNode)nameNode.textContent=canonical;}matches.filter(folder=>folder!==target).forEach(folder=>{Array.from(folder.children||[]).filter(el=>el.localName!=='name').forEach(el=>target.appendChild(el));folder.remove();});return target;}
  function destinationPoint(latDeg,lngDeg,distanceMeters,bearingDeg){const radius=6378137,delta=distanceMeters/radius,theta=bearingDeg*Math.PI/180,phi1=latDeg*Math.PI/180,lambda1=lngDeg*Math.PI/180,sinPhi2=Math.sin(phi1)*Math.cos(delta)+Math.cos(phi1)*Math.sin(delta)*Math.cos(theta),phi2=Math.asin(sinPhi2),lambda2=lambda1+Math.atan2(Math.sin(theta)*Math.sin(delta)*Math.cos(phi1),Math.cos(delta)-Math.sin(phi1)*Math.sin(phi2));return[phi2*180/Math.PI,lambda2*180/Math.PI];}
  function circleCoordinateText(lat,lng,radiusMeters,steps=72){const points=[];for(let i=0;i<=steps;i++){const[pLat,pLng]=destinationPoint(lat,lng,radiusMeters,360*i/steps);points.push(`${pLng.toFixed(8)},${pLat.toFixed(8)},0`);}return points.join(' ');}
  function folderStyleUrl(folder){if(!folder)return'';for(const pm of Array.from(folder.children||[]).filter(el=>el.localName==='Placemark')){const styleUrl=Array.from(pm.children||[]).find(el=>el.localName==='styleUrl');if(styleUrl?.textContent?.trim())return styleUrl.textContent.trim();}return'';}
  function createCirclePlacemark(doc,record,radiusMeters,styleUrl){const pm=createElement(doc,'Placemark');pm.appendChild(createElement(doc,'name',`${record.name}_${radiusMeters}m円`));if(styleUrl)pm.appendChild(createElement(doc,'styleUrl',styleUrl));const polygon=createElement(doc,'Polygon');polygon.appendChild(createElement(doc,'tessellate','1'));polygon.appendChild(createElement(doc,'altitudeMode','clampToGround'));const outer=createElement(doc,'outerBoundaryIs'),ring=createElement(doc,'LinearRing');ring.appendChild(createElement(doc,'coordinates',circleCoordinateText(record.latlng[0],record.latlng[1],radiusMeters)));outer.appendChild(ring);polygon.appendChild(outer);pm.appendChild(polygon);return pm;}
  function appendGeneratedCircles(doc,documentNode,allRecords,newRecords){const spacing=window.CampsitePoiSpacingPolicy,folder50=canonicalCircleFolder(doc,documentNode,spacing.targetCircleFolder,['50m円（基本距離）']),folder40=canonicalCircleFolder(doc,documentNode,spacing.referenceCircleFolders[40],['40m円（基本距離）']),folder30=canonicalCircleFolder(doc,documentNode,spacing.referenceCircleFolders[30],['30m円（調整用）']),style50=folderStyleUrl(folder50),style40=folderStyleUrl(folder40),style30=folderStyleUrl(folder30);Array.from(folder50.children||[]).filter(el=>el.localName==='Placemark').forEach(el=>el.remove());allRecords.forEach(record=>folder50.appendChild(createCirclePlacemark(doc,record,spacing.targetMeters,style50)));newRecords.forEach(record=>{if(record.include40mCircle)folder40.appendChild(createCirclePlacemark(doc,record,40,style40));if(record.include30mCircle)folder30.appendChild(createCirclePlacemark(doc,record,30,style30));});}
  function pointPlacemarks(doc){return Array.from(doc.getElementsByTagNameNS('*','Placemark')).filter(pm=>!!pm.getElementsByTagNameNS('*','Point')[0]?.getElementsByTagNameNS('*','coordinates')[0]);}
  function buildOriginalPlacemarkMap(doc){const originals=poiRecords.filter(r=>!r.isNew),marks=pointPlacemarks(doc),out=new Map();originals.forEach((record,index)=>{if(marks[index])out.set(record,marks[index]);});return out;}
  function setDescription(doc,pm,record,photoPath){if(!pm)return;let desc=Array.from(pm.children||[]).find(el=>el.localName==='description');if(!desc){desc=createElement(doc,'description');const point=Array.from(pm.children||[]).find(el=>el.localName==='Point');pm.insertBefore(desc,point||null);}const parts=[];if(record.description)parts.push(record.description);if(record.fieldMemo)parts.push(`【現地メモ】\n${record.fieldMemo}`);if(photoPath)parts.push(`【現地写真】\n${photoPath}`);desc.textContent=parts.join('\n\n');}
  function addPoiTypeExtendedData(doc,pm,record){if(!record.poiType)return;const extended=createElement(doc,'ExtendedData'),data=createElement(doc,'Data');data.setAttribute('name','poi_type');data.appendChild(createElement(doc,'value',record.poiType));extended.appendChild(data);pm.appendChild(extended);}
  function deleteExistingRecords(recordMap){poiRecords.filter(r=>!r.isNew&&r.fieldDeleted).forEach(record=>{const pm=recordMap.get(record);if(!pm)throw new Error(`削除対象POI「${record.name}」の元データを特定できませんでした。`);pm.remove();});}
  function replaceExistingRecords(changed,photoPaths,recordMap){changed.filter(r=>!r.isNew&&!r.fieldDeleted).forEach(record=>{const pm=recordMap.get(record);if(!pm)throw new Error(`POI「${record.name}」の元データを特定できませんでした。`);if(meters(record.originalLatlng,record.latlng)>.05)pm.getElementsByTagNameNS('*','Point')[0].getElementsByTagNameNS('*','coordinates')[0].textContent=`${record.latlng[1]},${record.latlng[0]},0`;if(record.fieldMemoDirty||record.fieldPhotoDirty)setDescription(pm.ownerDocument,pm,record,photoPaths.get(record)||'');});}
  function appendNewPois(doc,documentNode,records,photoPaths){if(!records.length)return;records.forEach(record=>{const folder=ensureTargetFolder(doc,documentNode,additionalFolderName(record));const pm=createElement(doc,'Placemark');pm.appendChild(createElement(doc,'name',record.name));setDescription(doc,pm,record,photoPaths.get(record)||'');addPoiTypeExtendedData(doc,pm,record);const point=createElement(doc,'Point');point.appendChild(createElement(doc,'coordinates',`${record.latlng[1]},${record.latlng[0]},0`));pm.appendChild(point);folder.appendChild(pm);});}
  function safeFileName(value){return String(value||'photo').replace(/[\\/:*?"<>|\s]+/g,'_').slice(0,60)||'photo';}
  async function attachPhotos(outZip,records){const paths=new Map();let seq=1;for(const record of records){if(record.fieldDeleted||!record.fieldPhoto?.blob)continue;const original=record.fieldPhoto.name||'photo.jpg',dot=original.lastIndexOf('.'),ext=dot>=0?original.slice(dot).toLowerCase():'.jpg',path=`field_photos/${String(seq).padStart(3,'0')}_${safeFileName(record.name)}${ext}`;outZip.file(path,record.fieldPhoto.blob);paths.set(record,path);seq++;}return paths;}

  function appendAreas(doc,documentNode){
    const records=activeAreas();if(!records.length)return;
    const folder=ensureTargetFolder(doc,documentNode,AREA_FOLDER);
    records.forEach(record=>{
      const pm=createElement(doc,'Placemark');pm.appendChild(createElement(doc,'name',record.name));
      const polygon=createElement(doc,'Polygon');polygon.appendChild(createElement(doc,'tessellate','1'));polygon.appendChild(createElement(doc,'altitudeMode','clampToGround'));
      const outer=createElement(doc,'outerBoundaryIs'),ring=createElement(doc,'LinearRing');
      const closed=[...record.points,record.points[0]];
      ring.appendChild(createElement(doc,'coordinates',closed.map(point=>`${point[1].toFixed(8)},${point[0].toFixed(8)},0`).join(' ')));
      outer.appendChild(ring);polygon.appendChild(outer);pm.appendChild(polygon);folder.appendChild(pm);
    });
  }

  async function exportCombinedKmz(){
    const changed=changedRecords(),areas=activeAreas();if(!changed.length&&!areas.length)return;
    const source=await sourcePromise;if(!source)throw new Error('元ファイルを再取得できませんでした。もう一度KMZを選択してください。');
    const doc=new DOMParser().parseFromString(source.kmlText,'application/xml');if(doc.querySelector('parsererror'))throw new Error('元KMLを解析できませんでした。');
    const documentNode=doc.getElementsByTagNameNS('*','Document')[0]||doc.documentElement,outZip=source.zip||new JSZip(),recordMap=buildOriginalPlacemarkMap(doc);
    const photoPaths=await attachPhotos(outZip,changed);replaceExistingRecords(changed,photoPaths,recordMap);deleteExistingRecords(recordMap);removeOldFieldCircleFolders(doc);
    const allRecords=poiRecords.filter(r=>!r.fieldDeleted),newRecords=allRecords.filter(r=>r.added&&r.isNew);appendNewPois(doc,documentNode,newRecords,photoPaths);appendGeneratedCircles(doc,documentNode,allRecords,newRecords);appendAreas(doc,documentNode);
    outZip.file(source.kmlPath||'doc.kml',new XMLSerializer().serializeToString(doc));
    const blob=await outZip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.google-earth.kmz'}),stamp=new Date().toISOString().replace(/[:.]/g,'-'),base=sourceFileName.replace(/\.(kmz|kml|zip)$/i,''),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`${base}_現地調整_${stamp}.kmz`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    saveNote.textContent=`POI ${changed.length}件・活動範囲 ${areas.length}件をKMZへ反映しました。`;modeStatus.textContent='KMZ保存完了';
  }

  saveButton.addEventListener('click',async event=>{
    if(!areaChangedCount())return;
    event.preventDefault();event.stopImmediatePropagation();saveButton.disabled=true;saveNote.textContent='POI・活動範囲を含むKMZを作成中…';
    try{await exportCombinedKmz();}catch(error){console.error(error);saveNote.textContent=`⚠ ${error.message||'KMZを保存できませんでした。'}`;modeStatus.textContent='保存失敗';}finally{refreshSaveButton();}
  },true);

  function refreshSaveButton(){
    if(!saveWrapperInstalled)return;
    const poiCount=changedRecords().length,areaCount=areaChangedCount(),total=poiCount+areaCount;
    saveButton.disabled=!total;
    saveButton.textContent=total?`変更をKMZ保存（POI ${poiCount} / 範囲 ${areaCount}）`:'変更したPOIをKMZ保存';
    saveNote.textContent=total?'POIの追加・移動等と活動範囲をまとめてKMZへ反映します。':'変更するとKMZ保存できるようになります。';
  }

  function installSaveWrapper(){
    if(saveWrapperInstalled||!window.FieldModeExport)return false;
    saveWrapperInstalled=true;
    const originalSetSource=window.FieldModeExport.setSourceFile;
    window.FieldModeExport.setSourceFile=file=>{setSourceFile(file);return originalSetSource?.(file);};
    const previousUpdate=updateSaveButton;
    updateSaveButton=function(){previousUpdate?.();refreshSaveButton();};
    refreshSaveButton();return true;
  }

  function initCreativeArea(){
    if(initialized||!window.FieldCreative)return false;
    const areaButton=document.querySelector('#fieldModeCreativeHotbar [data-tool="area"]');if(!areaButton)return false;
    initialized=true;areaButton.disabled=false;areaButton.classList.remove('is-coming');areaButton.title='点を順番に置き、最後を最初へ自動接続して活動範囲を作成';
    areaButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();beginArea();});
    return true;
  }

  fileInput.addEventListener('change',()=>{const file=fileInput.files&&fileInput.files[0];if(file)setSourceFile(file);});
  const timer=setInterval(()=>{installSaveWrapper();initCreativeArea();if(saveWrapperInstalled&&initialized)clearInterval(timer);},0);setTimeout(()=>clearInterval(timer),5000);

  window.FieldModeArea={getRecords:()=>areaRecords,snapshot:snapshotAreas,restore:restoreAreas,setSourceFile,begin:beginArea,cancel:()=>cancelDraft({exit:true})};
})();
