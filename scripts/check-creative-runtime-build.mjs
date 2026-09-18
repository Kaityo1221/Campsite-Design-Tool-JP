import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const indexHtml = fs.readFileSync('creative/index.html', 'utf8');
const manifest = JSON.parse(fs.readFileSync('creative/runtime/next-lab-manifest.json', 'utf8'));
const runtimeFiles = new Map(
  manifest.order.map(name => [
    './runtime/' + name,
    fs.readFileSync('creative/runtime/' + name, 'utf8')
  ])
);
const bridgePatch = fs.readFileSync('creative/bridge-project-patch.js', 'utf8');

function extractCreativeBootstrap(html) {
  const marker = '<script>\n(async()=>{';
  const start = html.indexOf(marker);
  assert.ok(start >= 0, 'Creative bootstrap tag missing');
  const codeStart = start + '<script>\n'.length;
  const end = html.indexOf('</script>', codeStart);
  assert.ok(end > codeStart, 'Creative bootstrap closing tag missing');
  return html.slice(codeStart, end);
}

const statusNode = { textContent: '' };
const context = {
  console: { log() {}, warn() {}, error() {} },
  window: { CampsiteCaAccess: {} },
  location: {
    search: '?campsiteProject=bridge',
    href: 'https://example.test/Campsite-Design-Tool-JP/creative/index.html?campsiteProject=bridge'
  },
  URLSearchParams,
  URL,
  AbortController,
  setTimeout,
  clearTimeout,
  document: {
    querySelector(selector) {
      return selector === '#creativeBootStatus small' ? statusNode : null;
    },
    getElementById() {
      return null;
    },
    body: { textContent: '', innerHTML: '' }
  },
  sessionStorage: {
    getItem() { return null; },
    setItem() {},
    get length() { return 0; },
    key() { return null; }
  },
  localStorage: {
    getItem() { return '1'; },
    setItem() {}
  },
  async fetch(input) {
    const key = String(input);
    return {
      ok: runtimeFiles.has(key),
      async text() {
        return runtimeFiles.get(key) || '';
      }
    };
  }
};

vm.createContext(context);
new vm.Script(bridgePatch, { filename: 'creative/bridge-project-patch.js' }).runInContext(context);

let bootstrap = extractCreativeBootstrap(indexHtml);
const executeLoop = `  for(const runtimeCode of runtimeScripts){
    const runRuntime=new Function(runtimeCode);
    runRuntime();
  }`;
assert.ok(bootstrap.includes(executeLoop), 'Creative runtime execution loop changed');
bootstrap = bootstrap.replace(
  executeLoop,
  `  globalThis.__runtimeScripts=runtimeScripts;
  return;`
);
bootstrap = bootstrap.replace(
  '(async()=>{',
  'globalThis.__creativeBootPromise=(async()=>{'
);

new vm.Script(bootstrap, { filename: 'creative/index.html:inline-bootstrap' }).runInContext(context);
await context.__creativeBootPromise;

const scripts = context.__runtimeScripts;
assert.ok(Array.isArray(scripts) && scripts.length >= 1, 'Generated Creative runtime scripts missing');

scripts.forEach((code, index) => {
  new vm.Script(code, { filename: `generated-creative-runtime-${index}.js` });
});

console.log(`Generated Creative runtime syntax: OK (${scripts.length} scripts)`);
