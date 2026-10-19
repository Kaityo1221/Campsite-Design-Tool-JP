import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const file='bridge-android-n4/gcs-response-inspector.js';
const w={};
vm.runInNewContext(fs.readFileSync(file,'utf8'),{window:w});
const inspect=w.CampsiteBridgeAndroidN4GcsInspector.inspect;
const good=inspect({result:{data:[{pois:[{poiId:'hidden-guid',latE6:35000000}]}]}});
assert.equal(good.valid,true,'normal POI envelope must be structurally recognizable');
assert.equal(good.poiArrayCount,1);
assert.equal(good.rawPoiCount,1);
assert.equal(good.sourceComplete,null,'structure alone NEVER proves source completeness');
assert.equal(JSON.stringify(good).includes('hidden-guid'),false,'no raw identifiers can be retained');

const empty=inspect({result:{data:[{pois:[]}]}});
assert.equal(empty.valid,true,'empty POI array is syntactically valid but unverified');
assert.equal(empty.sourceComplete,null);
assert.equal(empty.rawPoiCount,0);

for (const input of [
  {error:{code:401,message:'login expired'}},
  {errors:[{message:'forbidden'}]},
  {status:'error'},
  {success:false},
  {result:{data:{items:[]}}},
  [],
  null
]) assert.equal(inspect(input).valid,false,'an error or unknown envelope must not pass');

for (const input of [
  {result:{data:[{pois:[]}]},hasMore:true},
  {result:{data:[{pois:[]}]},nextPageToken:'secret-token'},
  {result:{data:[{pois:[]}]},nextCursor:'secret-next'},
  {result:{data:[{pois:[]}]},truncated:true},
  {result:{data:[{pois:[]}]},nested:{hasNext:true}}
]) {
  const result=inspect(input);
  assert.equal(result.valid,false,'explicitly incomplete response is a fail-closed stop');
  assert.equal(result.reason,'EXPLICIT_INCOMPLETE');
  assert.equal(JSON.stringify(result).includes('secret-'),false,'pagination tokens must never enter diagnostics');
}

const unexpected=inspect({result:{message:'server changed response format'}});
assert.equal(unexpected.reason,'NO_POI_ARRAY');
assert.equal(unexpected.valid,false);

console.log('N4-I GCS structural/unknown/explicit-incomplete/error/privacy: PASS');
console.log('Authenticated source completeness and Android physical device: NOT TESTED');
