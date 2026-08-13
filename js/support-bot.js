(function () {
  function mountSupportBot() {
    const root = document.createElement('div');
    root.id = 'campsiteSupportBotRoot';
    root.innerHTML = `
      <button type="button" class="support-bot-launcher">🐑 困った？</button>
      <div class="support-bot-backdrop">
        <section class="support-bot-panel">
          <header class="support-bot-header">
            <div class="support-bot-header-copy">
              <strong>🐑 Campsite Support</strong>
              <small>よくある質問・操作サポート</small>
            </div>
            <button type="button" class="support-bot-close">×</button>
          </header>
          <div class="support-bot-messages"></div>
          <div class="support-bot-composer">
            <input class="support-bot-input" maxlength="2000" placeholder="質問や要望を入力">
            <button type="button" class="support-bot-send">送信</button>
          </div>
        </section>
      </div>`;

    document.body.appendChild(root);
    const backdrop = root.querySelector('.support-bot-backdrop');
    const messages = root.querySelector('.support-bot-messages');

    function addMessage(text, user) {
      const row = document.createElement('div');
      row.className = 'support-bot-row ' + (user ? 'user' : 'bot');
      const bubble = document.createElement('div');
      bubble.className = 'support-bot-bubble';
      bubble.textContent = text;
      row.appendChild(bubble);
      messages.appendChild(row);
    }

    root.querySelector('.support-bot-launcher').addEventListener('click', function () {
      backdrop.classList.add('show');
      if (!messages.children.length) {
        addMessage('こんにちは。Campsite Design ToolのサポートBotです。困っている内容を選んでください。', false);
      }
    });

    root.querySelector('.support-bot-close').addEventListener('click', function () {
      backdrop.classList.remove('show');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountSupportBot);
  } else {
    mountSupportBot();
  }
})();