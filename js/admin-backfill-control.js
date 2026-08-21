/* ======================================================
   管理者用 POIバックフィル操作

   - 管理者画面に「次の25件を処理」カードを追加
   - 総件数 / 処理済み / 残り / 進捗率を表示
   - 実行後に今回の処理件数と最新進捗を再取得
   - 既存の管理者セッションを利用
====================================================== */

(function () {
  "use strict";

  const CARD_ID = "adminPoiBackfillCard";
  const BUTTON_ID = "adminPoiBackfillButton";
  const STATUS_ID = "adminPoiBackfillStatus";
  const PROGRESS_ID = "adminPoiBackfillProgress";
  const PROGRESS_FUNCTION = "admin-backfill-progress";

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
    el.textContent = String(message || "");
  }

  function renderProgress(progress, latestSucceeded = null) {
    const el = document.getElementById(PROGRESS_ID);
    if (!el) return;

    if (!progress) {
      el.innerHTML = `<div style="color:#94a3b8;">進捗を取得できませんでした。</div>`;
      return;
    }

    const total = Number(progress.total_files) || 0;
    const processed = Number(progress.processed_files) || 0;
    const remaining = Number(progress.remaining_files) || Math.max(total - processed, 0);
    const pct = Number(progress.progress_pct) || 0;
    const obs = Number(progress.observation_rows) || 0;
    const unique = Number(progress.unique_pois) || 0;
    const latest = latestSucceeded === null ? "" : `
      <div style="margin-top:10px;padding:8px 10px;border-radius:9px;background:rgba(34,197,94,.10);border:1px solid rgba(34,197,94,.25);color:#bbf7d0;font-weight:bold;">
        今回：+${Number(latestSucceeded) || 0}件
      </div>`;

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;">
        <div style="padding:10px;border-radius:10px;background:rgba(15,23,42,.55);text-align:center;"><div style="font-size:11px;color:#94a3b8;">総ファイル</div><strong style="font-size:20px;">${total}</strong></div>
        <div style="padding:10px;border-radius:10px;background:rgba(15,23,42,.55);text-align:center;"><div style="font-size:11px;color:#94a3b8;">処理済み</div><strong style="font-size:20px;color:#86efac;">${processed}</strong></div>
        <div style="padding:10px;border-radius:10px;background:rgba(15,23,42,.55);text-align:center;"><div style="font-size:11px;color:#94a3b8;">残り</div><strong style="font-size:20px;color:#fde68a;">${remaining}</strong></div>
      </div>
      <div style="margin-top:10px;height:10px;border-radius:999px;background:rgba(51,65,85,.8);overflow:hidden;">
        <div style="height:100%;width:${Math.max(0, Math.min(100, pct))}%;background:linear-gradient(90deg,#22c55e,#38bdf8);"></div>
      </div>
      <div style="margin-top:6px;font-size:12px;color:#cbd5e1;">進捗 ${pct.toFixed(1)}% / POI観測 ${obs.toLocaleString()}件 / ユニークPOI ${unique.toLocaleString()}件</div>
      ${latest}
    `;
  }

  async function fetchProgress() {
    if (!window.campsiteSupabase?.functions) throw new Error("Supabaseクライアントを初期化できませんでした。");
    const sessionToken = window.CampsiteAdminAuth?.getSessionToken?.() || "";
    if (!sessionToken) throw new Error("管理者認証が必要です。");

    const { data, error } = await window.campsiteSupabase.functions.invoke(PROGRESS_FUNCTION, {
      body: { sessionToken },
    });

    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || "進捗取得に失敗しました。");
    renderProgress(data.progress);
    return data.progress;
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
    setStatus("次の未処理KMZを最大25件処理しています。", "running");

    try {
      const data = await window.CampsiteAdminSecureApi.invoke("run-backfill", { limit: 25 });

      if (data?.locked || data?.backfill?.reason === "backfill_locked") {
        setStatus("すでに別のバックフィルが処理中です。完了後にもう一度押してください。", "running");
        await fetchProgress().catch(() => {});
        return;
      }

      const attempted = Number(data?.attempted) || 0;
      const succeeded = Number(data?.succeeded) || 0;
      const failed = Number(data?.failed) || 0;
      const progress = data?.backfill?.progress || null;

      if (progress) renderProgress(progress, succeeded);
      else await fetchProgress().then((p) => renderProgress(p, succeeded)).catch(() => {});

      if (attempted === 0) {
        setStatus("未処理KMZはありません。バックフィル完了です。", "success");
        return;
      }

      if (failed > 0) {
        setStatus(`処理完了：${attempted}件中 ${succeeded}件成功 / ${failed}件失敗。`, "error");
        return;
      }

      setStatus(`処理完了：${succeeded}/${attempted}件成功。画面の処理済み件数も更新しました。`, "success");
    } catch (error) {
      console.error("管理者POIバックフィルエラー", error);
      setStatus(String(error?.message || "バックフィル処理に失敗しました。"), "error");
      await fetchProgress().catch(() => {});
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
      <p class="note">未処理KMZを最大25件ずつPOI Masterへ取り込みます。多重実行はサーバー側で防止します。</p>
      <div id="${PROGRESS_ID}" style="margin:12px 0;padding:12px;border-radius:12px;background:rgba(2,6,23,.30);border:1px solid rgba(148,163,184,.16);">進捗を読み込み中…</div>
      <button type="button" id="${BUTTON_ID}" class="generate">次の25件を処理</button>
      <div id="${STATUS_ID}" style="margin-top:12px;padding:10px 12px;border:1px solid rgba(96,165,250,.28);border-radius:10px;background:rgba(59,130,246,.10);color:#bfdbfe;font-size:13px;line-height:1.6;">押した結果は上の数字に反映されます。</div>
    `;

    const anchor = document.getElementById("aliasReviewAdminBox");
    if (anchor?.parentNode === panel) anchor.insertAdjacentElement("afterend", card);
    else panel.insertBefore(card, panel.children[2] || null);

    document.getElementById(BUTTON_ID)?.addEventListener("click", runBackfill);
    fetchProgress().catch((error) => {
      console.error("POIバックフィル進捗取得エラー", error);
      renderProgress(null);
    });
  }

  window.AdminPoiBackfill = Object.freeze({ run: runBackfill, mount, refresh: fetchProgress });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
