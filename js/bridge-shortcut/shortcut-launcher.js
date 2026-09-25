(async () => {
  'use strict';

  const LAUNCHER_VERSION = '1.2.1';
  const RUNTIME_URL = 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/js/bridge-shortcut/campsite-bridge-shortcut-runtime.js';
  const NATIVE_MARKER_POLICY_URL = 'https://kaityo1221.github.io/Campsite-Design-Tool-JP/dist/bridge-shortcut/1.0.0/runtime.part-10.iphone-native-wayfarer-marker-policy.js';
  const WAYFARER_HOST = /(^|\.)wayfarer\.(nianticlabs\.com|scopely\.com)$/i;
  const PANEL_ID = 'campsite-bridge-shortcut-panel';

  const finish = value => {
    try { completion(value); } catch (_) {}
  };

  const formatError = error => {
    if (!error) return '';
    const name = String(error.name || 'Error');
    const message = String(error.message || error);
    const stack = String(error.stack || '').trim();
    return stack ? `${name}: ${message}\n${stack}` : `${name}: ${message}`;
  };

  const bridgeState = () => ({
    panel: Boolean(document.getElementById(PANEL_ID)),
    api: Boolean(window.CampsiteBridgeShortcut),
    installedFlag: Boolean(window.__campsiteBridgeShortcutProdInstalled)
  });

  const bridgeStarted = () => {
    const state = bridgeState();
    return state.panel || state.api;
  };

  function runCapabilityTests(report) {
    try {
      delete window.__bridgeEvalTest;
      eval('window.__bridgeEvalTest = 123;');
      report.eval = window.__bridgeEvalTest === 123 ? 'PASS' : `FAIL value=${String(window.__bridgeEvalTest)}`;
    } catch (error) {
      report.eval = `FAIL ${formatError(error)}`;
    }

    try {
      delete window.__bridgeFunctionTest;
      new Function('window.__bridgeFunctionTest = 456;')();
      report.function = window.__bridgeFunctionTest === 456 ? 'PASS' : `FAIL value=${String(window.__bridgeFunctionTest)}`;
    } catch (error) {
      report.function = `FAIL ${formatError(error)}`;
    }

    try {
      document.body.dataset.bridgeRuntimeTest = 'ok';
      const div = document.createElement('div');
      div.id = '__bridgeDomTest';
      div.textContent = 'BRIDGE DOM TEST';
      div.style.cssText = 'position:fixed;left:8px;top:8px;z-index:2147483647;padding:4px 7px;background:#111;color:#fff;font:11px sans-serif;border-radius:6px;';
      document.body.appendChild(div);
      const ok = document.body.dataset.bridgeRuntimeTest === 'ok' && document.getElementById('__bridgeDomTest') === div;
      report.dom = ok ? 'PASS' : 'FAIL';
      div.remove();
      delete document.body.dataset.bridgeRuntimeTest;
    } catch (error) {
      report.dom = `FAIL ${formatError(error)}`;
    }

    try {
      delete window.__bridgeInlineScriptTest;
      const script = document.createElement('script');
      script.textContent = 'window.__bridgeInlineScriptTest = 789;';
      (document.head || document.documentElement).appendChild(script);
      script.remove();
      report.inlineScript = window.__bridgeInlineScriptTest === 789 ? 'PASS' : 'BLOCKED/NO EXECUTION';
    } catch (error) {
      report.inlineScript = `FAIL ${formatError(error)}`;
    }

    try { delete window.__bridgeEvalTest; } catch (_) {}
    try { delete window.__bridgeFunctionTest; } catch (_) {}
    try { delete window.__bridgeInlineScriptTest; } catch (_) {}
  }

  async function runRuntimeOnce(code, report) {
    const evalOk = report.eval === 'PASS';
    const functionOk = report.function === 'PASS';
    const inlineOk = report.inlineScript === 'PASS';

    let mode = '';
    try {
      if (evalOk) {
        mode = 'eval';
        eval(`${code}\n//# sourceURL=campsite-bridge-shortcut-runtime.js`);
      } else if (functionOk) {
        mode = 'function';
        const runner = new Function(`${code}\n//# sourceURL=campsite-bridge-shortcut-runtime.js`);
        runner.call(window);
      } else if (inlineOk) {
        mode = 'inline-script';
        const script = document.createElement('script');
        script.dataset.campsiteBridgeShortcutLauncher = '1';
        script.textContent = `${code}\n//# sourceURL=campsite-bridge-shortcut-runtime.js`;
        (document.head || document.documentElement).appendChild(script);
        script.remove();
      } else {
        report.runtime = 'SKIP: no string-execution method passed';
        return;
      }

      await Promise.resolve();
      await new Promise(resolve => setTimeout(resolve, 120));

      const state = bridgeState();
      report.runtimeMode = mode;
      report.runtime = bridgeStarted() ? 'PASS: Bridge UI/API started' : 'NO UI/API after execution';
      report.runtimeState = `panel=${state.panel} api=${state.api} installedFlag=${state.installedFlag}`;
    } catch (error) {
      const state = bridgeState();
      report.runtimeMode = mode || 'none';
      report.runtime = `THREW ${formatError(error)}`;
      report.runtimeState = `panel=${state.panel} api=${state.api} installedFlag=${state.installedFlag}`;
    }
  }

  const reportText = report => [
    `Campsite Bridge Launcher ${LAUNCHER_VERSION}`,
    `host: ${location.hostname}`,
    `fetch: ${report.fetch || '-'}`,
    `native marker policy: ${report.nativePolicy || '-'}`,
    `eval: ${report.eval || '-'}`,
    `Function: ${report.function || '-'}`,
    `DOM: ${report.dom || '-'}`,
    `inline script: ${report.inlineScript || '-'}`,
    `runtime mode: ${report.runtimeMode || '-'}`,
    `runtime: ${report.runtime || '-'}`,
    `state: ${report.runtimeState || '-'}`
  ].join('\n');

  const report = {};

  try {
    if (!WAYFARER_HOST.test(location.hostname)) {
      alert('SafariでWayfarerを開いてからCampsite Bridgeを実行してください。');
      finish(`Campsite Bridge Launcher ${LAUNCHER_VERSION}\nnot-wayfarer: ${location.hostname}`);
      return;
    }

    const response = await fetch(`${RUNTIME_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`runtime HTTP ${response.status}`);

    const runtimeCode = await response.text();
    if (!runtimeCode.includes("const BRIDGE_VERSION = '")) {
      throw new Error('runtime validation failed');
    }
    report.fetch = `PASS size=${runtimeCode.length}`;

    let nativePolicyCode = '';
    try {
      const policyResponse = await fetch(`${NATIVE_MARKER_POLICY_URL}?t=${Date.now()}`, { cache: 'no-store' });
      if (!policyResponse.ok) throw new Error(`policy HTTP ${policyResponse.status}`);
      nativePolicyCode = await policyResponse.text();
      if (!nativePolicyCode.includes('CampsiteBridgeWayfarerNativeMarkerPolicy')) throw new Error('policy validation failed');
      report.nativePolicy = `PASS size=${nativePolicyCode.length}`;
    } catch (error) {
      report.nativePolicy = `SKIP ${formatError(error)}`;
      nativePolicyCode = '';
    }

    const code = nativePolicyCode ? `${runtimeCode}\n${nativePolicyCode}` : runtimeCode;

    runCapabilityTests(report);
    await runRuntimeOnce(code, report);
    finish(reportText(report));
  } catch (error) {
    report.runtime = `LAUNCHER ERROR ${formatError(error)}`;
    finish(reportText(report));
  }
})();
