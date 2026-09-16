/* ======================================================
   Phase 6: Server-backed final review records
   - Human final status: OK / needs check / needs revision / hold
   - Every save creates a new immutable review revision
   - Saves policy/scope/auto-check snapshot through admin Edge Function
   - Review form lives outside the inspector so POI clicks do not erase input
====================================================== */
(function () {
  "use strict";

  if (window.AdminReviewRecords) return;

  const RECORDS_FUNCTION = "admin-review-records";
  const HISTORY_FUNCTION = "admin-past-site-state";

  const STATUS = [
    { id: "ok", icon: "✅", label: "問題なし" },
    { id: "needs_check", icon: "⚠️", label: "要確認" },
    { id: "needs_revision", icon: "🔧", label: "要修正" },
    { id: "hold", icon: "⏸", label: "保留" }
  ];

  const REASONS = [
    { id: "distance", label: "距離" },
    { id: "poi_limit", label: "POI上限" },
    { id: "duplicate", label: "重複POI" },
    { id: "scope", label: "審査範囲" },
    { id: "layer", label: "レイヤー" },
    { id: "traffic", label: "通行・滞留" },
    { id: "route", label: "回遊性" },
    { id: "waiting", label: "集合・待機" },
    { id: "other", label: "その他" }
  ];

  const state = {
    initialRecordId: "",
    siteId: "",
    timeline: [],
    activeUploadId: "",
    activeIndex: 0,
    latest: null,
    history: [],
    panel: null,
    loadSeq: 0,
    reviewSeq: 0,
    saving: false,
    patched: false
  };

  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getToken() {
    return window.CampsiteAdminAuth?.getSessionToken?.() || "";
  }

  async function invoke(functionName, body = {}) {
    if (!window.campsiteSupabase?.functions) throw new Error("Supabase client unavailable");
    const sessionToken = getToken();
    if (!sessionToken) throw new Error("管理者認証が必要です。");
    const { data, error } = await window.campsiteSupabase.functions.invoke(functionName, {
      body: { ...body, sessionToken }
    });
    if (error) {
      let message = error.message || "管理者処理に失敗しました。";
      try {
        const details = error.context && typeof error.context.json === "function"
          ? await error.context.json()
          : null;
        if (details?.error) message = details.error;
      } catch (_) {}
      throw new Error(message);
    }
    if (!data?.success) throw new Error(data?.error || "管理者処理に失敗しました。");
    return data;
  }

  function fmtDate(value) {
    const d = new Date(value || 0);
    if (Number.isNaN(d.getTime())) return "日時不明";
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(d);
  }

  function buildTimeline(data) {
    const items = [];
    const seen = new Set();
    const push = item => {
      if (!item?.id || seen.has(item.id)) return;
      seen.add(item.id);
      items.push(item);
    };
    push(data?.current);
    (Array.isArray(data?.history) ? data.history : []).forEach(push);
    if (items.length === 1 && data?.previous) push(data.previous);
    return items;
  }

  function statusMeta(id) {
    return STATUS.find(row => row.id === id) || { id, icon: "○", label: id || "未設定" };
  }

  function reasonLabel(id) {
    return REASONS.find(row => row.id === id)?.label || id;
  }

  function ensurePanel() {
    const root = document.getElementById("adminReviewWorkspace");
    if (!root) return null;
    let panel = root.querySelector("#adminReviewDecisionPanel");
    if (panel) {
      state.panel = panel;
      return panel;
    }

    panel = document.createElement("section");
    panel.id = "adminReviewDecisionPanel";
    panel.className = "arr-panel";
    panel.innerHTML = `
      <div class="arr-head">
        <div>
          <span class="arr-eyebrow">FINAL REVIEW</span>
          <h3>最終審査を記録</h3>
          <p data-arr-context>審査対象を読み込んでいます…</p>
        </div>
        <div class="arr-latest" data-arr-latest></div>
      </div>

      <div class="arr-body">
        <div class="arr-form">
          <div class="arr-field">
            <strong>審査結果</strong>
            <div class="arr-statuses">
              ${STATUS.map(row => `<label><input type="radio" name="arrStatus" value="${row.id}"><span>${row.icon} ${row.label}</span></label>`).join("")}
            </div>
          </div>

          <div class="arr-field">
            <strong>確認理由 <small>任意・複数可</small></strong>
            <div class="arr-reasons">
              ${REASONS.map(row => `<label><input type="checkbox" value="${row.id}" data-arr-reason><span>${row.label}</span></label>`).join("")}
            </div>
          </div>

          <div class="arr-field">
            <strong>管理者メモ <small>任意・1000文字まで</small></strong>
            <textarea data-arr-memo maxlength="1000" placeholder="判断理由や次回確認したい点を記録"></textarea>
          </div>

          <div class="arr-actions">
            <button type="button" class="arr-save" data-arr-save>この審査結果を保存</button>
            <span data-arr-message></span>
          </div>
          <p class="arr-note">保存すると新しいrevisionになります。過去の審査結果は上書きしません。</p>
        </div>

        <div class="arr-history-wrap">
          <div class="arr-history-title"><strong>この版の審査履歴</strong><span data-arr-policy-note></span></div>
          <div class="arr-history" data-arr-history>まだ審査記録はありません。</div>
        </div>
      </div>`;

    root.appendChild(panel);
    panel.querySelector("[data-arr-save]")?.addEventListener("click", saveCurrentReview);
    state.panel = panel;
    renderAll();
    return panel;
  }

  function activeTimelineItem() {
    return state.timeline[state.activeIndex] || null;
  }

  function renderContext() {
    const panel = ensurePanel();
    if (!panel) return;
    const item = activeTimelineItem();
    const context = panel.querySelector("[data-arr-context]");
    const policyNote = panel.querySelector("[data-arr-policy-note]");
    const scope = window.AdminReviewScope?.getScope?.();
    const policy = window.CampsitePolicy?.getSnapshot?.() || {};
    const auto = window.AdminAutoReview?.getResult?.();

    if (context) {
      context.textContent = item
        ? `${item.fileName || "KMZ"} · ${fmtDate(item.createdAt)} · ${scope ? `審査範囲 v${scope.revision}` : "審査範囲未指定"}`
        : "審査対象を読み込んでいます…";
    }

    if (policyNote) {
      const currentVersion = Number(auto?.policy?.versionNo ?? policy.versionNo) || 0;
      const savedVersion = Number(state.latest?.policyVersionNo) || 0;
      policyNote.textContent = savedVersion && currentVersion && savedVersion !== currentVersion
        ? `保存時 v${savedVersion} / 現在 v${currentVersion}`
        : currentVersion ? `現在 policy v${currentVersion}` : "policy確認中";
    }
  }

  function renderLatest() {
    const panel = ensurePanel();
    if (!panel) return;
    const host = panel.querySelector("[data-arr-latest]");
    if (!host) return;
    if (!state.latest) {
      host.innerHTML = `<span>未審査</span>`;
      return;
    }
    const meta = statusMeta(state.latest.status);
    host.innerHTML = `<span>${meta.icon} ${esc(meta.label)}</span><small>rev ${state.latest.reviewRevision} · ${esc(fmtDate(state.latest.reviewedAt))}</small>`;
  }

  function autoSummary(snapshot) {
    if (!snapshot || snapshot.ready !== true) return "AUTO CHECK未実施";
    const spacing = Array.isArray(snapshot.spacingPairs) ? snapshot.spacingPairs.length : 0;
    const duplicate = Array.isArray(snapshot.duplicatePairs) ? snapshot.duplicatePairs.length : 0;
    const limits = Array.isArray(snapshot.limitWarnings) ? snapshot.limitWarnings.length : 0;
    return `距離 ${spacing} / 上限 ${limits} / 重複 ${duplicate}`;
  }

  function renderHistory() {
    const panel = ensurePanel();
    if (!panel) return;
    const host = panel.querySelector("[data-arr-history]");
    if (!host) return;
    if (!state.history.length) {
      host.innerHTML = `<div class="arr-empty">まだ審査記録はありません。</div>`;
      return;
    }
    host.innerHTML = state.history.slice(0, 8).map(row => {
      const meta = statusMeta(row.status);
      const reasons = Array.isArray(row.reasons) && row.reasons.length
        ? row.reasons.map(reasonLabel).join(" / ")
        : "理由指定なし";
      return `<article class="arr-history-item">
        <div class="arr-history-main"><strong>${meta.icon} ${esc(meta.label)}</strong><span>rev ${row.reviewRevision}</span></div>
        <div class="arr-history-meta">${esc(fmtDate(row.reviewedAt))} · policy v${row.policyVersionNo ?? "-"} · scope ${row.scopeRevision ? `v${row.scopeRevision}` : "なし"}</div>
        <div class="arr-history-meta">${esc(reasons)} · ${esc(autoSummary(row.autoCheckSnapshot))}</div>
        ${row.memo ? `<p>${esc(row.memo)}</p>` : ""}
      </article>`;
    }).join("");
  }

  function renderAll() {
    renderContext();
    renderLatest();
    renderHistory();
  }

  function resetForm() {
    const panel = ensurePanel();
    if (!panel) return;
    panel.querySelectorAll('input[name="arrStatus"]').forEach(input => { input.checked = false; });
    panel.querySelectorAll("[data-arr-reason]").forEach(input => { input.checked = false; });
    const memo = panel.querySelector("[data-arr-memo]");
    if (memo) memo.value = "";
    const message = panel.querySelector("[data-arr-message]");
    if (message) message.textContent = "";
  }

  function safePoint(point) {
    return {
      name: String(point?.name || "名称なし").slice(0, 200),
      lat: Number(point?.lat),
      lng: Number(point?.lng),
      added: point?.added === true,
      poiType: ["pokestop", "gym", "powerSpot", "unknown"].includes(String(point?.poiType)) ? point.poiType : "unknown"
    };
  }

  function compactPairs(rows) {
    if (!Array.isArray(rows)) return [];
    return rows.slice(0, 100).map(row => ({
      a: safePoint(row.a),
      b: safePoint(row.b),
      distance: Number.isFinite(Number(row.distance)) ? Math.round(Number(row.distance) * 10) / 10 : null
    }));
  }

  function compactAutoReview() {
    const result = window.AdminAutoReview?.getResult?.();
    if (!result || typeof result !== "object") return { ready: false };
    return {
      ready: result.ready === true,
      scopedCount: Array.isArray(result.scoped) ? result.scoped.length : 0,
      addedCount: Array.isArray(result.added) ? result.added.length : 0,
      counts: { ...(result.counts || {}) },
      spacingPairs: compactPairs(result.spacingPairs),
      duplicatePairs: compactPairs(result.duplicatePairs),
      limitWarnings: Array.isArray(result.limitWarnings)
        ? result.limitWarnings.slice(0, 20).map(row => ({ key: row.key, label: row.label, count: row.count, limit: row.limit }))
        : []
    };
  }

  async function loadReviews(uploadId, reset = false) {
    const id = String(uploadId || "");
    if (!id) return;
    const seq = ++state.reviewSeq;
    if (reset) resetForm();
    const panel = ensurePanel();
    panel?.querySelector("[data-arr-history]")?.replaceChildren(document.createTextNode("審査履歴を読み込んでいます…"));
    try {
      const data = await invoke(RECORDS_FUNCTION, { action: "get", uploadId: id, limit: 10 });
      if (seq !== state.reviewSeq || id !== state.activeUploadId) return;
      state.latest = data.latest || null;
      state.history = Array.isArray(data.history) ? data.history : [];
      renderAll();
    } catch (error) {
      if (seq !== state.reviewSeq) return;
      console.error("review records load error", error);
      const host = ensurePanel()?.querySelector("[data-arr-history]");
      if (host) host.textContent = error?.message || "審査履歴を読み込めませんでした。";
    }
  }

  async function saveCurrentReview() {
    if (state.saving) return;
    const panel = ensurePanel();
    if (!panel) return;
    const status = panel.querySelector('input[name="arrStatus"]:checked')?.value || "";
    if (!status) {
      alert("審査結果を選択してください。");
      return;
    }
    if (!state.activeUploadId) {
      alert("現在表示中のKMZを確認できませんでした。");
      return;
    }
    const siteId = state.siteId || window.AdminReviewScope?.getSiteId?.() || "";
    if (!siteId) {
      alert("site_idを確認できないため保存できません。");
      return;
    }

    const reasons = [...panel.querySelectorAll("[data-arr-reason]:checked")].map(input => input.value);
    const memo = panel.querySelector("[data-arr-memo]")?.value.trim() || "";
    const auto = window.AdminAutoReview?.getResult?.();
    const policyVersionNo = Number(auto?.policy?.versionNo ?? window.CampsitePolicy?.getSnapshot?.()?.versionNo) || 0;
    const message = panel.querySelector("[data-arr-message]");
    const button = panel.querySelector("[data-arr-save]");

    state.saving = true;
    if (button) button.disabled = true;
    if (message) message.textContent = "保存しています…";
    try {
      const data = await invoke(RECORDS_FUNCTION, {
        action: "save",
        siteId,
        uploadId: state.activeUploadId,
        status,
        reasons,
        memo,
        policyVersionNo,
        autoCheckSnapshot: compactAutoReview()
      });
      if (message) message.textContent = `rev ${data.review?.reviewRevision || "?"} を保存しました。`;
      await loadReviews(state.activeUploadId, false);
      resetForm();
      const saved = ensurePanel()?.querySelector("[data-arr-message]");
      if (saved) saved.textContent = `rev ${data.review?.reviewRevision || "?"} をサーバーへ保存しました。`;
    } catch (error) {
      console.error("review records save error", error);
      if (message) message.textContent = error?.message || "保存できませんでした。";
    } finally {
      state.saving = false;
      if (button) button.disabled = false;
    }
  }

  async function loadContext(recordId) {
    const id = String(recordId || "").trim();
    if (!id) return;
    const seq = ++state.loadSeq;
    state.initialRecordId = id;
    state.siteId = "";
    state.timeline = [];
    state.activeIndex = 0;
    state.activeUploadId = "";
    state.latest = null;
    state.history = [];
    ensurePanel();
    resetForm();
    renderAll();
    try {
      const data = await invoke(HISTORY_FUNCTION, { recordId: id });
      if (seq !== state.loadSeq) return;
      state.siteId = String(data?.site?.id || data?.current?.siteId || "");
      state.timeline = buildTimeline(data);
      state.activeIndex = 0;
      state.activeUploadId = String(state.timeline[0]?.id || id);
      renderAll();
      await loadReviews(state.activeUploadId, true);
    } catch (error) {
      if (seq !== state.loadSeq) return;
      console.error("review records context error", error);
      const host = ensurePanel()?.querySelector("[data-arr-history]");
      if (host) host.textContent = error?.message || "審査対象を読み込めませんでした。";
    }
  }

  function switchToIndex(index) {
    if (!Number.isInteger(index) || index < 0 || index >= state.timeline.length) return;
    const nextId = String(state.timeline[index]?.id || "");
    if (!nextId) return;
    const changed = nextId !== state.activeUploadId;
    state.activeIndex = index;
    state.activeUploadId = nextId;
    renderAll();
    if (changed) loadReviews(nextId, true);
  }

  function installTimelineListener() {
    document.addEventListener("click", event => {
      const button = event.target?.closest?.("#adminReviewWorkspace [data-arw-index]");
      if (!button) return;
      const index = Number(button.dataset.arwIndex);
      if (!Number.isInteger(index)) return;
      setTimeout(() => switchToIndex(index), 0);
    }, true);
  }

  function patchWorkspace() {
    const original = window.AdminReviewWorkspace;
    if (!original || original.__phase6RecordsWrapped) return Boolean(original?.__phase6RecordsWrapped);
    if (!original.__phase4ScopeWrapped) return false;

    const wrapped = Object.freeze({
      __phase4ScopeWrapped: true,
      __phase6RecordsWrapped: true,
      open: async recordId => {
        const contextPromise = loadContext(recordId);
        const result = await original.open(recordId);
        ensurePanel();
        await contextPromise;
        renderAll();
        return result;
      },
      close: () => {
        state.initialRecordId = "";
        state.timeline = [];
        state.activeUploadId = "";
        state.latest = null;
        state.history = [];
        return original.close();
      },
      isOpen: () => original.isOpen()
    });
    window.AdminReviewWorkspace = wrapped;
    state.patched = true;
    return true;
  }

  installTimelineListener();
  window.addEventListener("adminautoreviewchange", renderContext);
  window.addEventListener("adminreviewscopechange", renderContext);
  window.addEventListener("campsitepolicychange", renderContext);

  const patchTimer = window.setInterval(() => {
    ensurePanel();
    if (patchWorkspace()) window.clearInterval(patchTimer);
  }, 50);

  window.AdminReviewRecords = Object.freeze({
    getActiveUploadId: () => state.activeUploadId || null,
    getLatest: () => state.latest ? { ...state.latest } : null,
    getHistory: () => state.history.map(row => ({ ...row })),
    reload: () => state.activeUploadId ? loadReviews(state.activeUploadId, false) : Promise.resolve()
  });
})();
