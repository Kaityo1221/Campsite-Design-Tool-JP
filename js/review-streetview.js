(() => {
  const metaBox = document.getElementById('metaBox');
  if (!metaBox) return;

  const enhanceMeta = () => {
    const rows = [...metaBox.querySelectorAll('.meta-row')];
    const coordinateRow = rows.find(row => row.querySelector('b')?.textContent.trim() === '座標');
    const mapRow = rows.find(row => row.querySelector('b')?.textContent.trim() === '地図');
    if (!coordinateRow) return;

    const valueEl = coordinateRow.querySelector('span');
    const raw = valueEl?.textContent || '';
    const match = raw.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
    if (!match) return;

    const lat = match[1];
    const lng = match[2];
    const coordinates = `${lat},${lng}`;
    valueEl.textContent = coordinates;

    if (!coordinateRow.querySelector('.coordinate-copy-btn')) {
      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'coordinate-copy-btn';
      copyBtn.textContent = 'コピー';
      copyBtn.style.marginLeft = '10px';
      copyBtn.style.padding = '5px 10px';
      copyBtn.style.borderRadius = '999px';
      copyBtn.style.border = '1px solid #cbd5e1';
      copyBtn.style.background = '#fff';
      copyBtn.style.cursor = 'pointer';
      copyBtn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(coordinates);
          copyBtn.textContent = 'コピー済み';
          setTimeout(() => { copyBtn.textContent = 'コピー'; }, 1200);
        } catch (_) {
          const ta = document.createElement('textarea');
          ta.value = coordinates;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          copyBtn.textContent = 'コピー済み';
          setTimeout(() => { copyBtn.textContent = 'コピー'; }, 1200);
        }
      });
      coordinateRow.appendChild(copyBtn);
    }

    if (mapRow) {
      const link = mapRow.querySelector('a');
      if (link) {
        link.href = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${encodeURIComponent(coordinates)}`;
        link.textContent = '道路をStreet Viewで確認';
        link.setAttribute('aria-label', `座標 ${coordinates} 周辺の道路をStreet Viewで確認`);
      }
    }
  };

  const observer = new MutationObserver(enhanceMeta);
  observer.observe(metaBox, { childList: true, subtree: true });
  enhanceMeta();
})();
