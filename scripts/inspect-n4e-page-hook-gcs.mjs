import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
execFileSync(process.execPath,['scripts/build-android-bridge-0.3.6-unsigned.mjs'],{stdio:'ignore'});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'n4e-hook-'));
try {
 execFileSync('unzip',['-q','downloads/campsite-bridge-android-0.3.6-unsigned.xpi','page-hook.js','-d',tmp]);
 const s=fs.readFileSync(path.join(tmp,'page-hook.js'),'utf8');
 const patterns=['XMLHttpRequest','GCS_PATH','isGcsUrl(','post(',"window.addEventListener('message'",'function emitGcs','bodyText','poiKind','gameEntity','cachedPois.set','function cache','function normalize','rawPoiTo','normalizePoi','POI_CACHE','CACHE'];
 for(const p of patterns){
   let from=0,n=0;
   while((from=s.indexOf(p,from))>=0 && n<8){
     console.log('--- '+p+' #'+(++n)+' @'+from+' ---');
     console.log(s.slice(Math.max(0,from-900),Math.min(s.length,from+2200)));
     from+=p.length;
   }
 }
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
