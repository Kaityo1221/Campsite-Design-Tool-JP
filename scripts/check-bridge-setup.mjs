import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('bridge-setup.html', 'utf8');
const install = fs.readFileSync('bridge-shortcut-install.html', 'utf8');
const js = fs.readFileSync('js/bridge-setup.js', 'utf8');
const config = fs.readFileSync('js/bridge-setup-config.js', 'utf8');
const launcher = fs.readFileSync('js/bridge-shortcut/shortcut-launcher.js', 'utf8');
const all = `${html}\n${install}\n${js}\n${config}\n${launcher}`;

const has = (source, value, message) => assert.ok(source.includes(value), message || `Missing: ${value}`);

has(html, 'あなたの端末に合わせてセットアップします。');
has(html, 'data-device-panel="apple"');
has(html, 'data-device-panel="android"');
has(html, 'data-device-panel="pc"');
has(html, '正式版 1.0.0');
has(html, '現在のテスト版を利用できます');
has(html, 'id="androidXpiSteps"');

has(js, "/iPad/i.test(ua)");
has(js, "platform === 'MacIntel' && touchPoints > 1");
has(js, "/iPhone|iPod/i.test(ua)");
has(js, "/Android/i.test(ua)");
has(js, 'campsiteBridgeSetup.manualDevice.v1');
has(js, "CONFIG.appleManualSetupUrl");
has(js, 'isValidAppleShortcutUrl');

has(config, "appleManualSetupUrl: './bridge-shortcut-install.html'");
has(config, "appleRuntimeVersion: '1.0.0'");
has(config, "appleShortcutUrl: 'https://www.icloud.com/shortcuts/3ddc90767d114bfba66de3a5d1a12d01'");

has(install, 'ランチャーコードをコピー');
has(install, 'Safariの共有メニュー');
has(launcher, 'campsite-bridge-shortcut-runtime.js');
has(launcher, 'completion(value)');
has(launcher, 'document.createElement');
has(launcher, 'script.textContent');

assert.equal(/Userscripts/i.test(all), false, 'Retired installation wording must not appear');
assert.equal(/Tampermonkey/i.test(all), false, 'Retired installation wording must not appear');
assert.equal(/iPhone版\s*Campsite Bridge/i.test(all), false, 'Do not present Apple as a separate product');
assert.equal(/Android版\s*Campsite Bridge/i.test(all), false, 'Do not present Android as a separate product');

console.log('Campsite Bridge setup contract: OK');
