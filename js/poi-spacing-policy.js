/* ======================================================
   POI spacing policy 2026-08-15

   現行方針
   - POI間隔は原則50m
   - 30m未満は要修正
   - 30m以上50m未満は要確認
   - 30m・40m円は距離確認のための参考表示
   - 密集・滞留などの分類はイベント時の安全性確認であり、
     POI間隔50m基準とは別判定
====================================================== */

(() => {
  "use strict";

  const POLICY = window.CampsitePoiSpacingPolicy;
  if (!POLICY) return;
  const TARGET_METERS = window.CampsitePoiSpacingPolicy.targetMeters;

  const FINAL_NOTE =
    "この結果は距離確認のための参考情報です。最終的にはコミュニティに合った遊び場を作ることを大切にしてください。";
  const SAFETY_NOTE =
    "※この分類はイベント時の滞留・安全性を確認するための目安です。POI間隔の50m基準とは別の判定です。";

  function replaceFunctionSource(name, transform) {
    const original = window[name];
    if (typeof original !== "function" || original.__poiSpacing50mFinalPatched) return;

    try {
      const source = original.toString();
      const transformed = transform(source);
      if (!transformed || transformed === source) return;

      const patched = Function(`"use strict"; return (${transformed});`)();
      Object.defineProperty(patched, "__poiSpacing50mFinalPatched", { value: true });
      window[name] = patched;
    } catch (error) {
      console.warn(`[POI 50m] ${name} の更新に失敗しました。`, error);
    }
  }

  function ensureFixedRadiusInput(groupName, anchorInput) {
    if (!anchorInput) return;

    let input = document.querySelector(`input[name="${groupName}"][value="50"]`);
    let label = input?.closest("label");

    if (!input) {
      label = document.createElement("label");
      input = document.createElement("input");
      input.type = "checkbox";
      input.name = groupName;
      input.value = "50";
      label.appendChild(input);

      const parent = anchorInput.closest(".checks") || anchorInput.parentElement?.parentElement;
      const firstLabel = anchorInput.closest("label");
      if (!parent) return;

      if (firstLabel && firstLabel.parentElement === parent) {
        parent.insertBefore(label, firstLabel);
        parent.insertBefore(document.createElement("br"), firstLabel);
      } else {
        parent.prepend(label);
        parent.insertBefore(document.createElement("br"), label.nextSibling);
      }
    }

    input.checked = true;
    input.disabled = true;
    label?.replaceChildren(input, document.createTextNode(" 50m円（原則）"));
  }

  function normalizeRadiusOption(groupName) {
    const inputs = Array.from(document.querySelectorAll(`input[name="${groupName}"]`));
    const refs = inputs.filter(input => [30, 40].includes(Number(input.value)));
    const anchor = refs.find(input => Number(input.value) === 40) || refs[0];

    ensureFixedRadiusInput(groupName, anchor);

    refs.forEach(input => {
      input.checked = false;
      const label = input.closest("label");
      if (!label) return;
      label.replaceChildren(input, document.createTextNode(` ${input.value}m円（参考）`));
    });
  }

  function patchStaticCopy(root = document) {
    normalizeRadiusOption("circleOnlyRadius");
    normalizeRadiusOption("radius");

    const circleInput = document.getElementById("circleOnlyFileInput");
    const circleStep = circleInput?.closest(".step");
    if (circleStep) {
      const notes = Array.from(circleStep.querySelectorAll("p.note"));
      if (notes[0]) {
        notes[0].innerHTML =
          "50mの円は、原則となるPOI間隔を確認するために表示します。<br>" +
          "30m・40mの円は、あくまで距離確認のための参考表示です。POI間隔は原則50mです。";
      }
    }

    root.querySelectorAll(".distance-entry-details-body").forEach(node => {
      node.innerHTML = node.innerHTML
        .replace(/距離条件/g, "POI間の距離")
        .replace(/30m円・40m円/g, "30m・40m・50m円")
        .replace(/30m・40m円/g, "30m・40m・50m円");
    });

    root.querySelectorAll("button").forEach(button => {
      if ((button.textContent || "").includes("距離条件をチェック")) {
        button.textContent = "POI間の距離をチェック";
      }
    });
  }

  function patchPreSubmitCopy(root = document) {
    root.querySelectorAll(".pre-submit-item").forEach(item => {
      const strong = item.querySelector("strong");
      const small = item.querySelector("small");
      const text = strong?.textContent || "";

      if (/POI間隔.*40m|POI間隔.*50m/.test(text)) {
        strong.textContent = "POI間隔は原則50mです";
        if (small) {
          small.textContent = "30m・40mは、あくまで距離確認のための参考です。";
        }
      }
    });
  }

  function patchDistanceFunctions() {
    if (typeof window.classifyDistanceRisk === "function") {
      window.classifyDistanceRisk = function classifyDistanceRisk50m(distance) {
        if (distance < 20) return "密集";
        if (distance < 30) return "滞留";
        const band = POLICY.distanceBand(distance);
        if (band === "caution" || band === "near") return "軽微";
        return null;
      };
    }

    if (typeof window.getDistanceAdviceRuleText === "function") {
      window.getDistanceAdviceRuleText = function getDistanceAdviceRuleText50m(type) {
        if (type === "密集" || type === "滞留") {
          return "30m未満です。配置の見直しをお願いします。";
        }
        return `POI間隔は原則${TARGET_METERS}mです。${TARGET_METERS}m未満の箇所は、状況により調整が必要になる場合があります。`;
      };
    }

    replaceFunctionSource("getRiskAccordionHtml", source => source
      .replace(/軽微（30m以上40m未満）/g, "軽微（30m以上50m未満）")
      .replace(/参考距離（30m以上50m未満）/g, "軽微（30m以上50m未満）")
      .replace(/30m以上40m未満です。40m基本には届きませんが、30m調整圏内として確認します。/g,
        "状況により調整が必要になる場合があります。")
      .replace(/30m以上50m未満です。[^"`]*参考距離[^"`]*/g,
        "状況により調整が必要になる場合があります。")
      .replace(/△ 調整可能距離/g, "△ 要確認")
      .replace(/⚠ 調整対象/g, "⚠ 要修正")
    );

    // distance-entry.js が既にラップ済みの場合、Function再生成すると
    // クロージャ originalRunDistanceCheck が失われるため、ラッパーは書き換えない。
    if (!String(window.runDistanceCheck || "").includes("originalRunDistanceCheck")) {
      replaceFunctionSource("runDistanceCheck", source => source
      .replace(/let resultStatus = "問題なし";/g, 'let resultStatus = "50m以上";')
      .replace(/resultStatus = "調整あり";/g, 'resultStatus = "30m未満あり";')
      .replace(/resultStatusIcon = "⚠";/g, 'resultStatusIcon = "🚨";')
      .replace(/resultStatus = "参考距離あり";/g, 'resultStatus = "50m未満あり";')
      .replace(/30〜50m参考：/g, "30m〜50m未満：")
      .replace(/30〜50m（参考距離）：/g, "30m〜50m未満：")
      .replace(/50m未満合計：/g, "50m未満の組み合わせ：")
      .replace(/50m未満の組み合わせはありません。/g, "50m未満のPOIはありません。")
      .replace(/`✅ 問題なし（\$\{points.length\}件）<br><br>`/g,
        '`✅ 50m未満のPOIはありません。<br><br>`')
      .replace(/sectionTitleHtml\("判定結果", "50m未満の近接件数を確認します。30m・40mは参考距離です。"\)/g,
        'sectionTitleHtml("判定結果", "POI間隔は原則50mです。30m・40mは状況に応じた確認のための目安として表示しています。")')
      .replace(/sectionTitleHtml\("分類別チェック", "近接内容を密集・滞留・参考距離に分けて確認します。"\)/g,
        `sectionTitleHtml("分類別チェック", "${SAFETY_NOTE}")`)
      .replace(/sectionTitleHtml\("追加・変更対象の近接", "30m未満は要注意、30m以上50m未満は参考距離として確認します。"\)/g,
        'sectionTitleHtml("50m未満の箇所", "POI間隔は原則50mです。30m未満は要修正、30m以上50m未満は要確認です。")')
      .replace(/const targetWarnings = warnings\.filter\(w => \{\s*return !isExistingPoiPair\(w\) && w\.distance < 30;\s*\}\);/g,
        'const targetWarnings = warnings.filter(w => {\n  return !isExistingPoiPair(w) && w.distance < 50;\n});')
      .replace(/label = "⚠ 要注意";/g, 'label = "⚠ 要修正";')
      .replace(/message = "30m未満です。再確認をお願いします。";/g,
        'message = "30m未満です。配置の見直しをお願いします。";')
      .replace(/message = "50m未満です。30m・40mは参考距離として確認してください。";/g,
        'message = "状況により調整が必要になる場合があります。";')
      .replace(/30m以上50m未満は参考距離として、上の分類別チェックで確認できます。/g,
        "POI間隔は原則50mです。30m未満の近接はありません。50m未満の箇所は、状況により調整が必要になる場合があります。")
      .replace(/50m未満の組み合わせがあります。/g,
        "POI間隔は原則50mです。")
      .replace(/⚪ 30〜50m参考：/g, "⚪ 30m〜50m未満：")
      .replace(/sectionTitleHtml\("距離チェックマップ", "OSM \/ 航空写真でPOI・活動範囲・近接ラインを確認できます。"\)/g,
        `sectionTitleHtml("距離チェックマップ", "50m：原則となるPOI間隔 / 40m：距離確認用（参考） / 30m：距離確認用（参考）")`)
    );
    }
  }

  function patchKmzFunctions() {
    const transform = source => source
      .replace(/40m円（基本距離）/g, "40m円（参考）")
      .replace(/40m円（参考距離）/g, "40m円（参考）")
      .replace(/30m円（調整用）/g, "30m円（参考）")
      .replace(/30m円（参考距離）/g, "30m円（参考）")
      .replace(/50m円（目安）/g, "50m円（原則）");

    replaceFunctionSource("generateKMZ", transform);
    replaceFunctionSource("generateCircleOnlyKMZ", transform);
  }

  function appendFinalGuidance() {
    const result = document.getElementById("distanceResult");
    if (!result || !result.innerHTML || result.querySelector("[data-poi-spacing-final-note]")) return;

    const note = document.createElement("div");
    note.dataset.poiSpacingFinalNote = "true";
    note.className = "distance-warning";
    note.style.marginTop = "14px";
    note.textContent = FINAL_NOTE;
    result.appendChild(note);
  }

  function wrapDistanceCheck() {
    const original = window.runDistanceCheck;
    if (typeof original !== "function" || original.__poiSpacing50mFinalWrapped) return;

    const wrapped = async function (...args) {
      const value = await original.apply(this, args);
      appendFinalGuidance();
      return value;
    };
    Object.defineProperty(wrapped, "__poiSpacing50mFinalWrapped", { value: true });
    window.runDistanceCheck = wrapped;
  }

  function applyAll() {
    patchDistanceFunctions();
    patchKmzFunctions();
    wrapDistanceCheck();
    patchStaticCopy(document);
    patchPreSubmitCopy(document);
  }

  applyAll();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyAll, { once: true });
  } else {
    queueMicrotask(applyAll);
  }
  window.addEventListener("load", applyAll, { once: true });
})();