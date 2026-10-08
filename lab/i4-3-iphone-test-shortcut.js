/* Campsite Bridge I4-3 TEST ONLY. Create a separate Safari Shortcut.
 * Does not replace the production launcher or production runtime.
 */
(async () => {
  'use strict';
  const HOST = /(^|\.)wayfarer\.(nianticlabs\.com|scopely\.com)$/i;
  const STABLE = 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/js/bridge-shortcut/campsite-bridge-shortcut-runtime.js';
  const RAW = 'https://raw.githubusercontent.com/Kaityo1221/Campsite-Design-Tool-JP/bfa79012a65a331eefb0f6057453e8d0b82c61e2/dist/bridge-shortcut/1.0.0/';
  const PROBES = [
    'runtime.part-08aa.iphone-i4-probe-host.js',
    'runtime.part-08b.iphone-i4-probe-ui.js'
  ];
  const finish = value => { try { completion(value); } catch (_) { alert(value); } };
  if (!HOST.test(location.hostname)) {
    finish('I4-3 TEST: WayfarerのSafariページで実行してください。'); return;
  }
  try {
    const fetchCode = async url => {
      const response = await fetch(url + '?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + new URL(url).pathname.split('/').pop());
      return response.text();
    };
    const [stable, host, ui] = await Promise.all([
      fetchCode(STABLE), ...PROBES.map(name => fetchCode(RAW + name))
    ]);
    if (!stable.includes("const BRIDGE_VERSION = '1.0.0'")) {
      throw new Error('STABLE_RUNTIME_INVALID');
    }
    window.__cbsI4ProbeTestEnabled = true;
    const evaluate = (source, label) => {
      try { (0, eval)(source + '\n//# sourceURL=' + label); }
      catch (error) { throw new Error(label + ': ' + (error?.message || error)); }
    };
    evaluate(stable, 'campsite-stable-runtime.js');
    evaluate(host, 'campsite-i4-probe-host.js');
    evaluate(ui, 'campsite-i4-probe-ui.js');
    finish('I4-3 TEST: 診断コードを読み込みました。活動範囲を確定し、🔬 I4通信診断を押してください。');
  } catch (error) {
    finish('I4-3 TEST 起動失敗: ' + String(error?.message || error));
  }
})();
