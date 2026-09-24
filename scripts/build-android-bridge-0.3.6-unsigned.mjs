import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SOURCE_XPI = 'downloads/campsite-bridge-android-0.3.5-unsigned.xpi';
const OUTPUT_XPI = 'downloads/campsite-bridge-android-0.3.6-unsigned.xpi';
const OUTPUT_SHA = 'downloads/campsite-bridge-android-0.3.6-unsigned.sha256';
const SHARED_VISUALS = 'js/bridge-wayfarer-poi-colors.js';
const VERSION = '0.3.6';
const RELEASE = 'M3.6';
const MARKER = 'Campsite Bridge shared WFMM-first POI colors';

execFileSync(process.execPath, ['scripts/build-android-bridge-0.3.5-unsigned.mjs'], { stdio: 'inherit' });
if (!fs.existsSync(SOURCE_XPI)) throw new Error(`Android 0.3.5 unsigned source missing: ${SOURCE_XPI}`);
if (!fs.existsSync(SHARED_VISUALS)) throw new Error(`Shared POI color overlay missing: ${SHARED_VISUALS}`);

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'campsite-bridge-036-'));
try {
  execFileSync('unzip', ['-q', SOURCE_XPI, '-d', work]);
  fs.rmSync(path.join(work, 'META-INF'), { recursive: true, force: true });

  const pageHookPath = path.join(work, 'page-hook.js');
  let pageHook = fs.readFileSync(pageHookPath, 'utf8');
  const visuals = fs.readFileSync(SHARED_VISUALS, 'utf8');
  if (!pageHook.includes(MARKER)) {
    pageHook += `\n\n/* ${MARKER} */\n${visuals}\n`;
    fs.writeFileSync(pageHookPath, pageHook);
  }

  const manifestPath = path.join(work, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = VERSION;
  manifest.description = `Campsite Bridge ${RELEASE} sender for Wayfarer Map on Firefox. WFMM-first POI colors.`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  execFileSync(process.execPath, ['--check', pageHookPath], { stdio: 'inherit' });
  execFileSync(process.execPath, ['--check', path.join(work, 'bridge-core.js')], { stdio: 'inherit' });
  execFileSync(process.execPath, ['--check', path.join(work, 'bridge-ui.js')], { stdio: 'inherit' });

  fs.rmSync(OUTPUT_XPI, { force: true });
  fs.mkdirSync(path.dirname(OUTPUT_XPI), { recursive: true });
  const files = ['bridge-ui.css', 'manifest.json', 'bridge-core.js', 'page-hook.js', 'bridge-ui.js'];
  execFileSync('zip', ['-q', '-9', path.resolve(OUTPUT_XPI), ...files], { cwd: work });

  const data = fs.readFileSync(OUTPUT_XPI);
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  fs.writeFileSync(OUTPUT_SHA, `${sha256}  ${path.basename(OUTPUT_XPI)}\n`);

  console.log(`Built Campsite Bridge Android ${VERSION} unsigned candidate: ${data.length} bytes`);
  console.log(`SHA-256: ${sha256}`);
  console.log(`Shared visuals marker: ${MARKER}`);
  console.log('NOTE: Mozilla signing is required before normal Firefox distribution.');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
