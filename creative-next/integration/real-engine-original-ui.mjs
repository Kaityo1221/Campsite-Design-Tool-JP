import {createIsolatedEditorSession} from '../phase-1b/integration/isolated-editor-session.mjs';
import {installOriginalButtonsFixture} from './original-ui-buttons-fixture.mjs';
// Real isolated editor, no storage. Must accept explicitly-reviewed KMZ before any history action.
export function createRealEngineOriginalUI({document,JSZip,DOMParser,XMLSerializer,cryptoProvider=globalThis.crypto,onRefresh=()=>{}}={}){
 const engine=createIsolatedEditorSession({JSZip,DOMParser,XMLSerializer,cryptoProvider,storage:null});
 const ui=installOriginalButtonsFixture(document,engine,()=>{
   onRefresh(engine.state());ui.sync();
 });
 const sync=()=>ui.sync();
 async function prepare(bytes){const result=await engine.prepare(bytes);sync();return result;}
 function accept({confirmed=false}={}){const result=engine.acceptPrepared({confirmed});sync();return result;}
 function edit(command,{confirmed=false}={}){
  const result=engine.command(command,{confirmed});
  if(result?.changed){onRefresh(engine.state());sync();}
  return result;
 }
 return Object.freeze({engine,prepare,accept,edit,sync,dispose:()=>ui.dispose()});
}
