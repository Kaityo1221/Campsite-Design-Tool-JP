/* I4-4 live multi-tile TEST only. Never replaces production Bridge. */
(async () => {
'use strict';
const HOST = /(^|\\.)wayfarer\\.(nianticlabs\\.com|scopely\\.com)$/i;
const BASE = 'https://raw.githubusercontent.com/Kaityo1221/Campsite-Design-Tool-JP/i4-4-live-tiles-iphone-test/';
const STABLE = 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/js/bridge-shortcut/campsite-bridge-shortcut-runtime.js';
const finish = s => { try { completion(s); } catch (_) { alert(s); } };
if (!HOST.test(location.hostname)) { finish('Wayfarer Safariで実行してください'); return; }
try {
  const load = async url => { const r = await fetch(url + '?t=' + Date.now(), {cache:'no-store'}); if (!r.ok) throw Error('LOAD HTTP '+r.status); return r.text(); };
  const [stable, engine, test] = await Promise.all([load(STABLE), load(BASE+'bridge-pc/wayfarer-acquisition-engine.js'), load(BASE+'lab/i4-4-live-test.js')]);
  if (!stable.includes("const BRIDGE_VERSION = '1.0.0'")) throw Error('STABLE_RUNTIME_INVALID');
  (0,eval)(stable);
  window.__cbsI44EngineSource = engine;
  (0,eval)(test);
  finish('I4-4 TEST起動。活動範囲を確定後、🔭 複数タイル取得を押してください。');
} catch(e) { finish('I4-4 TEST起動失敗: '+String(e.message||e)); }
})();