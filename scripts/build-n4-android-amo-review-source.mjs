// Build an AMO reviewer source archive for the unsigned Android N4 QA package.
// This tool does not upload to Mozilla or change public 0.3.5.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const stage = fs.mkdtempSync(path.join(os.tmpdir(), 'noah-n4-amo-review-'));
const root = path.join(stage, 'Campsite-Noah-N4-QA-0.3.7-source');
const out = path.resolve('downloads/campsite-noah-n4-qa-0.3.7-AMO-source.zip');
const qa = path.resolve('downloads/campsite-bridge-android-n4-qa-0.3.7-unsigned.xpi');
const expectedProdHash = 'f5c7d300c6cdd82758f88f651116c1b7af42863ef03e80f8ac89e39afa0fa7b7';
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
try {
  execFileSync(process.execPath, ['scripts/check-n4-android-qa-package.mjs'], { stdio: 'inherit' });
  assert.equal(sha('downloads/campsite-bridge-android-0.3.5.xpi'), expectedProdHash);
  fs.mkdirSync(root, { recursive: true });

  const files = [
    'scripts/build-android-bridge-xpi.mjs',
    'scripts/build-android-bridge-0.3.5-unsigned.mjs',
    'scripts/build-android-bridge-0.3.6-unsigned.mjs',
    'scripts/build-android-bridge-0.3.7-unsigned.mjs',
    'scripts/build-n4-android-qa-unsigned.mjs',
    'scripts/check-n4-android-qa-package.mjs',
    'scripts/check-n4h-android-safety.mjs',
    'scripts/check-n4i-gcs-inspector.mjs',
    'scripts/check-n4g-android-receiver-handoff.mjs',
    'scripts/check-n4-android-final-regression.mjs',
    'bridge-android-n4/interior-poi-export.js',
    'bridge-android-n4/gcs-response-inspector.js',
    'bridge-android-n4/wayfarer-acquisition-coordinator.js',
    'bridge-android-n4/wayfarer-map-adapter.js',
    'bridge-android-n4/panel-polygon-adapter.js',
    'bridge-android-n4/panel-ui-adapter.js',
    'bridge-pc/wayfarer-polygon-controller.js',
    'bridge-pc/polygon-ui.js',
    'bridge-pc/wayfarer-observation-zone.js',
    'bridge-pc/wayfarer-acquisition-engine.js',
    'bridge-pc/poi-parser.js',
    'bridge-pc/poi-classifier.js',
    ...Array.from({length:8}, (_,i)=>'dist/android-bridge-0.3.4/part-'+String(i+1).padStart(2,'0')+'.b64'),
    'downloads/campsite-bridge-android-0.3.5.xpi'
  ];
  for (const file of files) {
    assert.ok(fs.statSync(file).isFile(), 'missing source input: ' + file);
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(file, target);
  }

  // The archived 0.3.4 baseline consists of readable JS/CSS/manifest.
  // Include its extracted contents to make the historical input auditable.
  const baseline = path.join(root, 'review-baseline-0.3.4-extracted');
  fs.mkdirSync(baseline);
  execFileSync('unzip', ['-q', 'downloads/campsite-bridge-android-0.3.4.xpi', '-d', baseline]);
  fs.rmSync(path.join(baseline, 'META-INF'), { recursive: true, force: true });
  const generatedQaManifest = execFileSync('unzip', ['-p', qa, 'manifest.json'], { encoding: 'utf8' });
  const manifest = JSON.parse(generatedQaManifest);
  assert.equal(manifest.version, '0.3.7');
  assert.equal(manifest.browser_specific_settings?.gecko?.id, 'campsite-bridge-android-n4-qa@local');

  fs.writeFileSync(path.join(root, 'README-AMO-REVIEW.md'), `# Campsite Noah N4 QA 0.3.7: reviewer source bundle

This archive is **source for AMO reviewer inspection**, not an installable extension.
The submitted binary is \`campsite-bridge-android-n4-qa-0.3.7-unsigned.xpi\`, ID \`campsite-bridge-android-n4-qa@local\`.
Do not submit a public 0.3.5 version update. The QA candidate has not been Android-device tested.
Source repository: https://github.com/Kaityo1221/Campsite-Design-Tool-JP
QA development commit: af2e5b9fb990a71d26ce5d9e752ad161d5b8d89f.

## Build requirements
Linux (Ubuntu 24.04 used in GitHub Actions), Node.js 22, zip and unzip binaries.
No npm install, bundler, secrets, network requests, API keys, or signed AMO assets are required.
Scripts only use Node built-ins and the included static inputs.

## How to reproduce from the root directory
1. \`node scripts/check-n4-android-qa-package.mjs\`
   This rebuilds the archived 0.3.4 XPI from the included eight base64 parts, then
   rebuilds 0.3.5 / 0.3.6 / 0.3.7 and finally N4 QA 0.3.7 unsigned.
2. \`unzip -p downloads/campsite-bridge-android-n4-qa-0.3.7-unsigned.xpi manifest.json\`
   Confirm QA ID and version 0.3.7.
3. \`node scripts/check-n4h-android-safety.mjs\`
   Optional regression: the subset of tests with additional dependencies from
   elsewhere in the full repository may need the complete GitHub checkout.

The build is constructed with ZIP timestamps, so the entire XPI bytewise hash can
vary between builds; compare the manifest and non-META-INF payload file contents
against the submitted XPI. The builder verifies immutable published 0.3.5 SHA-256.

## Why there is a baseline binary input
The historical 0.3.4 input is preserved as eight base64-encoded parts to reproduce
the exact baseline bytes; its readable non-signature JS/CSS/manifest files are
also provided under \`review-baseline-0.3.4-extracted\`.
The 0.3.5 signed XPI is an integrity-only reference used by the QA build guard;
the build does not inject any of its signed code into the QA extension.
The N4-added editable source is in \`bridge-android-n4\` and \`bridge-pc\`.

Safety: Mozilla signing, authenticated GCS proof and Android hardware D01-D10
are NOT completed. GCS sourceComplete remains null and transfer remains blocked.
`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.rmSync(out, { force: true });
  execFileSync('zip', ['-q', '-r', out, path.basename(root)], { cwd:stage });
  execFileSync('unzip', ['-tqq', out], { stdio:'pipe' });
  assert.ok(fs.statSync(out).size > 0);
  console.log('AMO REVIEW SOURCE ZIP READY:', out, fs.statSync(out).size, 'bytes');
  console.log('ZIP SHA-256:', sha(out));
  console.log('NO SIGNING / NO UPLOAD / NO RELEASE');
} finally {
  fs.rmSync(stage, { recursive: true, force: true });
}
