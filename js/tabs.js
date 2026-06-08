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

updateWorkflowStep(tabId);
  
window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}
function setWorkflowStep(step) {
  document
    .querySelectorAll(".workflow-step")
    .forEach(el => {
      el.classList.remove("active");
    });

  const target =
    document.querySelector(
      `[data-workflow-step="${step}"]`
    );

  if (target) {
    target.classList.add("active");
  }
}
function updateWorkflowStep(tabId) {
  const stepMap = {
    howto: "prepare",
    script: "prepare",
    guide: "prepare",

    tool: "prepare",
    "circle-tools": "kmz",
    "deduplicate-poi": "kmz",

    distance: "finished-kmz",
    check: "check",

    parts: "finished-kmz",
    admin: "finished-kmz"
  };

  setWorkflowStep(stepMap[tabId] || "prepare");
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
/*
  Campsite CSV Mode Selector
  Wayfarer Map抽出CSV / 自作CSV の入口を分岐する
*/

window._campsiteCsvMode = null;

function openCampsiteStartModal(){
  const modal = document.getElementById("campsiteCsvModal");

  if(!modal){
    return;
  }

  modal.style.display = "flex";
}

function closeCampsiteStartModal(){
  const modal = document.getElementById("campsiteCsvModal");

  if(!modal){
    return;
  }

  modal.style.display = "none";
}

function closeCampsiteStartModalByBackdrop(event){
  if(event.target.id !== "campsiteCsvModal"){
    return;
  }

  closeCampsiteStartModal();
}

function selectCampsiteCsvMode(mode){
  window._campsiteCsvMode = mode;

  closeCampsiteStartModal();

  const openingScreen =
    document.getElementById("openingScreen");

  const isOpeningVisible =
    openingScreen &&
    window.getComputedStyle(openingScreen).display !== "none";

  if(isOpeningVisible && typeof startAdventure === "function"){
    startAdventure();
  }

  window.setTimeout(() => {
    const toolTabButton =
      document.querySelector(
        '.tab-button[data-tab-target="tool"]'
      );

    if(typeof openTab === "function"){
      openTab("tool", toolTabButton);
    }

    applyCampsiteCsvMode(mode);

setWorkflowStep("csv");
  }, 0);
}

function applyCampsiteCsvMode(mode){
  setWorkflowStep("csv");

  const wayfarerStep =
    document.getElementById("wayfarerCsvStep");

  const customStep =
    document.getElementById("customCsvStep");

  const summary =
    document.getElementById("csvModeSummary");

  const summaryText =
    document.getElementById("csvModeSummaryText");

  if(!wayfarerStep || !customStep || !summary || !summaryText){
    return;
  }

  /* 自作CSVを使う */
  if(mode === "custom"){
    wayfarerStep.style.display = "none";
    customStep.style.display = "block";

    summaryText.textContent =
      "自作CSVを使ってキャンプサイトを作成";

    summary.style.display = "flex";

    return;
  }

  /* Wayfarer Mapから抽出済みのCSVを使う */
  if(mode === "extracted"){
    wayfarerStep.style.display = "none";
    customStep.style.display = "none";

    summaryText.textContent =
      "抽出済みCSVを使ってキャンプサイトを作成";

    summary.style.display = "flex";

    return;
  }

  /* Wayfarer Mapから新しく抽出する */
  wayfarerStep.style.display = "block";
  customStep.style.display = "none";

  summaryText.textContent =
    "Wayfarer Mapから抽出してキャンプサイトを作成";

  summary.style.display = "flex";
}

document.addEventListener("keydown", event => {
  if(event.key !== "Escape"){
    return;
  }

  closeCampsiteStartModal();
});