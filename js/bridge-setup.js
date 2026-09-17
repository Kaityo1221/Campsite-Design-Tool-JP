(() => {
  'use strict';

  const VERSION = '1.1.0';
  const MANUAL_DEVICE_KEY = 'campsiteBridgeSetup.manualDevice.v1';
  const VALID_DEVICES = new Set(['apple', 'android', 'pc']);
  const CONFIG = Object.freeze({
    appleShortcutUrl: '',
    appleManualSetupUrl: './bridge-shortcut-install.html',
    appleRuntimeVersion: '1.0.0',
    androidExtensionUrl: '',
    firefoxAndroidUrl: 'https://play.google.com/store/apps/details?id=org.mozilla.firefox',
    wayfarerUrl: 'https://wayfarer.nianticlabs.com/new/',
    ...(window.CampsiteBridgeSetupConfig || {})
  });

  const text = value => String(value == null ? '' : value);

  function detectDevice(nav = navigator) {
    const ua = text(nav?.userAgent);
    const platform = text(nav?.platform || nav?.userAgentData?.platform);
    const touchPoints = Number(nav?.maxTouchPoints || 0);
    const isIPad = /iPad/i.test(ua) || (platform === 'MacIntel' && touchPoints > 1);
    if (isIPad || /iPhone|iPod/i.test(ua)) return 'apple';
    if (/Android/i.test(ua) || /Android/i.test(text(nav?.userAgentData?.platform))) return 'android';
    return 'pc';
  }

  function detectBrowser(device, nav = navigator) {
    const ua = text(nav?.userAgent);
    if (device === 'apple') {
      const alternate = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|Discord/i.test(ua);
      return /Safari/i.test(ua) && !alternate ? 'safari' : 'other';
    }
    if (device === 'android') return /Firefox\//i.test(ua) ? 'firefox' : 'other';
    return 'desktop';
  }

  function isValidAppleShortcutUrl(value) {
    const candidate = text(value).trim();
    if (!candidate) return false;
    try {
      const url = new URL(candidate);
      return url.protocol === 'https:' && /(^|\.)icloud\.com$/i.test(url.hostname) && /^\/shortcuts\/[^/?#]+\/?$/i.test(url.pathname);
    } catch (_) {
      return false;
    }
  }

  function readManualDevice() {
    try {
      const value = localStorage.getItem(MANUAL_DEVICE_KEY);
      return VALID_DEVICES.has(value) ? value : null;
    } catch (_) { return null; }
  }

  function writeManualDevice(device) {
    try {
      if (VALID_DEVICES.has(device)) localStorage.setItem(MANUAL_DEVICE_KEY, device);
      else localStorage.removeItem(MANUAL_DEVICE_KEY);
    } catch (_) {}
  }

  function setLink(id, url, { disabledText = '準備中です', label } = {}) {
    const element = document.getElementById(id);
    if (!element) return;
    if (label) element.textContent = label;
    if (url) {
      element.href = url;
      element.classList.remove('is-disabled');
      element.setAttribute('aria-disabled', 'false');
      element.removeAttribute('data-unavailable');
    } else {
      element.removeAttribute('href');
      element.classList.add('is-disabled');
      element.setAttribute('aria-disabled', 'true');
      element.dataset.unavailable = disabledText;
    }
  }

  function configureLinks() {
    const shortcutReady = isValidAppleShortcutUrl(CONFIG.appleShortcutUrl);
    setLink(
      'appleShortcutLink',
      shortcutReady ? text(CONFIG.appleShortcutUrl).trim() : CONFIG.appleManualSetupUrl,
      { label: shortcutReady ? 'ショートカットを追加' : 'ショートカットを設定' }
    );

    const appleVersion = document.getElementById('appleVersion');
    if (appleVersion) appleVersion.textContent = `正式版 ${CONFIG.appleRuntimeVersion}`;

    setLink('androidFirefoxLink', CONFIG.firefoxAndroidUrl, { disabledText: 'Firefoxの案内を準備中です' });

    const android = document.getElementById('androidExtensionLink');
    if (android) {
      android.href = CONFIG.androidExtensionUrl || '#androidXpiSteps';
      android.textContent = CONFIG.androidExtensionUrl ? 'Campsite Bridgeを導入' : '導入手順を見る';
      if (CONFIG.androidExtensionUrl) {
        android.target = '_blank';
        android.rel = 'noopener';
      }
    }

    setLink('appleWayfarerLink', CONFIG.wayfarerUrl);
    setLink('androidWayfarerLink', CONFIG.wayfarerUrl);
  }

  const LABELS = {
    apple: ['🍎', 'iPhone / iPadを検出しました', 'Campsite Bridgeを設定します。', 'Safari', 'セットアップを開始'],
    android: ['🤖', 'Androidを検出しました', 'Campsite Bridgeを設定します。', 'Firefox', 'セットアップを開始'],
    pc: ['💻', 'PCを検出しました', 'Campsite Bridge PC版', 'PC', '詳細を見る']
  };

  function render(device, source = 'auto') {
    const [icon, title, description, browserName, startLabel] = LABELS[device] || LABELS.pc;
    const browser = detectBrowser(device);

    document.querySelectorAll('[data-device-panel]').forEach(panel => {
      panel.hidden = panel.dataset.devicePanel !== device;
    });
    document.querySelectorAll('[data-device-choice]').forEach(button => {
      const selected = button.dataset.deviceChoice === device;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });

    document.getElementById('detectedIcon').textContent = icon;
    document.getElementById('detectedTitle').textContent = title;
    document.getElementById('detectedDescription').textContent = description;
    document.getElementById('recommendedBrowser').textContent = browserName;
    document.getElementById('deviceSourceBadge').textContent = source === 'manual' ? '手動選択' : '自動判定';
    document.getElementById('setupStartButton').textContent = startLabel;

    const notice = document.getElementById('browserNotice');
    notice.hidden = true;
    notice.textContent = '';
    if (device === 'apple' && browser !== 'safari') {
      notice.textContent = 'この端末はApple端末です。セットアップとWayfarerの利用はSafariで進めてください。';
      notice.hidden = false;
    } else if (device === 'android' && browser !== 'firefox') {
      notice.textContent = 'この端末はAndroidです。セットアップとWayfarerの利用はFirefoxで進めてください。';
      notice.hidden = false;
    }

    document.body.dataset.bridgeDevice = device;
    document.body.dataset.bridgeDeviceSource = source;
    window.CampsiteBridgeSetupState = Object.freeze({ version: VERSION, device, source, browser });
  }

  function bind() {
    document.querySelectorAll('[data-device-choice]').forEach(button => {
      button.addEventListener('click', () => {
        const device = button.dataset.deviceChoice;
        if (!VALID_DEVICES.has(device)) return;
        writeManualDevice(device);
        render(device, 'manual');
      });
    });

    document.getElementById('resetDeviceDetection').addEventListener('click', () => {
      writeManualDevice(null);
      render(detectDevice(), 'auto');
    });

    document.getElementById('setupStartButton').addEventListener('click', () => {
      const panel = document.querySelector('[data-device-panel]:not([hidden])');
      if (!panel) return;
      panel.classList.add('started');
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    document.addEventListener('click', event => {
      const target = event.target.closest('a.is-disabled');
      if (!target) return;
      event.preventDefault();
      const status = document.getElementById('bridgeSetupStatus');
      status.hidden = false;
      status.textContent = `ℹ️ ${target.dataset.unavailable || '準備中です'}`;
    });
  }

  function init() {
    configureLinks();
    bind();
    const manual = readManualDevice();
    render(manual || detectDevice(), manual ? 'manual' : 'auto');
  }

  window.CampsiteBridgeSetup = Object.freeze({ version: VERSION, detectDevice, detectBrowser, isValidAppleShortcutUrl });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
