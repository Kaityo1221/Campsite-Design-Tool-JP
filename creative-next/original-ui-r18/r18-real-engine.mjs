import {createRealEngineOriginalUI} from '../integration/real-engine-original-ui.mjs';
import {createFreshV1Kmz} from '../phase-1b/core/create-new-kmz.mjs';
// r18 real-engine visual fixture. No storage and no old Creative scripts.
const JSZip=globalThis.JSZip;
if(!JSZip)throw new Error('JSZip is unavailable: r18 remains disabled');
const original={id:'r18-example',role:'existing',kind:'pokestop',title:'テスト用POI',memo:'初期',lat:35.64203,lng:139.855563,deleted:false};
const ui=createRealEngineOriginalUI({document,JSZip,DOMParser,XMLSerializer,cryptoProvider:globalThis.crypto});
let confirmed=false;
async function loadSynthetic({confirm=false}={}){
 if(confirm!==true)return {status:'CANCELLED'};
 const data=await createFreshV1Kmz({records:[original],activityAreas:[]},{JSZip,DOMParser,XMLSerializer});
 const preview=await ui.prepare(data.bytes);
 if(preview.status!=='REVIEW')return preview;
 const accept=ui.accept({confirmed:true});confirmed=accept.applied===true;
 return accept;
}
function changeMemo(value){
 if(!confirmed)throw new Error('Explicit synthetic review required');
 return ui.edit({type:'edit',id:original.id,patch:{memo:value}},{confirmed:true});
}
globalThis.creativeR18=Object.freeze({loadSynthetic,changeMemo,state:()=>ui.engine.state(),dispose:ui.dispose});
