import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build-android-bridge-0.3.5-unsigned.mjs'], { stdio: 'inherit' });

const xpi = 'downloads/campsite-bridge-android-0.3.5-unsigned.xpi';
assert.ok(fs.existsSync(xpi), '0.3.5 candidate XPI was not built');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'campsite-bridge-035-check-'));
try {
  execFileSync('unzip', ['-q', xpi, '-d', tmp]);

  const manifest = JSON.parse(fs.readFileSync(path.join(tmp, 'manifest.json'), 'utf8'));
  const ui = fs.readFileSync(path.join(tmp, 'bridge-ui.js'), 'utf8');

  assert.equal(manifest.version, '0.3.5');
  assert.equal(manifest.browser_specific_settings?.gecko?.id, 'campsite-bridge-android@local');
  assert.equal(fs.existsSync(path.join(tmp, 'META-INF')), false, 'Unsigned candidate must not carry stale 0.3.4 signatures');

  assert.ok(ui.includes('function findSidebarCollapseAnchor(logout)'), 'Collapse/eject anchor detector missing');
  assert.ok(ui.includes("panel.dataset.anchor = 'sidebar-collapse-right'"), 'Bridge must anchor to the right of the collapse/eject control');
  assert.ok(ui.includes('const preferredLeft = Math.round(rect.right + 6);'), 'Bridge must start just right of the collapse/eject control');
  assert.ok(ui.includes('const viewportBodyLeft = Math.max(edge, Math.min(preferredBodyLeft, innerWidth - bodyWidth - edge));'), 'Expanded panel must stay inside viewport');
  assert.ok(ui.includes("panel.dataset.anchor = 'sidebar-community-fallback'"), 'Community fallback must remain available');
  assert.ok(ui.includes('if (rect.left > 180 || rect.width < 24 || rect.width > 88'), 'Collapse detector must stay scoped to small left-sidebar controls');

  execFileSync(process.execPath, ['--check', path.join(tmp, 'bridge-ui.js')], { stdio: 'inherit' });

  console.log('Campsite Bridge Android 0.3.5 placement candidate: OK');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
