(() => {
  'use strict';

  let installed = false;
  let running = false;

  function ensureOverlay() {
    let overlay = document.getElementById('placementBreakEffect');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'placementBreakEffect';
    overlay.className = 'placement-break-effect';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = `
      <div class="placement-break-effect__shade"></div>
      <div class="placement-break-effect__caption">
        <small>BREAK FORMATION</small>
        <strong>奇襲</strong>
        <span>側面より突入</span>
      </div>
      <div class="placement-break-effect__cavalry" aria-hidden="true">
        <span>🐎</span><span>🐎</span><span>🐎</span><span>🐎</span><span>🐎</span>
      </div>
      <div class="placement-break-effect__dust" aria-hidden="true"></div>
      <div class="placement-break-effect__fire" aria-hidden="true">
        <div class="placement-break-effect__fire-track">
          <span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span><span>🔥</span>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  function setCaption(overlay, title, detail, state) {
    const strong = overlay.querySelector('.placement-break-effect__caption strong');
    const span = overlay.querySelector('.placement-break-effect__caption span');
    if (strong) strong.textContent = title;
    if (span) span.textContent = detail;
    overlay.dataset.outcome = state || '';
  }

  function play(original, context, args) {
    if (running) return;
    running = true;

    const overlay = ensureOverlay();
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const button = document.querySelector('.placement-break-button');
    if (button) button.disabled = true;

    overlay.classList.remove('is-running');
    overlay.dataset.outcome = '';
    setCaption(overlay, '奇襲', '側面より突入', '');
    void overlay.offsetWidth;
    overlay.classList.add('is-running');

    let succeeded = false;
    let capturedAlert = '';

    const onSuccess = () => {
      succeeded = true;
    };
    window.addEventListener('placementstrategy:break', onSuccess, { once: true });

    const executeAt = reduceMotion ? 80 : 620;
    const finishAt = reduceMotion ? 360 : 1850;

    window.setTimeout(() => {
      const nativeAlert = window.alert;
      try {
        window.alert = message => {
          capturedAlert = String(message || '');
        };
        original.apply(context, args);
      } finally {
        window.alert = nativeAlert;
      }

      if (succeeded) {
        setCaption(overlay, '再編成完了', '布陣を更新', 'success');
      } else {
        setCaption(overlay, '突破不能', capturedAlert || '現在の配分では再編成できません', 'blocked');
      }
    }, executeAt);

    window.setTimeout(() => {
      overlay.classList.remove('is-running');
      window.removeEventListener('placementstrategy:break', onSuccess);
      if (button?.isConnected) button.disabled = false;
      running = false;
    }, finishAt);
  }

  function install() {
    if (installed) return true;
    const original = window.runPlacementStrategyBreak;
    if (typeof original !== 'function') return false;

    window.runPlacementStrategyBreak = function placementStrategyBreakWithEffect(...args) {
      return play(original, this, args);
    };

    installed = true;
    ensureOverlay();
    console.info('[Placement Strategy Break Effect] active');
    return true;
  }

  function wait(attempt = 0) {
    if (install()) return;
    if (attempt >= 160) {
      console.warn('[Placement Strategy Break Effect] break action did not become ready.');
      return;
    }
    window.setTimeout(() => wait(attempt + 1), 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => wait(), { once: true });
  } else {
    wait();
  }
})();
