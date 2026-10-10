import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../../phase-2-preview/preview.css', import.meta.url), 'utf8');

test('fallback canvas CSS never hides Leaflet Canvas POI, circles or activity polygons', () => {
  // Leaflet renders vectors in its own <canvas> (preferCanvas: true).
  // Only the standalone fallback #map may be hidden while Leaflet is shown.
  assert.match(css, /\.map-wrap:has\(#leaflet-map:not\(\[hidden\]\)\)\s+#map\s*\{\s*display:none\s*\}/);
  assert.doesNotMatch(css, /\.map-wrap:has\(#leaflet-map:not\(\[hidden\]\)\)\s+canvas\s*\{/);
  assert.match(css, /(?:^|\})#map\{display:block;width:100%;height:300px;/);
  assert.match(css, /@media\(max-width:600px\)\{[^}]*\{[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*\}[^}]*#map\{height:225px\}/);
  // No generic canvas display/size rule that can impact Leaflet's renderer.
  assert.doesNotMatch(css, /(?:^|\})\s*canvas\s*\{/);
});
