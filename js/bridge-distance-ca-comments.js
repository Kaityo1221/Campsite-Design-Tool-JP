(() => {
  'use strict';

  const PROJECT_KEY = 'campsiteProject.v1';
  const WRAP_FLAG = '__campsiteCaCommentWrapped';

  function readProject() {
    try { return JSON.parse(sessionStorage.getItem(PROJECT_KEY) || 'null'); }
    catch (_) { return null; }
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function addedPois(project) {
    const source = Array.isArray(project?.currentPois) ? project.currentPois : [];
    return source
      .filter(poi => poi?.role === 'added' || String(poi?.layer || '').startsWith('new-'))
      .map(poi => ({
        name: String(poi?.title || poi?.name || '').trim(),
        comment: (Object.prototype.hasOwnProperty.call(poi || {}, 'applicationComment')
          ? String(poi?.applicationComment || '')
          : String(poi?.description || poi?.memo || '')).trim()
      }))
      .filter(item => item.name);
  }

  function uniqueItems(items) {
    const unique = [];
    const seen = new Set();
    items.forEach(item => {
      const key = `${item.name}\n${item.comment}`;
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(item);
    });
    return unique;
  }

  function decoratePairCards(project) {
    const candidates = addedPois(project);
    const cards = Array.from(document.querySelectorAll('#distanceResult .distance-band-card'));

    cards.forEach(card => {
      card.querySelector('.campsite-ca-comment-note')?.remove();
      delete card.dataset.caCommented;
      card.dataset.caConfirmed = 'false';
      if (card.dataset.reference === 'true') return;

      const text = card.textContent || '';
      const matches = uniqueItems(candidates.filter(item =>
        text.includes(`：${item.name}`) || text.includes(item.name)
      ));
      if (!matches.length) return;

      const confirmed = matches.every(item => Boolean(item.comment));
      const missing = matches.filter(item => !item.comment);
      card.dataset.caConfirmed = confirmed ? 'true' : 'false';

      const note = document.createElement('div');
      note.className = 'campsite-ca-comment-note';
      if (confirmed) {
        note.style.cssText = 'margin-top:8px;padding:8px 9px;border-radius:9px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.34);color:#dcfce7;font-size:12px;line-height:1.6';
        note.innerHTML = `<strong style="color:#86efac">✅ CA確認済み</strong>${matches.map(item => `<div style="margin-top:3px">📝 ${esc(item.name)}：${esc(item.comment)}</div>`).join('')}`;
      } else {
        note.style.cssText = 'margin-top:8px;padding:8px 9px;border-radius:9px;background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.38);color:#fef3c7;font-size:12px;line-height:1.6';
        note.innerHTML = `<strong style="color:#fde68a">⚠️ CA確認待ち</strong>${missing.length ? `<div style="margin-top:3px">コメント未入力：${missing.map(item => esc(item.name)).join(' / ')}</div>` : ''}`;
      }
      card.appendChild(note);
    });
  }

  function updateJudgementSummary() {
    const sections = Array.from(document.querySelectorAll('#distanceResult .distance-result-section'));
    const section = sections.find(node => (node.querySelector('.distance-result-heading')?.textContent || '').includes('距離チェック結果'));
    const card = section?.querySelector('.distance-warning');
    if (!card) return;

    card.querySelector('.campsite-ca-comment-summary')?.remove();

    const targetCards = Array.from(document.querySelectorAll('#distanceResult .distance-band-card'))
      .filter(node => node.dataset.reference !== 'true');
    if (!targetCards.length) return;

    const confirmedCount = targetCards.filter(node => node.dataset.caConfirmed === 'true').length;
    const unresolvedCount = Math.max(0, targetCards.length - confirmedCount);
    const allConfirmed = unresolvedCount === 0;

    const summary = document.createElement('div');
    summary.className = 'campsite-ca-comment-summary';
    summary.style.cssText = allConfirmed
      ? 'margin-top:12px;padding:10px 11px;border-radius:10px;background:rgba(34,197,94,.10);border:1px solid rgba(34,197,94,.30);color:#dcfce7;font-size:13px;line-height:1.75'
      : 'margin-top:12px;padding:10px 11px;border-radius:10px;background:rgba(245,158,11,.10);border:1px solid rgba(245,158,11,.34);color:#fef3c7;font-size:13px;line-height:1.75';
    summary.innerHTML = `
      <div><strong>50m未満の候補：${targetCards.length}組</strong></div>
      <div style="color:#86efac">✅ 確認済み：${confirmedCount}組</div>
      <div style="color:${unresolvedCount ? '#fde68a' : '#86efac'}">${unresolvedCount ? '⚠️' : '✅'} 未確認：${unresolvedCount}組</div>
      <div style="margin-top:6px;font-weight:950;color:${allConfirmed ? '#86efac' : '#fde68a'}">${allConfirmed ? '✅ 50m未満の候補はすべて確認済みです' : '⚠️ 確認が必要な候補があります'}</div>
    `;
    card.appendChild(summary);
  }

  function decorate() {
    const project = readProject();
    if (!project || project.source !== 'bridge') return;
    decoratePairCards(project);
    updateJudgementSummary();
  }

  function wrapDistanceCheck() {
    const fn = window.runDistanceCheck;
    if (typeof fn !== 'function' || fn[WRAP_FLAG]) return;
    const wrapped = async function(...args) {
      const result = await fn.apply(this, args);
      setTimeout(decorate, 120);
      return result;
    };
    wrapped[WRAP_FLAG] = true;
    window.runDistanceCheck = wrapped;
  }

  function boot() {
    const params = new URLSearchParams(location.search);
    if (params.get('campsiteProject') !== 'bridge') return;
    wrapDistanceCheck();
    setTimeout(decorate, 180);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
