import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../creative/runtime/map-engine/map-renderer.js', import.meta.url), 'utf8');

let stampSeq = 1;
const markerInstances = [];
function layerGroup() {
  return {
    layers: [],
    addTo() { return this; },
    removeLayer(layer) { this.layers = this.layers.filter(item => item !== layer); },
    clearLayers() { this.layers = []; }
  };
}
function marker(latlng, options = {}) {
  const instance = {
    options: { ...options },
    _latlng: { lat: latlng[0], lng: latlng[1] },
    _events: {},
    addTo(group) { group.layers.push(this); return this; },
    setLatLng(value) { this._latlng = { lat: value[0], lng: value[1] }; },
    getLatLng() { return this._latlng; },
    setIcon(icon) { this.options.icon = icon; },
    setOpacity(value) { this.options.opacity = value; },
    on(name, callback) { this._events[name] = callback; return this; }
  };
  markerInstances.push(instance);
  return instance;
}
function circle(latlng, options = {}) {
  return {
    options: { ...options },
    _latlng: { lat: latlng[0], lng: latlng[1] },
    _radius: options.radius,
    addTo(group) { group.layers.push(this); return this; },
    setLatLng(value) { this._latlng = { lat: value[0], lng: value[1] }; },
    getLatLng() { return this._latlng; },
    setRadius(value) { this._radius = value; },
    getRadius() { return this._radius; },
    setStyle(style) { Object.assign(this.options, style); }
  };
}

const window = {};
const L = {
  layerGroup,
  marker,
  circle,
  circleMarker: marker,
  divIcon: options => ({ kind: 'div', ...options }),
  icon: options => ({ kind: 'icon', ...options }),
  stamp: layer => layer.__stamp || (layer.__stamp = stampSeq++)
};
vm.runInNewContext(source, { window, L, console, Object, Array, Map, Set, String, Number, Error });

assert.equal(typeof window.bridgeMapLab_createMapRenderer, 'function');

const map = { removeLayer() {}, getPane() { return null; } };
let activated = 0;
const renderer = window.bridgeMapLab_createMapRenderer(map, { onMarkerActivate() { activated += 1; } });

renderer.render({ items: [
  {
    key: 'marker:reference:outer-1',
    ownerKey: 'reference:outer-1',
    origin: 'reference',
    renderKind: 'GYM',
    observationZone: 'REFERENCE_100',
    readOnly: true,
    inspectable: true,
    layerKey: 'marker',
    style: { opacity: 0.58 },
    geometry: { type: 'point', lat: 35, lng: 139 }
  },
  {
    key: 'circle50:reference:outer-1',
    ownerKey: 'reference:outer-1',
    origin: 'reference',
    renderKind: 'GYM',
    observationZone: 'REFERENCE_100',
    readOnly: true,
    layerKey: 'circle-50',
    style: { opacity: 0.42, fillOpacity: 0.035 },
    geometry: { type: 'circle', lat: 35, lng: 139, radiusMeters: 50 }
  }
] });

const markerDiagnostic = renderer.getDiagnostics()[0];
assert.equal(markerDiagnostic.markerKind, 'reference-icon');
assert.equal(markerDiagnostic.origin, 'reference');
assert.equal(markerDiagnostic.interactive, true, 'Inspectable Reference marker must accept inspection activation while remaining read-only');
assert.equal(markerDiagnostic.opacity, 0.58);
assert.deepEqual(JSON.parse(JSON.stringify(renderer.getRenderedCounts())), {
  markers: 1,
  circles50: 1,
  circles40: 0,
  circles30: 0
});
assert.equal(activated, 0);
markerInstances[0]._events.click?.({ originalEvent:null });
assert.equal(activated, 1, 'Inspectable Reference marker must call the renderer inspection activation callback');

renderer.render({ items: [
  {
    key: 'marker:reference:outer-1',
    ownerKey: 'reference:outer-1',
    origin: 'reference',
    renderKind: 'POKESTOP',
    observationZone: 'REFERENCE_100',
    readOnly: true,
    inspectable: true,
    layerKey: 'marker',
    style: { opacity: 0.5 },
    geometry: { type: 'point', lat: 35.0001, lng: 139.0001 }
  }
] });
const updated = renderer.getDiagnostics()[0];
assert.equal(updated.markerKind, 'reference-icon');
assert.equal(updated.opacity, 0.5);
assert.equal(renderer.getRenderedCounts().circles50, 0, 'Keyed renderer must remove stale reference circle');

console.log('WM-3C-3 Reference Renderer: PASS');
