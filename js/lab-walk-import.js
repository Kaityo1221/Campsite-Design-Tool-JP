"use strict";

/**
 * Campsite Lab
 * スマートウォッチ歩行データ取込UI
 * 第1段階：GPX区間解析、距離・速度計算、GPS異常区間除外
 */
document.addEventListener("DOMContentLoaded", () => {
const MAX_WALK_SPEED_KMH = 25;
const MAX_TIME_GAP_SECONDS = 5 * 60;
const EARTH_RADIUS_METERS = 6371008.8;

/**
 * 未接近POIを初期表示するルートからの最大距離
 */
const FAR_POI_VISIBLE_DISTANCE_METERS = 100;

/**
 * 停止地点の判定条件
 */
const STOP_RADIUS_METERS = 20;
const MIN_STOP_DURATION_SECONDS = 2 * 60;

  const openButton = document.getElementById("walkImportOpenButton");
  const closeButton = document.getElementById("walkImportCloseButton");
  const panel = document.getElementById("walkImportPanel");
  const fileButton = document.getElementById("walkImportFileButton");
  const fileInput = document.getElementById("walkImportFileInput");
  const status = document.getElementById("walkImportStatus");
  const mapSection = document.getElementById("walkMapSection");
  const mapElement = document.getElementById("walkRouteMap");
const summaryGrid =
  document.getElementById("walkSummaryGrid");

const summaryDistance =
  document.getElementById("walkSummaryDistance");

const summaryRecordedTime =
  document.getElementById("walkSummaryRecordedTime");

const summaryMovingTime =
  document.getElementById("walkSummaryMovingTime");

const summaryStoppedTime =
  document.getElementById("walkSummaryStoppedTime");

const summaryAverageSpeed =
  document.getElementById("walkSummaryAverageSpeed");

const summaryStopCount =
  document.getElementById("walkSummaryStopCount");
  const summaryPassedPoi =
  document.getElementById(
    "walkSummaryPassedPoi"
  );

const summaryNearPoi =
  document.getElementById(
    "walkSummaryNearPoi"
  );

const summaryStopPoi =
  document.getElementById(
    "walkSummaryStopPoi"
  );

const summaryFarPoi =
  document.getElementById(
    "walkSummaryFarPoi"
  );

const mapFitButton =
  document.getElementById("walkMapFitButton");

const farPoiToggleButton =
  document.getElementById(
    "walkFarPoiToggleButton"
  );

const actionArea =
  document.getElementById("walkImportActions");

const changeButton =
  document.getElementById("walkImportChangeButton");

const clearButton =
  document.getElementById("walkImportClearButton");
  if (
  !openButton ||
  !closeButton ||
  !panel ||
  !fileButton ||
  !fileInput ||
  !status ||
  !mapSection ||
  !mapElement ||
  !summaryGrid ||
  !summaryDistance ||
  !summaryRecordedTime ||
  !summaryMovingTime ||
  !summaryStoppedTime ||
  !summaryAverageSpeed ||
  !summaryStopCount ||
!summaryPassedPoi ||
!summaryNearPoi ||
!summaryStopPoi ||
!summaryFarPoi ||
!mapFitButton ||
!farPoiToggleButton ||
  !actionArea ||
  !changeButton ||
  !clearButton
) {
    console.warn("歩行データ取込UIの要素が見つかりません。");
    return;
  }

  let walkMap = null;
let walkMapLayerGroup = null;
let currentRouteBounds = null;
/**
 * LabEngineから受け取ったPOIデータ
 */
let currentPoiData = [];

/**
 * 現在表示中のGPX解析結果
 */
let currentGpxData = null;
let currentWalkAnalysis = null;

/**
 * true：100mを超える未接近POIも表示
 * false：ルートから100m以内だけ表示
 */
let showAllFarPoi = false;
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
   * 未接近POI表示ボタンの状態を更新する
   */
  const updateFarPoiToggleButton = () => {
    farPoiToggleButton.textContent =
      showAllFarPoi
        ? "未接近：全表示"
        : "未接近：100m以内";

    farPoiToggleButton.setAttribute(
      "aria-pressed",
      String(showAllFarPoi)
    );

    farPoiToggleButton.title =
      showAllFarPoi
        ? "100mを超える未接近POIも表示しています"
        : "ルートから100m以内の未接近POIだけ表示します";
  };

  /**
   * 取込パネルを開く
   */
  const openPanel = () => {
    panel.hidden = false;
    openButton.setAttribute("aria-expanded", "true");

    if (walkMap) {
      window.setTimeout(() => {
        walkMap.invalidateSize();
      }, 0);
    }
  };

  /**
   * 取込パネルを閉じる
   */
  const closePanel = () => {
    panel.hidden = true;
    openButton.setAttribute("aria-expanded", "false");
  };

  /**
   * 取込パネルの開閉を切り替える
   */
  const togglePanel = () => {
    if (panel.hidden) {
      openPanel();
    } else {
      closePanel();
    }
  };

  /**
   * XML名前空間に関係なく、最初の要素を取得する
   */
  const getFirstElement = (parent, localName) => {
    return parent.getElementsByTagNameNS("*", localName)[0] ?? null;
  };

  /**
   * GPXの時刻をDateへ変換する
   */
  const parseTime = (trackPoint) => {
    const element = getFirstElement(trackPoint, "time");

    if (!element?.textContent) {
      return null;
    }

    const value = new Date(element.textContent.trim());

    return Number.isNaN(value.getTime()) ? null : value;
  };

  /**
   * 1件のtrkptを内部データへ変換する
   */
  const parseTrackPoint = (
    trackPoint,
    segmentIndex,
    pointIndex
  ) => {
    const latitude = Number.parseFloat(
      trackPoint.getAttribute("lat")
    );

    const longitude = Number.parseFloat(
      trackPoint.getAttribute("lon")
    );

    if (
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      return null;
    }

    const elevationElement = getFirstElement(
      trackPoint,
      "ele"
    );

    const elevation = elevationElement?.textContent
      ? Number.parseFloat(
          elevationElement.textContent.trim()
        )
      : null;

    return {
      latitude,
      longitude,
      elevation: Number.isFinite(elevation)
        ? elevation
        : null,
      time: parseTime(trackPoint),
      segmentIndex,
      pointIndex
    };
  };

  /**
   * GPX文字列を解析する
   */
  const parseGpx = (gpxText) => {
    const parser = new DOMParser();

    const xml = parser.parseFromString(
      gpxText,
      "application/xml"
    );

    if (xml.querySelector("parsererror")) {
      throw new Error(
        "GPXのXML形式を読み取れませんでした。"
      );
    }

    const track =
      xml.getElementsByTagNameNS("*", "trk")[0] ??
      null;

    const trackName =
      getFirstElement(
        track ?? xml,
        "name"
      )?.textContent?.trim() || "名称なし";

    const segmentElements = Array.from(
      xml.getElementsByTagNameNS("*", "trkseg")
    );

    let segments = segmentElements.map(
      (segmentElement, segmentIndex) =>
        Array.from(
          segmentElement.getElementsByTagNameNS(
            "*",
            "trkpt"
          )
        )
          .map((trackPoint, pointIndex) =>
            parseTrackPoint(
              trackPoint,
              segmentIndex,
              pointIndex
            )
          )
          .filter(Boolean)
    );

    /**
     * trksegがないGPXへの予備対応
     */
    if (segments.length === 0) {
      const points = Array.from(
        xml.getElementsByTagNameNS("*", "trkpt")
      )
        .map((trackPoint, pointIndex) =>
          parseTrackPoint(
            trackPoint,
            0,
            pointIndex
          )
        )
        .filter(Boolean);

      if (points.length > 0) {
        segments = [points];
      }
    }

    segments = segments.filter(
      (segment) => segment.length > 0
    );

    if (segments.length === 0) {
      throw new Error(
        "GPX内に有効な歩行地点が見つかりませんでした。"
      );
    }

    return {
      trackName,
      segments,
      points: segments.flat()
    };
  };

  /**
   * 度をラジアンへ変換する
   */
  const toRadians = (degrees) => {
    return (degrees * Math.PI) / 180;
  };

  /**
   * 2地点間の距離をHaversine方式で計算する
   */
  const calculateDistanceMeters = (
    pointA,
    pointB
  ) => {
    const latitude1 = toRadians(
      pointA.latitude
    );

    const latitude2 = toRadians(
      pointB.latitude
    );

    const latitudeDifference =
      latitude2 - latitude1;

    const longitudeDifference = toRadians(
      pointB.longitude - pointA.longitude
    );

    const haversine =
      Math.sin(latitudeDifference / 2) ** 2 +
      Math.cos(latitude1) *
        Math.cos(latitude2) *
        Math.sin(longitudeDifference / 2) ** 2;

    const centralAngle =
      2 *
      Math.atan2(
        Math.sqrt(haversine),
        Math.sqrt(
          Math.max(0, 1 - haversine)
        )
      );

    return EARTH_RADIUS_METERS * centralAngle;
  };
  /**
 * LabEngineのPOIデータを歩行解析用の形式へ変換する
 */
const normalizePoiData = (poiList) => {
  if (!Array.isArray(poiList)) {
    return [];
  }

  return poiList
    .map((poi, index) => {
      const latitude = Number.parseFloat(
        poi.latitude ??
        poi.lat ??
        poi.Latitude
      );

      const longitude = Number.parseFloat(
        poi.longitude ??
        poi.lng ??
        poi.lon ??
        poi.Longitude
      );

      if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        latitude < -90 ||
        latitude > 90 ||
        longitude < -180 ||
        longitude > 180
      ) {
        return null;
      }

      return {
        id:
          poi.id ??
          poi.guid ??
          `walk-poi-${index}`,

        name:
          poi.name ??
          poi.title ??
          poi.Name ??
          `POI ${index + 1}`,

        category:
          poi._labCategoryKey ??
          poi.category_key ??
          poi.category ??
          poi.classification ??
          poi.type ??
          "unknown",

        latitude,
        longitude,

        original: poi
      };
    })
    .filter(Boolean);
};
/**
 * POIから歩行ルートまでの最短距離を計算する
 */
/**
 * 地点から1本のルート線分までの
 * 最短距離をメートルで計算する
 */
const calculatePointToSegmentDistanceMeters = (
  point,
  segmentStart,
  segmentEnd
) => {
  const referenceLatitude =
    (
      point.latitude +
      segmentStart.latitude +
      segmentEnd.latitude
    ) / 3;

  const longitudeScale =
    Math.cos(
      toRadians(referenceLatitude)
    );

  /**
   * POIを原点として、
   * 緯度経度をローカルなメートル座標へ変換する
   */
  const toLocalMeters = (target) => {
    const x =
      EARTH_RADIUS_METERS *
      toRadians(
        target.longitude -
        point.longitude
      ) *
      longitudeScale;

    const y =
      EARTH_RADIUS_METERS *
      toRadians(
        target.latitude -
        point.latitude
      );

    return {
      x,
      y
    };
  };

  const start =
    toLocalMeters(segmentStart);

  const end =
    toLocalMeters(segmentEnd);

  const segmentX =
    end.x - start.x;

  const segmentY =
    end.y - start.y;

  const segmentLengthSquared =
    segmentX ** 2 +
    segmentY ** 2;

  /**
   * 始点と終点が同じ座標の場合
   */
  if (segmentLengthSquared === 0) {
    return Math.hypot(
      start.x,
      start.y
    );
  }

  const projectionRatio =
    Math.max(
      0,
      Math.min(
        1,
        -(
          start.x * segmentX +
          start.y * segmentY
        ) /
        segmentLengthSquared
      )
    );

  const closestX =
    start.x +
    segmentX * projectionRatio;

  const closestY =
    start.y +
    segmentY * projectionRatio;

  return Math.hypot(
    closestX,
    closestY
  );
};

/**
 * POIから歩行ルート全体までの
 * 最短距離を計算する
 */
const calculatePoiRouteDistance = (
  poi,
  routeParts
) => {
  let minimumDistanceMeters =
    Infinity;

  routeParts.forEach((part) => {
    for (
      let pointIndex = 1;
      pointIndex < part.length;
      pointIndex += 1
    ) {
      const segmentStart =
        part[pointIndex - 1];

      const segmentEnd =
        part[pointIndex];

      const distanceMeters =
        calculatePointToSegmentDistanceMeters(
          poi,
          segmentStart,
          segmentEnd
        );

      minimumDistanceMeters =
        Math.min(
          minimumDistanceMeters,
          distanceMeters
        );
    }
  });

  return Number.isFinite(
    minimumDistanceMeters
  )
    ? minimumDistanceMeters
    : null;
};

/**
 * POIと歩行ルートの接近状況を判定する
 */
const analyzePoiProximity = (
  routeParts,
  stops
) => {
  return currentPoiData.map((poi) => {
    const routeDistanceMeters =
      calculatePoiRouteDistance(
        poi,
        routeParts
      );

    let nearestStopDistanceMeters =
      Infinity;

    stops.forEach((stop) => {
      const distanceMeters =
        calculateDistanceMeters(
          poi,
          stop
        );

      nearestStopDistanceMeters =
        Math.min(
          nearestStopDistanceMeters,
          distanceMeters
        );
    });

    const nearStop =
      nearestStopDistanceMeters <=
      STOP_RADIUS_METERS;

    let proximityType = "far";

    if (nearStop) {
      proximityType = "stop";
    } else if (
      routeDistanceMeters !== null &&
      routeDistanceMeters <= 20
    ) {
      proximityType = "passed";
    } else if (
      routeDistanceMeters !== null &&
      routeDistanceMeters <= 40
    ) {
      proximityType = "near";
    }

    return {
      ...poi,
      routeDistanceMeters,
      nearestStopDistanceMeters:
        Number.isFinite(
          nearestStopDistanceMeters
        )
          ? nearestStopDistanceMeters
          : null,
      nearStop,
      proximityType
    };
  });
};
/**
 * 停止地点を検出する
 *
 * 判定条件：
 * ・開始地点から半径20m以内
 * ・2分以上滞在
 */
const detectStops = (segments) => {
  const stops = [];

  segments.forEach((segment, segmentIndex) => {
    let startIndex = 0;

    while (startIndex < segment.length - 1) {
      const startPoint = segment[startIndex];

      if (!startPoint.time) {
        startIndex += 1;
        continue;
      }

      let searchIndex = startIndex + 1;
      let lastInsideIndex = startIndex;

      while (searchIndex < segment.length) {
        const currentPoint = segment[searchIndex];
        const previousPoint = segment[searchIndex - 1];

        if (
          !currentPoint.time ||
          !previousPoint.time
        ) {
          break;
        }

        const stepDurationSeconds =
          (currentPoint.time.getTime() -
            previousPoint.time.getTime()) /
          1000;

        /**
         * 時刻異常または長時間の記録切れ
         */
        if (
          stepDurationSeconds <= 0 ||
          stepDurationSeconds >
            MAX_TIME_GAP_SECONDS
        ) {
          break;
        }

        const distanceFromStart =
          calculateDistanceMeters(
            startPoint,
            currentPoint
          );

        /**
         * 半径20mを超えたら停止範囲を離れたと判定
         */
        if (
          distanceFromStart >
          STOP_RADIUS_METERS
        ) {
          break;
        }

        lastInsideIndex = searchIndex;
        searchIndex += 1;
      }

      if (lastInsideIndex > startIndex) {
        const endPoint =
          segment[lastInsideIndex];

        const durationSeconds =
          (endPoint.time.getTime() -
            startPoint.time.getTime()) /
          1000;

        if (
          durationSeconds >=
          MIN_STOP_DURATION_SECONDS
        ) {
          const stopPoints = segment.slice(
            startIndex,
            lastInsideIndex + 1
          );

          /**
           * 停止中の各座標を平均し、
           * 停止地点の中心座標を求める
           */
          const latitude =
            stopPoints.reduce(
              (sum, point) =>
                sum + point.latitude,
              0
            ) / stopPoints.length;

          const longitude =
            stopPoints.reduce(
              (sum, point) =>
                sum + point.longitude,
              0
            ) / stopPoints.length;

          stops.push({
            segmentIndex,
            startPointIndex: startIndex,
            endPointIndex: lastInsideIndex,
            latitude,
            longitude,
            startedAt: startPoint.time,
            endedAt: endPoint.time,
            durationSeconds,
            pointCount: stopPoints.length
          });

          /**
           * 検出済みの停止地点は重複判定しない
           */
          startIndex =
            lastInsideIndex + 1;

          continue;
        }
      }

      startIndex += 1;
    }
  });

  return stops;
};
  /**
   * GPXの移動距離・速度・異常区間を解析する
   */
  const analyzeTrack = (gpxData) => {
    let totalDistanceMeters = 0;
    let timedDistanceMeters = 0;
    let timedDurationSeconds = 0;
    let maximumSpeedKmh = null;
    let untimedSectionCount = 0;

    const validSections = [];
    const excludedSections = [];

    /**
     * 除外区間を記録する
     */
    const excludeSection = (
      section,
      reason
    ) => {
      excludedSections.push({
        ...section,
        reason
      });
    };

    gpxData.segments.forEach(
      (segment, segmentIndex) => {
        for (
          let pointIndex = 1;
          pointIndex < segment.length;
          pointIndex += 1
        ) {
          const previousPoint =
            segment[pointIndex - 1];

          const currentPoint =
            segment[pointIndex];

          const distanceMeters =
            calculateDistanceMeters(
              previousPoint,
              currentPoint
            );

          const baseSection = {
            segmentIndex,
            fromPointIndex: pointIndex - 1,
            toPointIndex: pointIndex,
            distanceMeters
          };

          /**
           * 距離が計算できない場合
           */
          if (!Number.isFinite(distanceMeters)) {
            excludeSection(
              baseSection,
              "距離計算不可"
            );

            continue;
          }

          /**
           * 時刻情報が不足している場合
           *
           * 距離には加算するが、
           * 平均速度と最高速度には使用しない
           */
          if (
            !previousPoint.time ||
            !currentPoint.time
          ) {
            totalDistanceMeters +=
              distanceMeters;

            untimedSectionCount += 1;

            validSections.push({
              ...baseSection,
              durationSeconds: null,
              speedKmh: null
            });

            continue;
          }

          const durationSeconds =
            (currentPoint.time.getTime() -
              previousPoint.time.getTime()) /
            1000;

          /**
           * 時刻が逆転または重複している場合
           */
          if (durationSeconds <= 0) {
            excludeSection(
              {
                ...baseSection,
                durationSeconds
              },
              "時刻の逆転または重複"
            );

            continue;
          }

          /**
           * 5分を超えて記録が途切れている場合
           */
          if (
            durationSeconds >
            MAX_TIME_GAP_SECONDS
          ) {
            excludeSection(
              {
                ...baseSection,
                durationSeconds
              },
              "記録間隔が5分超"
            );

            continue;
          }

          const speedKmh =
            (distanceMeters /
              durationSeconds) *
            3.6;

          /**
           * 歩行として25km/hを超える場合
           */
          if (
            speedKmh >
            MAX_WALK_SPEED_KMH
          ) {
            excludeSection(
              {
                ...baseSection,
                durationSeconds,
                speedKmh
              },
              "歩行として25km/h超"
            );

            continue;
          }

          totalDistanceMeters +=
            distanceMeters;

          timedDistanceMeters +=
            distanceMeters;

          timedDurationSeconds +=
            durationSeconds;

          maximumSpeedKmh =
            maximumSpeedKmh === null
              ? speedKmh
              : Math.max(
                  maximumSpeedKmh,
                  speedKmh
                );

          validSections.push({
            ...baseSection,
            durationSeconds,
            speedKmh
          });
        }
      }
    );

    const timedPoints =
      gpxData.points.filter(
        (point) => point.time
      );

    const firstTimedPoint =
      timedPoints[0] ?? null;

    const lastTimedPoint =
      timedPoints[
        timedPoints.length - 1
      ] ?? null;

    let recordedDurationSeconds = null;

    if (
      firstTimedPoint &&
      lastTimedPoint
    ) {
      const value =
        (lastTimedPoint.time.getTime() -
          firstTimedPoint.time.getTime()) /
        1000;

      if (value >= 0) {
        recordedDurationSeconds = value;
      }
    }
/**
 * 停止地点を検出する
 */
const stops = detectStops(
  gpxData.segments
);

const stoppedDurationSeconds =
  stops.reduce(
    (total, stop) =>
      total + stop.durationSeconds,
    0
  );

const movingDurationSeconds = Math.max(
  0,
  timedDurationSeconds -
    stoppedDurationSeconds
);

    return {
      pointCount: gpxData.points.length,
      timedPointCount: timedPoints.length,
      segmentCount: gpxData.segments.length,
      recordedDurationSeconds,
      totalDistanceMeters,

      averageSpeedKmh:
        timedDurationSeconds > 0
          ? (timedDistanceMeters /
              timedDurationSeconds) *
            3.6
          : null,

      maximumSpeedKmh,

      movingDurationSeconds,
      stoppedDurationSeconds,
      stopCount: stops.length,
stops,
      excludedSectionCount:
        excludedSections.length,
      untimedSectionCount,
      validSections,
      excludedSections
    };
  };

  /**
   * 秒を読みやすい時間へ変換する
   */
  const formatDuration = (seconds) => {
    if (!Number.isFinite(seconds)) {
      return "時刻情報なし";
    }

    const totalSeconds = Math.max(
      0,
      Math.round(seconds)
    );

    const hours = Math.floor(
      totalSeconds / 3600
    );

    const minutes = Math.floor(
      (totalSeconds % 3600) / 60
    );

    const remainingSeconds =
      totalSeconds % 60;

    if (hours > 0) {
      return remainingSeconds > 0
        ? `${hours}時間${minutes}分${remainingSeconds}秒`
        : `${hours}時間${minutes}分`;
    }

    if (minutes > 0) {
      return remainingSeconds > 0
        ? `${minutes}分${remainingSeconds}秒`
        : `${minutes}分`;
    }

    return `${remainingSeconds}秒`;
  };

  /**
   * 距離を読みやすい文字列へ変換する
   */
  const formatDistance = (meters) => {
    if (!Number.isFinite(meters)) {
      return "計算不可";
    }

    if (meters >= 1000) {
      return `${(
        meters / 1000
      ).toFixed(3)}km`;
    }

    return `${Math.round(
      meters
    )}m（${(
      meters / 1000
    ).toFixed(3)}km）`;
  };

  /**
   * 速度を読みやすい文字列へ変換する
   */
  const formatSpeed = (kmh) => {
    return Number.isFinite(kmh)
      ? `${kmh.toFixed(2)}km/h`
      : "計算不可";
  };
  /**
 * 解析カード用の距離表示
 */
const formatSummaryDistance = (meters) => {
  if (!Number.isFinite(meters)) {
    return "--";
  }

  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)}km`;
  }

  return `${Math.round(meters)}m`;
};

/**
 * 解析結果カードを表示する
 */
const renderSummaryCards = (analysis) => {
  summaryDistance.textContent =
    formatSummaryDistance(
      analysis.totalDistanceMeters
    );

  summaryRecordedTime.textContent =
    formatDuration(
      analysis.recordedDurationSeconds
    );

  summaryMovingTime.textContent =
    formatDuration(
      analysis.movingDurationSeconds
    );

  summaryStoppedTime.textContent =
    formatDuration(
      analysis.stoppedDurationSeconds
    );

  summaryAverageSpeed.textContent =
    formatSpeed(
      analysis.averageSpeedKmh
    );

  summaryStopCount.textContent =
    `${analysis.stopCount.toLocaleString()}件`;

  summaryGrid.hidden = false;
  actionArea.hidden = false;
};
/**
 * POI接近判定の件数を表示する
 */
const renderPoiSummaryCards = (
  analyzedPoiData
) => {
  const counts = {
    passed: 0,
    near: 0,
    stop: 0,
    far: 0
  };

  analyzedPoiData.forEach((poi) => {
    const proximityType =
      poi.proximityType;

    if (
      Object.hasOwn(
        counts,
        proximityType
      )
    ) {
      counts[proximityType] += 1;
    }
  });

  summaryPassedPoi.textContent =
    `${counts.passed.toLocaleString()}件`;

  summaryNearPoi.textContent =
    `${counts.near.toLocaleString()}件`;

  summaryStopPoi.textContent =
    `${counts.stop.toLocaleString()}件`;

  summaryFarPoi.textContent =
    `${counts.far.toLocaleString()}件`;
};
/**
 * Dateを時刻表示へ変換する
 */
const formatClockTime = (date) => {
  if (!(date instanceof Date)) {
    return "時刻不明";
  }

  return date.toLocaleTimeString(
    "ja-JP",
    {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }
  );
};

/**
 * Leafletのポップアップ内容を安全に作る
 */
const createMapPopup = (title, rows) => {
  const container = document.createElement("div");
  container.className = "walk-map-popup";

  const heading = document.createElement("strong");
  heading.textContent = title;
  container.appendChild(heading);

  rows.forEach((row) => {
    const line = document.createElement("div");
    line.textContent = row;
    container.appendChild(line);
  });

  return container;
};

/**
 * GPS除外区間をまたがない描画用ルートを作る
 */
const buildRouteParts = (gpxData, analysis) => {
  const validSectionKeys = new Set(
    analysis.validSections.map(
      (section) =>
        `${section.segmentIndex}:${section.fromPointIndex}:${section.toPointIndex}`
    )
  );

  const routeParts = [];

  gpxData.segments.forEach((segment, segmentIndex) => {
    let currentPart = [];

    for (let pointIndex = 1; pointIndex < segment.length; pointIndex += 1) {
      const key = `${segmentIndex}:${pointIndex - 1}:${pointIndex}`;

      if (validSectionKeys.has(key)) {
        if (currentPart.length === 0) {
          currentPart.push(segment[pointIndex - 1]);
        }

        currentPart.push(segment[pointIndex]);
        continue;
      }

      if (currentPart.length >= 2) {
        routeParts.push(currentPart);
      }

      currentPart = [];
    }

    if (currentPart.length >= 2) {
      routeParts.push(currentPart);
    }
  });

  return routeParts;
};

/**
 * 歩行ルート地図を初期化する
 */
const initializeWalkMap = () => {
  if (walkMap) {
    return walkMap;
  }

  if (!window.L) {
    throw new Error("地図ライブラリを読み込めませんでした。");
  }

  walkMap = window.L.map(mapElement, {
    preferCanvas: true,
    zoomControl: true
  });

  window.L.tileLayer(
    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }
  ).addTo(walkMap);

  walkMapLayerGroup = window.L.layerGroup().addTo(walkMap);

  return walkMap;
};

/**
 * 前回の地図解析結果を消す
 */
const clearWalkMap = () => {
  if (walkMapLayerGroup) {
    walkMapLayerGroup.clearLayers();
  }

  currentRouteBounds = null;
  mapFitButton.hidden = true;
  mapSection.hidden = true;
};
/**
 * 地図を歩行ルート全体へ戻す
 */
const fitWalkMapToRoute = () => {
  if (
    !walkMap ||
    !currentRouteBounds ||
    !currentRouteBounds.isValid()
  ) {
    return;
  }

  walkMap.invalidateSize();

  walkMap.fitBounds(
    currentRouteBounds.pad(0.15),
    {
      padding: [24, 24],
      maxZoom: 18
    }
  );
};
/**
 * 歩行ルート、開始・終了地点、停止地点を地図へ描画する
 */
const renderWalkMap = (gpxData, analysis) => {
  mapSection.hidden = false;

  const map = initializeWalkMap();
  walkMapLayerGroup.clearLayers();

  const routeParts = buildRouteParts(gpxData, analysis);
  const bounds = window.L.latLngBounds([]);
  const analyzedPoiData =
  analyzePoiProximity(
    routeParts,
    analysis.stops
  );
  renderPoiSummaryCards(
  analyzedPoiData
);
  routeParts.forEach((part) => {
    const latLngs = part.map((point) => [
      point.latitude,
      point.longitude
    ]);

    window.L.polyline(latLngs, {
      color: "#38bdf8",
      weight: 5,
      opacity: 0.9
    }).addTo(walkMapLayerGroup);

    latLngs.forEach((latLng) => bounds.extend(latLng));
  });

  const firstRoutePoint = routeParts[0]?.[0] ?? gpxData.points[0] ?? null;
  const lastRoutePart = routeParts[routeParts.length - 1] ?? null;
  const lastRoutePoint =
    lastRoutePart?.[lastRoutePart.length - 1] ??
    gpxData.points[gpxData.points.length - 1] ??
    null;

  if (firstRoutePoint) {
    const startLatLng = [
      firstRoutePoint.latitude,
      firstRoutePoint.longitude
    ];

    window.L.circleMarker(startLatLng, {
      radius: 8,
      color: "#86efac",
      fillColor: "#22c55e",
      fillOpacity: 1,
      weight: 3
    })
      .bindPopup(
        createMapPopup("スタート", [
          `時刻：${formatClockTime(firstRoutePoint.time)}`
        ])
      )
      .addTo(walkMapLayerGroup);

    bounds.extend(startLatLng);
  }

  if (lastRoutePoint) {
    const goalLatLng = [
      lastRoutePoint.latitude,
      lastRoutePoint.longitude
    ];

    window.L.circleMarker(goalLatLng, {
      radius: 8,
      color: "#fca5a5",
      fillColor: "#ef4444",
      fillOpacity: 1,
      weight: 3
    })
      .bindPopup(
        createMapPopup("ゴール", [
          `時刻：${formatClockTime(lastRoutePoint.time)}`
        ])
      )
      .addTo(walkMapLayerGroup);

    bounds.extend(goalLatLng);
  }

  analysis.stops.forEach((stop, index) => {
    const stopLatLng = [stop.latitude, stop.longitude];

    window.L.circle(stopLatLng, {
      radius: STOP_RADIUS_METERS,
      color: "#fde047",
      fillColor: "#facc15",
      fillOpacity: 0.12,
      weight: 1
    }).addTo(walkMapLayerGroup);

    window.L.circleMarker(stopLatLng, {
      radius: 7,
      color: "#fef08a",
      fillColor: "#eab308",
      fillOpacity: 1,
      weight: 3
    })
      .bindPopup(
        createMapPopup(`停止地点 ${index + 1}`, [
          `時刻：${formatClockTime(stop.startedAt)}〜${formatClockTime(
            stop.endedAt
          )}`,
          `停止時間：${formatDuration(stop.durationSeconds)}`,
          `記録地点：${stop.pointCount}件`
        ])
      )
      .addTo(walkMapLayerGroup);

    bounds.extend(stopLatLng);
  });
/**
 * POIを歩行ルート地図へ重ねる
 */
analyzedPoiData.forEach((poi) => {
  /**
   * 未接近POIは初期状態ではルートから100m以内だけ表示する。
   * 集計件数には影響させず、地図描画だけを絞り込む。
   */
  const isFarPoiVisible =
    poi.proximityType !== "far" ||
    showAllFarPoi ||
    (
      Number.isFinite(
        poi.routeDistanceMeters
      ) &&
      poi.routeDistanceMeters <=
        FAR_POI_VISIBLE_DISTANCE_METERS
    );

  if (!isFarPoiVisible) {
    return;
  }

  let markerColor = "#64748b";
  let label = "未接近";

  if (poi.proximityType === "passed") {
    markerColor = "#22c55e";
    label = "通過";
  } else if (poi.proximityType === "near") {
  markerColor = "#f97316";
  label = "近接";
}
 else if (poi.proximityType === "stop") {
    markerColor = "#a855f7";
    label = "停止地点付近";
  }

  const latLng = [
    poi.latitude,
    poi.longitude
  ];

  window.L.circleMarker(latLng, {
    radius: 7,
    color: "#ffffff",
    fillColor: markerColor,
    fillOpacity: 0.95,
    weight: 2
  })
    .bindPopup(
      createMapPopup(
        poi.name,
        [
          `判定：${label}`,
          `ルートまで：約${
            poi.routeDistanceMeters === null
              ? "不明"
              : Math.round(
                  poi.routeDistanceMeters
                )
          }m`,
          `分類：${poi.category}`
        ]
      )
    )
    .addTo(walkMapLayerGroup);
});
  if (bounds.isValid()) {
  currentRouteBounds = bounds;
  mapFitButton.hidden = false;

  fitWalkMapToRoute();
}

window.setTimeout(() => {
  map.invalidateSize();
  fitWalkMapToRoute();
}, 0);
};
  /**
   * 解析結果の表示文を作る
   */
  /**
 * 解析結果の表示文を作る
 */
const createGpxSummary = (
  file,
  gpxData,
  analysis
) => {
  const lines = [
    `ファイル：${file.name}`,
    `ルート名：${gpxData.trackName}`,
    `記録区間：${analysis.segmentCount.toLocaleString()}区間`,
    `記録地点：${analysis.pointCount.toLocaleString()}件`,
    `時刻付き地点：${analysis.timedPointCount.toLocaleString()}件`,
    `記録時間：${formatDuration(
      analysis.recordedDurationSeconds
    )}`,
    `総移動距離：${formatDistance(
      analysis.totalDistanceMeters
    )}`,
    `移動時間：${formatDuration(
      analysis.movingDurationSeconds
    )}`,
    `停止時間：${formatDuration(
      analysis.stoppedDurationSeconds
    )}`,
    `停止地点：${analysis.stopCount.toLocaleString()}件`,
    `平均速度：${formatSpeed(
      analysis.averageSpeedKmh
    )}`,
    `最高速度：${formatSpeed(
      analysis.maximumSpeedKmh
    )}`,
    `GPS除外区間：${analysis.excludedSectionCount.toLocaleString()}件`
  ];

  if (
    analysis.untimedSectionCount > 0
  ) {
    lines.push(
      `時刻不足区間：${analysis.untimedSectionCount.toLocaleString()}件`
    );
  }

  if (analysis.stops.length > 0) {
    lines.push("");
    lines.push("停止地点一覧");

    analysis.stops.forEach(
      (stop, index) => {
        lines.push(
          `${index + 1}. ` +
            `${formatClockTime(
              stop.startedAt
            )}〜${formatClockTime(
              stop.endedAt
            )} ` +
            `／ ${formatDuration(
              stop.durationSeconds
            )}`
        );
      }
    );
  }

  return lines.join("\n");
};

/**
 * 歩行解析結果を初期状態へ戻す
 */
const clearWalkAnalysis = () => {
  currentGpxData = null;
  currentWalkAnalysis = null;
  showAllFarPoi = false;
  updateFarPoiToggleButton();

  clearWalkMap();

  summaryGrid.hidden = true;
  actionArea.hidden = true;

  summaryDistance.textContent = "--";
  summaryRecordedTime.textContent = "--";
  summaryMovingTime.textContent = "--";
  summaryStoppedTime.textContent = "--";
  summaryAverageSpeed.textContent = "--";
  summaryStopCount.textContent = "--";
summaryPassedPoi.textContent = "--";
summaryNearPoi.textContent = "--";
summaryStopPoi.textContent = "--";
summaryFarPoi.textContent = "--";
  fileInput.value = "";

  setStatus(
    "GPXファイルを選択してください。"
  );
};
  updateFarPoiToggleButton();

  /**
   * 時計ボタン
   */
  openButton.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
      togglePanel();
    }
  );

  /**
   * 閉じるボタン
   */
  closeButton.addEventListener(
    "click",
    (event) => {
      event.stopPropagation();
      closePanel();
    }
  );

  /**
   * GPX選択ボタン
   */
  fileButton.addEventListener(
    "click",
    () => {
      fileInput.click();
    }
  );
/**
 * 別のGPXを選択する
 */
changeButton.addEventListener(
  "click",
  () => {
    fileInput.value = "";
    fileInput.click();
  }
);

/**
 * 解析結果をクリアする
 */
clearButton.addEventListener(
  "click",
  () => {
    clearWalkAnalysis();
    fileButton.focus();
  }
);

/**
 * 地図をルート全体へ戻す
 */
mapFitButton.addEventListener(
  "click",
  () => {
    fitWalkMapToRoute();
  }
);

/**
 * 未接近POIの100m以内／全表示を切り替える
 */
farPoiToggleButton.addEventListener(
  "click",
  () => {
    showAllFarPoi = !showAllFarPoi;
    updateFarPoiToggleButton();

    if (
      currentGpxData &&
      currentWalkAnalysis
    ) {
      try {
        renderWalkMap(
          currentGpxData,
          currentWalkAnalysis
        );
      } catch (error) {
        console.error(
          "未接近POI表示切替後の地図更新に失敗しました:",
          error
        );
      }
    }
  }
);
  /**
   * GPXファイル選択時
   */
  fileInput.addEventListener(
    "change",
    async () => {
      const selectedFile =
        fileInput.files?.[0];

      if (!selectedFile) {
        return;
      }

      if (
        !selectedFile.name
          .toLowerCase()
          .endsWith(".gpx")
      ) {
        setStatus(
          "GPX形式のファイルを選択してください。",
          "error"
        );

        fileInput.value = "";
        return;
      }

      clearWalkMap();

summaryGrid.hidden = true;
actionArea.hidden = true;

setStatus(
  "GPXファイルを解析しています…",
  "loading"
);

      try {
        const gpxText =
          await selectedFile.text();

        const gpxData =
          parseGpx(gpxText);

        const analysis =
          analyzeTrack(gpxData);

        currentGpxData = gpxData;
        currentWalkAnalysis = analysis;

        console.log(
          "GPX解析結果:",
          {
            file: selectedFile.name,
            gpxData,
            analysis
          }
        );

        const summary = createGpxSummary(
          selectedFile,
          gpxData,
          analysis
        );

        setStatus(summary, "success");

        renderSummaryCards(analysis);
        try {
          renderWalkMap(gpxData, analysis);
        } catch (mapError) {
          console.error("歩行ルート地図の表示エラー:", mapError);
          mapSection.hidden = true;
          setStatus(
            `${summary}\n地図表示：失敗しました。`,
            "error"
          );
        }
      } catch (error) {
        console.error(
          "GPX解析エラー:",
          error
        );

        setStatus(
          error instanceof Error
            ? error.message
            : "GPXの解析中にエラーが発生しました。",
          "error"
        );
      }
    }
  );

  /**
   * パネル外を押したときに閉じる
   */
  document.addEventListener(
    "click",
    (event) => {
      const launcher =
        document.querySelector(
          ".walk-import-launcher"
        );

      if (
        !launcher ||
        panel.hidden
      ) {
        return;
      }

      if (
        !launcher.contains(event.target)
      ) {
        closePanel();
      }
    }
  );

  /**
   * Escapeキーで閉じる
   */
  document.addEventListener(
    "keydown",
    (event) => {
      if (
        event.key === "Escape" &&
        !panel.hidden
      ) {
        closePanel();
        openButton.focus();
      }
    }
  );
  /**
 * LabEngineからPOIデータを受け取る公開窓口
 */
window.CampsiteWalkAnalysis = {
  setPoiData(poiList) {
    currentPoiData =
      normalizePoiData(poiList);

    console.log(
      "歩行解析へPOIデータを受け取りました:",
      currentPoiData
    );

    if (
      currentGpxData &&
      currentWalkAnalysis
    ) {
      try {
        renderWalkMap(
          currentGpxData,
          currentWalkAnalysis
        );
      } catch (error) {
        console.error(
          "POI追加後の歩行地図更新に失敗しました:",
          error
        );
      }
    }

    return {
      receivedCount:
        Array.isArray(poiList)
          ? poiList.length
          : 0,

      validCount:
        currentPoiData.length
    };
  },

  getPoiData() {
    return [...currentPoiData];
  },

  clearPoiData() {
    currentPoiData = [];

    if (
      currentGpxData &&
      currentWalkAnalysis
    ) {
      try {
        renderWalkMap(
          currentGpxData,
          currentWalkAnalysis
        );
      } catch (error) {
        console.error(
          "POIクリア後の歩行地図更新に失敗しました:",
          error
        );
      }
    }

    console.log(
      "歩行解析のPOIデータをクリアしました。"
    );
  }
};
});