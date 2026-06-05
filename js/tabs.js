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
function showScriptFlow(device) {
  // すべての端末別フローをいったん非表示にする
  document.querySelectorAll(".script-flow").forEach(flow => {
    flow.classList.remove("active");
  });

  // 端末名と表示対象のIDを対応させる
  const flowMap = {
    pc: "scriptFlowPc",
    iphone: "scriptFlowIphone",
    android: "scriptFlowAndroid"
  };

  // 選択された端末のフローだけを表示する
  const targetId = flowMap[device];
  const targetFlow = document.getElementById(targetId);

  if (targetFlow) {
    targetFlow.classList.add("active");
  }
}