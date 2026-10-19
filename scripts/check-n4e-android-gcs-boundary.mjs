import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build-android-bridge-0.3.7-unsigned.mjs'], { stdio: 'inherit' });
const xpi='downloads/campsite-bridge-android-0.3.7-unsigned.xpi';
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'campsite-n4e-gcs-'));
try {
  execFileSync('unzip',['-q',xpi,'-d',tmp]);
  const hook=fs.readFileSync(path.join(tmp,'page-hook.js'),'utf8');
  assert.match(hook,/\/api\/v1\/vault\/mapview\/gcs/,'existing Android GCS transport missing');
  assert.match(hook,/XMLHttpRequest/,'existing Android GCS transport must remain XHR-owned');
  assert.doesNotMatch(hook,/campsite-bridge-android-n4:gcs-request/,'N4 must not invent a second GCS transport before seam is defined');
  const public035=fs.readFileSync('downloads/campsite-bridge-android-0.3.5.xpi');
  const crypto=await import('node:crypto');
  const sha=crypto.createHash('sha256').update(public035).digest('hex');
  assert.equal(sha,'f5c7d300c6cdd82758f88f651116c1b7af42863ef03e80f8ac89e39afa0fa7b7','public signed 0.3.5 changed');
  console.log('N4-E GCS transport boundary audit PASS');
} finally { fs.rmSync(tmp,{recursive:true,force:true}); }
