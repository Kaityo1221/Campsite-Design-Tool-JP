function toggleUpdateLog(event) {
  if (event) {
    event.stopPropagation();
  }

  const log = document.getElementById("updateLog");

  if (!log) {
    alert("更新履歴が見つかりません");
    return;
  }

  log.style.display =
    log.style.display === "block" ? "none" : "block";
}

function toggleRenameGuide() {
  const guide = document.getElementById("renameGuide");

  if (!guide) {
    return;
  }

  guide.style.display =
    guide.style.display === "block" ? "none" : "block";
}

function openTab(tabId, button) {
  document.querySelectorAll(".tab-content").forEach(tab => {
    tab.classList.remove("active");
  });

  document.querySelectorAll(".tab-button").forEach(btn => {
    btn.classList.remove("active");
  });

  const targetTab = document.getElementById(tabId);

  if (targetTab) {
    targetTab.classList.add("active");
  }

  if (button && button.classList) {
    button.classList.add("active");
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function showScriptFlow(device, selectedButton) {
  // すべての端末別フローを非表示にする
  document.querySelectorAll(".script-flow").forEach(flow => {
    flow.classList.remove("active");
  });

  // すべての端末カードから選択状態を外す
  document.querySelectorAll(".script-device-card").forEach(card => {
    card.classList.remove("selected");
  });

  // 選択した端末に対応するフローを指定する
  const flowMap = {
    pc: "scriptFlowPc",
    iphone: "scriptFlowIphone",
    android: "scriptFlowAndroid"
  };

  const targetId = flowMap[device];
  const targetFlow = document.getElementById(targetId);

  // 選択した端末のフローを表示する
  if (targetFlow) {
    targetFlow.classList.add("active");
  }

  // 選択した端末カードだけを光らせる
  if (selectedButton && selectedButton.classList) {
    selectedButton.classList.add("selected");
  }
}