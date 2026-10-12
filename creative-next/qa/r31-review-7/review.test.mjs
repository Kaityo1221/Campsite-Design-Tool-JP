import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createWorkspace} from '../../original-ui-r31-b3-b4/workspace.mjs';
import {connectB2} from '../../original-ui-r31-b3-b4/adapter-review.mjs';
import {createFreshV1Kmz} from '../../phase-1b/core/create-new-kmz.mjs';
import {stageKmlInput} from '../../phase-1b/core/stage-kmz.mjs';

const deps={JSZip,DOMParser,XMLSerializer,cryptoProvider:webcrypto};
const original={id:'protected',role:'existing',kind:'pokestop',title:'原本を維持',memo:'原本のメモ',lat:35.7,lng:139.8};
const areaA=[[35.700,139.800],[35.702,139.800],[35.702,139.802]];
const areaB=[[35.701,139.801],[35.703,139.801],[35.703,139.803]];
const srcArea={id:'area-source-original',points:areaA};

async function fixture({area=true,duplicateFolder=false}={}){
 const bytes=(await createFreshV1Kmz({records:[original],activityAreas:area?[srcArea]:[]},deps)).bytes;
 if(!duplicateFolder)return bytes;
 const zip=await JSZip.loadAsync(bytes),file=zip.file('doc.kml');
 assert(file,'source KMZ must contain doc.kml');
 let xml=await file.async('string');
 assert.match(xml,/50m サークル/);
 xml=xml.replace('</Document>','<Folder><name>50m サークル</name></Folder></Document>');
 zip.file('doc.kml',xml);
 zip.file('retained/opaque.bin',new Uint8Array([0,255,37]));
 return zip.generateAsync({type:'uint8array'});
}
async function start(options){
 const bytes=await fixture(options),w=createWorkspace(deps),result=await w.prepare(bytes);
 assert.equal(result.status,'REVIEW',JSON.stringify(result));
 assert.equal(w.acceptPrepared({confirmed:true}).applied,true);
 let sink,reader;const ui={onCommand:f=>sink=f,setViewReader:f=>reader=f,status:()=>({mapCount:1,stopped:false,dataConnected:false}),dispose(){}};
 const adapter=connectB2({session:w.session,ui});let seq=0;
 return {w,adapter,bytes,view:()=>reader(),run:action=>adapter.dispatch({...action,requestId:'review-'+(++seq)},{confirmed:true})};
}
test('area redraw is one atomic change, Undo restores original with same id',async()=>{
 const x=await start({area:true}),baseline=x.w.session.state();
 assert.equal(baseline.areas.length,1);
 assert.equal(x.run({type:'area-replace',id:srcArea.id,points:areaB}).status,'APPLIED');
 const changed=x.w.session.state();
 assert.deepEqual(changed.areas,[{id:srcArea.id,points:areaB}]);
 assert.equal(changed.history.undo,baseline.history.undo+1);
 assert.deepEqual(changed.records,baseline.records);
 assert.equal(x.run({type:'undo'}).status,'APPLIED');
 assert.deepEqual(x.w.session.state().areas,baseline.areas);
 assert.equal(x.run({type:'redo'}).status,'APPLIED');
 assert.deepEqual(x.w.session.state().areas,changed.areas);
 const output=await x.w.exportKmz();
 const validated=await stageKmlInput(output.bytes,deps);
 assert.deepEqual(validated.errors,[]);
 x.adapter.dispose();x.w.dispose();
});
test('cancelled/invalid redraw does not modify the single Session or timeline',async()=>{
 const x=await start({area:true}),before=x.w.session.state();
 // The UI holds a local draft; no command is issued until explicit closing.
 assert.deepEqual(x.w.session.state(),before);
 assert.equal(x.run({type:'area-replace',id:srcArea.id,points:[[35.7,139.8],[35.7,139.8],[35.7,139.8]]}).status,'HOLD');
 assert.deepEqual(x.w.session.state(),before);
 assert.equal(x.run({type:'area-replace',id:'another-area',points:areaB}).status,'HOLD');
 assert.deepEqual(x.w.session.state(),before);
 x.adapter.dispose();x.w.dispose();
});
test('ambiguous output folder is never guessed or merged: append to unique new folder',async()=>{
 const x=await start({area:false,duplicateFolder:true}),before=x.w.session.state();
 assert.equal(x.run({type:'add',kind:'gym',position:{lat:35.704,lng:139.804}}).status,'APPLIED');
 const result=await x.w.exportKmz(),out=await JSZip.loadAsync(result.bytes);
 const xml=await out.file('doc.kml').async('string');
 assert.match(xml,/Creative Next 追加 50m サークル/);
 assert.equal((xml.match(/<name>50m サークル<\/name>/g)||[]).length,2);
 assert.deepEqual(await out.file('retained/opaque.bin').async('uint8array'),new Uint8Array([0,255,37]));
 const stage=await stageKmlInput(result.bytes,deps);
 assert.deepEqual(stage.errors,[]);
 assert.equal(x.w.session.state().records[0].title,before.records[0].title);
 assert.deepEqual(x.bytes,await fixture({area:false,duplicateFolder:true}));
 x.adapter.dispose();x.w.dispose();
});
