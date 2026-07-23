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
  const status = document.getElementById("walkImportStatus");

  if (
    !openButton ||
    !closeButton ||
    !panel ||
    !fileButton ||
    !fileInput ||
    !status
  ) {
    console.warn("歩行データ取込UIの要素が見つかりません。");
    return;
  }

  /**
   * ステータス表示を更新する
   */
  const setStatus = (message, type = "") => {
    status.textContent = message;
    status.className = "walk-import-status";

    if (type) {
      status.classList.add(type);
    }
  };

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

  /**
   * XML内の時刻を取得する
   */
  const getTrackPointTime = (trackPoint) => {
    const timeElement = trackPoint.querySelector("time");

    if (!timeElement?.textContent) {
      return null;
    }

    const parsedTime = new Date(timeElement.textContent.trim());

    if (Number.isNaN(parsedTime.getTime())) {
      return null;
    }

    return parsedTime;
  };

  /**
   * GPX文字列を解析する
   */
  const parseGpx = (gpxText) => {
    const parser = new DOMParser();
    const xmlDocument = parser.parseFromString(
      gpxText,
      "application/xml"
    );

    const parserError = xmlDocument.querySelector("parsererror");

    if (parserError) {
      throw new Error("GPXのXML形式を読み取れませんでした。");
    }

    const trackPoints = Array.from(
      xmlDocument.getElementsByTagName("trkpt")
    );

    if (trackPoints.length === 0) {
      throw new Error("GPX内に歩行地点が見つかりませんでした。");
    }

    const points = trackPoints
      .map((trackPoint) => {
        const latitude = Number.parseFloat(
          trackPoint.getAttribute("lat")
        );

        const longitude = Number.parseFloat(
          trackPoint.getAttribute("lon")
        );

        const elevationElement = trackPoint.querySelector("ele");
        const elevation = elevationElement?.textContent
          ? Number.parseFloat(elevationElement.textContent.trim())
          : null;

        const time = getTrackPointTime(trackPoint);

        if (
          !Number.isFinite(latitude) ||
          !Number.isFinite(longitude)
        ) {
          return null;
        }

        return {
          latitude,
          longitude,
          elevation:
            Number.isFinite(elevation) ? elevation : null,
          time
        };
      })
      .filter(Boolean);

    if (points.length === 0) {
      throw new Error("有効な緯度・経度が見つかりませんでした。");
    }

    return points;
  };

  /**
   * GPX解析結果の概要を作る
   */
  const createGpxSummary = (file, points) => {
    const timedPoints = points.filter((point) => point.time);

    const firstTimedPoint = timedPoints[0] ?? null;
    const lastTimedPoint =
      timedPoints[timedPoints.length - 1] ?? null;

    let durationText = "時刻情報なし";

    if (firstTimedPoint && lastTimedPoint) {
      const durationMilliseconds =
        lastTimedPoint.time.getTime() -
        firstTimedPoint.time.getTime();

      if (durationMilliseconds >= 0) {
        const totalMinutes = Math.round(
          durationMilliseconds / 1000 / 60
        );

        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;

        durationText =
          hours > 0
            ? `${hours}時間${minutes}分`
            : `${minutes}分`;
      }
    }

    return [
      `ファイル：${file.name}`,
      `記録地点：${points.length.toLocaleString()}件`,
      `時刻付き地点：${timedPoints.length.toLocaleString()}件`,
      `記録時間：${durationText}`
    ].join("\n");
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

  fileInput.addEventListener("change", async () => {
    const selectedFile = fileInput.files?.[0];

    if (!selectedFile) {
      return;
    }

    const fileName = selectedFile.name.toLowerCase();

    if (!fileName.endsWith(".gpx")) {
      setStatus(
        "GPX形式のファイルを選択してください。",
        "error"
      );
      fileInput.value = "";
      return;
    }

    setStatus("GPXファイルを解析しています…", "loading");

    try {
      const gpxText = await selectedFile.text();
      const points = parseGpx(gpxText);
      const summary = createGpxSummary(
        selectedFile,
        points
      );

      console.log("GPX解析結果:", {
        file: selectedFile.name,
        pointCount: points.length,
        points
      });

      setStatus(summary, "success");
    } catch (error) {
      console.error("GPX解析エラー:", error);

      setStatus(
        error instanceof Error
          ? error.message
          : "GPXの解析中にエラーが発生しました。",
        "error"
      );
    }
  });

  document.addEventListener("click", (event) => {
    const launcher = document.querySelector(
      ".walk-import-launcher"
    );

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