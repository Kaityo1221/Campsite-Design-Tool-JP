(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);

    // Keep add-mode crosshair visibility stronger than the v46 !important rule.
    src=src.replace(
      "cmSafeAddDot.style.display='grid';",
      "cmSafeAddDot.style.setProperty('display','grid','important');"
    );
    src=src.replace(
      "function cmSafeHideAddDot(){if(cmSafeAddDot)cmSafeAddDot.style.display='none'}",
      "function cmSafeHideAddDot(){if(cmSafeAddDot)cmSafeAddDot.style.setProperty('display','none','important')}"
    );

    // Only the ADD-mode guide circle becomes cyan. Existing POI distance circles are untouched.
    src=src.replace(
      "cmSafeAddCircle=L.circle(center,{radius:cmSafeAddRadius,color:'#d18a00',fillColor:'#d18a00',weight:1.5,fillOpacity:.025,renderer:circleRenderer,pane:'distance',interactive:false}).addTo(map);",
      "cmSafeAddCircle=L.circle(center,{radius:cmSafeAddRadius,color:'#63d7ff',opacity:.96,fillColor:'#63d7ff',fillOpacity:.045,weight:2.2,renderer:circleRenderer,pane:'distance',interactive:false,className:'cm-add-preview-ring'}).addTo(map);"
    );
    src=src.replace(
      "const circle=L.circle(latlng,{radius:50,color:'#d18a00',fillColor:'#d18a00',weight:1.5,fillOpacity:.035,renderer:circleRenderer,pane:'distance',interactive:false}).addTo(map);",
      "const circle=L.circle(latlng,{radius:50,color:'#63d7ff',opacity:.96,fillColor:'#63d7ff',fillOpacity:.045,weight:2.2,renderer:circleRenderer,pane:'distance',interactive:false,className:'cm-add-preview-ring'}).addTo(map);"
    );

    const style=`<style id="cmV50AddCancelSpacingStyle">
      .cm-safe-add-bar{
        grid-template-columns:64px 40px 64px 42px!important;
        column-gap:6px!important;
        padding-right:7px!important;
      }
      .cm-safe-add-confirm{margin-right:8px!important}
      .cm-safe-add-cancel{
        width:34px!important;
        height:34px!important;
        margin-left:8px!important;
        border:1px solid rgba(93,70,48,.18)!important;
        border-radius:50%!important;
        background:rgba(238,229,212,.58)!important;
        color:#5d4630!important;
        font-size:20px!important;
        font-weight:900!important;
        line-height:1!important;
        display:grid!important;
        place-items:center!important;
        padding:0!important;
      }

      /* ADD mode center target: a tiny white dot only. */
      #cmSafeAddDot{
        width:18px!important;
        height:18px!important;
        place-items:center!important;
        pointer-events:none!important;
        background:transparent!important;
        border:0!important;
        box-shadow:none!important;
      }
      #cmSafeAddDot span{
        position:relative!important;
        display:block!important;
        width:8px!important;
        height:8px!important;
        min-width:8px!important;
        min-height:8px!important;
        border-radius:50%!important;
        background:rgba(255,255,255,.98)!important;
        border:1px solid rgba(255,255,255,.98)!important;
        box-shadow:0 0 0 1px rgba(0,0,0,.18),0 1px 4px rgba(0,0,0,.28)!important;
        transform:none!important;
        opacity:1!important;
      }
      #cmSafeAddDot span:before,
      #cmSafeAddDot span:after{
        content:none!important;
        display:none!important;
        width:0!important;
        height:0!important;
        background:none!important;
        border:0!important;
        box-shadow:none!important;
        filter:none!important;
      }

      /* ADD-mode preview only: cool cyan so it cannot be confused with existing POI rings. */
      .cm-add-preview-ring{
        stroke:#63d7ff!important;
        stroke-opacity:.96!important;
        stroke-width:2.2!important;
        fill:#63d7ff!important;
        fill-opacity:.045!important;
        filter:drop-shadow(0 0 3px rgba(99,215,255,.58)) drop-shadow(0 0 8px rgba(99,215,255,.28));
      }
    </style>`;
    if(!src.includes('id="cmV50AddCancelSpacingStyle"'))src=src.replace('</head>',style+'</head>');

    // Phase 1: give every Creative workspace a stable identity.
    if(!src.includes('function cmNewWorkspaceId(){')){
      const payloadMarker='function cmWorkspacePayload(){';
      if(src.includes(payloadMarker)){
        const helpers=`function cmNewWorkspaceId(){
  try{return crypto.randomUUID()}catch{return 'workspace-'+Date.now()+'-'+Math.random().toString(16).slice(2)}
}
let cmWorkspaceId='';
function cmBridgeWorkspaceId(){
  try{
    const q=new URLSearchParams(location.search);
    if(q.get('campsiteProject')!=='bridge')return'';
    const project=JSON.parse(sessionStorage.getItem('campsiteProject.v1')||'null');
    return project&&project.source==='bridge'?String(project.workspaceId||project.projectId||'').trim():'';
  }catch{return''}
}
function cmEnsureWorkspaceId(){
  if(cmWorkspaceId)return cmWorkspaceId;
  cmWorkspaceId=cmBridgeWorkspaceId()||cmNewWorkspaceId();
  return cmWorkspaceId;
}
function cmWorkspaceIdFromKml(kml){
  try{
    const xml=new DOMParser().parseFromString(String(kml||''),'application/xml');
    for(const data of xml.getElementsByTagNameNS('*','Data')){
      if(String(data.getAttribute('name')||'').trim()!=='campsite-workspace-id')continue;
      const value=[...data.children].find(x=>x.localName==='value')?.textContent?.trim()||data.textContent?.trim()||'';
      if(value)return value;
    }
  }catch{}
  return'';
}
function cmStampWorkspaceId(xml,doc){
  const id=cmEnsureWorkspaceId();
  let ext=[...doc.children].find(x=>x.localName==='ExtendedData');
  if(!ext){ext=makeEl(xml,'ExtendedData');doc.appendChild(ext)}
  let data=[...ext.children].find(x=>x.localName==='Data'&&String(x.getAttribute('name')||'')==='campsite-workspace-id');
  if(!data){data=makeEl(xml,'Data');data.setAttribute('name','campsite-workspace-id');ext.appendChild(data)}
  let value=[...data.children].find(x=>x.localName==='value');
  if(!value){value=makeEl(xml,'value');data.appendChild(value)}
  value.textContent=id;
  return id;
}
`;
        src=src.replace(payloadMarker,helpers+payloadMarker);
        src=src.replace(/function cmWorkspacePayload\(\)\{return\{/,'function cmWorkspacePayload(){return{workspaceId:cmEnsureWorkspaceId(),');
        src=src.replace("let h=cmReadHistory().filter(x=>x&&x.createdAt!==cur.createdAt);","const wid=String(cur.workspaceId||'').trim();let h=cmReadHistory().filter(x=>x&&(wid?String(x.workspaceId||'')!==wid:x.createdAt!==cur.createdAt));");
        src=src.replace("cmCreatedAt=w.createdAt||Date.now();cmEnsureMetadata();","cmCreatedAt=w.createdAt||Date.now();cmWorkspaceId=String(w.workspaceId||'').trim()||cmNewWorkspaceId();cmEnsureMetadata();");
        src=src.replace("const cmOriginalStart=start.onclick;start.onclick=async()=>{const previousWorkspace=cmReadCurrent();const nextCreatedAt=Date.now();await cmOriginalStart();","const cmOriginalStart=start.onclick;start.onclick=async()=>{const previousWorkspace=cmReadCurrent(),previousWorkspaceId=cmWorkspaceId,nextCreatedAt=Date.now(),nextWorkspaceId=cmNewWorkspaceId();cmWorkspaceId=nextWorkspaceId;await cmOriginalStart();");
        src=src.replace("cmPersistCurrent();cmRenderRecent()}};","cmPersistCurrent();cmRenderRecent()}else{cmWorkspaceId=previousWorkspaceId}};");
        src=src.replace("function parse(kml){records=[];polygons=[];","function parse(kml){const embeddedWorkspaceId=cmWorkspaceIdFromKml(kml);if(embeddedWorkspaceId)cmWorkspaceId=embeddedWorkspaceId;records=[];polygons=[];");
        src=src.replace("if(docName)docName.textContent=sourceName;else doc.insertBefore(makeEl(xml,'name',sourceName),doc.firstChild);layerDefs.forEach","if(docName)docName.textContent=sourceName;else doc.insertBefore(makeEl(xml,'name',sourceName),doc.firstChild);cmStampWorkspaceId(xml,doc);layerDefs.forEach");
        src=src.replace("localStorage.setItem(STORE,JSON.stringify({sourceName,","localStorage.setItem(STORE,JSON.stringify({workspaceId:cmEnsureWorkspaceId(),sourceName,");
        src=src.replace("if(!s)return false;sourceName=s.sourceName||'campsite';","if(!s)return false;cmWorkspaceId=String(s.workspaceId||'').trim()||cmNewWorkspaceId();sourceName=s.sourceName||'campsite';");
        const publicApi=`window.CampsiteCreativeWorkspace=Object.freeze({
  getId:()=>cmEnsureWorkspaceId(),
  getSnapshot:()=>cmWorkspacePayload()
});
`;
        src=src.replace('cmInstallUi();\n// ===== /CREATIVE MODE intuitive UX v6 =====',publicApi+'cmInstallUi();\n// ===== /CREATIVE MODE intuitive UX v6 =====');
      }
    }

    return src;
  };
})();
