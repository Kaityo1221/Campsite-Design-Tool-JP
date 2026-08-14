(() => {
  'use strict';
  const SPACING_POLICY=window.CampsitePoiSpacingPolicy,TARGET_DISTANCE=SPACING_POLICY.targetMeters;
  const KML_NS='http://www.opengis.net/kml/2.2';let sourcePromise=Promise.resolve(null);
  const POI_TYPES=[
    {value:'pokestop',label:'ポケストップ',short:'🛑 ポケストップ'},
    {value:'gym',label:'ジム',short:'🏟️ ジム'},
    {value:'power_spot',label:'パワースポット',short:'⚡ パワースポット'}
  ];
  const ADDITIONAL_FOLDER_BY_TYPE={
    pokestop:'追加希望ポケスト',
    gym:'追加希望ジム',
    power:'追加希望パワスポ',
    power_spot:'追加希望パワスポ'
  };
  const FORMAL_ADDITIONAL_FOLDERS=new Set(Object.values(ADDITIONAL_FOLDER_BY_TYPE));
  let selectedPoiTypeIndex=0;
  let newPoiPlacementMode=false;
  let poiTypeButton=null;

  function additionalFolderName(value,fallback=''){
    const raw=String(value||'').trim();
    if(FORMAL_ADDITIONAL_FOLDERS.has(raw))return raw;
    return ADDITIONAL_FOLDER_BY_TYPE[raw.toLowerCase()]||ADDITIONAL_FOLDER_BY_TYPE[String(fallback||'').trim().toLowerCase()]||'追加希望ポケスト';
  }
  function currentPoiType(){return POI_TYPES[selectedPoiTypeIndex];}
  function setupPoiTypeCycler(){
    if(!newPoiButton||document.getElementById('fieldPoiTypeButton'))return;
    newPoiButton.textContent='＋ 新規設置';
    const button=document.createElement('button');
    poiTypeButton=button;
    button.id='fieldPoiTypeButton';
    button.className='field-mode-poi-type';
    button.type='button';
    button.textContent=currentPoiType().short;
    button.title='タップするたびにPOI種類を切り替えます';
    button.setAttribute('aria-label',`POI種類：${currentPoiType().label}。タップで切り替え`);
    button.addEventListener('click',()=>{
      selectedPoiTypeIndex=(selectedPoiTypeIndex+1)%POI_TYPES.length;
      button.textContent=currentPoiType().short;
      button.setAttribute('aria-label',`POI種類：${currentPoiType().label}。タップで切り替え`);
      modeStatus.textContent=`種類：${currentPoiType().label}`;
      if(newPoiPlacementMode)updateNewPoiPlacementGuide();
    });
    newPoiButton.insertAdjacentElement('beforebegin',button);
  }
  function placementLatLng(){const center=map.getCenter();return[center.lat,center.lng];}
  function updateNewPoiPlacementGuide(){
    if(!newPoiPlacementMode)return;
    const type=currentPoiType(),latlng=placementLatLng();
    updateDistanceStatus(latlng);
    selectionTitle.textContent=`新規${type.label}の位置を決めます`;
    selectionDetail.textContent='十字が設置位置です。地図を動かして「✓ この位置に設置」で確定します。';
  }
  function cancelNewPoiPlacement(){
    if(!newPoiPlacementMode)return;
    newPoiPlacementMode=false;
    crosshair.style.display='none';
    newPoiButton.textContent='＋ 新規設置';
    newPoiButton.setAttribute('aria-label','現在地付近に新規POIを設置');
    resetPoiSelection();
    updateDistanceStatus(currentPosition);
    modeStatus.textContent='新規設置を取消';
  }
  function beginNewPoiPlacement(){
    if(!currentPosition||!fileLoaded)return;
    if(selectedPoi||fineTuneMode)resetPoiSelection();
    window.FieldCreative?.enter('poi',{collapse:true});
    newPoiPlacementMode=true;
    crosshair.style.display='block';
    newPoiButton.textContent='✓ この位置に設置';
    newPoiButton.setAttribute('aria-label','十字の位置にPOIを設置');
    modeStatus.textContent=`${currentPoiType().label}の位置決め`;
    map.panTo(currentPosition);
    updateNewPoiPlacementGuide();
  }
  function createPoiAtLatLng(latlng){
    if(!fileLoaded)return;
    const type=currentPoiType();
    const count=poiRecords.filter(r=>r.isNew&&r.poiType===type.value&&!r.fieldDeleted).length+1;
    const name=`${type.label} ${count}`;
    const rangeCircle=L.circle(latlng,{pane:'fieldBackgroundPane',radius:TARGET_DISTANCE,color:'#d58b00',weight:2,opacity:.7,fillColor:'#ffd35c',fillOpacity:.035,interactive:false,dashArray:'6 5'}).addTo(dataLayer);
    const marker=L.circleMarker(latlng,{pane:'fieldPoiPane',radius:9,weight:3,color:'#d58b00',fillColor:'#ffd35c',fillOpacity:.9}).addTo(dataLayer);
    const record={marker,rangeCircle,name,description:'',folder:additionalFolderName(type.value),latlng:[...latlng],originalLatlng:[...latlng],added:true,isNew:true,poiType:type.value,include30mCircle:false,include40mCircle:false,fieldMemo:'',fieldMemoDirty:false,fieldPhoto:null,fieldPhotoDirty:false,fieldDeleted:false};
    poiRecords.push(record);
    marker.bindPopup(`<strong>${name}</strong><br><small>${type.label}</small><br><b>${record.folder}</b>`);
    marker.on('click',()=>selectAddedPoi(record));
    undoStack.push({kind:'add',record});redoStack.length=0;updateHistoryButtons();updateSaveButton();selectAddedPoi(record);updateDistanceStatus(record.latlng,record);modeStatus.textContent=`${type.label}を追加`;
  }
  function confirmNewPoiPlacement(){
    if(!newPoiPlacementMode)return;
    const latlng=placementLatLng();
    newPoiPlacementMode=false;
    crosshair.style.display='none';
    newPoiButton.textContent='＋ 新規設置';
    newPoiButton.setAttribute('aria-label','現在地付近に新規POIを設置');
    createPoiAtLatLng(latlng);
    window.FieldCreative?.exit({cancel:false});
  }
  newPoiButton?.addEventListener('click',event=>{
    if(!currentPosition||!fileLoaded)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(newPoiPlacementMode)confirmNewPoiPlacement();else beginNewPoiPlacement();
  },true);
  window.addEventListener('fieldcreativecancel',cancelNewPoiPlacement);
  map.on('move',updateNewPoiPlacementGuide);

  function findKmlPath(zip){const names=Object.keys(zip.files).filter(name=>name.toLowerCase().endsWith('.kml')&&!zip.files[name].dir);if(!names.length)throw new Error('KMZ内にKMLがありません。');return names.find(name=>/(^|\/)doc\.kml$/i.test(name))||names[0];}
  async function captureSource(file){if(!file)return null;const lower=file.name.toLowerCase();if(lower.endsWith('.kml'))return{file,zip:null,kmlPath:'doc.kml',kmlText:await file.text()};const zip=await JSZip.loadAsync(await file.arrayBuffer()),kmlPath=findKmlPath(zip);return{file,zip,kmlPath,kmlText:await zip.files[kmlPath].async('string')};}
  function setSourceFile(file){
    if(!file)return;
    sourcePromise=captureSource(file).catch(error=>{console.error('field export source capture failed',error);return null;});
  }
  fileInput.addEventListener('change',()=>{const file=fileInput.files&&fileInput.files[0];setSourceFile(file);});
  function createElement(doc,name,text){const el=doc.createElementNS(doc.documentElement.namespaceURI||KML_NS,name);if(text!==undefined)el.textContent=text;return el;}
  function directName(node){return Array.from(node.children||[]).find(el=>el.localName==='name')?.textContent?.trim()||'';}
  function findFolderByName(doc,name){return Array.from(doc.getElementsByTagNameNS('*','Folder')).find(folder=>directName(folder)===name)||null;}
  function ensureTargetFolder(doc,documentNode,name){let folder=findFolderByName(doc,name);if(folder)return folder;folder=createElement(doc,'Folder');folder.appendChild(createElement(doc,'name',name));documentNode.appendChild(folder);return folder;}
  function removeOldFieldCircleFolders(doc){Array.from(doc.getElementsByTagNameNS('*','Folder')).forEach(folder=>{const name=directName(folder);if(name==='現地モード_30m円'||name==='現地モード_40m円'||name==='現地モード_50m円'||name==='現地モード_距離円')folder.remove();});}
  function canonicalCircleFolder(doc,documentNode,canonical,aliases=[]){const names=new Set([canonical,...aliases]),matches=Array.from(doc.getElementsByTagNameNS('*','Folder')).filter(folder=>names.has(directName(folder)));let target=matches.find(folder=>directName(folder)===canonical)||matches[0];if(!target){target=ensureTargetFolder(doc,documentNode,canonical);}else{const nameNode=Array.from(target.children||[]).find(el=>el.localName==='name');if(nameNode)nameNode.textContent=canonical;}matches.filter(folder=>folder!==target).forEach(folder=>{Array.from(folder.children||[]).filter(el=>el.localName!=='name').forEach(el=>target.appendChild(el));folder.remove();});return target;}
  function destinationPoint(latDeg,lngDeg,distanceMeters,bearingDeg){const radius=6378137,delta=distanceMeters/radius,theta=bearingDeg*Math.PI/180,phi1=latDeg*Math.PI/180,lambda1=lngDeg*Math.PI/180,sinPhi2=Math.sin(phi1)*Math.cos(delta)+Math.cos(phi1)*Math.sin(delta)*Math.cos(theta),phi2=Math.asin(sinPhi2),lambda2=lambda1+Math.atan2(Math.sin(theta)*Math.sin(delta)*Math.cos(phi1),Math.cos(delta)-Math.sin(phi1)*Math.sin(phi2));return[phi2*180/Math.PI,lambda2*180/Math.PI];}
  function circleCoordinateText(lat,lng,radiusMeters,steps=72){const points=[];for(let i=0;i<=steps;i++){const[pLat,pLng]=destinationPoint(lat,lng,radiusMeters,360*i/steps);points.push(`${pLng.toFixed(8)},${pLat.toFixed(8)},0`);}return points.join(' ');}
  function folderStyleUrl(folder){if(!folder)return'';for(const pm of Array.from(folder.children||[]).filter(el=>el.localName==='Placemark')){const styleUrl=Array.from(pm.children||[]).find(el=>el.localName==='styleUrl');if(styleUrl?.textContent?.trim())return styleUrl.textContent.trim();}return'';}
  function createCirclePlacemark(doc,record,radiusMeters,styleUrl){const pm=createElement(doc,'Placemark');pm.appendChild(createElement(doc,'name',`${record.name}_${radiusMeters}m円`));if(styleUrl)pm.appendChild(createElement(doc,'styleUrl',styleUrl));const polygon=createElement(doc,'Polygon');polygon.appendChild(createElement(doc,'tessellate','1'));polygon.appendChild(createElement(doc,'altitudeMode','clampToGround'));const outer=createElement(doc,'outerBoundaryIs'),ring=createElement(doc,'LinearRing');ring.appendChild(createElement(doc,'coordinates',circleCoordinateText(record.latlng[0],record.latlng[1],radiusMeters)));outer.appendChild(ring);polygon.appendChild(outer);pm.appendChild(polygon);return pm;}
  function appendGeneratedCirclesToExistingLayers(doc,documentNode,allRecords,newRecords){const folder50=canonicalCircleFolder(doc,documentNode,SPACING_POLICY.targetCircleFolder,['50m円（基本距離）']),folder40=canonicalCircleFolder(doc,documentNode,SPACING_POLICY.referenceCircleFolders[40],['40m円（基本距離）']),folder30=canonicalCircleFolder(doc,documentNode,SPACING_POLICY.referenceCircleFolders[30],['30m円（調整用）']),style50=folderStyleUrl(folder50),style40=folderStyleUrl(folder40),style30=folderStyleUrl(folder30);Array.from(folder50.children||[]).filter(el=>el.localName==='Placemark').forEach(el=>el.remove());allRecords.forEach(record=>folder50.appendChild(createCirclePlacemark(doc,record,TARGET_DISTANCE,style50)));newRecords.forEach(record=>{if(record.include40mCircle)folder40.appendChild(createCirclePlacemark(doc,record,40,style40));if(record.include30mCircle)folder30.appendChild(createCirclePlacemark(doc,record,30,style30));});}
  function pointPlacemarks(doc){return Array.from(doc.getElementsByTagNameNS('*','Placemark')).filter(pm=>!!pm.getElementsByTagNameNS('*','Point')[0]?.getElementsByTagNameNS('*','coordinates')[0]);}
  function buildOriginalPlacemarkMap(doc){const originals=poiRecords.filter(r=>!r.isNew),marks=pointPlacemarks(doc),map=new Map();originals.forEach((record,index)=>{if(marks[index])map.set(record,marks[index]);});return map;}
  function setDescription(doc,pm,record,photoPath){if(!pm)return;let desc=Array.from(pm.children||[]).find(el=>el.localName==='description');if(!desc){desc=createElement(doc,'description');const point=Array.from(pm.children||[]).find(el=>el.localName==='Point');pm.insertBefore(desc,point||null);}const parts=[];if(record.description)parts.push(record.description);if(record.fieldMemo)parts.push(`【現地メモ】\n${record.fieldMemo}`);if(photoPath)parts.push(`【現地写真】\n${photoPath}`);desc.textContent=parts.join('\n\n');}
  function addPoiTypeExtendedData(doc,pm,record){if(!record.poiType)return;const extended=createElement(doc,'ExtendedData'),data=createElement(doc,'Data');data.setAttribute('name','poi_type');data.appendChild(createElement(doc,'value',record.poiType));extended.appendChild(data);pm.appendChild(extended);}
  function deleteExistingRecords(recordMap){poiRecords.filter(r=>!r.isNew&&r.fieldDeleted).forEach(record=>{const pm=recordMap.get(record);if(!pm)throw new Error(`削除対象POI「${record.name}」の元データを特定できませんでした。`);pm.remove();});}
  function replaceExistingRecords(changed,photoPaths,recordMap){changed.filter(r=>!r.isNew&&!r.fieldDeleted).forEach(record=>{const pm=recordMap.get(record);if(!pm)throw new Error(`POI「${record.name}」の元データを特定できませんでした。`);if(meters(record.originalLatlng,record.latlng)>.05)pm.getElementsByTagNameNS('*','Point')[0].getElementsByTagNameNS('*','coordinates')[0].textContent=`${record.latlng[1]},${record.latlng[0]},0`;if(record.fieldMemoDirty||record.fieldPhotoDirty)setDescription(pm.ownerDocument,pm,record,photoPaths.get(record)||'');});}
  function appendNewPois(doc,documentNode,records,photoPaths){if(!records.length)return;records.forEach(record=>{const folder=ensureTargetFolder(doc,documentNode,additionalFolderName(record.poiType,record.folder));const pm=createElement(doc,'Placemark');pm.appendChild(createElement(doc,'name',record.name));setDescription(doc,pm,record,photoPaths.get(record)||'');addPoiTypeExtendedData(doc,pm,record);const point=createElement(doc,'Point');point.appendChild(createElement(doc,'coordinates',`${record.latlng[1]},${record.latlng[0]},0`));pm.appendChild(point);folder.appendChild(pm);});}
  function safeFileName(value){return String(value||'photo').replace(/[\\/:*?"<>|\s]+/g,'_').slice(0,60)||'photo';}
  async function attachPhotos(outZip,records){const paths=new Map();let seq=1;for(const record of records){if(record.fieldDeleted||!record.fieldPhoto?.blob)continue;const original=record.fieldPhoto.name||'photo.jpg',dot=original.lastIndexOf('.'),ext=dot>=0?original.slice(dot).toLowerCase():'.jpg',path=`field_photos/${String(seq).padStart(3,'0')}_${safeFileName(record.name)}${ext}`;outZip.file(path,record.fieldPhoto.blob);paths.set(record,path);seq++;}return paths;}
  async function exportPreservedKmz(){const changed=changedRecords();if(!changed.length)return;const source=await sourcePromise;if(!source)throw new Error('元ファイルを再取得できませんでした。もう一度KMZを選択してください。');const doc=new DOMParser().parseFromString(source.kmlText,'application/xml');if(doc.querySelector('parsererror'))throw new Error('元KMLを解析できませんでした。');const documentNode=doc.getElementsByTagNameNS('*','Document')[0]||doc.documentElement,outZip=source.zip||new JSZip(),recordMap=buildOriginalPlacemarkMap(doc);const photoPaths=await attachPhotos(outZip,changed);replaceExistingRecords(changed,photoPaths,recordMap);deleteExistingRecords(recordMap);removeOldFieldCircleFolders(doc);const allRecords=poiRecords.filter(r=>!r.fieldDeleted),newRecords=allRecords.filter(r=>r.added&&r.isNew);appendNewPois(doc,documentNode,newRecords,photoPaths);appendGeneratedCirclesToExistingLayers(doc,documentNode,allRecords,newRecords);outZip.file(source.kmlPath||'doc.kml',new XMLSerializer().serializeToString(doc));const blob=await outZip.generateAsync({type:'blob',compression:'DEFLATE',compressionOptions:{level:6},mimeType:'application/vnd.google-earth.kmz'}),stamp=new Date().toISOString().replace(/[:.]/g,'-'),base=sourceFileName.replace(/\.(kmz|kml|zip)$/i,''),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${base}_現地調整_${stamp}.kmz`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);saveNote.textContent=`${changed.length}件をKMZへ反映しました。`;modeStatus.textContent='KMZ保存完了';}
  updateSaveButton=function(){const n=changedRecords().length;saveButton.disabled=!n;saveButton.textContent=n?`変更したPOIをKMZ保存（${n}件）`:'変更したPOIをKMZ保存';saveNote.textContent=n?`${n}件の追加・移動・削除・メモ・写真をKMZへ反映します。`:'変更するとKMZ保存できるようになります。';};updateSaveButton();
  saveButton.addEventListener('click',async event=>{const activeAreaCount=window.FieldModeArea?.getRecords?.().filter(record=>!record.deleted).length||0;if(activeAreaCount)return;event.preventDefault();event.stopImmediatePropagation();saveButton.disabled=true;saveNote.textContent='写真・メモを含むKMZを作成中…';try{await exportPreservedKmz();}catch(error){console.error(error);saveNote.textContent=`⚠ ${error.message||'KMZを保存できませんでした。'}`;modeStatus.textContent='保存失敗';}finally{updateSaveButton();}},true);
  setupPoiTypeCycler();
  window.FieldModeExport={setSourceFile,additionalFolderName};
})();
