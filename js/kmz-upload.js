(function () {
  "use strict";

  const FUNCTION_NAME = "upload-campsite-file";

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

    const uploadFile = file || (
      blob
        ? new File(
            [blob],
            normalizeFileName(fileName),
            {
              type:
                blob.type ||
                "application/vnd.google-earth.kmz"
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
Promise.all([
  import("./poi-spacing-policy.js?v=1"),
  import("./poi-spacing-policy-filter.js?v=1")
]).catch(error => {
  console.warn("POI距離ポリシーの読み込みに失敗しました。", error);
});
