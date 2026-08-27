(()=>{
  'use strict';

  // Temporary direct-contact mode.
  // The FAQ / guided support implementation remains in the repository and can
  // be re-enabled later. For now, tapping "困った？" shows only "会長にDM".
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

  function setComposerVisible(root, visible){
    const composer = root.querySelector('.support-bot-composer');
    if(composer) composer.style.display = visible ? '' : 'none';
  }

  function renderDirectOnly(root){
    const messages = root.querySelector('.support-bot-messages');
    const input = root.querySelector('.support-bot-input');
    if(!messages) return;

    directMode = false;
    sending = false;
    messages.innerHTML = '';
    if(input){
      input.value = '';
      input.placeholder = '会長へのDMを入力';
    }
    setComposerVisible(root, false);

    const actions = document.createElement('div');
    actions.className = 'support-bot-actions support-direct-only-actions';
    actions.style.justifyContent = 'center';
    actions.style.padding = '18px 10px';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'support-bot-action purple';
    button.dataset.directContactOnly = '1';
    button.textContent = '会長にDM';

    actions.appendChild(button);
    messages.appendChild(actions);
  }

  function startDirect(root){
    const messages = root.querySelector('.support-bot-messages');
    const input = root.querySelector('.support-bot-input');
    if(!messages || !input) return;

    directMode = true;
    messages.innerHTML = '';
    addMessage(messages, '困っている内容を入力してください。会長に直接届きます。', false);
    setComposerVisible(root, true);
    input.focus();
  }

  async function sendDirect(root){
    if(sending || !directMode) return;

    const messages = root.querySelector('.support-bot-messages');
    const input = root.querySelector('.support-bot-input');
    if(!messages || !input) return;

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
      resolved: false,
      app_version: window.APP_VERSION || null,
      status: 'new'
    });

    if(error){
      console.warn('direct support send error:', error);
      addMessage(messages, '送信に失敗しました。もう一度お試しください。', false);
      sending = false;
      return;
    }

    addMessage(messages, '会長へ送信しました。確認までお待ちください。', false);
    directMode = false;
    sending = false;
    setComposerVisible(root, false);
  }

  function init(){
    const root = document.getElementById('campsiteSupportBotRoot');
    if(!root || root.dataset.directContactOnlyReady === '1') return false;

    const launcher = root.querySelector('.support-bot-launcher');
    const backdrop = root.querySelector('.support-bot-backdrop');
    const send = root.querySelector('.support-bot-send');
    const input = root.querySelector('.support-bot-input');
    if(!launcher || !backdrop || !send || !input) return false;

    root.dataset.directContactOnlyReady = '1';

    // Capture first so the existing FAQ/menu listeners remain preserved but
    // do not run while this temporary direct-only mode is enabled.
    root.addEventListener('click', (event) => {
      const button = event.target.closest('button');
      if(!button) return;

      if(button === launcher){
        event.preventDefault();
        event.stopImmediatePropagation();
        backdrop.classList.add('show');
        renderDirectOnly(root);
        return;
      }

      if(button.dataset.directContactOnly === '1'){
        event.preventDefault();
        event.stopImmediatePropagation();
        startDirect(root);
        return;
      }

      if(button === send && directMode){
        event.preventDefault();
        event.stopImmediatePropagation();
        sendDirect(root);
      }
    }, true);

    root.addEventListener('keydown', (event) => {
      if(!directMode || event.target !== input || event.key !== 'Enter') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      sendDirect(root);
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
