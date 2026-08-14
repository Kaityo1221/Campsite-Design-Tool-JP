/* 50m円をPOI判定対象から除外する補助パッチ。 */
(() => {
  "use strict";

  const is50mCircleLayer = layerName => {
    const name = String(layerName || "").normalize("NFKC").toLowerCase();
    return name.includes("50m") && (name.includes("円") || name.includes("circle") || name.includes("buffer"));
  };

  const originalAuxiliary = window.isAuxiliaryLayer;
  if (typeof originalAuxiliary === "function" && !originalAuxiliary.__poiSpacing50mPatched) {
    const wrapped = function (layerName, ...args) {
      if (is50mCircleLayer(layerName)) return true;
      return originalAuxiliary.call(this, layerName, ...args);
    };
    Object.defineProperty(wrapped, "__poiSpacing50mPatched", { value: true });
    window.isAuxiliaryLayer = wrapped;
  }

  const originalTarget = window.isDistanceTargetLayer;
  if (typeof originalTarget === "function" && !originalTarget.__poiSpacing50mPatched) {
    const wrapped = function (layerName, ...args) {
      if (is50mCircleLayer(layerName)) return false;
      return originalTarget.call(this, layerName, ...args);
    };
    Object.defineProperty(wrapped, "__poiSpacing50mPatched", { value: true });
    window.isDistanceTargetLayer = wrapped;
  }

  const originalDiagnosisLevel = window.getVisibleDiagnosisAdviceLevel;
  if (typeof originalDiagnosisLevel === "function") {
    window.getVisibleDiagnosisAdviceLevel = function (text) {
      const normalized = String(text || "");
      if (/50m|40m|30m|25個|レイヤー/.test(normalized)) {
        return window.CAMPSITE_ADVICE_LEVELS?.REQUIRED || "required";
      }
      return originalDiagnosisLevel.call(this, text);
    };
  }
})();
