import test from 'node:test';import assert from 'node:assert/strict';
import JSZip from 'jszip';import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {stageKmlInput} from '../core/stage-kmz.mjs';
import {convertLegacyKasaiKmz} from '../core/legacy-kasai-convert.mjs';
import {previewLegacyPoiStore} from '../integration/legacy-poi-preview.mjs';
const deps={JSZip,DOMParser,XMLSerializer},N='http://www.opengis.net/kml/2.2';
const name='森の案内',desc='説明: POKESTOP<br>nextlab-layer: existing-pokestop';
async function stageOld(){const zip=new JSZip();zip.file('doc.kml',`<kml xmlns="${N}"><Document><Folder><name>既存 PokéStop</name><Placemark><name>${name}</name><description>${desc.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</description><ExtendedData><Data name="nextlab-layer"><value>existing-pokestop</value></Data></ExtendedData><Point><coordinates>139.8765430,35.6543210,0</coordinates></Point></Placemark></Folder></Document></kml>`);return stageKmlInput(await zip.generateAsync({type:'uint8array'}),deps);}
async function converted(){const old=await stageOld(),r=await convertLegacyKasaiKmz(old,deps);return stageKmlInput(r.bytes,deps)}
test('a verified legacy candidate creates a Phase 1-A store preview without auto-import',async()=>{
 const stage=await converted();const preview=previewLegacyPoiStore(stage);
 assert.equal(preview.canApply,false);assert.equal(preview.records.length,1);
 assert.equal(preview.records[0].role,'existing');assert.equal(preview.records[0].title,name);
 assert.equal(preview.records[0].lat,35.654321);assert.equal(preview.records[0].lng,139.876543);
 assert.equal(preview.records[0].metadata.originalPointCoordinates,'139.8765430,35.6543210,0');
 assert.equal(preview.records[0].metadata.originalDescription,desc);
});
test('existing POI movement remains locked in isolated store',async()=>{
 const p=previewLegacyPoiStore(await converted());const before=p.store.snapshot();
 const result=p.store.execute({type:'move',id:p.records[0].id,lat:35.7,lng:139.9},{confirmed:true});
 assert.equal(result.ok,false);assert.equal(result.error.code,'EXISTING_COORDINATES_LOCKED');
 assert.deepEqual(p.store.snapshot(),before);
});
test('memo changes allow Undo / Redo without mutating staged source',async()=>{
 const stage=await converted(),before=stage.sourceKml,p=previewLegacyPoiStore(stage);
 const result=p.store.execute({type:'edit',id:p.records[0].id,patch:{memo:'集まりました'}},{confirmed:true});
 assert.equal(result.ok,true);assert.equal(p.store.snapshot().records[0].memo,'集まりました');
 p.store.undo();assert.equal(p.store.snapshot().records[0].memo,'');
 p.store.redo();assert.equal(p.store.snapshot().records[0].memo,'集まりました');
 assert.equal(stage.sourceKml,before);
});
test('legacy HOLD stage cannot create editor preview',async()=>{
 const stage=await stageOld();assert.throws(()=>previewLegacyPoiStore(stage),e=>e.code==='PREVIEW_HOLD');
});
test('preview blocks staging with mismatched audit counts',async()=>{
 const stage=await converted();stage.audit.allObjectsCount=999;
 assert.throws(()=>previewLegacyPoiStore(stage),e=>e.code==='PREVIEW_HOLD');
});
