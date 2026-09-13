(() => {
  'use strict';

  function closeScroll() {
    const overlay = document.getElementById('jyunpokoScrollOverlay');
    if (!overlay) return;
    overlay.hidden = true;
    document.body.style.removeProperty('overflow');
  }

  function openScroll() {
    if (document.getElementById('jyunpokoScrollOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'jyunpokoScrollOverlay';
    overlay.className = 'jyunpoko-scroll-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'jyunpokoScrollTitle');
    overlay.innerHTML = `
      <section class="jyunpoko-scroll">
        <div class="jyunpoko-scroll__inner">
          <h2 id="jyunpokoScrollTitle" class="jyunpoko-scroll__title">🏯 じゅんぽこさんへ</h2>

          <div class="jyunpoko-scroll__body">
            <p>
              昨夜のひと言、確かに受け取った。<br>
              配置余地モード、ひと晩にて少し鍛え直しておいた。
            </p>

            <p>
              まずはKMZを読み込み、<br>
              いつものように触ってみてほしい。
            </p>

            <p>
              もし<br>
              <span class="jyunpoko-scroll__formation">🏯 布陣図</span><br>
              なるものを見つけたら、<br>
              どうかそのまま押してみてほしい。
            </p>

            <p>
              不具合、違和感、珍現象は、<br>
              遠慮なく戦況報告願う。
            </p>
          </div>

          <div class="jyunpoko-scroll__sign">
            墨俣一夜城<br>
            二〇二六年九月十四日
          </div>

          <div class="jyunpoko-scroll__seal" aria-hidden="true">風林<br>火山</div><br>
          <button type="button" class="jyunpoko-scroll__close" id="jyunpokoScrollClose">巻物を閉じる</button>
        </div>
      </section>
    `;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    overlay.querySelector('#jyunpokoScrollClose')?.addEventListener('click', closeScroll);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) closeScroll();
    });

    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !overlay.hidden) closeScroll();
    });

    window.setTimeout(() => overlay.querySelector('#jyunpokoScrollClose')?.focus(), 0);
  }

  function install() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', openScroll, { once: true });
    } else {
      openScroll();
    }
  }

  install();
})();
