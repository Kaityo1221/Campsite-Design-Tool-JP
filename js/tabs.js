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

  if (targetTab) {
    requestAnimationFrame(() => {
      const targetTop =
        targetTab.getBoundingClientRect().top +
        window.scrollY -
        16;

      window.scrollTo({
        top: Math.max(0, targetTop),
        behavior: "smooth"
      });
    });
  }
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
  document.querySelectorAll(".script-flow").forEach(flow => {
    flow.classList.remove("active");
  });

  document.querySelectorAll(".script-device-card").forEach(card => {
    card.classList.remove("selected");
  });

  const flowMap = {
    pc: "scriptFlowPc",
    iphone: "scriptFlowIphone",
    android: "scriptFlowAndroid"
  };

  const targetId = flowMap[device];
  const targetFlow = document.getElementById(targetId);

  if (targetFlow) {
    targetFlow.classList.add("active");
  }

  if (selectedButton && selectedButton.classList) {
    selectedButton.classList.add("selected");
  }
}

/*
  Campsite CSV Mode Selector
  Wayfarer Map抽出CSV / 自作CSV の入口を分岐する
*/

window._campsiteCsvMode = null;

function ensureCampsiteStepNumberStyles() {
  if (document.getElementById("campsiteStepNumberStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "campsiteStepNumberStyles";
  style.textContent = `
    #tool.csv-mode-extracted #customCsvStep + .step > .step-no {
      font-size: 0;
    }

    #tool.csv-mode-extracted #customCsvStep + .step > .step-no::after {
      content: "STEP 1";
      font-size: 13px;
    }

    #tool.csv-mode-extracted #customCsvStep + .step + .step + .step > .step-no::after {
      content: "STEP 2";
    }
  `;

  document.head.appendChild(style);
}

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

  const toolSection =
    document.getElementById("tool");

  if(!wayfarerStep || !customStep || !summary || !summaryText){
    return;
  }

  ensureCampsiteStepNumberStyles();

  if(toolSection){
    toolSection.classList.toggle(
      "csv-mode-extracted",
      mode === "extracted"
    );
  }

  if(mode === "custom"){
    wayfarerStep.style.display = "none";
    customStep.style.display = "block";

    summaryText.textContent =
      "自作CSVを使ってキャンプサイトを作成";

    summary.style.display = "flex";

    return;
  }

  if(mode === "extracted"){
    wayfarerStep.style.display = "none";
    customStep.style.display = "none";

    summaryText.textContent =
      "抽出済みCSVを使ってキャンプサイトを作成";

    summary.style.display = "flex";

    return;
  }

  wayfarerStep.style.display = "block";
  customStep.style.display = "none";

  summaryText.textContent =
    "Wayfarer Mapから抽出してキャンプサイトを作成";

  summary.style.display = "flex";
}

/* =========================
   UI大改修 02：KMZ生成後の案内
========================= */

function ensureKmzPostGenerationStyles() {
  if (document.getElementById("kmzPostGenerationStyles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "kmzPostGenerationStyles";
  style.textContent = `
    #tool .kmz-pre-guide-hidden {
      display: none !important;
    }

    #tool .kmz-after-guide[hidden] {
      display: none !important;
    }

    #tool .kmz-after-guide {
      margin-top: 14px;
      padding: 16px;
      border: 1px solid rgba(34, 197, 94, 0.34);
      border-radius: 14px;
      background: rgba(34, 197, 94, 0.08);
    }

    #tool .kmz-after-guide h3 {
      margin: 0 0 8px;
      color: #dcfce7;
      font-size: 18px;
      line-height: 1.5;
    }

    #tool .kmz-after-guide p {
      margin: 0 0 14px;
      color: #cbd5e1;
      font-size: 13px;
      line-height: 1.75;
    }

    #tool .kmz-after-guide .return-home-button {
      width: 100%;
      margin: 0;
    }

    .kmz-complete-next-steps {
      margin: 16px 0;
      padding: 14px 14px 14px 34px;
      border: 1px solid rgba(56, 189, 248, 0.28);
      border-radius: 14px;
      background: rgba(14, 165, 233, 0.08);
      color: #e2e8f0;
      text-align: left;
      line-height: 1.75;
    }

    .kmz-complete-next-steps li + li {
      margin-top: 6px;
    }

    .kmz-iphone-details {
      margin: 14px 0 18px;
      overflow: hidden;
      border: 1px dashed rgba(245, 158, 11, 0.38);
      border-radius: 12px;
      background: rgba(245, 158, 11, 0.08);
      text-align: left;
    }

    .kmz-iphone-details summary {
      padding: 12px 14px;
      color: #fde68a;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
    }

    .kmz-iphone-details div {
      padding: 0 14px 14px;
      color: #fef3c7;
      font-size: 12px;
      line-height: 1.75;
    }

    .kmz-iphone-details ol {
      margin: 8px 0 0;
      padding-left: 22px;
    }

    @media (max-width: 720px) {
      .return-modal {
        align-items: flex-start !important;
        justify-content: center !important;
        height: 100dvh;
        overflow-y: auto !important;
        -webkit-overflow-scrolling: touch;
        overscroll-behavior: contain;
        padding:
          max(12px, env(safe-area-inset-top))
          12px
          calc(120px + env(safe-area-inset-bottom)) !important;
      }

      .return-modal-card {
        width: min(100%, 620px) !important;
        max-height: none !important;
        overflow: visible !important;
        margin: 0 auto !important;
      }

      .return-modal-actions {
        padding-bottom: calc(20px + env(safe-area-inset-bottom));
      }

      .kmz-complete-modal {
        align-items: flex-start !important;
        justify-content: center !important;
        height: 100dvh;
        overflow: hidden !important;
        overscroll-behavior: none;
        padding:
          max(12px, env(safe-area-inset-top))
          12px
          max(16px, env(safe-area-inset-bottom)) !important;
      }

      .kmz-complete-modal-card {
        width: min(100%, 620px) !important;
        max-height: calc(
          100dvh - 32px - env(safe-area-inset-top) - env(safe-area-inset-bottom)
        ) !important;
        overflow-y: auto !important;
        overscroll-behavior-y: contain;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
        scroll-padding-top: 20px;
        scroll-padding-bottom: calc(96px + env(safe-area-inset-bottom));
        padding-bottom: calc(28px + env(safe-area-inset-bottom)) !important;
      }

      .kmz-complete-actions {
        padding-bottom: calc(28px + env(safe-area-inset-bottom));
      }

      .kmz-complete-action-button,
      .kmz-complete-modal-close,
      .kmz-iphone-details summary {
        touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
      }
    }

    @media (max-width: 520px) {
      .kmz-complete-next-steps {
        padding-left: 30px;
        font-size: 13px;
      }
    }
  `;

  document.head.appendChild(style);
}

function stabilizeModalScroller(scroller) {
  if (!scroller || scroller.dataset.scrollStabilized === "true") {
    return;
  }

  scroller.dataset.scrollStabilized = "true";

  const keepInsideScrollBounds = () => {
    const maxScroll = scroller.scrollHeight - scroller.clientHeight;

    if (maxScroll <= 2) {
      return;
    }

    if (scroller.scrollTop <= 0) {
      scroller.scrollTop = 1;
      return;
    }

    if (scroller.scrollTop >= maxScroll) {
      scroller.scrollTop = maxScroll - 1;
    }
  };

  scroller.addEventListener("touchstart", event => {
    keepInsideScrollBounds();
    event.stopPropagation();
  }, { passive: true });

  scroller.addEventListener("touchmove", event => {
    event.stopPropagation();
  }, { passive: true });

  scroller.addEventListener("click", event => {
    event.stopPropagation();
  });
}

function lockKmzModalPageScroll() {
  const body = document.body;

  if (!body || body.dataset.kmzModalScrollLocked === "true") {
    return;
  }

  const scrollY = window.scrollY;

  body.dataset.kmzModalScrollLocked = "true";
  body.dataset.kmzModalScrollY = String(scrollY);
  body.style.position = "fixed";
  body.style.top = `-${scrollY}px`;
  body.style.left = "0";
  body.style.right = "0";
  body.style.width = "100%";
  body.style.overflow = "hidden";
  document.documentElement.style.overflow = "hidden";
}

function unlockKmzModalPageScroll() {
  const body = document.body;

  if (!body || body.dataset.kmzModalScrollLocked !== "true") {
    return;
  }

  const scrollY = Number(body.dataset.kmzModalScrollY || "0");

  delete body.dataset.kmzModalScrollLocked;
  delete body.dataset.kmzModalScrollY;
  body.style.position = "";
  body.style.top = "";
  body.style.left = "";
  body.style.right = "";
  body.style.width = "";
  body.style.overflow = "";
  document.documentElement.style.overflow = "";

  window.scrollTo(0, scrollY);
}

function revealKmzAfterGuide() {
  const guide = document.getElementById("kmzAfterGuide");

  if (!guide) {
    return;
  }

  guide.hidden = false;
}

function setupKmzPostGenerationGuide() {
  ensureKmzPostGenerationStyles();

  const renameGuide = document.getElementById("renameGuide");
  const oldMyMapsStep = renameGuide
    ? renameGuide.closest(".step")
    : null;

  if (oldMyMapsStep) {
    oldMyMapsStep.classList.add("kmz-pre-guide-hidden");
  }

  const afterGuide = document.querySelector(
    "#tool .return-step-card"
  );

  if (afterGuide) {
    afterGuide.id = "kmzAfterGuide";
    afterGuide.className = "step kmz-after-guide";
    afterGuide.hidden = true;
    afterGuide.innerHTML = `
      <h3>Google My Mapsでの設計が終わりましたか？</h3>
      <p>
        追加POIと活動範囲を作成し、完成KMZを書き出したら、
        距離チェックへ進んでください。
      </p>
      <button
        type="button"
        class="return-home-button"
        onclick="openReturnModal()"
      >
        📏 完成KMZの距離チェックへ進む
      </button>
    `;
  }

  const modalCard = document.querySelector(
    "#kmzCompleteModal .kmz-complete-modal-card"
  );

  if (modalCard) {
    modalCard.innerHTML = `
      <button
        type="button"
        class="kmz-complete-modal-close"
        onclick="closeKmzCompleteModal()"
        aria-label="閉じる"
      >
        ×
      </button>

      <div class="kmz-complete-sheep">🐏</div>

      <p class="kmz-complete-label">
        KMZ COMPLETE
      </p>

      <h2>KMZを保存しました！</h2>

      <p class="kmz-complete-message">
        次はGoogle My Mapsで設計を仕上げます。
      </p>

      <ol class="kmz-complete-next-steps">
        <li>Google My MapsへKMZを読み込む</li>
        <li>追加POIと活動範囲を作成する</li>
        <li>完成KMZを書き出して距離チェックへ進む</li>
      </ol>

      <details class="kmz-iphone-details">
        <summary>iPhoneでZIPとして保存された場合</summary>
        <div>
          ファイルアプリで保存されたZIPを長押しし、
          「名称変更」から末尾の <strong>.zip</strong> を削除してください。
          <ol>
            <li>対象ファイルを長押し</li>
            <li>「名称変更」を選択</li>
            <li><strong>.kmz.zip</strong> を <strong>.kmz</strong> に変更</li>
            <li>Googleドライブへ移動</li>
          </ol>
        </div>
      </details>

      <div class="kmz-complete-actions">
        <button
          type="button"
          class="kmz-complete-action-button maps"
          onclick="openGoogleMyMaps(); closeKmzCompleteModal();"
        >
          <span>🗺️</span>
          <strong>Google My Mapsを開く</strong>
          <small>生成したKMZをインポートします</small>
        </button>

        <button
          type="button"
          class="kmz-complete-action-button later"
          onclick="closeKmzCompleteModal()"
        >
          <span>🐏</span>
          <strong>あとで作業する</strong>
          <small>案内を閉じて元の画面へ戻ります</small>
        </button>
      </div>
    `;

    stabilizeModalScroller(modalCard);
  }

  const originalCloseKmzCompleteModal =
    window.closeKmzCompleteModal;

  if (
    typeof originalCloseKmzCompleteModal === "function" &&
    !originalCloseKmzCompleteModal._postGuideWrapped
  ) {
    const wrappedCloseKmzCompleteModal = function (...args) {
      const result = originalCloseKmzCompleteModal.apply(this, args);
      unlockKmzModalPageScroll();
      return result;
    };

    wrappedCloseKmzCompleteModal._postGuideWrapped = true;
    window.closeKmzCompleteModal = wrappedCloseKmzCompleteModal;
  }

  const originalOpenKmzCompleteModal =
    window.openKmzCompleteModal;

  if (
    typeof originalOpenKmzCompleteModal === "function" &&
    !originalOpenKmzCompleteModal._postGuideWrapped
  ) {
    const wrappedOpenKmzCompleteModal = function (...args) {
      const result = originalOpenKmzCompleteModal.apply(this, args);

      revealKmzAfterGuide();
      lockKmzModalPageScroll();

      window.requestAnimationFrame(() => {
        if (!modalCard) {
          return;
        }

        const maxScroll = modalCard.scrollHeight - modalCard.clientHeight;

        if (maxScroll > 2 && modalCard.scrollTop <= 0) {
          modalCard.scrollTop = 1;
        }
      });

      return result;
    };

    wrappedOpenKmzCompleteModal._postGuideWrapped = true;
    window.openKmzCompleteModal = wrappedOpenKmzCompleteModal;
  }
}

function isIosMyMapsDevice() {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1
    )
  );
}

function copyTextForMyMaps(text) {
  const showCopiedMessage = () => {
    alert(
      "My MapsのURLをコピーしました。\n\n" +
      "Safariのアドレスバーへ貼り付けて開いてください。\n" +
      "リンクを直接押すと、Google Mapsアプリが開く場合があります。"
    );
  };

  const showManualCopy = () => {
    prompt(
      "下のURLをコピーし、Safariのアドレスバーへ貼り付けてください。",
      text
    );
  };

  if (
    navigator.clipboard &&
    window.isSecureContext
  ) {
    navigator.clipboard
      .writeText(text)
      .then(showCopiedMessage)
      .catch(showManualCopy);

    return;
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();

    const copied = document.execCommand("copy");
    textarea.remove();

    if (copied) {
      showCopiedMessage();
      return;
    }
  } catch (error) {
    // 下の手動コピー案内へ進む
  }

  showManualCopy();
}

function setupIosMyMapsLinkBehavior() {
  if (!isIosMyMapsDevice()) {
    return;
  }

  const myMapsUrl =
    "https://www.google.com/maps/d/u/0/";

  window.openGoogleMyMaps = function () {
    setWorkflowStep("mymaps");
    copyTextForMyMaps(myMapsUrl);
  };

  const mapsButton = document.querySelector(
    "#kmzCompleteModal .kmz-complete-action-button.maps"
  );

  if (!mapsButton) {
    return;
  }

  const title = mapsButton.querySelector("strong");
  const description = mapsButton.querySelector("small");

  if (title) {
    title.textContent = "My MapsのURLをコピー";
  }

  if (description) {
    description.textContent =
      "Safariのアドレスバーへ貼り付けて開きます";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setupKmzPostGenerationGuide();
  setupIosMyMapsLinkBehavior();
});

document.addEventListener("keydown", event => {
  if(event.key !== "Escape"){
    return;
  }

  closeCampsiteStartModal();
});