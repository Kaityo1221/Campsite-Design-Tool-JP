import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath,['scripts/build-android-bridge-0.3.6-unsigned.mjs'],{stdio:'ignore'});
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'n4e-hook-'));
try {
 execFileSync('unzip',['-q','downloads/campsite-bridge-android-0.3.6-unsigned.xpi','page-hook.js','-d',tmp]);
 const s=fs.readFileSync(path.join(tmp,'page-hook.js'),'utf8');
 const needle='/api/v1/vault/mapview/gcs';
 const i=s.indexOf(needle);
 if(i<0) throw new Error('GCS endpoint not found');
 const start=Math.max(0,s.lastIndexOf('\n',Math.max(0,i-4500)));
 const end=Math.min(s.length,s.indexOf('\n',i+4500)>0?s.indexOf('\n',i+4500):i+4500);
 console.log(s.slice(start,end));
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
