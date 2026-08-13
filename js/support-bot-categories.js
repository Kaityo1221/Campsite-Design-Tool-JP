document.addEventListener('DOMContentLoaded', function () {
  const root = document.getElementById('campsiteSupportBotRoot');
  if (!root) return;
  const messages = root.querySelector('.support-bot-messages');
  const launcher = root.querySelector('.support-bot-launcher');

  function addChoice(label, category) {
    const first = messages.querySelector('.support-bot-bubble');
    if (!first) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'support-bot-action';
    button.textContent = label;
    button.onclick = function () {
      window.CAMPSITE_SUPPORT_SELECTED_CATEGORY = category;
    };
    first.appendChild(button);
  }

  launcher.addEventListener('click', function () {
    setTimeout(function () {
      addChoice('🧩 Google My Maps・レイヤー', 'mymaps');
      addChoice('📍 POI・スポット', 'poi');
    }, 30);
  });
});