// Creates a side-by-side, *unsigned* Android N4 QA build.
// NEVER signs, deploys, uploads to AMO, or replaces the public 0.3.5 XPI.
// Firefox Release requires a Mozilla signature before permanent installation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SOURCE = 'downloads/campsite-bridge-android-0.3.7-unsigned.xpi';
const TARGET = 'downloads/campsite-bridge-android-n4-qa-0.3.7-unsigned.xpi';
const SHA_FILE = 'downloads/campsite-bridge-android-n4-qa-0.3.7-unsigned.sha256';
const PROD_ID = 'campsite-bridge-android@local';
const QA_ID = 'campsite-bridge-android-n4-qa@local';
const PROD_SHA = 'f5c7d300c6cdd82758f88f651116c1b7af42863ef03e80f8ac89e39afa0fa7b7';

execFileSync(process.execPath, ['scripts/build-android-bridge-0.3.7-unsigned.mjs'], { stdio: 'inherit' });
assert.equal(crypto.createHash('sha256').update(
  fs.readFileSync('downloads/campsite-bridge-android-0.3.5.xpi')
).digest('hex'), PROD_SHA, 'signed public 0.3.5 must remain unchanged');

const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'noah-n4-qa-'));
try {
  execFileSync('unzip',['-q',SOURCE,'-d',tmp]);
  const manifestPath=path.join(tmp,'manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  assert.equal(manifest.version,'0.3.7','QA only repackages the matching N4 candidate');
  assert.equal(manifest.browser_specific_settings?.gecko?.id, PROD_ID,'unknown original add-on identity');
  assert.ok(Array.isArray(manifest.content_scripts),'Firefox content scripts missing');
  // This metadata opts into Android signing compatibility without changing code.
  manifest.browser_specific_settings.gecko_android ??= {};
  manifest.browser_specific_settings.gecko.id=QA_ID;
  manifest.name='Campsite Bridge N4 QA TEST (UNSIGNED)';
  manifest.description='INTERNAL QA ONLY. No Mozilla signature. GCS completeness unverified; transfer remains blocked.';
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2)+'\n');

  fs.rmSync(path.join(tmp,'META-INF'),{recursive:true,force:true});
  fs.mkdirSync(path.dirname(TARGET),{recursive:true});
  fs.rmSync(TARGET,{force:true});
  // Zip only the source package's declared contents; prevent extra hidden files.
  const names=execFileSync('unzip',['-Z1',SOURCE],{encoding:'utf8'})
    .trim().split('\n').filter(p=>p && !p.startsWith('META-INF/'));
  assert.ok(names.includes('manifest.json'));
  assert.ok(names.includes('interior-poi-export.js'));
  assert.ok(names.includes('gcs-response-inspector.js'));
  assert.ok(names.every(n=>!n.startsWith('/')&&!n.includes('..')&&!n.includes('\\')));
  execFileSync('zip',['-q','-9',path.resolve(TARGET),...names],{cwd:tmp});
  const bytes=fs.readFileSync(TARGET);
  const sha=crypto.createHash('sha256').update(bytes).digest('hex');
  fs.writeFileSync(SHA_FILE,sha+'  '+path.basename(TARGET)+'\n');
  console.log('BUILT unsigned side-by-side N4 QA extension');
  console.log('Version: '+manifest.version+'; test ID: '+QA_ID+'; public ID unchanged');
  console.log('SHA256: '+sha);
  console.log('NOT installable in standard Firefox until signed by Mozilla.');
} finally {
  fs.rmSync(tmp,{recursive:true,force:true});
}
