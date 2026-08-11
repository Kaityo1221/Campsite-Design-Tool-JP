(() => {
  'use strict';

  const LINE_FOLDER='現地モード_線';
  const LINE_STORAGE_PREFIX='field-mode-lines:';
  let draftPoints=[];
  let previewLayer=null;
  let draftPointLayer=null;
  let controls=null;
  let lineRecords=[];
  let lineSeq=0;
  let sourcePromise=Promise.resolve(null);
  let sourceKey='';
  let initialized=false;
  let saveWrapperInstalled=false;

  function centerLatLng(){const c=map.getCenter();return[c.lat,c.lng];}
  function activeLines(){return lineRecords.filter(record=>!record.deleted);}
  function lineChangedCount(){return activeLines().length;}

  function findKmlPath(zip){
    const names=Object.keys(zip.files).filter(name=>name.toLowerCase().endsWith('.kml')&&!zip.files[name].dir);
    if(!names.length)throw new Error('KMZ内にKMLがありません。');
    return names.find(name=>/(^|\/)doc\.kml$/i.test(name))||names[0];
  }

  async function captureSource(file){
    if(!file)return null;
    sourceKey=`${file.name}:${file.size}:${file.lastModified||0}`;
    restoreStoredLines();
    const lower=file.name.toLowerCase();
    if(lower.endsWith('.kml'))return{file,zip:null,kmlPath:'doc.kml',kmlText:await file.text()};
    const zip=await JSZip.loadAsync(await file.arrayBuffer()),kmlPath=findKmlPath(zip);
    return{file,zip,kmlPath,kmlText:await zip.files[kmlPath].async('string')};
  }

  function setSourceFile(file){
    if(!file)return;
    sourcePromise=captureSource(file).catch(error=>{console.error('field line source capture failed',error);return null;});
  }

  function storageKey(){return sourceKey?`${LINE_STORAGE_PREFIX}${sourceKey}`:'';}
  function persistLines(){
    const key=storageKey();
    if(!key)return;
    try{
      const payload={version:1,seq:lineSeq,records:lineRecords.map(record=>({id:record.id,name:record.name,points:record.points,deleted:!!record.deleted}))};
      localStorage.setItem(key,JSON.stringify(payload));
    }catch(error){console.warn('field line autosave failed',error);}
  }

  function makeLineLayer(record){
    const layer=L.polyline(record.points,{pane:'fieldPoiPane',color:'#e06b2d',weight:5,opacity:.92,lineCap:'round',lineJoin:'round'});
    layer.bindPopup(`<strong>${record.name}</strong><br><small>現地モードで追加した線</small>`);
    record.layer=layer;
    if(!record.deleted)layer.addTo(dataLayer);
    return layer;
  }

  function ensureLineLayersVisible(){
    if(!fileLoaded)return;
    activeLines().forEach(record=>{
      if(!record.layer)makeLineLayer(record);
      else if(!dataLayer.hasLayer(record.layer))record.layer.addTo(dataLayer);
    });
    refreshSaveButton();
  }

  function restoreStoredLines(){
    const key=storageKey();
    if(!key)return;
    let payload=null;
    try{payload=JSON.parse(localStorage.getItem(key)||'null');}catch(_){return;}
    if(!payload||payload.version!==1||!Array.isArray(payload.records))return;
    lineRecords.forEach(record=>{try{if(record.layer&&dataLayer.hasLayer(record.layer))dataLayer.removeLayer(record.layer);}catch(_){}});
    lineRecords=payload.records.filter(item=>Array.isArray(item.points)&&item.points.length>=2).map(item=>({
      id:item.id,
      name:item.name||'現地線',
      points:item.points.map(p=>[Number(p[0]),Number(p[1])]),
      deleted:!!item.deleted,
      layer:null
    }));
    lineSeq=Math.max(Number(payload.seq)||0,lineRecords.length);
    lineRecords.forEach(makeLineLayer);
    refreshSaveButton();
  }

  function ensureControls(){
    if(controls)return controls;
    controls=document.createElement('div');
    controls.id='fieldModeLineActions';
    Object.assign(controls.style,{display:'none',position:'fixed',left:'50%',bottom:'calc(92px + env(safe-area-inset-bottom))',transform:'translateX(-50%)',width:'min(calc(100% - 24px), 560px)',gridTemplateColumns:'1.2fr 1fr 1fr',gap:'8px',padding:'8px',border:'1px solid rgba(73,57,30,.24)',borderRadius:'16px',background:'rgba(59,49,37,.93)',boxShadow:'0 5px 16px rgba(0,0,0,.22)',backdropFilter:'blur(8px)',zIndex:'1190'});
    controls.innerHTML=`
      <button type="button" data-line-action="add">＋ 点を追加</button>
      <button type="button" data-line-action="back">↶ 1点戻す</button>
      <button type="button" data-line-action="confirm">✓ 線を確定</button>
      <button type="button" data-line-action="cancel" style="grid-column:1 / -1">× 線を取消</button>`;
    controls.querySelectorAll('button').forEach(button=>Object.assign(button.style,{minHeight:'44px',border:'1px solid #b89a57',borderRadius:'12px',background:'rgba(255,248,230,.97)',color:'#49391e',fontWeight:'900'}));
    controls.addEventListener('click',event=>{
      const button=event.target.closest('[data-line-action]');
      if(!button)return;
      const action=button.dataset.lineAction;
      if(action==='add')addDraftPoint();
      if(action==='back')removeDraftPoint();
      if(action==='confirm')confirmLine();
      if(action==='cancel')cancelDraft({exit:true});
    });
    document.body.appendChild(controls);
    return controls;
  }

  function refreshControls(){
    if(!controls)return;
    controls.querySelector('[data-line-action="back"]').disabled=!draftPoints.length;
    controls.querySelector('[data-line-action="confirm"]').disabled=draftPoints.length<2;
    selectionTitle.textContent=`✏️ 線を作成中（${draftPoints.length}点）`;
    selectionDetail.textContent=draftPoints.length<2?'地図中央の十字を合わせて「＋ 点を追加」。2点以上で線を確定できます。':'地図を動かして点を追加します。橙色の線が完成イメージです。';
  }

  function redrawPreview(){
    if(previewLayer){dataLayer.removeLayer(previewLayer);previewLayer=null;}
    if(draftPointLayer){dataLayer.removeLayer(draftPointLayer);draftPointLayer=null;}
    const center=centerLatLng();
    const previewPoints=draftPoints.length?[...draftPoints,center]:[center];
    if(previewPoints.length>=2)previewLayer=L.polyline(previewPoints,{pane:'fieldPoiPane',color:'#e06b2d',weight:4,opacity:.72,dashArray:'8 7',interactive:false}).addTo(dataLayer);
    if(draftPoints.length){
      draftPointLayer=L.layerGroup(draftPoints.map((point,index)=>L.circleMarker(point,{pane:'fieldPoiPane',radius:5,weight:2,color:'#9d481d',fillColor:'#fff2df',fillOpacity:1,interactive:false}).bindTooltip(String(index+1),{permanent:true,direction:'top',offset:[0,-6]}))).addTo(dataLayer);
    }
  }

  function beginLine(){
    if(!fileLoaded)return;
    draftPoints=[];
    resetPoiSelection();
    window.FieldCreative?.selectTool('line',{collapse:false});
    window.FieldCreative?.closeMenu();
    crosshair.style.display='block';
    ensureControls().style.display='grid';
    modeStatus.textContent='線を作成';
    refreshControls();
    redrawPreview();
  }

  function addDraftPoint(){
    draftPoints.push(centerLatLng());
    redrawPreview();
    refreshControls();
    modeStatus.textContent=`線：${draftPoints.length}点`;
  }

  function removeDraftPoint(){
    if(!draftPoints.length)return;
    draftPoints.pop();
    redrawPreview();
    refreshControls();
  }

  function clearPreview(){
    if(previewLayer){dataLayer.removeLayer(previewLayer);previewLayer=null;}
    if(draftPointLayer){dataLayer.removeLayer(draftPointLayer);draftPointLayer=null;}
  }

  function cancelDraft({exit=false}={}){
    draftPoints=[];
    clearPreview();
    crosshair.style.display='none';
    if(controls)controls.style.display='none';
    if(exit)window.FieldCreative?.exit({cancel:false});
    modeStatus.textContent='線作成を取消';
    selectionTitle.textContent='追加予定POIを選択してください';
    selectionDetail.textContent='地図上の黄色い追加予定POIをタップしてください。';
  }

  function confirmLine(){
    if(draftPoints.length<2)return;
    lineSeq+=1;
    const record={id:`line:${Date.now().toString(36)}:${lineSeq}`,name:`現地線 ${lineSeq}`,points:draftPoints.map(point=>[...point]),deleted:false,layer:null};
    lineRecords.push(record);
    makeLineLayer(record);
    undoStack.push({kind:'line-add',lineRecord:record});
    redoStack.length=0;
    updateHistoryButtons();
    persistLines();
    draftPoints=[];
    clearPreview();
    crosshair.style.display='none';
    if(controls)controls.style.display='none';
    refreshSaveButton();
    modeStatus.textContent='線を追加';
    selectionTitle.textContent=`追加：${record.name}`;
    selectionDetail.textContent=`${record.points.length}点の線を追加しました。KMZ保存でLineStringとして出力します。`;
    window.FieldCreative?.exit({cancel:false});
  }

  function undoLine(event){
    const action=undoStack[undoStack.length-1];
    if(action?.kind!=='line-add')return;
    event.preventDefault();event.stopImmediatePropagation();
    undoStack.pop();
    const record=action.lineRecord;
    record.deleted=true;
    if(record.layer&&dataLayer.hasLayer(record.layer))dataLayer.removeLayer(record.layer);
    redoStack.push(action);
    updateHistoryButtons();persistLines();refreshSaveButton();
    modeStatus.textContent='線追加を戻しました';
  }

  function redoLine(event){
    const action=redoStack[redoStack.length-1];
    if(action?.kind!=='line-add')return;
    event.preventDefault();event.stopImmediatePropagation();
    redoStack.pop();
    const record=action.lineRecord;
    record.deleted=false;
    if(record.layer&&!dataLayer.hasLayer(record.layer))record.layer.addTo(dataLayer);
    undoStack.push(action);
    updateHistoryButtons();persistLines();refreshSaveButton();
    modeStatus.textContent='線追加をやり直しました';
  }

  undoButton.addEventListener('click',undoLine,true);
  redoButton.addEventListener('click',redoLine,true);
  map.on('move',()=>{if(controls?.style.display==='grid')redrawPreview();});
  window.addEventListener('fieldcreativecancel',()=>cancelDraft({exit:false}));

  function createElement(doc,name,text){const el=doc.createElementNS(doc.documentElement.namespaceURI||'http://www.opengis.net/kml/2.2',name);if(text!==undefined)el.textContent=text;return el;}
  function directName(node){return Array.from(node.children||[]).find(el=>el.localName==='name')?.textContent?.trim()||'';}
  function findFolderByName(doc,name){return Array.from(doc.getElementsByTagNameNS('*','Folder')).find(folder=>directName(folder)===name)||null;}
  function ensureTargetFolder(doc,documentNode,name){let folder=findFolderByName(doc,name);if(folder)return folder;folder=createElement(doc,'Folder');folder.appendChild(createElement(doc,'name',name));documentNode.appendChild(folder);return folder;}
  function removeOldFieldCircleFolders(doc){Array.from(doc.getElementsByTagNameNS('*','Folder')).forEach(folder=>{const name=directName(folder);if(name==='現地モード_30m円'||name==='現地モード_40m円'||name==='現地モード_距離円')folder.remove();});}
  function destinationPoint(latDeg,lngDeg,distanceMeters,bearingDeg){const radius=6378137,delta=distanceMeters/radius,theta=bearingDeg*Math.PI/180,phi1=latDeg*Math.PI/180,lambda1=lngDeg*Math.PI/180,sinPhi2=Math.sin(phi1)*Math.cos(delta)+Math.cos(phi1)*Math.sin(delta)*Math.cos(theta),phi2=Math.asin(sinPhi2),lambda2=lambda1+Math.atan2(Math.sin(theta)*Math.sin(delta)*Math.cos(phi1),Math.cos(delta)-Math.sin(phi1)*Math.sin(phi2));return[phi2*180/Math.PI,lambda2*180/Math.PI];}
  function circleCoordinateText(lat,lng,radiusMeters,steps=72){const points=[];for(let i=0;i<=steps;i++){const[pLat,pLng]=destinationPoint(lat,lng,radiusMeters,360*i/steps);points.push(`${pLng.toFixed(8)},${pLat.toFixed(8)},0`);}return points.join(' ');}
  function folderStyleUrl(folder){if(!folder)return'';for(const pm of Array.from(folder.children||[]).filter(el=>el.localName==='Placemark')){const styleUrl=Array.from(pm.children||[]).find(el=>el.localName==='styleUrl');if(styleUrl?.textContent?.trim())return styleUrl.textContent.trim();}return'';}
  function createCirclePlacemark(doc,record,radiusMeters,styleUrl){const pm=createElement(doc,'Placemark');pm.appendChild(createElement(doc,'name',`${record.name}_${radiusMeters}m円`));if(styleUrl)pm.appendChild(createElement(doc,'styleUrl',styleUrl));const polygon=createElement(doc,'Polygon');polygon.appendChild(createElement(doc,'tessellate','1'));polygon.appendChild(createElement(doc,'altitudeMode','clampToGround'));const outer=createElement(doc,'outerBoundaryIs'),ring=createElement(doc,'LinearRing');ring.appendChild(createElement(doc,'coordinates',circleCoordinateText(record.latlng[0],record.latlng[1],radiusMeters)));outer.appendChild(ring);polygon.appendChild(outer);pm.appendChild(polygon);return pm;}
  function appendGeneratedCircles(doc,documentNode,records){const folder30=ensureTargetFolder(doc,documentNode,'30m円（調整用）'),folder40=ensureTargetFolder(doc,documentNode,'40m円（基本距離）'),style30=folderStyleUrl(folder30)||'#poly-C2185B-3000-71-nodesc',style40=folderStyleUrl(folder40)||'#poly-000000-2000-77-nodesc';records.forEach(record=>{folder30.appendChild(createCirclePlacemark(doc,record,30,style30));folder40.appendChild(createCirclePlacemark(doc,record,40,style40));});}
  function pointPlacemarks(doc){return Array.from(doc.getElementsByTagNameNS('*','Placemark')).filter(pm=>!!pm.getElementsByTagNameNS('*','Point')[0]?.getElementsByTagNameNS('*','coordinates')[0]);}
  function buildOriginalPlacemarkMap(doc){const originals=poiRecords.filter(r=>!r.isNew),marks=pointPlacemarks(doc),out=new Map();originals.forEach((record,index)=>{if(marks[index])out.set(record,marks[index]);});return out;}
  function setDescription(doc,pm,record,photoPath){if(!pm)return;let desc=Array.from(pm.children||[]).find(el=>el.localName==='description');if(!desc){desc=createElement(doc,'description');const point=Array.from(pm.children||[]).find(el=>el.localName==='Point');pm.insertBefore(desc,point||null);}const parts=[];if(record.description)parts.push(record.description);if(record.fieldMemo)parts.push(`【現地メモ】\n${record.fieldMemo}`);if(photoPath)parts.push(`【現地写真】\n${photoPath}`);desc.textContent=parts.join('\n\n');}
  function addPoiTypeExtendedData(doc,pm,record){if(!record.poiType)return;const extended=createElement(doc,'ExtendedData'),data=createElement(doc,'Data');data.setAttribute('name','poi_type');data.appendChild(createElement(doc,'value',record.poiType));extended.appendChild(data);pm.appendChild(extended);}
  function deleteExistingRecords(recordMap){poiRecords.filter(r=>!r.isNew&&r.fieldDeleted).forEach(record=>{const pm=recordMap.get(record);if(!pm)throw new Error(`削除対象POI「${record.name}」の元データを特定できませんでした。`);pm.remove();});}
  function replaceExistingRecords(changed,photoPaths,recordMap){changed.filter(r=>!r.isNew&&!r.fieldDeleted).forEach(record=>{const pm=recordMap.get(record);if(!pm)throw new Error(`POI「${record.name}」の元データを特定できませんでした。`);if(meters(record.originalLatlng,record.latlng)>.05)pm.getElementsByTagNameNS('*','Point')[0].getElementsByTagNameNS('*','coordinates')[0].textContent=`${record.latlng[1]},${record.latlng[0]},0`;if(record.fieldMemoDirty||record.fieldPhotoDirty)setDescription(pm.ownerDocument,pm,record,photoPaths.get(record)||'');});}
  function appendNewPois(doc,documentNode,records,photoPaths){if(!records.length)return;const folder=ensureTargetFolder(doc,documentNode,'追加希望POI');records.forEach(record=>{const pm=createElement(doc,'Placemark');pm.appendChild(createElement(doc,'name',record.name));setDescription(doc,pm,record,photoPaths.get(record)||'');addPoiTypeExtendedData(doc,pm,record);const point=createElement(doc,'Point');point.appendChild(createElement(doc,'coordinates',`${record.latlng[1]},${record.latlng[0]},0`));pm.appendChild(point);folder.appendChild(pm);});}
  function safeFileName(value){return String(value||'photo').replace(/[\\/:*?"<>|\s]+/g,'_').slice(0,60)||'photo';}
  async function attachPhotos(outZip,records){const paths=new Map();let seq=1;for(const record of records){if(record.fieldDeleted||!record.fieldPhoto?.blob)continue;const original=record.fieldPhoto.name||'photo.jpg',dot=original.lastIndexOf('.'),ext=dot>=0?original.slice(dot).toLowerCase():'.jpg',path=`field_photos/${String(seq).padStart(3,'0')}_${safeFileName(record.name)}${ext}`;outZip.file(path,record.fieldPhoto.blob);paths.set(record,path);seq++;}return paths;}
  function appendLines(doc,documentNode){const records=activeLines();if(!records.length)return;const folder=ensureTargetFolder(doc,documentNode,LINE_FOLDER);records.forEach(record=>{const pm=createElement(doc,'Placemark');pm.appendChild(createElement(doc,'name',record.name));const line=createElement(doc,'LineString');line.appendChild(createElement(doc,'tessellate','1'));line.appendChild(createElement(doc,'altitudeMode','clampToGround'));line.appendChild(createElement(doc,'coordinates',record.points.map(point=>`${point[1].toFixed(8)},${point[0].toFixed(8)},0`).join(' ')));pm.appendChild(line);folder.appendChild(pm);});}

  async function exportCombinedKmz(){
    const changed=changedRecords(),lines=activeLines();
    if(!changed.length&&!lines.length)return;
    const source=await sourcePromise;
    if(!source)throw new Error('元ファイルを再取得できませんでした。もう一度KMZを選択してください。');
    const doc=new DOMParser().parseFromString(source.kmlText,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error('元KMLを解析できませんでした。');
    const documentNode=doc.getElementsByTagNameNS('*','Document')[0]||doc.documentElement;
    const outZip=source.zip||new JSZip();
    const recordMap=buildOriginalPlacemarkMap(doc);
    const photoPaths=await attachPhotos(outZip,changed);
    replaceExistingRecords(changed,photoPaths,recordMap);
    deleteExistingRecords(recordMap);
    removeOldFieldCircleFolders(doc);
    const newRecords=poiRecords.filter(r=>r.added&&r.isNew&&!r.fieldDeleted);
    appendNewPois(doc,documentNode,newRecords,photoPaths);
    appendGeneratedCircles(doc,documentNode,newRecords);
    appendLines(doc,documentNode);
    outZip.file(source.kmlPath||'doc.kml',new XMLSerializer().serializeToString(doc));
    const blob=await outZip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.google-earth.kmz'});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-'),base=sourceFileName.replace(/\.(kmz|kml|zip)$/i,''),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`${base}_現地調整_${stamp}.kmz`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);
    saveNote.textContent=`POI ${changed.length}件・線 ${lines.length}本をKMZへ反映しました。`;
    modeStatus.textContent='KMZ保存完了';
  }

  saveButton.addEventListener('click',async event=>{
    if(!lineChangedCount())return;
    event.preventDefault();event.stopImmediatePropagation();
    saveButton.disabled=true;saveNote.textContent='POI・線を含むKMZを作成中…';
    try{await exportCombinedKmz();}
    catch(error){console.error(error);saveNote.textContent=`⚠ ${error.message||'KMZを保存できませんでした。'}`;modeStatus.textContent='保存失敗';}
    finally{refreshSaveButton();}
  },true);

  function refreshSaveButton(){
    if(!saveWrapperInstalled)return;
    const poiCount=changedRecords().length,lineCount=lineChangedCount(),total=poiCount+lineCount;
    saveButton.disabled=!total;
    saveButton.textContent=total?`変更をKMZ保存（POI ${poiCount} / 線 ${lineCount}）`:'変更したPOIをKMZ保存';
    saveNote.textContent=total?'POIの追加・移動等と線をまとめてKMZへ反映します。':'変更するとKMZ保存できるようになります。';
  }

  function installSaveWrapper(){
    if(saveWrapperInstalled||!window.FieldModeExport)return false;
    saveWrapperInstalled=true;
    const originalSetSource=window.FieldModeExport.setSourceFile;
    window.FieldModeExport.setSourceFile=file=>{setSourceFile(file);return originalSetSource?.(file);};
    const previousUpdate=updateSaveButton;
    updateSaveButton=function(){previousUpdate?.();refreshSaveButton();};
    refreshSaveButton();
    return true;
  }

  function initCreativeLine(){
    if(initialized||!window.FieldCreative)return false;
    const lineButton=document.querySelector('#fieldModeCreativeHotbar [data-tool="line"]');
    if(!lineButton)return false;
    initialized=true;
    lineButton.disabled=false;
    lineButton.classList.remove('is-coming');
    lineButton.title='地図中央の十字で点を順番に置いて線を作成';
    lineButton.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();beginLine();});
    return true;
  }

  fileInput.addEventListener('change',()=>{const file=fileInput.files&&fileInput.files[0];if(file)setSourceFile(file);});
  if(modeStatus){
    new MutationObserver(()=>setTimeout(ensureLineLayersVisible,0)).observe(modeStatus,{childList:true,subtree:true,characterData:true});
  }

  const timer=setInterval(()=>{
    installSaveWrapper();
    initCreativeLine();
    if(saveWrapperInstalled&&initialized)clearInterval(timer);
  },0);
  setTimeout(()=>clearInterval(timer),5000);

  window.FieldModeLine={getRecords:()=>lineRecords,setSourceFile,begin:beginLine,cancel:()=>cancelDraft({exit:true}),refresh:ensureLineLayersVisible};
})();