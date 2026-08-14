(()=>{
  'use strict';

  let directMode = false;
  let sending = false;

  function sessionId(){
    let id = localStorage.getItem('campsite_support_session_id');
    if(!id){
      id = 'cs_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10);
      localStorage.setItem('campsite_support_session_id', id);
    }
    return id;
  }

  function avatar(user){
    const a = document.createElement(user ? 'span' : 'img');
    a.className = 'support-bot-avatar ' + (user ? 'you' : 'ren');
    if(user){
      a.textContent = 'YOU';
    }else{
      a.src = 'assets/ren_normal.png';
      a.alt = 'レン';
      a.onerror = () => { a.style.display = 'none'; };
    }
    return a;
  }

  function addMessage(messages, text, user=false){
    const row = document.createElement('div');
    row.className = 'support-bot-row ' + (user ? 'user' : 'bot');
    const bubble = document.createElement('div');
    bubble.className = 'support-bot-bubble';
    bubble.textContent = text;
    if(user){
      row.appendChild(bubble);
      row.appendChild(avatar(true));
    }else{
      row.appendChild(avatar(false));
      row.appendChild(bubble);
    }
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  async function sendDirect(messages, input){
    if(sending) return;
    const text = String(input.value || '').trim();
    if(!text){
      addMessage(messages, '困っている内容を入力してください。', false);
      input.focus();
      return;
    }

    sending = true;
    input.value = '';
    addMessage(messages, text, true);

    if(!window.campsiteSupabase){
      addMessage(messages, '送信機能を利用できません。通信状況を確認して、もう一度お試しください。', false);
      sending = false;
      return;
    }

    const { error } = await window.campsiteSupabase.from('ca_feedback').insert({
      session_id: sessionId(),
      feedback_type: 'question',
      category: 'other',
      content: text.slice(0, 2000),
      bot_source: 'direct_contact',
      flow_path: 'home > direct_contact',
      resolved: false,
      app_version: window.APP_VERSION || null,
      status: 'new'
    });

    if(error){
      console.warn('direct support send error:', error.message);
      addMessage(messages, '送信に失敗しました。通信状況を確認して、もう一度お試しください。', false);
      sending = false;
      return;
    }

    addMessage(messages, '会長へ送信しました。確認までお待ちください。', false);
    directMode = false;
    sending = false;
  }

  function init(){
    const root = document.getElementById('campsiteSupportBotRoot');
    if(!root || root.dataset.directContactReady === '1') return false;

    const messages = root.querySelector('.support-bot-messages');
    const input = root.querySelector('.support-bot-input');
    const send = root.querySelector('.support-bot-send');
    if(!messages || !input || !send) return false;

    root.dataset.directContactReady = '1';

    function ensureButton(){
      const actionGroups = [...messages.querySelectorAll('.support-bot-actions')];
      const homeGroup = actionGroups.find(group =>
        [...group.querySelectorAll('.support-bot-action')].some(btn => btn.textContent.trim() === '改善・要望を送る')
      );
      if(!homeGroup || homeGroup.querySelector('[data-direct-contact]')) return;

      const improvement = [...homeGroup.querySelectorAll('.support-bot-action')]
        .find(btn => btn.textContent.trim() === '改善・要望を送る');
      if(!improvement) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'support-bot-action';
      button.dataset.directContact = '1';
      button.textContent = 'チャットしても操作が分からない時';
      button.addEventListener('click', () => {
        directMode = true;
        addMessage(messages, 'チャットしても操作が分からない時', true);
        addMessage(messages, '会長に直接DMが届きます。困っている内容を入力してください。', false);
        input.focus();
      });
      homeGroup.insertBefore(button, improvement);
    }

    const observer = new MutationObserver(ensureButton);
    observer.observe(messages, { childList: true, subtree: true });
    ensureButton();

    root.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if(!button) return;
      if(button.dataset.directContact === '1' || button === send) return;
      if(directMode) directMode = false;
    }, true);

    send.addEventListener('click', (event) => {
      if(!directMode) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      sendDirect(messages, input);
    }, true);

    input.addEventListener('keydown', (event) => {
      if(!directMode || event.key !== 'Enter') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      sendDirect(messages, input);
    }, true);

    return true;
  }

  if(!init()){
    const timer = setInterval(() => {
      if(init()) clearInterval(timer);
    }, 100);
    setTimeout(() => clearInterval(timer), 10000);
  }
})();
