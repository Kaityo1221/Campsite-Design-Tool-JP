(()=>{
  const previous=window.applyCreativePatches;
  if(typeof previous!=='function')return;

  window.applyCreativePatches=function(src){
    src=previous(src);
    if(typeof src!=='string'||src.includes('function cmNewWorkspaceId(){'))return src;

    const payloadMarker='function cmWorkspacePayload(){';
    if(!src.includes(payloadMarker))return src;

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

    src=src.replace(
      /function cmWorkspacePayload\(\)\{return\{/,
      'function cmWorkspacePayload(){return{workspaceId:cmEnsureWorkspaceId(),'
    );

    src=src.replace(
      "let h=cmReadHistory().filter(x=>x&&x.createdAt!==cur.createdAt);",
      "const wid=String(cur.workspaceId||'').trim();let h=cmReadHistory().filter(x=>x&&(wid?String(x.workspaceId||'')!==wid:x.createdAt!==cur.createdAt));"
    );

    src=src.replace(
      "cmCreatedAt=w.createdAt||Date.now();cmEnsureMetadata();",
      "cmCreatedAt=w.createdAt||Date.now();cmWorkspaceId=String(w.workspaceId||'').trim()||cmNewWorkspaceId();cmEnsureMetadata();"
    );

    src=src.replace(
      "const cmOriginalStart=start.onclick;start.onclick=async()=>{const previousWorkspace=cmReadCurrent();const nextCreatedAt=Date.now();await cmOriginalStart();",
      "const cmOriginalStart=start.onclick;start.onclick=async()=>{const previousWorkspace=cmReadCurrent(),previousWorkspaceId=cmWorkspaceId,nextCreatedAt=Date.now(),nextWorkspaceId=cmNewWorkspaceId();cmWorkspaceId=nextWorkspaceId;await cmOriginalStart();"
    );
    src=src.replace(
      "cmPersistCurrent();cmRenderRecent()}};",
      "cmPersistCurrent();cmRenderRecent()}else{cmWorkspaceId=previousWorkspaceId}};"
    );

    src=src.replace(
      "function parse(kml){records=[];polygons=[];",
      "function parse(kml){const embeddedWorkspaceId=cmWorkspaceIdFromKml(kml);if(embeddedWorkspaceId)cmWorkspaceId=embeddedWorkspaceId;records=[];polygons=[];"
    );

    src=src.replace(
      "if(docName)docName.textContent=sourceName;else doc.insertBefore(makeEl(xml,'name',sourceName),doc.firstChild);layerDefs.forEach",
      "if(docName)docName.textContent=sourceName;else doc.insertBefore(makeEl(xml,'name',sourceName),doc.firstChild);cmStampWorkspaceId(xml,doc);layerDefs.forEach"
    );

    src=src.replace(
      "localStorage.setItem(STORE,JSON.stringify({sourceName,",
      "localStorage.setItem(STORE,JSON.stringify({workspaceId:cmEnsureWorkspaceId(),sourceName,"
    );
    src=src.replace(
      "if(!s)return false;sourceName=s.sourceName||'campsite';",
      "if(!s)return false;cmWorkspaceId=String(s.workspaceId||'').trim()||cmNewWorkspaceId();sourceName=s.sourceName||'campsite';"
    );

    const publicApi=`window.CampsiteCreativeWorkspace=Object.freeze({
  getId:()=>cmEnsureWorkspaceId(),
  getSnapshot:()=>cmWorkspacePayload()
});
`;
    src=src.replace(
      'cmInstallUi();\n// ===== /CREATIVE MODE intuitive UX v6 =====',
      publicApi+'cmInstallUi();\n// ===== /CREATIVE MODE intuitive UX v6 ====='
    );

    return src;
  };
})();
