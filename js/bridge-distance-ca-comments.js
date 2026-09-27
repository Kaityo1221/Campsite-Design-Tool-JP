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

  function commentedAddedPois(project) {
    const source = Array.isArray(project?.currentPois) ? project.currentPois : [];
    return source
      .filter(poi => poi?.role === 'added' || String(poi?.layer || '').startsWith('new-'))
      .map(poi => ({
        name: String(poi?.title || poi?.name || '').trim(),
        comment: String(poi?.description || poi?.memo || '').trim()
      }))
      .filter(item => item.name && item.comment);
  }

  function decoratePairCards(project) {
    const commented = commentedAddedPois(project);
    const cards = Array.from(document.querySelectorAll('#distanceResult .distance-band-card'));

    cards.forEach(card => {
      card.querySelector('.campsite-ca-comment-note')?.remove();
      card.dataset.caCommented = 'false';
      if (card.dataset.reference === 'true') return;

      const text = card.textContent || '';
      const matches = commented.filter(item =>
        text.includes(`：${item.name}`) || text.includes(item.name)
      );
      if (!matches.length) return;

      const unique = [];
      const seen = new Set();
      matches.forEach(item => {
        const key = `${item.name}\n${item.comment}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }
      });

      card.dataset.caCommented = 'true';
      const note = document.createElement('div');
      note.className = 'campsite-ca-comment-note';
      note.style.cssText = 'margin-top:8px;padding:8px 9px;border-radius:9px;background:rgba(34,197,94,.12);border:1px solid rgba(34,197,94,.34);color:#dcfce7;font-size:12px;line-height:1.6';
      note.innerHTML = `<strong style="color:#86efac">📝 CAコメント付き</strong>${unique.map(item => `<div style="margin-top:3px">${esc(item.name)}：${esc(item.comment)}</div>`).join('')}`;
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
    const commentedCount = targetCards.filter(node => node.dataset.caCommented === 'true').length;
    if (!commentedCount) return;

    const unresolvedCount = Math.max(0, targetCards.length - commentedCount);
    const summary = document.createElement('div');
    summary.className = 'campsite-ca-comment-summary';
    summary.style.cssText = 'margin-top:12px;padding:9px 10px;border-radius:10px;background:rgba(34,197,94,.10);border:1px solid rgba(34,197,94,.28);color:#dcfce7;font-size:13px;line-height:1.65';
    summary.innerHTML = `<strong style="color:#86efac">📝 うちCAコメント付き：${commentedCount}組</strong><br>${unresolvedCount === 0 ? '50m未満の対象ペアはCAコメントで確認済みです。結果には記録として残します。' : `コメント未入力：${unresolvedCount}組`}`;
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
