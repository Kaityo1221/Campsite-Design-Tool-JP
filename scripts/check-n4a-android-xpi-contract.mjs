import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build-android-bridge-0.3.6-unsigned.mjs'], { stdio: 'inherit' });

const xpi = 'downloads/campsite-bridge-android-0.3.6-unsigned.xpi';
assert.ok(fs.existsSync(xpi), '0.3.6 candidate XPI was not built');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'campsite-n4a-android-contract-'));
try {
  execFileSync('unzip', ['-q', xpi, '-d', tmp]);
  const required = ['manifest.json', 'bridge-core.js', 'page-hook.js', 'bridge-ui.js', 'bridge-ui.css'];
  for (const file of required) assert.ok(fs.existsSync(path.join(tmp, file)), `missing ${file}`);

  const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  const core = fs.readFileSync(path.join(tmp, 'bridge-core.js'), 'utf8');
  const hook = fs.readFileSync(path.join(tmp, 'page-hook.js'), 'utf8');
  const ui = fs.readFileSync(path.join(tmp, 'bridge-ui.js'), 'utf8');

  assert.equal(manifest.version, '0.3.6');
  assert.equal(manifest.browser_specific_settings?.gecko?.id, 'campsite-bridge-android@local');
  assert.equal(fs.existsSync(path.join(tmp, 'META-INF')), false);

  const report = {
    manifest: {
      version: manifest.version,
      contentScripts: manifest.content_scripts?.map(item => item.js || []) || [],
      webAccessibleResources: manifest.web_accessible_resources || []
    },
    bridgeCore: {
      bytes: Buffer.byteLength(core),
      hasProtocol: core.includes('CAMPSITE_BRIDGE_POI_V1'),
      hasReceiver: /bridge-receiver/i.test(core),
      hasPostMessage: core.includes('postMessage'),
      hasRuntimeMessaging: /runtime\.(sendMessage|onMessage)/.test(core)
    },
    pageHook: {
      bytes: Buffer.byteLength(hook),
      hasGcs: /\/api\/v1\/vault\/mapview\/gcs/.test(hook),
      hasFetch: /\bfetch\s*\(/.test(hook),
      hasXhr: /XMLHttpRequest/.test(hook),
      hasPerformanceObserver: /PerformanceObserver/.test(hook),
      hasBridgeOverlay: /CampsiteBridgePoiColors|campsite-bridge-poi-colors/.test(hook)
    },
    bridgeUi: {
      bytes: Buffer.byteLength(ui),
      hasBridgeLabel: ui.includes('🌉 Bridge'),
      hasPanelTitle: /Campsite Bridge/.test(ui),
      hasCommunityAnchor: /findSidebarCommunityAnchor/.test(ui),
      hasCollapseAnchor: /findSidebarCollapseAnchor/.test(ui),
      hasReceiver: /bridge-receiver/i.test(ui)
    }
  };

  assert.equal(report.pageHook.hasBridgeOverlay, false, 'Bridge POI overlay must stay retired');
  assert.equal(report.bridgeUi.hasBridgeLabel, true, 'Wayfarer Bridge entry must remain visible');

  console.log('N4-A Android XPI contract');
  console.log(JSON.stringify(report, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
