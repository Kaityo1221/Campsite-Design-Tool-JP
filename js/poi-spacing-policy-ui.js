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

  function makeLabel(input, text, fixed = false) {
    const label = input.closest("label") || document.createElement("label");

    if (!input.closest("label")) {
      label.appendChild(input);
    }

    label.replaceChildren(input, document.createTextNode(` ${text}`));

    if (fixed) {
      label.dataset.poiSpacingFixed50 = "true";
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
      input.checked = true;
      input.disabled = true;

      const label = makeLabel(input, "50m円（必ず生成）", true);
      checks.prepend(label);
    } else {
      input.checked = true;
      input.disabled = true;
      const label = makeLabel(input, "50m円（必ず生成）", true);
      if (!label.parentElement) checks.prepend(label);
    }
  }

  function normalizeOptionalInput(checks, meters) {
    const input = checks.querySelector(`input[name="radius"][value="${meters}"]`);
    if (!input) return;

    input.checked = false;
    input.disabled = false;

    const label = makeLabel(input, `${meters}m円（参考距離・任意）`);
    if (!label.parentElement) checks.appendChild(label);
  }

  function setupMainRadiusUi() {
    const anyRadius = document.querySelector('#tool input[name="radius"]');
    const step = anyRadius?.closest(".step");
    const checks = step?.querySelector(".checks");

    if (!step || !checks) return;

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
      note.textContent = "POI間隔は50mを目安に設計してください。30m・40mは参考距離です。";
    }
  }

  function setup() {
    ensureStyles();
    setupMainRadiusUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }

  const observer = new MutationObserver(() => {
    setupMainRadiusUi();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
