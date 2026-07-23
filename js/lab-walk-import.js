"use strict";

/**
 * Campsite Lab
 * スマートウォッチ歩行データ取込UI
 */
document.addEventListener("DOMContentLoaded", () => {
  const openButton = document.getElementById("walkImportOpenButton");
  const closeButton = document.getElementById("walkImportCloseButton");
  const panel = document.getElementById("walkImportPanel");
  const fileButton = document.getElementById("walkImportFileButton");
  const fileInput = document.getElementById("walkImportFileInput");

  if (!openButton || !closeButton || !panel || !fileButton || !fileInput) {
    console.warn("歩行データ取込UIの要素が見つかりません。");
    return;
  }

  /**
   * 取込パネルを開く
   */
  const openPanel = () => {
    panel.hidden = false;
    openButton.setAttribute("aria-expanded", "true");
  };

  /**
   * 取込パネルを閉じる
   */
  const closePanel = () => {
    panel.hidden = true;
    openButton.setAttribute("aria-expanded", "false");
  };

  /**
   * パネルを開閉する
   */
  const togglePanel = () => {
    if (panel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  };

  openButton.addEventListener("click", (event) => {
    event.stopPropagation();
    togglePanel();
  });

  closeButton.addEventListener("click", (event) => {
    event.stopPropagation();
    closePanel();
  });

  fileButton.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    const selectedFile = fileInput.files?.[0];

    if (!selectedFile) {
      return;
    }

    console.log("選択された歩行データ:", {
      name: selectedFile.name,
      type: selectedFile.type,
      size: selectedFile.size
    });

    // 現段階では解析・送信しない。
    // 次工程でGPX形式チェックとプレビュー処理を追加する。
  });

  document.addEventListener("click", (event) => {
    const launcher = document.querySelector(".walk-import-launcher");

    if (!launcher || panel.hidden) {
      return;
    }

    if (!launcher.contains(event.target)) {
      closePanel();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) {
      closePanel();
      openButton.focus();
    }
  });
});