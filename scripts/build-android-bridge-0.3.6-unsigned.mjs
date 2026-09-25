import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SOURCE_XPI = 'downloads/campsite-bridge-android-0.3.5-unsigned.xpi';
const OUTPUT_XPI = 'downloads/campsite-bridge-android-0.3.6-unsigned.xpi';
const OUTPUT_SHA = 'downloads/campsite-bridge-android-0.3.6-unsigned.sha256';
const VERSION = '0.3.6';
const RELEASE = 'M3.6';
const RETIRED_VISUAL_MARKERS = [
  'Campsite Bridge shared WFMM-first POI colors',
  'campsite-bridge-poi-colors',
  'CampsiteBridgePoiColors'
];

execFileSync(process.execPath, ['scripts/build-android-bridge-0.3.5-unsigned.mjs'], { stdio: 'inherit' });
if (!fs.existsSync(SOURCE_XPI)) throw new Error(`Android 0.3.5 unsigned source missing: ${SOURCE_XPI}`);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'campsite-bridge-036-'));
try {
  execFileSync('unzip', ['-q', SOURCE_XPI, '-d', work]);
  fs.rmSync(path.join(work, 'META-INF'), { recursive: true, force: true });

  const pageHookPath = path.join(work, 'page-hook.js');
  const pageHook = fs.readFileSync(pageHookPath, 'utf8');
  for (const marker of RETIRED_VISUAL_MARKERS) {
    if (pageHook.includes(marker)) {
      throw new Error(`Retired Bridge POI overlay found in Android page-hook.js: ${marker}`);
    }
  }

  const manifestPath = path.join(work, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = VERSION;
  manifest.description = `Campsite Bridge ${RELEASE} sender for Wayfarer Map on Firefox. POI display stays with Wayfarer/WFMM.`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  execFileSync(process.execPath, ['--check', pageHookPath], { stdio: 'inherit' });
  execFileSync(process.execPath, ['--check', path.join(work, 'bridge-core.js')], { stdio: 'inherit' });
  execFileSync(process.execPath, ['--check', path.join(work, 'bridge-ui.js')], { stdio: 'inherit' });

  fs.rmSync(OUTPUT_XPI, { force: true });
  fs.mkdirSync(path.dirname(OUTPUT_XPI), { recursive: true });
  const files = ['bridge-ui.css', 'manifest.json', 'bridge-core.js', 'page-hook.js', 'bridge-ui.js'];
  execFileSync('zip', ['-q', '-9', path.resolve(OUTPUT_XPI), ...files], { cwd: work });

  const data = fs.readFileSync(OUTPUT_XPI);
  for (const marker of RETIRED_VISUAL_MARKERS) {
    if (data.includes(Buffer.from(marker))) {
      throw new Error(`Retired Bridge POI overlay marker entered Android XPI: ${marker}`);
    }
  }

  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  fs.writeFileSync(OUTPUT_SHA, `${sha256}  ${path.basename(OUTPUT_XPI)}\n`);

  console.log(`Built Campsite Bridge Android ${VERSION} unsigned candidate: ${data.length} bytes`);
  console.log(`SHA-256: ${sha256}`);
  console.log('POI display owner: Wayfarer/WFMM (Bridge overlay retired)');
  console.log('NOTE: Mozilla signing is required before normal Firefox distribution.');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
