/* 提出KMZ MAP VIEWER: 完成KMZバッジ */
(() => {
  'use strict';

  const list = document.getElementById('kmvRecordList');
  if (!list) return;

  const style = document.createElement('style');
  style.textContent = `
    .kmv-final-badge{
      display:inline-flex;
      align-items:center;
      width:max-content;
      margin-top:7px;
      padding:3px 7px;
      border:1px solid rgba(74,222,128,.42);
      border-radius:999px;
      background:rgba(20,83,45,.46);
      color:#bbf7d0;
      font-size:9px;
      font-weight:900;
      line-height:1.2;
      letter-spacing:.02em;
    }
  `;
  document.head.appendChild(style);

  function isCompletedKmz(fileName) {
    const name = String(fileName || '').normalize('NFKC');
    return /(?:^|[_\-])完成(?:[_\-]|\s).*\.kmz$/i.test(name) || /_完成_[^/\\]+\.kmz$/i.test(name);
  }

  function decorate() {
    list.querySelectorAll('.kmv-record').forEach(card => {
      const existing = card.querySelector('.kmv-final-badge');
      const smalls = card.querySelectorAll('small');
      const fileName = smalls[0]?.textContent?.trim() || '';
      const completed = isCompletedKmz(fileName);

      if (!completed) {
        existing?.remove();
        return;
      }
      if (existing) return;

      const badge = document.createElement('span');
      badge.className = 'kmv-final-badge';
      badge.textContent = '✅ 完成KMZ';
      badge.title = 'CREATIVE MODEの完成出力として生成されたKMZです';
      card.appendChild(badge);
    });
  }

  new MutationObserver(decorate).observe(list, { childList: true, subtree: true });
  decorate();
})();
