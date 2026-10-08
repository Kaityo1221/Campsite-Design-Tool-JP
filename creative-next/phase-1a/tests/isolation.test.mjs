import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));

test('application dependencies remain local and contain no persistence, network or production connections', async () => {
  const files = [path.join(root, 'bootstrap.mjs')];
  for (const directory of ['core', 'adapters']) {
    for (const name of await readdir(path.join(root, directory))) files.push(path.join(root, directory, name));
  }
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /\b(?:localStorage|sessionStorage|indexedDB|fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|CampsiteCaAccess|CampsiteCreativeProject)\b/, file);
    assert.doesNotMatch(source, /\b(?:eval|setInterval)\s*\(/, file);
    for (const match of source.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)['"]/g)) {
      assert.ok(match[1].startsWith('.'), `${file}: non-local dependency ${match[1]}`);
      const relative = path.relative(root, path.resolve(path.dirname(file), match[1]));
      assert.ok(!relative.startsWith('..') && !path.isAbsolute(relative), `${file}: dependency escapes Phase 1-A`);
    }
  }
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test('tracked repository files are unchanged; all nonignored additions stay in Phase 1-A', () => {
  const repository = path.resolve(root, '../..');
  execFileSync('git', ['diff', '--exit-code', 'HEAD'], { cwd: repository });
  const tracked = execFileSync('git', ['diff', '--name-only', '--cached'], { cwd: repository, encoding: 'utf8' });
  assert.equal(tracked.trim(), '');
  const added = execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: repository, encoding: 'utf8' }).trim().split(/\r?\n/).filter(Boolean);
  assert.ok(added.length > 0);
  assert.ok(added.every(name => name.startsWith('creative-next/phase-1a/')), added.join('\n'));
});
