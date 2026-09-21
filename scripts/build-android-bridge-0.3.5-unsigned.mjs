import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const SOURCE_XPI = 'downloads/campsite-bridge-android-0.3.4.xpi';
const OUTPUT_XPI = 'downloads/campsite-bridge-android-0.3.5-unsigned.xpi';
const OUTPUT_SHA = 'downloads/campsite-bridge-android-0.3.5-unsigned.sha256';
const VERSION = '0.3.5';
const RELEASE = 'M3.5';

execFileSync(process.execPath, ['scripts/build-android-bridge-xpi.mjs'], { stdio: 'inherit' });

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'campsite-bridge-035-'));
try {
  execFileSync('unzip', ['-q', SOURCE_XPI, '-d', work]);

  fs.rmSync(path.join(work, 'META-INF'), { recursive: true, force: true });

  const uiPath = path.join(work, 'bridge-ui.js');
  let ui = fs.readFileSync(uiPath, 'utf8');

  const logoutFn = `  function findSidebarLogoutAnchor() {
    let best = null;
    let bestScore = Infinity;
    for (const el of document.querySelectorAll('button,[role="button"],a,li,div')) {
      const text = String(el.textContent || '').replace(/\\s+/g, ' ').trim();
      if (!(text === 'ログアウト' || /^Log\\s*out$/i.test(text))) continue;
      if (!isVisibleElement(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.left > 180) continue;
      const score = Math.abs(rect.bottom - innerHeight) + rect.left;
      if (score < bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return best;
  }
`;

  if (!ui.includes(logoutFn)) throw new Error('0.3.4 logout anchor function changed; refusing unsafe patch');

  const collapseFn = `
  function findSidebarCollapseAnchor(logout) {
    if (!logout) return null;
    const logoutRect = logout.getBoundingClientRect();
    let best = null;
    let bestScore = Infinity;
    for (const el of document.querySelectorAll('button,[role="button"],a')) {
      if (el === logout || logout.contains(el) || el.contains(logout)) continue;
      if (!isVisibleElement(el)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.left > 180 || rect.width < 24 || rect.width > 88 || rect.height < 24 || rect.height > 64) continue;
      if (rect.bottom > logoutRect.top + 6) continue;
      const gap = logoutRect.top - rect.bottom;
      if (gap < -6 || gap > 90) continue;

      const text = String(el.textContent || '').replace(/\\s+/g, ' ').trim();
      const label = [
        el.getAttribute('aria-label') || '',
        el.getAttribute('title') || '',
        text
      ].join(' ').trim();
      const iconLike = text.length <= 3 ||
        /collapse|expand|sidebar|menu|close|open|back|折りたた|閉じ|開く|戻る/i.test(label);
      const score =
        gap * 5 +
        Math.abs(rect.height - 40) +
        Math.abs(rect.width - 40) +
        Math.abs(rect.left - logoutRect.left) * 0.15 +
        (iconLike ? 0 : 80);
      if (score < bestScore) {
        best = el;
        bestScore = score;
      }
    }
    return best;
  }
`;

  ui = ui.replace(logoutFn, logoutFn + collapseFn);

  const oldPosition = `  function positionPanelNow() {
    if (!panel || !onMap) return;
    const anchor = findSidebarCommunityAnchor();
    const logout = findSidebarLogoutAnchor();
    const edge = 6;

    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const logoutRect = logout ? logout.getBoundingClientRect() : null;
      const left = Math.max(edge, Math.round(rect.left + 6));
      const rootWidth = Math.max(104, Math.min(132, Math.round(rect.width - 12)));
      let top = Math.round(rect.bottom + 8);
      const toggleHeight = 40;
      if (logoutRect) top = Math.min(top, Math.round(logoutRect.top - toggleHeight - 10));
      top = Math.max(edge, top);

      panel.style.left = \`${left}px\`;
      panel.style.top = \`${top}px\`;
      panel.style.bottom = 'auto';
      panel.style.width = \`${rootWidth}px\`;
      panel.style.visibility = 'visible';
      panel.dataset.anchor = 'sidebar-community';
      lastAnchorSignature = \`${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}\`;
      return;
    }

    // Wait for the left navigation to finish mounting instead of flashing elsewhere on the map.
    panel.style.visibility = 'hidden';
    panel.dataset.anchor = 'waiting-sidebar';
  }
`;

  const newPosition = `  function positionPanelNow() {
    if (!panel || !onMap) return;
    const logout = findSidebarLogoutAnchor();
    const collapse = findSidebarCollapseAnchor(logout);
    const edge = 6;
    const toggleHeight = 40;

    if (collapse) {
      const rect = collapse.getBoundingClientRect();
      const logoutRect = logout ? logout.getBoundingClientRect() : null;
      const preferredLeft = Math.round(rect.right + 6);
      const left = Math.max(edge, Math.min(preferredLeft, innerWidth - 92 - edge));
      const sidebarRight = logoutRect ? Math.round(logoutRect.right - 6) : Math.round(rect.right + 112);
      const rootWidth = Math.max(92, Math.min(124, sidebarRight - left));
      const top = Math.max(edge, Math.round(rect.top + (rect.height - toggleHeight) / 2));

      panel.style.left = \`${left}px\`;
      panel.style.top = \`${top}px\`;
      panel.style.bottom = 'auto';
      panel.style.width = \`${rootWidth}px\`;
      panel.style.visibility = 'visible';
      panel.dataset.anchor = 'sidebar-collapse-right';

      const body = panel.querySelector('#cbam24-body');
      if (body) {
        const bodyWidth = 286;
        const preferredBodyLeft = left + rootWidth + 10;
        const viewportBodyLeft = Math.max(edge, Math.min(preferredBodyLeft, innerWidth - bodyWidth - edge));
        body.style.left = \`${Math.round(viewportBodyLeft - left)}px\`;
        body.style.right = 'auto';
      }

      lastAnchorSignature = \`collapse:${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}\`;
      return;
    }

    const anchor = findSidebarCommunityAnchor();
    if (anchor) {
      const rect = anchor.getBoundingClientRect();
      const logoutRect = logout ? logout.getBoundingClientRect() : null;
      const left = Math.max(edge, Math.round(rect.left + 6));
      const rootWidth = Math.max(104, Math.min(132, Math.round(rect.width - 12)));
      let top = Math.round(rect.bottom + 8);
      if (logoutRect) top = Math.min(top, Math.round(logoutRect.top - toggleHeight - 10));
      top = Math.max(edge, top);

      panel.style.left = \`${left}px\`;
      panel.style.top = \`${top}px\`;
      panel.style.bottom = 'auto';
      panel.style.width = \`${rootWidth}px\`;
      panel.style.visibility = 'visible';
      panel.dataset.anchor = 'sidebar-community-fallback';
      const body = panel.querySelector('#cbam24-body');
      if (body) {
        body.style.left = 'calc(100% + 10px)';
        body.style.right = 'auto';
      }
      lastAnchorSignature = \`community:${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}:${Math.round(rect.height)}\`;
      return;
    }

    // Wait for the left navigation to finish mounting instead of flashing elsewhere on the map.
    panel.style.visibility = 'hidden';
    panel.dataset.anchor = 'waiting-sidebar';
  }
`;

  if (!ui.includes(oldPosition)) throw new Error('0.3.4 positionPanelNow changed; refusing unsafe patch');
  ui = ui.replace(oldPosition, newPosition);
  ui = ui.replaceAll('Campsite Bridge M3.4', `Campsite Bridge ${RELEASE}`);
  fs.writeFileSync(uiPath, ui);

  const manifestPath = path.join(work, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  manifest.version = VERSION;
  manifest.description = `Campsite Bridge ${RELEASE} sender for Wayfarer Map on Firefox.`;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  execFileSync(process.execPath, ['--check', uiPath], { stdio: 'inherit' });

  fs.rmSync(OUTPUT_XPI, { force: true });
  fs.mkdirSync(path.dirname(OUTPUT_XPI), { recursive: true });
  const files = ['bridge-ui.css', 'manifest.json', 'bridge-core.js', 'page-hook.js', 'bridge-ui.js'];
  execFileSync('zip', ['-q', '-9', path.resolve(OUTPUT_XPI), ...files], { cwd: work });

  const data = fs.readFileSync(OUTPUT_XPI);
  const sha256 = crypto.createHash('sha256').update(data).digest('hex');
  fs.writeFileSync(OUTPUT_SHA, `${sha256}  ${path.basename(OUTPUT_XPI)}\n`);

  console.log(`Built Campsite Bridge Android ${VERSION} unsigned candidate: ${data.length} bytes`);
  console.log(`SHA-256: ${sha256}`);
  console.log('NOTE: META-INF signatures were intentionally removed. Mozilla signing is required before normal Firefox distribution.');
} finally {
  fs.rmSync(work, { recursive: true, force: true });
}
