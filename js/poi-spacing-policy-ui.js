/* ======================================================
   POI spacing policy UI patch
   - 50m円は必ず生成
   - 30m / 40mは参考距離として任意選択
   - capacity.cssで隠されている円設定を再表示
====================================================== */

(() => {
  "use strict";

  const STYLE_ID = "poiSpacingPolicyUiStyles";

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      /* capacity.css の「円設定は非表示」を上書き */
      #tool #customCsvStep + .step + .step.poi-spacing-radius-step {
        display: block !important;
        margin-top: 12px;
        margin-bottom: 14px;
        padding: 14px 16px;
        border: 1px solid rgba(56,189,248,.28);
        border-radius: 14px;
        background: rgba(14,165,233,.06);
      }

      #tool .poi-spacing-radius-step > .step-no {
        display: none !important;
      }

      #tool .poi-spacing-radius-step > p:first-of-type {
        margin: 0 0 10px;
        color: #e2e8f0;
        font-size: 14px;
        line-height: 1.7;
      }

      #tool .poi-spacing-radius-step .checks {
        display: flex;
        flex-wrap: wrap;
        gap: 10px 16px;
        align-items: center;
      }

      #tool .poi-spacing-radius-step .checks br {
        display: none;
      }

      #tool .poi-spacing-radius-step .checks label {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin: 0;
        padding: 9px 12px;
        border: 1px solid rgba(148,163,184,.24);
        border-radius: 10px;
        background: rgba(15,23,42,.60);
        color: #e2e8f0;
        font-size: 13px;
        font-weight: 700;
      }

      #tool .poi-spacing-radius-step .checks label[data-poi-spacing-fixed50="true"] {
        border-color: rgba(34,197,94,.42);
        background: rgba(34,197,94,.10);
        color: #dcfce7;
      }

      #tool .poi-spacing-radius-step .checks input[type="checkbox"] {
        width: 16px;
        height: 16px;
        margin: 0;
      }

      #tool .poi-spacing-radius-step .checks input[type="checkbox"]:disabled {
        opacity: 1;
        cursor: default;
      }

      #tool .poi-spacing-radius-step .note {
        width: 100%;
        margin: 10px 0 0;
        color: #94a3b8;
        font-size: 12px;
        line-height: 1.65;
      }

      /* 実行前の空マップが大きな黒い余白として見えないようにする。 */
      #distance #distanceMap:empty {
        display: none;
        height: 0;
        min-height: 0;
        margin: 0;
        border: 0;
        box-shadow: none;
      }

      #distance .distance-run-status {
        margin: 14px 0 0;
        padding: 14px 16px;
        border: 1px solid rgba(56,189,248,.38);
        border-radius: 14px;
        background: rgba(14,165,233,.08);
        color: #dbeafe;
        font-size: 14px;
        line-height: 1.7;
      }

      #distance .distance-run-status.error {
        border-color: rgba(239,68,68,.48);
        background: rgba(239,68,68,.10);
        color: #fecaca;
      }

      /* STEP 3の説明文を現行方針へ更新 */
      #tool #customCsvStep + .step + .step + .step > p:first-of-type::after {
        content: "50m円を必ず生成します。30m・40mは参考距離として任意で追加できます。" !important;
      }

      @media (max-width: 620px) {
        #tool .poi-spacing-radius-step .checks {
          flex-direction: column;
          align-items: stretch;
        }

        #tool .poi-spacing-radius-step .checks label {
          width: 100%;
          box-sizing: border-box;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function setLabel(input, text, fixed = false) {
    let label = input.closest("label");

    if (!label) {
      label = document.createElement("label");
      label.appendChild(input);
    }

    label.replaceChildren(input, document.createTextNode(` ${text}`));

    if (fixed) {
      label.dataset.poiSpacingFixed50 = "true";
    } else {
      delete label.dataset.poiSpacingFixed50;
    }

    return label;
  }

  function ensure50Input(checks) {
    let input = checks.querySelector('input[name="radius"][value="50"]');

    if (!input) {
      input = document.createElement("input");
      input.type = "checkbox";
      input.name = "radius";
      input.value = "50";
      const label = setLabel(input, "50m円（必ず生成）", true);
      checks.prepend(label);
    } else {
      const label = setLabel(input, "50m円（必ず生成）", true);
      if (!label.parentElement) checks.prepend(label);
    }

    input.checked = true;
    input.disabled = true;
  }

  function normalizeOptionalInput(checks, meters) {
    const input = checks.querySelector(`input[name="radius"][value="${meters}"]`);
    if (!input) return;

    input.checked = false;
    input.disabled = false;

    const label = setLabel(input, `${meters}m円（参考距離・任意）`);
    if (!label.parentElement) checks.appendChild(label);
  }

  function setupMainRadiusUi() {
    const anyRadius = document.querySelector('#tool input[name="radius"]');
    const step = anyRadius?.closest(".step");
    const checks = step?.querySelector(".checks");

    if (!step || !checks || step.dataset.poiSpacingUiReady === "true") return;

    step.dataset.poiSpacingUiReady = "true";
    step.classList.add("poi-spacing-radius-step");

    const lead = step.querySelector(":scope > p:first-of-type");
    if (lead) {
      lead.innerHTML =
        '<strong style="color:#f8fafc;">円の設定</strong><br>' +
        '50m円は必ず生成されます。30m・40mは必要な場合だけ追加してください。';
    }

    ensure50Input(checks);
    normalizeOptionalInput(checks, 40);
    normalizeOptionalInput(checks, 30);

    const note = checks.querySelector("p.note");
    if (note) {
      note.textContent = "POI間隔は原則50mです。30m・40mは参考距離です。";
    }
  }

  function installDistanceResult50mUi() {
    window.normalizeJudgementSection = function normalizeJudgementSection50m(section) {
      if (!section) return;
      const card = section.querySelector(".distance-warning");
      if (!card || card.dataset.poiSpacing50Normalized === "true") return;

      const text = card.textContent || "";
      const dense = Number(text.match(/20m未満（密集）\s*：\s*(\d+)件/)?.[1] || 0);
      const stay = Number(text.match(/20〜30m（滞留）\s*：\s*(\d+)件/)?.[1] || 0);
      const near50 = Number(
        text.match(/30〜50m(?:（参考距離）)?\s*：\s*(\d+)件/)?.[1] ||
        text.match(/30m〜50m未満(?:（要確認）)?\s*：\s*(\d+)件/)?.[1] ||
        text.match(/30〜40m（軽微）\s*：\s*(\d+)件/)?.[1] ||
        0
      );
      const actionableTotal = dense + stay + near50;

      let status = "問題なし";
      let icon = "✅";
      let color = "#22c55e";

      if (dense + stay > 0) {
        status = "要修正";
        icon = "⚠";
        color = "#ef4444";
      } else if (near50 > 0) {
        status = "50m未満あり";
        icon = "△";
        color = "#f59e0b";
      }

      card.style.borderColor = color;
      card.dataset.poiSpacing50Normalized = "true";
      card.innerHTML = `
        <strong style="color:${color};font-size:20px;">
          ${icon} 判定結果：${status}
        </strong><br><br>
        20m未満（密集）：${dense}件<br>
        20〜30m（滞留）：${stay}件<br>
        30〜50m未満（要確認）：${near50}件<br>
        50m未満合計：${actionableTotal}件<br><br>
        ${actionableTotal === 0
          ? "追加・変更対象の50m未満の組み合わせはありません。"
          : "追加・変更対象に関係する50m未満の組み合わせがあります。詳細を開き、対象POIと地図を確認してください。"}
      `;
    };

    const rankGuide = document.querySelector("#distance .rank-guide-box");
    if (rankGuide) {
      rankGuide.innerHTML = `
        <strong>距離判定の見方</strong><br><br>
        🔴 20m未満：密集。配置の見直しが必要です。<br><br>
        🟠 20m以上30m未満：滞留。配置の見直しが必要です。<br><br>
        🟡 30m以上50m未満：要確認。POI間隔は原則50mです。<br><br>
        ⚪ 50m以上：原則となる間隔を満たしています。<br><br>
        <span style="opacity:.85;">※30m・40mは距離確認のための参考値です。</span>
      `;
    }
  }

  function normalizeRenderedDistanceResult() {
    const result = document.getElementById("distanceResult");
    if (!result || !result.children.length) return;

    const sections = Array.from(result.querySelectorAll(".distance-result-section"));
    const judgementSection = sections.find(section => {
      const heading = section.querySelector(".distance-result-heading");
      return (heading?.textContent || "").includes("判定結果");
    });

    if (judgementSection) {
      window.normalizeJudgementSection?.(judgementSection);
      return;
    }

    const cards = Array.from(result.querySelectorAll(".distance-warning"));
    const legacyCard = cards.find(card => {
      const text = card.textContent || "";
      return text.includes("判定結果") && (
        text.includes("40m未満合計") ||
        text.includes("30〜40m（軽微）") ||
        text.includes("30〜50m（参考距離）") ||
        text.includes("30m〜50m未満")
      );
    });

    if (legacyCard) {
      const wrapper = document.createElement("div");
      legacyCard.parentNode?.insertBefore(wrapper, legacyCard);
      wrapper.appendChild(legacyCard);
      window.normalizeJudgementSection?.(wrapper);
      wrapper.replaceWith(legacyCard);
    }
  }

  function watchDistanceResult() {
    const result = document.getElementById("distanceResult");
    if (!result || result.dataset.poiSpacing50Observer === "true") return;

    result.dataset.poiSpacing50Observer = "true";
    const observer = new MutationObserver(() => {
      queueMicrotask(normalizeRenderedDistanceResult);
    });
    observer.observe(result, { childList: true, subtree: true });
    normalizeRenderedDistanceResult();
  }

  function installDistanceRunUx() {
    const original = window.runDistanceCheck;
    if (typeof original !== "function" || original.__distanceRunUxWrapped) return;

    const wrapped = async function (...args) {
      const result = document.getElementById("distanceResult");
      const map = document.getElementById("distanceMap");
      const button = document.querySelector('#distance button.generate[onclick*="runDistanceCheck"]');
      const originalButtonText = button?.textContent || "距離チェック実行";

      if (map && !map.children.length) {
        map.style.display = "none";
      }

      if (result) {
        result.innerHTML = '<div class="distance-run-status">📏 距離を計算しています…</div>';
      }

      if (button) {
        button.disabled = true;
        button.textContent = "距離チェック中…";
      }

      /* iPhone Safariでも押下直後の表示を先に描画させる。 */
      await new Promise(resolve => requestAnimationFrame(() => resolve()));

      try {
        const value = await original.apply(this, args);

        requestAnimationFrame(() => {
          if (result?.children.length) {
            result.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });

        return value;
      } catch (error) {
        console.error("距離チェック実行エラー:", error);
        if (result) {
          result.innerHTML = `
            <div class="distance-run-status error">
              ⚠ 距離チェック中にエラーが発生しました。<br>
              <small>${String(error?.message || error || "不明なエラー")}</small>
            </div>
          `;
          result.scrollIntoView({ behavior: "smooth", block: "start" });
        }
        return undefined;
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = originalButtonText;
        }
      }
    };

    Object.defineProperty(wrapped, "__distanceRunUxWrapped", { value: true });
    window.runDistanceCheck = wrapped;
  }

  function setup() {
    ensureStyles();
    setupMainRadiusUi();
    installDistanceResult50mUi();
    watchDistanceResult();
    installDistanceRunUx();

    const map = document.getElementById("distanceMap");
    if (map && !map.children.length) {
      map.style.display = "none";
    }

    /* 他の距離ポリシーパッチが後からrunDistanceCheckを包んでも最後にUXガードを戻す。 */
    setTimeout(installDistanceRunUx, 0);
    setTimeout(installDistanceRunUx, 600);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }

  window.addEventListener("load", () => {
    installDistanceRunUx();
  }, { once: true });
})();