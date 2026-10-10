import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {createIsolatedEditorSession} from '../integration/isolated-editor-session.mjs';

function shortCircle(){
 const ring=[];
 for(let i=0;i<45;i++){
  const theta=2*Math.PI*i/45;
  const lng=139.8+Math.sin(theta)*.00043;
  const lat=35.7+Math.cos(theta)*.00036;
  ring.push(`${lng.toFixed(7)},${lat.toFixed(7)},0`);
 }
 ring.push(ring[0]);
 return ring.join(' ');
}
const xml=`<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
<Folder><name>既存 PokéStop</name><Placemark><name>Old POI</name>
<ExtendedData><Data name="nextlab-layer"><value>existing-pokestop</value></Data></ExtendedData>
<Point><coordinates>139.8000000,35.7000000,0</coordinates></Point></Placemark></Folder>
<Folder><name>40m サークル</name><Placemark><name>40m 1</name>
<Polygon><outerBoundaryIs><LinearRing><coordinates>${shortCircle()}</coordinates>
</LinearRing></outerBoundaryIs></Polygon></Placemark></Folder>
</Document></kml>`;
test('legacy short-ring HOLD contains read-only actionable diagnostics, no work applied',async()=>{
 const zip=new JSZip();zip.file('doc.kml',xml);
 const bytes=await zip.generateAsync({type:'uint8array'});
 const session=createIsolatedEditorSession({JSZip,DOMParser,XMLSerializer});
 const result=await session.prepare(bytes);
 assert.equal(result.status,'HOLD');
 assert.equal(result.canApply,false);
 assert.equal(result.legacyAudit.status,'REPORT_ONLY');
 assert.equal(result.legacyAudit.canConvert,false);
 assert.equal(result.legacyAudit.summary.pois,1);
 assert.equal(result.legacyAudit.summary.circleCandidates,1);
 assert.equal(result.legacyAudit.summary.ringsByLength[46],1);
 assert.equal(result.legacyAudit.summary.unverifiedCircleGeometry,1);
 assert.equal(session.state().hasActive,false);
});
