(() => {
  'use strict';

  const VERSION = '1.0.0';
  const MANUAL_DEVICE_KEY = 'campsiteBridgeSetup.manualDevice.v1';
  const VALID_DEVICES = new Set(['apple', 'android', 'pc']);

  const CONFIG = Object.freeze({
    appleShortcutUrl: '',
    androidExtensionUrl: '',
    firefoxAndroidUrl: 'https://play.google.com/store/apps/details?id=org.mozilla.firefox',
    wayfarerUrl: 'https://wayfarer.nianticlabs.com/new/'
  });

  function text(value) {
    return String(value == null ? '' : value);
  }

  function detectDevice(nav = window.navigator) {
    const ua = text(nav?.userAgent);
    const uaPlatform = text(nav?.userAgentData?.platform);
    const platform = text(nav?.platform || uaPlatform);
    const touchPoints = Number(nav?.maxTouchPoints || 0);

    const isIPad =
      /iPad/i.test(ua) ||
      (platform === 'MacIntel' && touchPoints > 1);

    const isIPhone = /iPhone|iPod/i.test(ua);
    if (isIPad || isIPhone) return 'apple';

    const isAndroid = /Android/i.test(ua) || /Android/i.test(uaPlatform);
    if (isAndroid) return 'android';

    return 'pc';
  }

  function detectBrowser(device, nav = window.navigator) {
    const ua = text(nav?.userAgent);
    if (device === 'apple') {
      const alternate = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA|Discord/i.test(ua);
      const safari = /Safari/i.test(ua) && !alternate;
      return safari ? 'safari' : 'other';
    }
    if (device === 'android') {
      return /Firefox\//i.test(ua) ? 'firefox' : 'other';
    }
    return 'desktop';
  }

  function readManualDevice() {
    try {
      const value = localStorage.getItem(MANUAL_DEVICE_KEY);
      return VALID_DEVICES.has(value) ? value : null;
    } catch (_) {
      return null;
    }
  }

  function writeManualDevice(device) {
    try {
      if (VALID_DEVICES.has(device)) localStorage.setItem(MANUAL_DEVICE_KEY, device);
      else localStorage.removeItem(MANUAL_DEVICE_KEY);
    } catch (_) {}
  }

  const LABELS = {
    apple: {
      icon: '🍎',
      detected: 'iPhone / iPadを検出しました',
      title: 'Campsite Bridgeを設定します。',
      browser: 'Safari',
      start: 'セットアップを開始'
    },
    android: {
      icon: '🤖',
      detected: 'Androidを検出しました',
      title: 'Campsite Bridgeを設定します。',
      browser: 'Firefox',
      start: 'セットアップを開始'
    },
    pc: {
      icon: '💻',
      detected: 'PCを検出しました',
      title: 'Campsite Bridge PC版',
      browser: 'PC',
      start: '詳細を見る'
    }
  };

  function setHref(id, url, unavailableText) {
    const element = document.getElementById(id);
    if (!element) return;
    const ready = Boolean(url);
    element.classList.toggle('is-disabled', !ready);
    element.setAttribute('aria-disabled', ready ? 'false' : 'true');
    if (ready) {
      element.href = url;
      element.removeAttribute('data-unavailable');
    } else {
      element.removeAttribute('href');
      element.dataset.unavailable = unavailableText || '準備中です';
    }
  }

  function configureLinks() {
    setHref('appleShortcutLink', CONFIG.appleShortcutUrl, 'ショートカットの公開準備中です');
    setHref('androidFirefoxLink', CONFIG.firefoxAndroidUrl, 'Firefoxの案内を準備中です');
    setHref('androidExtensionLink', CONFIG.androidExtensionUrl, 'Firefox版Campsite Bridgeの公開準備中です');
    setHref('appleWayfarerLink', CONFIG.wayfarerUrl, 'Wayfarerを開けません');
    setHref('androidWayfarerLink', CONFIG.wayfarerUrl, 'Wayfarerを開けません');
  }

  function showUnavailableMessage(element) {
    const message = text(element?.dataset?.unavailable || '準備中です');
    const status = document.getElementById('bridgeSetupStatus');
    if (!status) return;
    status.textContent = `ℹ️ ${message}`;
    status.hidden = false;
  }

  function render(device, source = 'auto') {
    const label = LABELS[device] || LABELS.pc;
    const browser = detectBrowser(device);

    document.querySelectorAll('[data-device-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.devicePanel !== device;
    });
    document.querySelectorAll('[data-device-choice]').forEach((button) => {
      const selected = button.dataset.deviceChoice === device;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', selected ? 'true' : 'false');
    });

    const icon = document.getElementById('detectedIcon');
    const detected = document.getElementById('detectedTitle');
    const description = document.getElementById('detectedDescription');
    const browserName = document.getElementById('recommendedBrowser');
    const sourceBadge = document.getElementById('deviceSourceBadge');
    const browserNotice = document.getElementById('browserNotice');
    const startButton = document.getElementById('setupStartButton');

    if (icon) icon.textContent = label.icon;
    if (detected) detected.textContent = label.detected;
    if (description) description.textContent = label.title;
    if (browserName) browserName.textContent = label.browser;
    if (sourceBadge) sourceBadge.textContent = source === 'manual' ? '手動選択' : '自動判定';
    if (startButton) startButton.textContent = label.start;

    if (browserNotice) {
      browserNotice.hidden = true;
      browserNotice.textContent = '';
      if (device === 'apple' && browser !== 'safari') {
        browserNotice.textContent = 'この端末はApple端末です。セットアップとWayfarerの利用はSafariで進めてください。';
        browserNotice.hidden = false;
      } else if (device === 'android' && browser !== 'firefox') {
        browserNotice.textContent = 'この端末はAndroidです。セットアップとWayfarerの利用はFirefoxで進めてください。';
        browserNotice.hidden = false;
      }
    }

    document.body.dataset.bridgeDevice = device;
    document.body.dataset.bridgeDeviceSource = source;
    window.CampsiteBridgeSetupState = Object.freeze({ version: VERSION, device, source, browser });
  }

  function openCurrentFlow() {
    const panel = document.querySelector('[data-device-panel]:not([hidden])');
    if (!panel) return;
    panel.classList.add('started');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bind() {
    document.querySelectorAll('[data-device-choice]').forEach((button) => {
      button.addEventListener('click', () => {
        const device = button.dataset.deviceChoice;
        if (!VALID_DEVICES.has(device)) return;
        writeManualDevice(device);
        render(device, 'manual');
      });
    });

    document.getElementById('resetDeviceDetection')?.addEventListener('click', () => {
      writeManualDevice(null);
      render(detectDevice(), 'auto');
    });

    document.getElementById('setupStartButton')?.addEventListener('click', openCurrentFlow);

    document.addEventListener('click', (event) => {
      const target = event.target.closest('a.is-disabled');
      if (!target) return;
      event.preventDefault();
      showUnavailableMessage(target);
    });
  }

  function init() {
    configureLinks();
    bind();
    const manual = readManualDevice();
    render(manual || detectDevice(), manual ? 'manual' : 'auto');
  }

  window.CampsiteBridgeSetup = Object.freeze({
    version: VERSION,
    detectDevice,
    detectBrowser,
    clearManualDevice() {
      writeManualDevice(null);
      render(detectDevice(), 'auto');
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
