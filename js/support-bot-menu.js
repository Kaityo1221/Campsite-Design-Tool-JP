document.addEventListener('DOMContentLoaded', function () {
  const root = document.getElementById('campsiteSupportBotRoot');
  if (!root) return;
  const messages = root.querySelector('.support-bot-messages');
  const launcher = root.querySelector('.support-bot-launcher');
  const input = root.querySelector('.support-bot-input');
  const send = root.querySelector('.support-bot-send');
  const faqs = Array.isArray(window.CAMPSITE_SUPPORT_FAQS) ? window.CAMPSITE_SUPPORT_FAQS : [];
  const labels = {wayfarer:'🗺️ Wayfarer Map',poi:'📍 POI・スポット',mymaps:'🧩 Google My Maps・レイヤー',file:'📁 CSV・KMZ・ファイル',distance:'📏 距離チェック・結果',other:'🛠️ 不具合・その他'};
  let category = null;
  let currentFaq = null;
  let improvementMode = false;

  function sessionId() {
    const key = 'campsite_support_session_id';
    let id = localStorage.getItem(key);
    if (!id) {
      id = 'cs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, id);
    }
    return id;
  }

  async function save(data) {
    if (!window.campsiteSupabase) return false;
    const row = {
      session_id: sessionId(),
      feedback_type: data.type || 'question',
      category: data.category || 'other',
      content: String(data.content || '').slice(0, 2000),
      faq_id: data.faq_id || null,
      resolved: typeof data.resolved === 'boolean' ? data.resolved : null,
      app_version: window.APP_VERSION || null,
      status: 'new'
    };
    const result = await window.campsiteSupabase.from('ca_feedback').insert(row);
    if (result.error) {
      console.warn('support feedback error', result.error.message);
      return false;
    }
    return true;
  }

  function add(text, user, buttons) {
    const row = document.createElement('div');
    row.className = 'support-bot-row ' + (user ? 'user' : 'bot');
    const bubble = document.createElement('div');
    bubble.className = 'support-bot-bubble';
    bubble.textContent = text;
    if (buttons && buttons.length) {
      const actions = document.createElement('div');
      actions.className = 'support-bot-actions';
      buttons.forEach(item => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'support-bot-action' + (item.kind ? ' ' + item.kind : '');
        button.textContent = item.label;
        button.addEventListener('click', item.onClick);
        actions.appendChild(button);
      });
      bubble.appendChild(actions);
    }
    row.appendChild(bubble);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  function home() {
    messages.innerHTML = '';
    category = null;
    currentFaq = null;
    improvementMode = false;
    const buttons = Object.keys(labels).map(key => ({label: labels[key], onClick: () => showCategory(key)}));
    buttons.push({label:'💡 改善・要望を送る', kind:'purple', onClick:startImprovement});
    add('こんにちは。困っている内容を選んでください。\n一覧にない質問は下の入力欄から送れます。', false, buttons);
  }

  function showCategory(key) {
    category = key;
    currentFaq = null;
    improvementMode = false;
    add(labels[key], true);
    const list = faqs.filter(item => item.c === key);
    const buttons = list.map(item => ({label:item.q, onClick:() => showFaq(item)}));
    buttons.push({label:'← 最初に戻る', onClick:home});
    add(list.length ? '近い質問を選んでください。' : 'このカテゴリは準備中です。入力欄から質問を送ってください。', false, buttons);
  }

  function showFaq(faq) {
    currentFaq = faq;
    category = faq.c;
    add(faq.q, true);
    add(faq.a, false, [
      {label:'解決した 👍', kind:'good', onClick:() => rate(true)},
      {label:'解決しなかった 👎', kind:'bad', onClick:() => rate(false)},
      {label:'別の質問を見る', onClick:() => showCategory(faq.c)}
    ]);
  }

  async function rate(resolved) {
    if (!currentFaq) return;
    const faq = currentFaq;
    await save({type:'question', category:faq.c, faq_id:faq.id, resolved, content:(resolved ? 'FAQ回答で解決: ' : 'FAQ回答で解決しなかった: ') + faq.q});
    if (resolved) {
      add('よかった！記録しました。🐑', false, [{label:'最初に戻る', onClick:home}]);
    } else {
      input.focus();
      add('了解です。どこで詰まったか入力してください。質問として保存して改善に使います。', false);
    }
  }

  function startImprovement() {
    improvementMode = true;
    category = 'other';
    currentFaq = null;
    add('改善してほしいこと、新機能のアイデア、分かりづらかったところを入力してください。', false);
    input.focus();
  }

  async function submitText() {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    add(text, true);
    const ok = await save({type:improvementMode ? 'improvement' : 'question', category:category || 'other', faq_id:currentFaq ? currentFaq.id : null, resolved:currentFaq ? false : null, content:text});
    add(ok ? (improvementMode ? 'ありがとう。要望として受け付けました。今後の改修候補に入れます。' : '質問を受け付けました。FAQ改善に使います。') : '送信に失敗しました。通信状況を確認してもう一度送ってください。', false, [{label:'最初に戻る', onClick:home}]);
    improvementMode = false;
    currentFaq = null;
  }

  launcher.addEventListener('click', function () { setTimeout(home, 0); });
  send.addEventListener('click', submitText);
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); submitText(); } });
});