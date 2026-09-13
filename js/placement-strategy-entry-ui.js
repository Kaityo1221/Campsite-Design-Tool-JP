(() => {
  'use strict';

  const currentPath = window.location.pathname.replace(/\/+$/, '');
  if (!currentPath.endsWith('/lab.html')) return;

  function injectStyles() {
    if (document.getElementById('placementStrategyEntryUiStyle')) return;
    const style = document.createElement('style');
    style.id = 'placementStrategyEntryUiStyle';
    style.textContent = `
      .placement-strategy-entry {
        margin: 0 0 18px;
        padding: 16px 16px 14px;
        border-radius: 16px;
        border: 1px solid rgba(245, 197, 90, .55);
        background: linear-gradient(180deg, rgba(77, 48, 18, .34), rgba(36, 24, 13, .26));
        box-shadow: inset 0 1px 0 rgba(255,255,255,.05), 0 8px 24px rgba(0,0,0,.16);
      }
      .placement-strategy-entry__eyebrow {
        font-size: 11px;
        font-weight: 900;
        letter-spacing: .12em;
        color: #f2c96c;
        margin-bottom: 5px;
      }
      .placement-strategy-entry__title {
        font-size: 19px;
        font-weight: 900;
        color: #fff2c8;
        margin-bottom: 7px;
      }
      .placement-strategy-entry__copy {
        color: #e9edf7;
        font-size: 13px;
        line-height: 1.75;
      }
      .placement-strategy-entry__route {
        margin-top: 10px;
        padding: 9px 11px;
        border-radius: 11px;
        background: rgba(15, 23, 42, .48);
        color: #dbeafe;
        font-size: 12px;
        font-weight: 800;
        line-height: 1.6;
      }
      .placement-strategy-entry__status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 10px;
        padding: 5px 9px;
        border-radius: 999px;
        border: 1px solid rgba(148,163,184,.32);
        color: #cbd5e1;
        font-size: 11px;
        font-weight: 800;
      }
      .placement-strategy-entry__status.ready {
        border-color: rgba(74,222,128,.45);
        color: #bbf7d0;
        background: rgba(22,101,52,.18);
      }
      #placementStrategyLaunchButton {
        background: linear-gradient(180deg, #8b5a2b, #5b3416) !important;
        border: 1px solid #c28a49 !important;
        color: #fff7ed !important;
        box-shadow: inset 0 1px 0 rgba(255,255,255,.12), 0 7px 20px rgba(88,52,22,.28) !important;
      }
    `;
    document.head.appendChild(style);
  }

  function findCapacityHost(input) {
    return input?.closest('.capacity-control-top') || input?.closest('.step') || input?.parentElement || null;
  }

  function updateStatus(input, status) {
    const hasFile = Boolean(input?.files?.length);
    if (!status) return;
    status.classList.toggle('ready', hasFile);
    status.textContent = hasFile
      ? '● KMZ準備完了：下のボタンから軍議画面へ'
      : '○ KMZ待機中';
  }

  function installEntryUi() {
    const input = document.getElementById('capacityFile');
    if (!input) return false;

    const host = findCapacityHost(input);
    if (!host) return false;

    injectStyles();

    let entry = document.getElementById('placementStrategyEntry');
    if (!entry) {
      entry = document.createElement('div');
      entry.id = 'placementStrategyEntry';
      entry.className = 'placement-strategy-entry';
      entry.innerHTML = `
        <div class="placement-strategy-entry__eyebrow">PLACEMENT STRATEGY / LAB</div>
        <div class="placement-strategy-entry__title">🏯 配置戦略・布陣図</div>
        <div class="placement-strategy-entry__copy">
          KMZを読み込むと、50m原則で配置余地を解析し、候補エリアと布陣を比較できます。
        </div>
        <div class="placement-strategy-entry__route">
          KMZを選択 → 下の「配置戦略・布陣図を開く」 → 地図右上で「通常地図 / 布陣図」を切替
        </div>
        <div id="placementStrategyEntryStatus" class="placement-strategy-entry__status">○ KMZ待機中</div>
      `;
      host.insertAdjacentElement('afterbegin', entry);
    }

    const status = document.getElementById('placementStrategyEntryStatus');
    updateStatus(input, status);

    if (input.dataset.placementStrategyEntryBound !== 'true') {
      input.dataset.placementStrategyEntryBound = 'true';
      input.addEventListener('change', () => updateStatus(input, status));
    }

    const button = host.querySelector('button[onclick*="analyzePlacementCapacity"]') ||
      document.querySelector('button[onclick*="analyzePlacementCapacity"]');
    if (button) {
      button.id = 'placementStrategyLaunchButton';
      button.textContent = '🏯 配置戦略・布陣図を開く';
    }

    const empty = document.getElementById('placementResult');
    if (empty && empty.classList.contains('placement-empty')) {
      empty.textContent = 'KMZを読み込むと、配置戦略と布陣図を表示します。';
    }

    return true;
  }

  function waitForUi(attempt = 0) {
    if (installEntryUi()) return;
    if (attempt >= 100) return;
    window.setTimeout(() => waitForUi(attempt + 1), 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForUi(), { once: true });
  } else {
    waitForUi();
  }
})();
