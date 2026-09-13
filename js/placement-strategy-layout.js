(() => {
  'use strict';

  const currentPath = window.location.pathname.replace(/\/+$/, '');
  if (!currentPath.endsWith('/lab.html')) return;

  function installLayout() {
    const result = document.getElementById('capacityResult');
    const compare = document.getElementById('capacityMapCompare');
    if (!result || !compare) return false;

    let section = document.getElementById('placementStrategyFinalPreview');
    if (!section) {
      section = document.createElement('section');
      section.id = 'placementStrategyFinalPreview';
      section.className = 'placement-strategy-final-preview';
      section.innerHTML = `
        <div class="capacity-section-title">3. 最終的な候補配置をプレビュー</div>
        <p class="note placement-strategy-final-preview__lead">
          現在地図と候補地図を並べて、最終的な配置イメージを確認します。
        </p>
      `;
      result.insertAdjacentElement('afterend', section);
    }

    if (compare.parentElement !== section) {
      section.appendChild(compare);
    }

    const titles = compare.querySelectorAll('.capacity-map-card .capacity-section-title');
    if (titles[0]) titles[0].textContent = '現在地図';
    if (titles[1]) titles[1].textContent = '候補地図';

    if (!document.getElementById('placementStrategyFinalPreviewStyle')) {
      const style = document.createElement('style');
      style.id = 'placementStrategyFinalPreviewStyle';
      style.textContent = `
        .placement-strategy-final-preview {
          margin-top: 20px;
        }
        .placement-strategy-final-preview__lead {
          margin: 8px 0 12px;
        }
        .placement-strategy-final-preview .capacity-map-compare {
          margin-top: 12px;
        }
      `;
      document.head.appendChild(style);
    }

    return true;
  }

  function waitForLayout(attempt = 0) {
    if (installLayout()) return;
    if (attempt >= 100) return;
    window.setTimeout(() => waitForLayout(attempt + 1), 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => waitForLayout(), { once: true });
  } else {
    waitForLayout();
  }
})();
