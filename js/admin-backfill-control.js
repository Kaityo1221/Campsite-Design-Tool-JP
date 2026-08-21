/* ======================================================
   管理者用 POIバックフィル操作

   - 管理者画面に「次の25件を処理」カードを追加
   - 既存の管理者セッションを利用
   - backfill-campsite-pois 側のロックで多重実行を防止
====================================================== */

(function () {
  "use strict";

  const CARD_ID = "adminPoiBackfillCard";
  const BUTTON_ID = "adminPoiBackfillButton";
  const STATUS_ID = "adminPoiBackfillStatus";

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setStatus(message, type = "neutral") {
    const el = document.getElementById(STATUS_ID);
    if (!el) return;

    const palette = {
      neutral: { bg: "rgba(59,130,246,.10)", border: "rgba(96,165,250,.28)", color: "#bfdbfe" },
      running: { bg: "rgba(245,158,11,.10)", border: "rgba(245,158,11,.32)", color: "#fde68a" },
      success: { bg: "rgba(34,197,94,.10)", border: "rgba(34,197,94,.32)", color: "#bbf7d0" },
      error: { bg: "rgba(239,68,68,.10)", border: "rgba(239,68,68,.32)", color: "#fecaca" },
    };

    const style = palette[type] || palette.neutral;
    el.style.background = style.bg;
    el.style.borderColor = style.border;
    el.style.color = style.color;
    el.innerHTML = escapeHtml(message);
  }

  async function runBackfill() {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;

    if (!window.CampsiteAdminAuth?.isUnlocked?.()) {
      setStatus("管理者認証が必要です。管理者画面へ入り直してください。", "error");
      return;
    }

    if (!window.CampsiteAdminSecureApi?.invoke) {
      setStatus("管理者APIを読み込めませんでした。ページを再読み込みしてください。", "error");
      return;
    }

    button.disabled = true;
    button.textContent = "処理中…";
    setStatus("次の未処理KMZを最大25件処理しています。通常は約1分です。", "running");

    try {
      const data = await window.CampsiteAdminSecureApi.invoke("run-backfill", { limit: 25 });

      if (data?.locked || data?.backfill?.error === "backfill_locked") {
        setStatus("すでに別のバックフィルが処理中です。完了後にもう一度押してください。", "running");
        return;
      }

      const attempted = Number(data?.attempted) || 0;
      const succeeded = Number(data?.succeeded) || 0;
      const failed = Number(data?.failed) || 0;

      if (attempted === 0) {
        setStatus("未処理KMZはありません。バックフィル完了です。", "success");
        return;
      }

      if (failed > 0) {
        setStatus(`処理完了：${attempted}件中 ${succeeded}件成功 / ${failed}件失敗。失敗分は次回も処理対象として残ります。`, "error");
        return;
      }

      setStatus(`処理完了：${succeeded}/${attempted}件成功しました。次の25件を続けて処理できます。`, "success");
    } catch (error) {
      const message = String(error?.message || "バックフィル処理に失敗しました。");
      if (message.includes("backfill_locked")) {
        setStatus("すでに別のバックフィルが処理中です。完了後にもう一度押してください。", "running");
      } else {
        console.error("管理者POIバックフィルエラー", error);
        setStatus(message, "error");
      }
    } finally {
      button.disabled = false;
      button.textContent = "次の25件を処理";
    }
  }

  function mount() {
    if (document.getElementById(CARD_ID)) return;

    const panel = document.querySelector("#admin .panel");
    if (!panel) return;

    const card = document.createElement("div");
    card.id = CARD_ID;
    card.className = "step";
    card.style.border = "1px solid rgba(34,197,94,0.42)";
    card.style.background = "rgba(20,83,45,0.12)";
    card.innerHTML = `
      <div class="step-no">POI DATA</div>
      <h3>過去KMZのPOIバックフィル</h3>
      <p class="note">
        保存済みKMZから未処理データを最大25件ずつPOI Masterへ取り込みます。<br>
        通常の自動バックフィルはそのまま動作します。多重実行はサーバー側ロックで防止されます。
      </p>
      <button type="button" id="${BUTTON_ID}" class="generate">次の25件を処理</button>
      <div id="${STATUS_ID}" style="margin-top:12px;padding:10px 12px;border:1px solid rgba(96,165,250,.28);border-radius:10px;background:rgba(59,130,246,.10);color:#bfdbfe;font-size:13px;line-height:1.6;">
        1回最大25件。前の処理が動いている場合は自動でスキップします。
      </div>
    `;

    const anchor = document.getElementById("aliasReviewAdminBox");
    if (anchor?.parentNode === panel) {
      anchor.insertAdjacentElement("afterend", card);
    } else {
      panel.insertBefore(card, panel.children[2] || null);
    }

    document.getElementById(BUTTON_ID)?.addEventListener("click", runBackfill);
  }

  window.AdminPoiBackfill = Object.freeze({ run: runBackfill, mount });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
