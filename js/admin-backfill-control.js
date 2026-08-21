/* ======================================================
   管理者用 POIバックフィル操作

   - 管理者画面に「次の25件を処理」カードを追加
   - バックフィル本体はサーバー側バックグラウンドで継続
   - 画面を閉じても / スリープしても処理継続
   - 復帰時に進捗とジョブ状態を自動更新
====================================================== */

(function () {
  "use strict";

  const CARD_ID = "adminPoiBackfillCard";
  const BUTTON_ID = "adminPoiBackfillButton";
  const STATUS_ID = "adminPoiBackfillStatus";
  const PROGRESS_ID = "adminPoiBackfillProgress";
  const PROGRESS_FUNCTION = "admin-backfill-progress";
  const POLL_INTERVAL_MS = 5000;
  let pollTimer = null;

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

  function setButtonRunning(running, text = null) {
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    button.disabled = !!running;
    button.textContent = text || (running ? "サーバーで処理中…" : "次の25件を処理");
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

  async function fetchJobStatus() {
    if (!window.CampsiteAdminSecureApi?.invoke) return null;
    const data = await window.CampsiteAdminSecureApi.invoke("backfill-job-status");
    return data?.job || null;
  }

  function stopPolling() {
    if (pollTimer) clearTimeout(pollTimer);
    pollTimer = null;
  }

  function schedulePolling() {
    stopPolling();
    pollTimer = setTimeout(() => {
      refreshJobState().catch(() => {});
    }, POLL_INTERVAL_MS);
  }

  async function refreshJobState() {
    const job = await fetchJobStatus().catch(() => null);
    await fetchProgress().catch(() => {});

    if (!job) {
      setButtonRunning(false);
      stopPolling();
      return null;
    }

    if (job.running) {
      setButtonRunning(true);
      setStatus("サーバー側でバックフィル処理中です。ここからは画面を閉じても、スマホをスリープしても大丈夫です。", "running");
      schedulePolling();
      return job;
    }

    stopPolling();
    setButtonRunning(false);

    const attempted = Number(job.attempted) || 0;
    const succeeded = Number(job.succeeded) || 0;
    const failed = Number(job.failed) || 0;
    const locked = job?.result?.locked === true || job?.result?.reason === "backfill_locked";

    if (locked) {
      setStatus("別のバックフィル処理が先に動いていました。進捗を更新しました。", "running");
      return job;
    }

    if (attempted === 0) {
      setStatus("未処理KMZはありません。バックフィル完了です。", "success");
      return job;
    }

    if (failed > 0) {
      setStatus(`処理完了：${attempted}件中 ${succeeded}件成功 / ${failed}件失敗。`, "error");
      return job;
    }

    const progress = await fetchProgress().catch(() => null);
    if (progress) renderProgress(progress, succeeded);
    setStatus(`処理完了：${succeeded}/${attempted}件成功。サーバー側で最後まで処理しました。`, "success");
    return job;
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

    setButtonRunning(true, "開始中…");
    setStatus("バックフィル処理をサーバーへ渡しています…", "running");

    try {
      const data = await window.CampsiteAdminSecureApi.invoke("run-backfill", { limit: 25 });

      if (data?.locked) {
        setButtonRunning(true);
        setStatus("すでにサーバー側でバックフィル処理中です。画面を閉じても、スマホをスリープしても大丈夫です。", "running");
        schedulePolling();
        return;
      }

      if (!data?.accepted) {
        throw new Error("サーバー側ジョブを開始できませんでした。");
      }

      setButtonRunning(true);
      setStatus("サーバー側で処理を開始しました。もう画面を閉じても、スマホをスリープしても大丈夫です。", "running");
      await fetchProgress().catch(() => {});
      schedulePolling();
    } catch (error) {
      console.error("管理者POIバックフィル開始エラー", error);
      setButtonRunning(false);
      setStatus(String(error?.message || "バックフィル処理を開始できませんでした。"), "error");
      await fetchProgress().catch(() => {});
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
      <p class="note">未処理KMZを最大25件ずつPOI Masterへ取り込みます。開始後はサーバー側で継続するため、画面を閉じてもスリープしても大丈夫です。</p>
      <div id="${PROGRESS_ID}" style="margin:12px 0;padding:12px;border-radius:12px;background:rgba(2,6,23,.30);border:1px solid rgba(148,163,184,.16);">進捗を読み込み中…</div>
      <button type="button" id="${BUTTON_ID}" class="generate">次の25件を処理</button>
      <div id="${STATUS_ID}" style="margin-top:12px;padding:10px 12px;border:1px solid rgba(96,165,250,.28);border-radius:10px;background:rgba(59,130,246,.10);color:#bfdbfe;font-size:13px;line-height:1.6;">開始後はサーバーが引き継ぎます。</div>
    `;

    const anchor = document.getElementById("aliasReviewAdminBox");
    if (anchor?.parentNode === panel) anchor.insertAdjacentElement("afterend", card);
    else panel.insertBefore(card, panel.children[2] || null);

    document.getElementById(BUTTON_ID)?.addEventListener("click", runBackfill);
    fetchProgress().catch((error) => {
      console.error("POIバックフィル進捗取得エラー", error);
      renderProgress(null);
    });
    refreshJobState().catch(() => {});
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && document.getElementById(CARD_ID)) {
      refreshJobState().catch(() => {});
    }
  });

  window.AdminPoiBackfill = Object.freeze({ run: runBackfill, mount, refresh: refreshJobState });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
