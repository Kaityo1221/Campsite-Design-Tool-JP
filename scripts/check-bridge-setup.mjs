import fs from 'node:fs';
import assert from 'node:assert/strict';

const html = fs.readFileSync('bridge-setup.html', 'utf8');
const js = fs.readFileSync('js/bridge-setup.js', 'utf8');
const config = fs.readFileSync('js/bridge-setup-config.js', 'utf8');
const all = `${html}\n${js}\n${config}`;

function includes(source, needle, message) {
  assert.ok(source.includes(needle), message || `Missing: ${needle}`);
}

// Product / UI contract.
includes(html, 'Campsite Bridge', 'Unified Campsite Bridge branding is required');
includes(html, 'あなたの端末に合わせてセットアップします。');
includes(html, 'data-device-panel="apple"');
includes(html, 'data-device-panel="android"');
includes(html, 'data-device-panel="pc"');
includes(html, 'data-device-choice="apple"');
includes(html, 'data-device-choice="android"');
includes(html, 'data-device-choice="pc"');
includes(html, 'PC版は準備中です');
assert.equal(/iPhone版\s*Campsite Bridge/i.test(all), false, 'Do not present iPhone as a separate Campsite Bridge product');
assert.equal(/Android版\s*Campsite Bridge/i.test(all), false, 'Do not present Android as a separate Campsite Bridge product');

// Apple / iPad detection contract.
includes(js, "/iPad/i.test(ua)", 'Explicit iPad UA detection is required');
includes(js, "platform === 'MacIntel' && touchPoints > 1", 'iPadOS desktop UA fallback is required');
includes(js, "/iPhone|iPod/i.test(ua)", 'iPhone detection is required');

// Android / OS-first contract.
includes(js, "/Android/i.test(ua)", 'Android OS detection is required');
includes(js, "if (isIPad || isIPhone) return 'apple';", 'Apple OS must route before browser handling');
includes(js, "if (isAndroid) return 'android';", 'Android OS must route before browser handling');
includes(js, "return 'pc';", 'Desktop fallback is required');

// Manual choice must persist and override auto detection.
includes(js, 'campsiteBridgeSetup.manualDevice.v1');
includes(js, "render(manual || detectDevice(), manual ? 'manual' : 'auto');");

// Browser guidance contract.
includes(js, 'セットアップとWayfarerの利用はSafariで進めてください。');
includes(js, 'セットアップとWayfarerの利用はFirefoxで進めてください。');

// Distribution endpoints stay separate from detection logic.
includes(html, 'js/bridge-setup-config.js?v=1');
includes(config, "appleShortcutUrl: ''");
includes(config, "androidExtensionUrl: ''");

// Android current test build remains usable even before a public XPI URL exists.
includes(html, '現在のテスト版を利用できます');
includes(html, 'id="androidXpiSteps"');
includes(html, 'Install Extension from File / ファイルから拡張機能をインストール');
includes(html, 'Firefoxロゴを素早く5回タップ');
includes(html, 'WayfarerのMap画面で「🌉 Bridge」が表示されれば導入完了です。');
includes(js, "element.href = '#androidXpiSteps';", 'Android setup must fall back to the signed XPI instructions');

// New flow must not contain retired installation methods.
assert.equal(/Userscripts/i.test(all), false, 'Userscripts must not appear in the new Bridge setup flow');
assert.equal(/Tampermonkey/i.test(all), false, 'Tampermonkey must not appear in the new Bridge setup flow');

console.log('Bridge setup contract check: OK');
