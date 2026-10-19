import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build-android-bridge-0.3.6-unsigned.mjs'], { stdio: 'inherit' });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'campsite-n4b-hook-'));
try {
  execFileSync('unzip', ['-q', 'downloads/campsite-bridge-android-0.3.6-unsigned.xpi', '-d', tmp]);
  const hook = fs.readFileSync(path.join(tmp, 'page-hook.js'), 'utf8');
  const patterns = [
    /google\.maps/g,
    /getMap\s*\(/g,
    /app-wf-base-map/g,
    /__ngContext__/g,
    /map\.getCenter/g,
    /getBounds\s*\(/g
  ];
  const snippets = {};
  for (const pattern of patterns) {
    const match = pattern.exec(hook);
    if (!match || match.index == null) continue;
    snippets[String(pattern)] = hook.slice(Math.max(0, match.index - 650), Math.min(hook.length, match.index + 1250))
      .replace(/\s+/g, ' ').trim();
  }
  assert.ok(Object.keys(snippets).length > 0, 'Android page-hook exposes no detectable map integration seam');
  console.log('N4-B Android map seam');
  console.log(JSON.stringify(snippets, null, 2));
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
