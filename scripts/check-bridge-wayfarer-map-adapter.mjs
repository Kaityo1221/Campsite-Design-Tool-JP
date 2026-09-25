import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../js/bridge-wayfarer-map-adapter.js', import.meta.url), 'utf8');

function makeMap() {
  return {
    getBounds() { return {}; },
    getCenter() { return {}; },
    getZoom() { return 17; },
    getDiv() { return {}; },
    addListener() { return { remove() {} }; }
  };
}

function loadAdapter(host) {
  const document = {
    querySelector(selector) {
      return selector === 'app-wf-base-map' ? host : null;
    }
  };
  const window = {};
  const context = vm.createContext({ window, document });
  vm.runInContext(source, context, { filename: 'bridge-wayfarer-map-adapter.js' });
  return window.CampsiteBridgeWayfarerMapAdapter;
}

{
  const map = makeMap();
  const component = { getMap: () => map, setCustomLayers() {} };
  const host = { __ngContext__: [null, 7, component] };
  const adapter = loadAdapter(host);
  const found = adapter.findMapContext();
  assert.equal(found.map, map);
  assert.equal(found.component, component);
  assert.equal(found.adapter, 'wfmm-mapview-component');
  assert.equal(found.capabilities.customLayers, true);
}

{
  const map = makeMap();
  const nestedComponent = { getMap: () => map, setCustomLayers() {} };
  const host = { __ngContext__: [{ nested: nestedComponent }] };
  const adapter = loadAdapter(host);
  assert.equal(adapter.findMap(), null, 'adapter must not deep-scan Angular object graphs');
}

{
  const map = makeMap();
  const component = { getMap: () => map, setCustomLayers() {} };
  const contextEntries = Array.from({ length: 129 }, () => ({}));
  contextEntries[128] = component;
  const adapter = loadAdapter({ __ngContext__: contextEntries });
  assert.equal(adapter.findMap(), null, 'adapter must keep the WFMM 128-entry scan bound');
}

{
  const map = makeMap();
  const lookalike = { getMap: () => map };
  const adapter = loadAdapter({ __ngContext__: [lookalike] });
  assert.equal(adapter.findMap(), null, 'component must expose setCustomLayers like Wayfarer mapview');
}

{
  const component = { getMap: () => ({ getZoom() { return 17; } }), setCustomLayers() {} };
  const adapter = loadAdapter({ __ngContext__: [component] });
  assert.equal(adapter.findMap(), null, 'invalid Google Map lookalikes must be rejected');
}

{
  const adapter = loadAdapter(null);
  assert.equal(adapter.findMap(), null);
  assert.equal(adapter.getDiagnostics().lastResolution, 'host-not-found');
}

{
  const component = { getMap() { throw new Error('boom'); }, setCustomLayers() {} };
  const adapter = loadAdapter({ __ngContext__: [component] });
  assert.equal(adapter.findMap(), null);
  const diagnostics = adapter.getDiagnostics();
  assert.equal(diagnostics.componentGetMapErrors, 1);
  assert.equal(diagnostics.lastResolution, 'component-get-map-error');
}

console.log('Bridge Wayfarer Map Adapter checks passed.');
