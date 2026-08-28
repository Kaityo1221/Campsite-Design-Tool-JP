/* Japan-only location/IP guard for approved Community Ambassadors. */
(function () {
  'use strict';

  if (window.__campsiteCaGeoGuardLoaded) return;
  window.__campsiteCaGeoGuardLoaded = true;

  const FUNCTION_NAME = 'ca-geo-guard';
  const GPS_ACCURACY_LIMIT_METERS = 100;
  const GRACE_MS = 15000;
  const POSITION_TIMEOUT_MS = 7000;
  const RETRY_INTERVAL_MS = 1800;

  let currentCheck = null;
  let lastPosition = null;
  let lastResult = null;
  let lastTestScenario = '';
  let bypassNextEnterClick = false;
  let wasEnterVisible = false;
  let startupGeneration = 0;

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getClient() {
    return window.campsiteSupabase || null;
  }

  function getStatusEl() {
    return document.getElementById('caAccessStatus');
  }

  function getEnterButton() {
    return document.getElementById('caEnterButton');
  }

  function setStatus(message, tone) {
    const el = getStatusEl();
    if (!el) return;
    el.textContent = message || '';
    if (tone === 'error') el.style.color = '#fecaca';
    else if (tone === 'ok') el.style.color = '#bbf7d0';
    else if (tone === 'warn') el.style.color = '#fde68a';
    else el.style.color = '';
  }

  function setEnterEnabled(enabled) {
    const button = getEnterButton();
    if (!button) return;
    button.disabled = !enabled;
    button.style.opacity = enabled ? '' : '0.55';
    button.style.cursor = enabled ? '' : 'not-allowed';
  }

  function ensureDisclosure() {
    const status = getStatusEl();
    if (!status || document.getElementById('caGeoDisclosure')) return;
    const note = document.createElement('div');
    note.id = 'caGeoDisclosure';
    note.textContent = '日本国内での現地利用を確認します。ブロック判定時のみ、原因確認のため位置情報等を30日間記録します。';
    note.style.cssText = 'margin-top:8px;font-size:12px;line-height:1.55;color:#94a3b8;text-align:left;';
    status.insertAdjacentElement('afterend', note);
  }

  function getPanel() {
    let panel = document.getElementById('caGeoGuardPanel');
    if (panel) return panel;
    const status = getStatusEl();
    if (!status) return null;
    panel = document.createElement('div');
    panel.id = 'caGeoGuardPanel';
    panel.style.cssText = 'display:none;margin-top:12px;padding:12px;border:1px solid rgba(148,163,184,.28);border-radius:14px;background:rgba(15,23,42,.58);text-align:left;';
    const disclosure = document.getElementById('caGeoDisclosure');
    (disclosure || status).insertAdjacentElement('afterend', panel);
    return panel;
  }

  function clearPanel() {
    const panel = getPanel();
    if (!panel) return;
    panel.innerHTML = '';
    panel.style.display = 'none';
  }

  function makeButton(label, onClick, kind) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.style.cssText = [
      'border:0',
      'border-radius:10px',
      'padding:9px 12px',
      'font-size:13px',
      'font-weight:700',
      'cursor:pointer',
      kind === 'primary' ? 'background:#38bdf8;color:#082f49' : 'background:#334155;color:#f8fafc'
    ].join(';');
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await onClick();
      } finally {
        if (document.body.contains(button)) button.disabled = false;
      }
    });
    return button;
  }

  function renderBlocked(result) {
    const panel = getPanel();
    if (!panel) return;
    panel.innerHTML = '';
    panel.style.display = 'block';

    const title = document.createElement('div');
    title.textContent = result?.testScenario ? '🧪 テスト判定' : '📍 利用地域を確認できません';
    title.style.cssText = 'font-weight:800;color:#f8fafc;margin-bottom:9px;';
    panel.appendChild(title);

    const message = document.createElement('div');
    message.textContent = result?.message || '日本国内からの利用を確認できませんでした。';
    message.style.cssText = 'font-size:13px;line-height:1.6;color:#cbd5e1;margin-bottom:10px;';
    panel.appendChild(message);

    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    actions.appendChild(makeButton('もう一度確認', () => runGuard({ phase: 'retry' }), 'primary'));

    if (result?.canContinueTest && result?.testScenario) {
      actions.appendChild(makeButton('テストとして続行', () => continueTest(result.testScenario), 'secondary'));
    }
    panel.appendChild(actions);
  }

  function renderAdminTests() {
    if (!lastResult?.isAdmin || lastResult?.status !== 'allowed') return;
    const panel = getPanel();
    if (!panel) return;
    panel.innerHTML = '';
    panel.style.display = 'block';

    const title = document.createElement('div');
    title.textContent = '🧪 会長テストモード';
    title.style.cssText = 'font-weight:800;color:#f8fafc;margin-bottom:6px;';
    panel.appendChild(title);

    const hint = document.createElement('div');
    hint.textContent = '本番の判定ロジックと画面を、4種類の模擬状態で確認できます。';
    hint.style.cssText = 'font-size:12px;line-height:1.5;color:#94a3b8;margin-bottom:9px;';
    panel.appendChild(hint);

    const buttons = document.createElement('div');
    buttons.style.cssText = 'display:flex;gap:7px;flex-wrap:wrap;';
    const scenarios = [
      ['海外IP', 'foreign_ip'],
      ['GPS海外', 'gps_overseas'],
      ['GPS低精度', 'gps_low_accuracy'],
      ['位置情報拒否', 'location_denied']
    ];
    for (const [label, scenario] of scenarios) {
      buttons.appendChild(makeButton(label, () => runGuard({ phase: 'test', testScenario: scenario }), 'secondary'));
    }
    panel.appendChild(buttons);
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const error = new Error('Geolocation is not supported');
        error.code = 0;
        reject(error);
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: POSITION_TIMEOUT_MS
      });
    });
  }

  async function invokeGuard(payload) {
    const client = getClient();
    if (!client?.functions?.invoke) throw new Error('認証クライアントを利用できません。');
    const { data, error } = await client.functions.invoke(FUNCTION_NAME, { body: payload });
    if (error) {
      const message = data?.message || data?.error || error.message || '地域判定に失敗しました。';
      const wrapped = new Error(message);
      wrapped.cause = error;
      throw wrapped;
    }
    return data || {};
  }

  function positionPayload(position) {
    return {
      latitude: Number(position?.coords?.latitude),
      longitude: Number(position?.coords?.longitude),
      accuracy: Number(position?.coords?.accuracy)
    };
  }

  async function invokeWithIpRetries(payload) {
    let result = null;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      result = await invokeGuard({
        action: 'check',
        ...payload,
        finalizeIpUnknown: attempt === 3
      });
      if (result?.status !== 'ip_unknown') return result;
      if (attempt < 3) {
        setStatus(`接続地域を確認しています… ${attempt + 1}/3`, 'warn');
        await sleep(650);
      }
    }
    return result;
  }

  async function reportPermissionDenied(testScenario) {
    return invokeGuard({
      action: 'location_denied',
      testScenario: testScenario || undefined
    });
  }

  function withScenario(result, testScenario) {
    if (testScenario && result && typeof result === 'object') result.testScenario = testScenario;
    return result;
  }

  async function acquireAndEvaluate(testScenario, finalize) {
    if (testScenario === 'location_denied') {
      return { result: withScenario(await reportPermissionDenied(testScenario), testScenario), position: null };
    }

    let position;
    try {
      position = await getPosition();
      lastPosition = position;
    } catch (error) {
      if (error?.code === 1) {
        const result = await reportPermissionDenied(testScenario);
        return { result: withScenario(result, testScenario), position: null };
      }
      throw error;
    }

    const payload = {
      ...positionPayload(position),
      testScenario: testScenario || undefined,
      finalizeLowAccuracy: !!finalize?.lowAccuracy,
      finalizeOverseas: !!finalize?.overseas
    };
    const result = await invokeWithIpRetries(payload);
    return { result: withScenario(result, testScenario), position };
  }

  async function resolveGrace(initialResult, initialPosition, testScenario) {
    let result = initialResult;
    let position = initialPosition;
    let retryKind = result?.status === 'retry_accuracy' ? 'accuracy' : 'overseas';
    let deadline = Date.now() + GRACE_MS;

    while (result?.status === 'retry_accuracy' || result?.status === 'retry_overseas') {
      const now = Date.now();
      if (now >= deadline) break;
      const remaining = Math.max(1, Math.ceil((deadline - now) / 1000));
      setStatus(
        retryKind === 'accuracy'
          ? `位置情報の精度を再確認しています… 残り約${remaining}秒`
          : `現在地を再確認しています… 残り約${remaining}秒`,
        'warn'
      );
      await sleep(Math.min(RETRY_INTERVAL_MS, Math.max(250, deadline - Date.now())));
      if (Date.now() >= deadline) break;

      try {
        const next = await acquireAndEvaluate(testScenario, null);
        result = next.result;
        position = next.position || position;
      } catch (error) {
        if (error?.code === 1) {
          result = withScenario(await reportPermissionDenied(testScenario), testScenario);
          break;
        }
        continue;
      }

      if (result?.status === 'allowed' || result?.status === 'blocked') return { result, position };
      const nextKind = result?.status === 'retry_accuracy' ? 'accuracy' : 'overseas';
      if (nextKind !== retryKind) {
        retryKind = nextKind;
        deadline = Date.now() + GRACE_MS;
      }
    }

    if (result?.status === 'retry_accuracy') {
      const final = await acquireAndEvaluate(testScenario, { lowAccuracy: true });
      return final;
    }
    if (result?.status === 'retry_overseas') {
      const final = await acquireAndEvaluate(testScenario, { overseas: true });
      return final;
    }
    return { result, position };
  }

  function showAllowed(result) {
    lastResult = result;
    lastTestScenario = '';
    setEnterEnabled(true);
    setStatus('日本国内からの利用を確認しました。ボタンを押して開始してください。', 'ok');
    clearPanel();
    if (result?.isAdmin) renderAdminTests();
  }

  function showBlocked(result) {
    lastResult = result;
    lastTestScenario = result?.testScenario || '';
    setEnterEnabled(false);
    setStatus(result?.message || '利用地域を確認できませんでした。', 'error');
    renderBlocked(result || {});
  }

  function showTemporaryFailure(message) {
    lastResult = null;
    setEnterEnabled(false);
    setStatus(message || '位置情報を確認できませんでした。もう一度お試しください。', 'error');
    const panel = getPanel();
    if (!panel) return;
    panel.innerHTML = '';
    panel.style.display = 'block';
    const actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;';
    actions.appendChild(makeButton('もう一度確認', () => runGuard({ phase: 'retry' }), 'primary'));
    panel.appendChild(actions);
  }

  async function performGuard(options) {
    const testScenario = options?.testScenario || '';
    ensureDisclosure();
    setEnterEnabled(false);
    clearPanel();
    setStatus(testScenario ? 'テスト判定を実行しています…' : '日本国内からのアクセスを確認しています…', 'warn');

    try {
      let evaluated = await acquireAndEvaluate(testScenario, null);
      if (evaluated.result?.status === 'retry_accuracy' || evaluated.result?.status === 'retry_overseas') {
        evaluated = await resolveGrace(evaluated.result, evaluated.position, testScenario);
      }

      const result = evaluated.result || {};
      if (result.status === 'allowed') {
        showAllowed(result);
        return { allowed: true, result };
      }
      if (result.status === 'blocked') {
        showBlocked(result);
        return { allowed: false, result };
      }

      showTemporaryFailure(result.message || '地域判定を完了できませんでした。通信環境を確認して、もう一度お試しください。');
      return { allowed: false, result };
    } catch (error) {
      if (error?.code === 1) {
        try {
          const result = withScenario(await reportPermissionDenied(testScenario), testScenario);
          showBlocked(result);
          return { allowed: false, result };
        } catch (_) {}
      }
      console.error('CA geo guard failed', error);
      const message = error?.code === 2 || error?.code === 3
        ? '位置情報を取得できませんでした。通信環境や位置情報設定を確認して、もう一度お試しください。'
        : (error?.message || '地域判定に失敗しました。もう一度お試しください。');
      showTemporaryFailure(message);
      return { allowed: false, error };
    }
  }

  function runGuard(options) {
    if (currentCheck) return currentCheck;
    currentCheck = performGuard(options || {}).finally(() => {
      currentCheck = null;
    });
    return currentCheck;
  }

  async function continueTest(testScenario) {
    if (!testScenario) return;
    setStatus('テスト続行を記録しています…', 'warn');
    try {
      const payload = {
        action: 'test_bypass',
        testScenario,
        ...(lastPosition ? positionPayload(lastPosition) : {})
      };
      const result = await invokeGuard(payload);
      if (result?.status !== 'allowed' || !result?.testBypass) throw new Error('テスト続行を確認できませんでした。');
      bypassNextEnterClick = true;
      const button = getEnterButton();
      if (button) {
        button.disabled = false;
        button.click();
      }
    } catch (error) {
      console.error('CA geo guard test bypass failed', error);
      showTemporaryFailure(error?.message || 'テスト続行に失敗しました。');
    }
  }

  async function guardEnterClick(event) {
    const target = event.target?.closest?.('#caEnterButton');
    if (!target) return;
    if (bypassNextEnterClick) {
      bypassNextEnterClick = false;
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const outcome = await runGuard({ phase: 'enter' });
    if (!outcome?.allowed) return;
    bypassNextEnterClick = true;
    target.disabled = false;
    target.click();
  }

  function checkApprovedTransition() {
    ensureDisclosure();
    const button = getEnterButton();
    if (!button) return;
    const visible = button.style.display !== 'none' && getComputedStyle(button).display !== 'none';
    if (visible && !wasEnterVisible) {
      wasEnterVisible = true;
      const generation = ++startupGeneration;
      setTimeout(() => {
        if (generation !== startupGeneration) return;
        if (!getEnterButton() || getComputedStyle(getEnterButton()).display === 'none') return;
        runGuard({ phase: 'startup' });
      }, 0);
    } else if (!visible && wasEnterVisible) {
      wasEnterVisible = false;
      startupGeneration += 1;
      lastResult = null;
      lastTestScenario = '';
      clearPanel();
    }
  }

  document.addEventListener('click', guardEnterClick, true);

  function startObserver() {
    ensureDisclosure();
    checkApprovedTransition();
    const observer = new MutationObserver(() => checkApprovedTransition());
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'disabled']
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver, { once: true });
  } else {
    startObserver();
  }

  window.CampsiteCaGeoGuard = Object.freeze({
    check: () => runGuard({ phase: 'manual' }),
    runTest: (testScenario) => runGuard({ phase: 'test', testScenario })
  });
})();
