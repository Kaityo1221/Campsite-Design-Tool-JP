import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

execFileSync(process.execPath, ['scripts/build-android-bridge-xpi.mjs'], { stdio: 'inherit' });

const html = fs.readFileSync('bridge-setup.html', 'utf8');
const install = fs.readFileSync('bridge-shortcut-install.html', 'utf8');
const js = fs.readFileSync('js/bridge-setup.js', 'utf8');
const config = fs.readFileSync('js/bridge-setup-config.js', 'utf8');
const launcher = fs.readFileSync('js/bridge-shortcut/shortcut-launcher.js', 'utf8');
const androidXpiPath = 'downloads/campsite-bridge-android-0.3.4.xpi';
const androidXpi = fs.readFileSync(androidXpiPath);
const androidXpiSha256 = crypto.createHash('sha256').update(androidXpi).digest('hex');
const all = `${html}\n${install}\n${js}\n${config}\n${launcher}`;

const has = (source, value, message) => assert.ok(source.includes(value), message || `Missing: ${value}`);

has(html, 'あなたの端末に合わせてセットアップします。');
has(html, 'data-device-panel="apple"');
has(html, 'data-device-panel="android"');
has(html, 'data-device-panel="pc"');
has(html, '正式版 1.0.0');
has(html, 'Android実機確認済み');
has(html, 'id="androidVersion"');
has(html, 'M3.4 / 0.3.4');
has(html, 'id="androidXpiChecksum"');
has(html, 'id="androidXpiSteps"');
has(html, 'Campsite Bridge <strong>0.3.4</strong>');
has(html, 'bridge-setup-config.js?v=2');

has(js, "/iPad/i.test(ua)");
has(js, "platform === 'MacIntel' && touchPoints > 1");
has(js, "/iPhone|iPod/i.test(ua)");
has(js, "/Android/i.test(ua)");
has(js, 'campsiteBridgeSetup.manualDevice.v1');
has(js, "CONFIG.appleManualSetupUrl");
has(js, 'isValidAppleShortcutUrl');
has(js, "document.getElementById('androidVersion')");
has(js, "document.getElementById('androidXpiChecksum')");

has(config, "appleManualSetupUrl: './bridge-shortcut-install.html'");
has(config, "appleRuntimeVersion: '1.0.0'");
has(config, "appleShortcutUrl: 'https://www.icloud.com/shortcuts/3ddc90767d114bfba66de3a5d1a12d01'");
has(config, "androidRuntimeVersion: '0.3.4'");
has(config, "androidReleaseLabel: 'M3.4'");
has(config, "androidXpiSha256: '13e57ace3468832c171df06bb92c983d66a22bc0f390c0ff15d0df3deff741b6'");
has(config, "androidExtensionUrl: './downloads/campsite-bridge-android-0.3.4.xpi'");
assert.equal(androidXpi.length, 34607, 'Android 0.3.4 XPI size mismatch');
assert.equal(androidXpiSha256, '13e57ace3468832c171df06bb92c983d66a22bc0f390c0ff15d0df3deff741b6', 'Android 0.3.4 XPI SHA-256 mismatch');

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
