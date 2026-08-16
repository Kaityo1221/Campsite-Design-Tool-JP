(function () {
  "use strict";

  const FUNCTION_NAME = "upload-campsite-file";
  const KMZ_MIME = "application/vnd.google-earth.kmz";

  function isKmzFileName(fileName) {
    return String(fileName || "")
      .toLowerCase()
      .endsWith(".kmz");
  }

  function isIosFamily() {
    const ua = String(navigator.userAgent || "");

    return (
      /iPhone|iPad|iPod/i.test(ua) ||
      (
        navigator.platform === "MacIntel" &&
        Number(navigator.maxTouchPoints) > 1
      )
    );
  }

  function ensureIosKmzSaveModal() {
    let modal = document.getElementById("campsiteIosKmzSaveModal");

    if (modal) {
      return modal;
    }

    modal = document.createElement("div");
    modal.id = "campsiteIosKmzSaveModal";

    Object.assign(modal.style, {
      display: "none",
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      background: "rgba(2, 6, 23, 0.82)",
      backdropFilter: "blur(8px)"
    });

    const card = document.createElement("div");

    Object.assign(card.style, {
      width: "min(100%, 420px)",
      padding: "22px",
      borderRadius: "20px",
      border: "1px solid rgba(125, 211, 252, 0.42)",
      background: "#0f172a",
      color: "#e2e8f0",
      boxShadow: "0 22px 60px rgba(0, 0, 0, 0.42)",
      textAlign: "left"
    });

    card.innerHTML = `
      <div style="font-size:20px;font-weight:900;color:#f8fafc;">
        ✅ KMZ生成完了
      </div>
      <div style="margin-top:10px;font-size:13px;line-height:1.7;color:#cbd5e1;">
        iPhoneでは通常のダウンロードだとKMZに <strong>.zip</strong> が付く場合があります。<br>
        下のボタンから共有シートを開き、<strong>「ファイルに保存」</strong>を選んでください。
      </div>
      <div id="campsiteIosKmzFileName" style="margin-top:12px;padding:10px 12px;border-radius:12px;background:rgba(30,41,59,.9);font-size:12px;line-height:1.5;word-break:break-all;color:#bae6fd;"></div>
      <button id="campsiteIosKmzSaveButton" type="button" style="width:100%;min-height:52px;margin-top:16px;border:1px solid #38bdf8;border-radius:14px;background:#0ea5e9;color:white;font-size:16px;font-weight:900;">
        📁 KMZとして保存
      </button>
      <div id="campsiteIosKmzSaveStatus" style="min-height:20px;margin-top:8px;font-size:12px;line-height:1.5;color:#cbd5e1;"></div>
      <button id="campsiteIosKmzCloseButton" type="button" style="width:100%;min-height:44px;margin-top:8px;border:1px solid rgba(148,163,184,.35);border-radius:12px;background:rgba(30,41,59,.75);color:#cbd5e1;font-weight:800;">
        閉じる
      </button>
    `;

    modal.appendChild(card);
    document.body.appendChild(modal);

    card.querySelector("#campsiteIosKmzCloseButton")
      ?.addEventListener("click", () => {
        modal.style.display = "none";
      });

    modal.addEventListener("click", event => {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    });

    return modal;
  }

  function installKmzDownloadGuard() {
    if (
      window.__campsiteKmzDownloadGuardInstalled ||
      typeof URL === "undefined" ||
      typeof URL.createObjectURL !== "function" ||
      typeof URL.revokeObjectURL !== "function" ||
      typeof HTMLAnchorElement === "undefined"
    ) {
      return;
    }

    window.__campsiteKmzDownloadGuardInstalled = true;

    const blobByUrl = new Map();
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    const originalRevokeObjectURL = URL.revokeObjectURL.bind(URL);
    const originalAnchorClick = HTMLAnchorElement.prototype.click;

    URL.createObjectURL = function (object) {
      const url = originalCreateObjectURL(object);

      if (object instanceof Blob) {
        blobByUrl.set(url, object);
      }

      return url;
    };

    URL.revokeObjectURL = function (url) {
      blobByUrl.delete(String(url || ""));
      return originalRevokeObjectURL(url);
    };

    HTMLAnchorElement.prototype.click = function () {
      if (isKmzFileName(this.download)) {
        const sourceUrl = this.href;
        const sourceBlob = blobByUrl.get(sourceUrl);

        if (sourceBlob instanceof Blob) {
          const fixedBlob = new Blob([sourceBlob], { type: KMZ_MIME });

          if (
            isIosFamily() &&
            typeof navigator.share === "function" &&
            typeof File === "function"
          ) {
            const shareFile = new File(
              [fixedBlob],
              this.download,
              { type: KMZ_MIME }
            );

            const shouldOpenCompletionModal =
              /_円差分更新\.kmz$/i.test(shareFile.name);

            let canShare = true;

            if (typeof navigator.canShare === "function") {
              try {
                canShare = navigator.canShare({ files: [shareFile] });
              } catch (_) {
                canShare = false;
              }
            }

            if (canShare) {
              const modal = ensureIosKmzSaveModal();
              const fileNameBox = modal.querySelector("#campsiteIosKmzFileName");
              const saveButton = modal.querySelector("#campsiteIosKmzSaveButton");
              const status = modal.querySelector("#campsiteIosKmzSaveStatus");

              if (fileNameBox) {
                fileNameBox.textContent = shareFile.name;
              }

              if (status) {
                status.textContent = "";
              }

              if (saveButton) {
                saveButton.onclick = async () => {
                  saveButton.disabled = true;

                  if (status) {
                    status.textContent = "共有シートを開いています…";
                  }

                  try {
                    await navigator.share({ files: [shareFile] });

                    if (status) {
                      status.textContent = "共有が完了しました。";
                    }

                    setTimeout(() => {
                      modal.style.display = "none";

                      if (
                        shouldOpenCompletionModal &&
                        typeof window.openKmzCompleteModal === "function"
                      ) {
                        window.openKmzCompleteModal();
                      }
                    }, 500);
                  } catch (error) {
                    if (status) {
                      status.textContent =
                        error?.name === "AbortError"
                          ? "キャンセルしました。もう一度押せます。"
                          : "共有シートを開けませんでした。もう一度お試しください。";
                    }
                  } finally {
                    saveButton.disabled = false;
                  }
                };
              }

              modal.style.display = "flex";
              return;
            }
          }

          const fixedUrl = originalCreateObjectURL(fixedBlob);
          this.href = fixedUrl;

          setTimeout(() => {
            originalRevokeObjectURL(fixedUrl);

            if (this.href === fixedUrl) {
              this.href = sourceUrl;
            }
          }, 10000);
        }
      }

      return originalAnchorClick.apply(this, arguments);
    };
  }

  installKmzDownloadGuard();

  function getAnonymousDeviceId() {
    const storageKey = "campsiteUserId";

    let deviceId = localStorage.getItem(storageKey);

    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem(storageKey, deviceId);
    }

    return deviceId;
  }

  function normalizeFileName(fileName, fallback = "campsite.kmz") {
    const normalized = String(fileName || fallback)
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^\.+/, "")
      .slice(0, 120);

    return normalized || fallback;
  }

  function normalizeParkName(parkName) {
    const normalized = String(parkName || "公園名不明")
      .normalize("NFKC")
      .replace(/[\\/:*?"<>|]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 50);

    return normalized || "公園名不明";
  }

  function appendOptionalValue(formData, key, value) {
    if (value === null || value === undefined || value === "") {
      return;
    }

    formData.append(key, String(value));
  }

  function showUploadFailure(targetElement) {
    if (!targetElement) {
      return;
    }

    const oldMessage = targetElement.querySelector(
      ".server-upload-note"
    );

    if (oldMessage) {
      oldMessage.remove();
    }

    const message = document.createElement("div");

    message.className = "server-upload-note";
    message.textContent =
      "※解析データを送信できませんでした。";

    targetElement.appendChild(message);
  }

  async function uploadCampsiteFile(options) {
    const {
      file,
      blob,
      fileName,
      actionType,
      parkName,
      metadata = {},
      errorTarget = null
    } = options || {};

    const normalizedUploadFileName =
      normalizeFileName(fileName);

    const uploadFile = file || (
      blob
        ? new File(
            [blob],
            normalizedUploadFileName,
            {
              type: isKmzFileName(normalizedUploadFileName)
                ? KMZ_MIME
                : (
                    blob.type ||
                    "application/octet-stream"
                  )
            }
          )
        : null
    );

    if (!(uploadFile instanceof File)) {
      throw new Error(
        "アップロード対象のファイルがありません。"
      );
    }

    if (
      actionType !== "kmz_generate" &&
      actionType !== "distance_check"
    ) {
      throw new Error(
        "アップロード種別が正しくありません。"
      );
    }

    if (
      !window.campsiteSupabase ||
      !window.campsiteSupabase.functions
    ) {
      throw new Error(
        "Supabaseクライアントが初期化されていません。"
      );
    }

    const formData = new FormData();

    formData.append("file", uploadFile);
    formData.append(
      "original_file_name",
      normalizeFileName(
        fileName || uploadFile.name
      )
    );
    formData.append(
      "anonymous_device_id",
      getAnonymousDeviceId()
    );
    formData.append("action_type", actionType);
    formData.append(
      "park_name",
      normalizeParkName(parkName)
    );

    appendOptionalValue(
      formData,
      "poi_count",
      metadata.poiCount
    );

    appendOptionalValue(
      formData,
      "existing_poi_count",
      metadata.existingPoiCount
    );

    appendOptionalValue(
      formData,
      "added_poi_count",
      metadata.addedPoiCount
    );

    appendOptionalValue(
      formData,
      "warning_count",
      metadata.warningCount
    );

    appendOptionalValue(
      formData,
      "campsite_score",
      metadata.campsiteScore
    );

    appendOptionalValue(
      formData,
      "campsite_rank",
      metadata.campsiteRank
    );

    try {
      const {
        data,
        error
      } = await window.campsiteSupabase.functions.invoke(
        FUNCTION_NAME,
        {
          body: formData
        }
      );

      if (error) {
        throw error;
      }

      if (!data || data.success !== true) {
        throw new Error(
          data?.error ||
          "サーバーへの送信に失敗しました。"
        );
      }

      return data;
    } catch (error) {
      console.warn(
        "KMZ自動送信に失敗しました。",
        error
      );

      showUploadFailure(errorTarget);

      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error)
      };
    }
  }

  window.uploadCampsiteFile = uploadCampsiteFile;
})();

/* 50m POI spacing policy is loaded after the legacy KMZ/distance scripts. */
import("./poi-spacing-config.js?v=1")
  .then(() => Promise.all([
    import("./poi-spacing-policy.js?v=7"),
    import("./poi-spacing-policy-filter.js?v=4"),
    import("./poi-spacing-policy-ui.js?v=6")
  ]))
  .then(() => import("./poi-spacing-kmz50-guard.js?v=4"))
  .then(() => import("./poi-spacing-kmz-preserve.js?v=2"))
  .then(() => import("./poi-spacing-kmz-diff.js?v=1"))
  .catch(error => {
    console.warn("POI距離ポリシーの読み込みに失敗しました。", error);
  });