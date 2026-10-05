import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SOURCE_XPI = 'downloads/campsite-bridge-android-0.3.6-unsigned.xpi';
const OUTPUT_XPI = 'downloads/campsite-bridge-android-0.3.7-unsigned.xpi';
const OUTPUT_SHA = 'downloads/campsite-bridge-android-0.3.7-unsigned.sha256';
const VERSION = '0.3.7';
const RELEASE = 'M3.7';
const EXTRA = [
  ['bridge-android-n4/wayfarer-map-adapter.js', 'wayfarer-map-adapter.js'],
  ['bridge-pc/wayfarer-polygon-controller.js', 'wayfarer-polygon-controller.js'],
  ['bridge-pc/polygon-ui.js', 'polygon-ui.js'],
  ['bridge-pc/wayfarer-observation-zone.js', 'wayfarer-observation-zone.js'],
  ['bridge-pc/wayfarer-acquisition-engine.js', 'wayfarer-acquisition-engine.js']
];

execFileSync(process.execPath, ['scripts/build-android-bridge-0.3.6-unsigned.mjs'], { stdio: 'inherit' });
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'campsite-bridge-037-'));
try {
  execFileSync('unzip', ['-q', SOURCE_XPI, '-d', work]);
  fs.rmSync(path.join(work, 'META-INF'), { recursive: true, force: true });

  for (const [source, target] of EXTRA) fs.copyFileSync(source, path.join(work, target));

  const manifestPath = path.join(work, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = VERSION;
  manifest.description = `Campsite Bridge ${RELEASE} Android parity candidate. Wayfarer/WFMM owns POI display.`;
  const page = manifest.content_scripts?.find(item => Array.isArray(item.js) && item.js.includes('page-hook.js'));
  const isolated = manifest.content_scripts?.find(item => Array.isArray(item.js) && item.js.includes('bridge-core.js'));
  if (!page || !isolated) throw new Error('Android content-script blocks not found');
  page.world = 'MAIN';
  page.js = [
    'page-hook.js',
    'wayfarer-map-adapter.js',
    'wayfarer-observation-zone.js',
    'wayfarer-acquisition-engine.js',
    'wayfarer-polygon-controller.js'
  ];
  isolated.world = 'ISOLATED';
  isolated.js = [
    'bridge-core.js',
    'polygon-ui.js',
    'bridge-ui.js'
  ];
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  for (const file of [...page.js, ...isolated.js]) execFileSync(process.execPath, ['--check', path.join(work, file)], { stdio: 'inherit' });

  const files = ['bridge-ui.css','manifest.json','bridge-core.js','page-hook.js','wayfarer-map-adapter.js','wayfarer-observation-zone.js','wayfarer-acquisition-engine.js','wayfarer-polygon-controller.js','polygon-ui.js','bridge-ui.js'];
  fs.rmSync(OUTPUT_XPI, { force: true });
  execFileSync('zip', ['-q','-9',path.resolve(OUTPUT_XPI),...files], { cwd: work });
  const data = fs.readFileSync(OUTPUT_XPI);
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  fs.writeFileSync(OUTPUT_SHA, `${sha256}  ${path.basename(OUTPUT_XPI)}\n`);
  console.log(`Built Campsite Bridge Android ${VERSION} unsigned candidate: ${data.length} bytes`);
  console.log(`SHA-256: ${sha256}`);
  console.log('N4 shared modules packaged; public signed 0.3.5 untouched.');
} finally { fs.rmSync(work, { recursive: true, force: true }); }
