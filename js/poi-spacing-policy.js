/* ======================================================
   POI spacing policy 2026-08-14

   Current public guidance:
   - POI間隔は50mを目安に設計する
   - 50m円は必ず生成する
   - 30m・40mは参考距離として任意表示する

   詳細基準が今後変更されても、このファイルを更新すれば
   既存機能へまとめて反映できるようにする。
====================================================== */

(() => {
  "use strict";

  const POLICY = window.CampsitePoiSpacingPolicy;
  if (!POLICY) {
    throw new Error("POI spacing config is not loaded.");
  }

  function replaceFunctionSource(name, transform) {
    const original = window[name];
    if (typeof original !== "function" || original.__poiSpacing50mPatched) {
      return;
    }

    try {
      const source = original.toString();
      const transformed = transform(source);

      if (!transformed || transformed === source) {
        console.warn(`[POI 50m] ${name} の置換対象が見つかりませんでした。`);
        return;
      }

      const patched = Function(`"use strict"; return (${transformed});`)();
      Object.defineProperty(patched, "__poiSpacing50mPatched", {
        value: true
      });
      window[name] = patched;
    } catch (error) {
      console.warn(`[POI 50m] ${name} の更新に失敗しました。`, error);
    }
  }

  function ensureFixedRadiusInput(groupName, anchorInput) {
    if (!anchorInput || document.querySelector(`input[name="${groupName}"][value="50"]`)) {
      return;
    }

    const label = document.createElement("label");
    label.dataset.poiSpacingFixed50 = "true";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.name = groupName;
    input.value = "50";
    input.checked = true;
    input.disabled = true;

    label.appendChild(input);
    label.appendChild(document.createTextNode(" 50m円（必ず生成）"));

    const parent = anchorInput.closest(".checks") || anchorInput.parentElement?.parentElement;
    if (!parent) return;

    const firstLabel = anchorInput.closest("label");
    if (firstLabel && firstLabel.parentElement === parent) {
      parent.insertBefore(label, firstLabel);
      parent.insertBefore(document.createElement("br"), firstLabel);
    } else {
      parent.prepend(label);
      parent.insertBefore(document.createElement("br"), label.nextSibling);
    }
  }

  function normalizeRadiusOption(groupName) {
    const inputs = Array.from(
      document.querySelectorAll(`input[name="${groupName}"]`)
    );

    const optionInputs = inputs.filter(input => Number(input.value) === 30 || Number(input.value) === 40);
    const anchor = optionInputs.find(input => Number(input.value) === 40) || optionInputs[0];

    ensureFixedRadiusInput(groupName, anchor);

    optionInputs.forEach(input => {
      input.checked = false;
      const label = input.closest("label");
      if (!label) return;

      const meters = Number(input.value);
      label.replaceChildren(
        input,
        document.createTextNode(` ${meters}m円（参考距離・任意）`)
      );
    });
  }

  function patchCircleCopy() {
    const circleInput = document.getElementById("circleOnlyFileInput");
    const step = circleInput?.closest(".step");

    if (step) {
      const notes = Array.from(step.querySelectorAll("p.note"));
      if (notes[0]) {
        notes[0].innerHTML =
          "CSV / KML / KMZから、50m円を必ず生成します。<br>30m・40mは参考距離として必要な場合だけ追加できます。";
      }

      notes.forEach(note => {
        note.innerHTML = note.innerHTML
          .replace(/30m円・40m円だけ/g, "50m円と任意の30m・40m円")
          .replace(/既存の30m円・40m円/g, "既存の30m・40m・50m円")
          .replace(/古い円レイヤー/g, "古い円レイヤー");
      });
    }

    normalizeRadiusOption("circleOnlyRadius");
    normalizeRadiusOption("radius");
  }

  function patchHeroCopy() {
    const lead = document.querySelector(".hero .lead");
    if (!lead) return;

    lead.innerHTML =
      "Wayfarer CSV / My Maps KML / KMZ から<br>" +
      "POIを読み込み、50m円を必ず生成し、30m・40m円を参考距離として追加できます。";
  }

  function patchDistanceEntryCopy(root = document) {
    root.querySelectorAll(".distance-entry-details-body").forEach(node => {
      node.innerHTML = node.innerHTML
        .replace(/30m・40m円/g, "30m・40m・50m円")
        .replace(/30m円・40m円/g, "30m・40m・50m円");
    });
  }

  function patchPreSubmitCopy(root = document) {
    root.querySelectorAll(".pre-submit-item").forEach(item => {
      const strong = item.querySelector("strong");
      const small = item.querySelector("small");
      const text = strong?.textContent || "";

      if (text.includes("POI間隔は40m以上を基本")) {
        strong.textContent = "POI間隔は50mを目安に設計している";
        if (small) small.textContent = POLICY.publicLead;
      }

      if (text.includes("40m確保が難しい箇所")) {
        strong.textContent = "30m・40mは参考距離として確認している";
        if (small) small.textContent = POLICY.referenceNote;
      }
    });
  }

  function patchQuizCopy() {
    const quiz = document.getElementById("quizModal");
    if (!quiz) return;

    const paragraphs = Array.from(quiz.querySelectorAll("p"));
    const q1 = paragraphs.find(p => (p.textContent || "").trim().startsWith("Q1."));
    const q2 = paragraphs.find(p => (p.textContent || "").trim().startsWith("Q2."));

    if (q1) {
      q1.textContent = "Q1. POI間隔の目安として案内している距離は？";
    }

    const q1Labels = Array.from(quiz.querySelectorAll('input[name="q1"]')).map(input => input.closest("label"));
    q1Labels.forEach(label => {
      const input = label?.querySelector("input");
      if (!label || !input) return;
      const copy = {
        a: "50m",
        b: "40m",
        c: "30m"
      }[input.value];
      label.replaceChildren(input, document.createTextNode(copy ? ` ${copy}` : ""));
    });

    if (q2) {
      q2.textContent = "Q2. 30m・40mの位置づけとして正しいものは？";
    }

    const q2Copy = {
      many: "50mと同じ必須距離として扱う",
      tap: "配置を検討するための参考距離として扱う",
      gym: "POIをできるだけ密集させるための距離として扱う"
    };

    Array.from(quiz.querySelectorAll('input[name="q2"]')).forEach(input => {
      const label = input.closest("label");
      if (!label) return;
      label.replaceChildren(
        input,
        document.createTextNode(` ${q2Copy[input.value] || ""}`)
      );
    });
  }

  function patchKnowledgeApi() {
    const knowledge = window.CampsiteKnowledge;
    if (!knowledge || knowledge.__poiSpacing50mPatched) return;

    const updatedEntries = Array.from(knowledge.fixedEntries || []).map(entry => {
      if (entry?.category !== "distance") return entry;

      return Object.freeze({
        ...entry,
        id: "required-distance-target-50m",
        advice: `${POLICY.publicLead} ${POLICY.referenceNote}`,
        evidence: "Campsite Design Toolの距離チェック・設計ガイドで使用している現行距離方針。",
        confirmedAt: "2026-08-14"
      });
    });

    const replacement = {
      ...knowledge,
      fixedEntries: Object.freeze(updatedEntries),
      getEntries(options = {}) {
        const {
          level = null,
          category = null,
          publicationAllowedOnly = true
        } = options;

        return updatedEntries.filter(entry => {
          if (level && entry.level !== level) return false;
          if (category && entry.category !== category) return false;
          if (publicationAllowedOnly && !entry.publicationAllowed) return false;
          return true;
        });
      },
      __poiSpacing50mPatched: true
    };

    window.CampsiteKnowledge = Object.freeze(replacement);
  }

  function patchDistanceFunctions() {
    if (typeof window.classifyDistanceRisk === "function") {
      window.classifyDistanceRisk = function classifyDistanceRisk50m(distance) {
        if (distance < 20) return "密集";
        const band = POLICY.distanceBand(distance);
        if (band === "danger") return "滞留";
        if (band === "caution" || band === "near") return "軽微";
        return null;
      };
    }

    if (typeof window.getDistanceAdviceRuleText === "function") {
      window.getDistanceAdviceRuleText = function getDistanceAdviceRuleText50m(type) {
        if (type === "密集") {
          return "20m未満です。近すぎるため、追加POI側の位置を最優先で見直してください。";
        }
        if (type === "滞留") {
          return "20m以上30m未満です。30mを下回っているため、追加POI側の位置を見直してください。";
        }
        return `30m以上50m未満です。${POLICY.publicLead} ${POLICY.referenceNote}`;
      };
    }

    replaceFunctionSource("getRiskAccordionHtml", source => source
      .replace(/軽微（30m以上40m未満）/g, "参考距離（30m以上50m未満）")
      .replace(/30m以上40m未満です。40m基本には届きませんが、30m調整圏内として確認します。/g,
        `30m以上50m未満です。${POLICY.publicLead} ${POLICY.referenceNote}`)
      .replace(/調整可能距離/g, "参考距離")
    );

    replaceFunctionSource("runDistanceCheck", source => source
      .replace(/if \(distance < 40\) \{/g,
        "if (distance < window.CampsitePoiSpacingPolicy.targetMeters) {")
      .replace(/30〜40m（軽微）/g, "30〜50m（参考距離）")
      .replace(/40m未満合計/g, "50m未満合計")
      .replace(/40m未満の組み合わせはありません。/g, "50m未満の組み合わせはありません。")
      .replace(/40m未満の近接件数を確認します。/g, "50m未満の近接件数を確認します。30m・40mは参考距離です。")
      .replace(/20m未満／20〜30m／30〜40mの近接件数を確認します。/g,
        "50m未満の近接件数を確認します。30m・40mは参考距離です。")
      .replace(/調整可能距離あり/g, "参考距離あり")
      .replace(/軽微：\$\{campsite\.under40\}件/g, "30〜40m参考：${campsite.under40}件")
    );
  }

  function patchKmzFunctions() {
    const transformKmzGenerator = source => source
      .replace(/layerName\.includes\("40m"\)/g,
        'layerName.includes("40m") ||\n    layerName.includes("50m")')
      .replace(/circle40: createFolder\(outputXml, doc, "40m円（基本距離）"\),/g,
        'circle50: createFolder(outputXml, doc, "50m円（目安）"),\n  circle40: createFolder(outputXml, doc, "40m円（参考距離）"),')
      .replace(/circle30: createFolder\(outputXml, doc, "30m円（調整用）"\)/g,
        'circle30: createFolder(outputXml, doc, "30m円（参考距離）")')
      .replace(/if \(radius === 40\) \{\n\s*folders\.circle40\.appendChild\(circlePlacemark\);/g,
        'if (radius === 50) {\n      folders.circle50.appendChild(circlePlacemark);\n    } else if (radius === 40) {\n      folders.circle40.appendChild(circlePlacemark);')
      .replace(/30m円または40m円を選択してください/g,
        "30m・40mは任意です。50m円は必ず生成されます")
      .replace(/40m円（基本距離）/g, "40m円（参考距離）")
      .replace(/30m円（調整用）/g, "30m円（参考距離）");

    replaceFunctionSource("generateKMZ", transformKmzGenerator);
    replaceFunctionSource("generateCircleOnlyKMZ", transformKmzGenerator);
  }

  function wrapRenderers() {
    const original = window.renderPreSubmitCheck;
    if (typeof original === "function" && !original.__poiSpacing50mWrapped) {
      const wrapped = function (...args) {
        const result = original.apply(this, args);
        patchPreSubmitCopy(document);
        return result;
      };
      Object.defineProperty(wrapped, "__poiSpacing50mWrapped", { value: true });
      window.renderPreSubmitCheck = wrapped;
    }

    const originalDistanceEntry = window.setupDistanceEntryUi;
    if (typeof originalDistanceEntry === "function" && !originalDistanceEntry.__poiSpacing50mWrapped) {
      const wrapped = function (...args) {
        const result = originalDistanceEntry.apply(this, args);
        patchDistanceEntryCopy(document);
        return result;
      };
      Object.defineProperty(wrapped, "__poiSpacing50mWrapped", { value: true });
      window.setupDistanceEntryUi = wrapped;
    }
  }

  function applyAll() {
    patchDistanceFunctions();
    patchKmzFunctions();
    wrapRenderers();
    patchHeroCopy();
    patchCircleCopy();
    patchDistanceEntryCopy();
    patchPreSubmitCopy();
    patchQuizCopy();
    patchKnowledgeApi();
  }

  applyAll();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyAll, { once: true });
  } else {
    queueMicrotask(applyAll);
  }

  window.addEventListener("load", applyAll, { once: true });
})();
