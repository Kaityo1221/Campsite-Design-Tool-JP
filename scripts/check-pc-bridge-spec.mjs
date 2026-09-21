import fs from 'node:fs';
import assert from 'node:assert/strict';

const spec = fs.readFileSync('docs/bridge-pc-minimum-spec-v1.md', 'utf8');
const receiver = fs.readFileSync('bridge-receiver.html', 'utf8');
const projectContract = fs.readFileSync('docs/bridge-project-contract-v1.md', 'utf8');
const setup = fs.readFileSync('bridge-setup.html', 'utf8');

const has = (source, value, message) => assert.ok(source.includes(value), message || `Missing: ${value}`);

has(spec, 'Chrome extension using Manifest V3');
has(spec, 'downloads/campsite-bridge-pc-0.1.0.zip');
has(spec, 'https://wayfarer.scopely.com/*');
has(spec, 'https://wayfarer.nianticlabs.com/*');
has(spec, 'CAMPSITE_BRIDGE_POI_V1');
has(spec, 'CAMPSITE_BRIDGE_READY_V1');
has(spec, 'CAMPSITE_BRIDGE_ACK_V1');
has(spec, "bridgeVersion: '0.1.0'");
has(spec, "schemaVersion: '1.2'");
has(spec, '?campsiteBridgeDev=1&handshake=<HANDSHAKE_ID>');
has(spec, 'campsiteProject.v1');
has(spec, 'No manual CSV is required.');
has(spec, 'No Tampermonkey / Userscripts dependency is introduced.');

assert.equal(spec.includes('campssiteProject.v1'), false, 'PC spec must use the canonical Project key');
assert.equal(/CAMPSITE_BRIDGE_PC_/i.test(spec), false, 'PC must not define a PC-only protocol');
assert.equal(/Tampermonkeyをインストール/i.test(spec), false, 'PC Bridge spec must not revive the retired install path');

has(receiver, "data.type !== 'CAMPSITE_BRIDGE_POI_V1'");
has(receiver, "type:'CAMPSITE_BRIDGE_READY_V1'");
has(receiver, "type: 'CAMPSITE_BRIDGE_ACK_V1'");
has(receiver, "'https://wayfarer.scopely.com'");
has(receiver, "'https://wayfarer.nianticlabs.com'");
has(projectContract, 'Bridge Payload -> Adapter -> campsiteProject.v1');
has(setup, 'PC Chrome対応', 'PC Bridge setup must be published');
has(setup, 'Campsite Bridge PCをダウンロード');
has(setup, 'chrome://extensions');
assert.equal(setup.includes('PC版は準備中です'), false, 'Published PC setup must not say preparation in progress');

console.log('PC Bridge minimum spec contract: OK');
