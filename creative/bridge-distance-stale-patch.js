(() => {
  'use strict';

  const injection = String.raw`
function campsProjectDesignSignature(project){
  const source=Array.isArray(project&&project.currentPois)?project.currentPois:[];
  const pois=source.map(p=>({
    id:String(p&&((p.guid||p.id)||'')),
    lat:Number(p&&p.lat),
    lng:Number(p&&p.lng),
    role:String(p&&p.role||''),
    layer:String(p&&p.layer||''),
    gameEntity:String(p&&p.gameEntity||''),
    title:String(p&&(p.title||p.name)||''),
    description:String(p&&(p.description||p.memo)||'')
  })).sort((a,b)=>a.id.localeCompare(b.id)||a.lat-b.lat||a.lng-b.lng);
  const polygon=(Array.isArray(project&&project.polygon)?project.polygon:[]).map(point=>[
    Number(Array.isArray(point)?point[0]:NaN),
    Number(Array.isArray(point)?point[1]:NaN)
  ]);
  return JSON.stringify({pois,polygon});
}
function campsProjectMarkDistanceStale(project){
  if(!project||project.source!=='bridge')return project;
  const result=project.distanceResult;
  if(!result||!result.checkedAt||!result.designSignature)return project;
  const currentSignature=campsProjectDesignSignature(project);
  if(currentSignature===String(result.designSignature))return project;
  if(result.stale===true&&String(result.currentDesignSignature||'')===currentSignature)return project;
  result.stale=true;
  result.staleAt=new Date().toISOString();
  result.staleReason='creative-design-changed';
  result.currentDesignSignature=currentSignature;
  project.phase='design';
  project.preSubmitCheckpoint=null;
  project.updatedAt=result.staleAt;
  try{sessionStorage.setItem(CAMPSITE_PROJECT_KEY,JSON.stringify(project))}catch(_){}
  return project;
}
const campsProjectSyncBeforeDistanceStale=syncCampsiteProjectFromCreative;
syncCampsiteProjectFromCreative=function(project){
  const saved=campsProjectSyncBeforeDistanceStale(project);
  return campsProjectMarkDistanceStale(saved);
};
`;

  function apply(html) {
    let out = String(html || '');
    if (!out.includes('function syncCampsiteProjectFromCreative(project){')) return out;
    if (out.includes('function campsProjectDesignSignature(project){')) return out;
    const needle = 'function restore(){';
    if (!out.includes(needle)) return out;
    return out.replace(needle, injection + needle);
  }

  window.applyCreativeBridgeDistanceStalePatch = apply;
})();
