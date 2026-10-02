import fs from 'node:fs';
import vm from 'node:vm';

const OUTPUT = 'bridge-pc/creative-wm3c-test-runtime.js';
const SOURCE_FILES = [
  'creative/runtime/map-engine/wayfarer-observation-adapter.js',
  'creative/runtime/map-engine/wayfarer-reference-geometry.js',
  'creative/runtime/map-engine/wayfarer-reference-scene-builder.js',
  'creative/runtime/map-engine/map-renderer.js'
];
const PATCH_FILE = 'creative/wayfarer-reference-layer-patch.js';

function referenceAugmentSource() {
  const patchSource = fs.readFileSync(PATCH_FILE, 'utf8');
  const context = { window: {}, console };
  vm.createContext(context);
  new vm.Script(patchSource, { filename: PATCH_FILE }).runInContext(context);
  const apply = context.window.applyCreativeWayfarerReferenceLayerPatch;
  if (typeof apply !== 'function') throw new Error('WM-3C Reference patch registration failed.');

  const fixture = `<html><body><script>
(()=>{'use strict';
const records=[];
function cmCandidateShadowScene(){return Object.freeze({items:Object.freeze([])})}
})();
</script></body></html>`;
  const transformed = apply(fixture);
  const marker = '/* cmWm3cReferenceRuntime */';
  const start = transformed.indexOf(marker);
  const end = start >= 0 ? transformed.indexOf('})();\n</script>', start) : -1;
  if (start < 0 || end < 0) throw new Error('WM-3C Reference runtime augmentation could not be extracted.');
  return transformed.slice(start, end);
}

function safeInlineSource(path) {
  const source = fs.readFileSync(path, 'utf8');
  if (source.includes('</script>')) throw new Error(`Inline TEST source contains </script>: ${path}`);
  return source;
}

export function buildWm3cCreativeTestRuntime() {
  const inlineSources = SOURCE_FILES.map(safeInlineSource);
  const augment = referenceAugmentSource();

  const output = `(() => {
  'use strict';

  if (window.__campsiteWm3cCreativeRuntimeInstalled) return;
  window.__campsiteWm3cCreativeRuntimeInstalled = true;

  const VERSION = '0.1.0';
  const INLINE_SOURCES = ${JSON.stringify(inlineSources)};
  const REFERENCE_AUGMENT = ${JSON.stringify(augment)};
  const CORE_NEEDLE = "<script>\\n(()=>{'use strict';";
  const CORE_END = '})();\\n</script>';

  function inlineEngineTags() {
    return INLINE_SOURCES.map(source => '<script>' + source + '<' + '/script>').join('');
  }

  function transformCreativeHtml(value) {
    if (typeof value !== 'string') return value;
    if (!value.includes('cmCandidateShadowScene')) return value;
    if (value.includes('cmWm3cReferenceRuntime')) return value;

    let out = value;
    if (!out.includes(CORE_NEEDLE)) return out;
    out = out.replace(CORE_NEEDLE, inlineEngineTags() + CORE_NEEDLE);

    const coreStart = out.indexOf("(()=>{'use strict';");
    const coreEnd = coreStart >= 0 ? out.indexOf(CORE_END, coreStart) : -1;
    if (coreEnd < 0) return value;
    out = out.slice(0, coreEnd) + '\\n' + REFERENCE_AUGMENT + '\\n' + out.slice(coreEnd);
    return out;
  }

  const proto = window.Document?.prototype;
  if (!proto || typeof proto.write !== 'function') return;

  const nativeWrite = proto.write;
  const nativeWriteln = typeof proto.writeln === 'function' ? proto.writeln : null;

  proto.write = function(...args) {
    return nativeWrite.apply(this, args.map(transformCreativeHtml));
  };
  if (nativeWriteln) {
    proto.writeln = function(...args) {
      return nativeWriteln.apply(this, args.map(transformCreativeHtml));
    };
  }

  window.__campsiteWm3cCreativeRuntime = Object.freeze({
    version: VERSION,
    transformCreativeHtml
  });
})();
`;

  fs.writeFileSync(OUTPUT, output);
  return OUTPUT;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(`Built ${buildWm3cCreativeTestRuntime()}`);
}
