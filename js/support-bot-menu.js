document.addEventListener('DOMContentLoaded', function () {
  const root = document.getElementById('campsiteSupportBotRoot');
  if (!root) return;

  const messages = root.querySelector('.support-bot-messages');
  const launcher = root.querySelector('.support-bot-launcher');

  function clearMessages() {
    messages.innerHTML = '';
  }

  function showWelcome() {
    clearMessages();
    const row = document.createElement('div');
    row.className = 'support-bot-row bot';
    const bubble = document.createElement('div');
    bubble.className = 'support-bot-bubble';
    bubble.textContent = 'こんにちは。困っている内容を選んでください。';
    row.appendChild(bubble);
    messages.appendChild(row);
  }

  launcher.addEventListener('click', function () {
    setTimeout(showWelcome, 0);
  });
});