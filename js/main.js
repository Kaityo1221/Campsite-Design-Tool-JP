window.APP_VERSION = "v6.2.1";
window.APP_UPDATED = "2026-07-07";
window.ENABLE_QUIZ = true;
window.QUIZ_VERSION = "beta3";

let currentAliasReviewItem = null;
let aliasReviewIsLoading = false;
let aliasReviewSkippedIds = [];

window._layerPoints = {};

let distanceData = {
  existing: [],
  add: []
};
/* パスコード入力を半角英数字だけに制限 */
function sanitizePasscodeInput(input) {
  input.value = input.value.replace(/[^A-Za-z0-9]/g, "");
}

function checkAccessCode() {
  const input = document.getElementById("accessCodeInput");
  const error = document.getElementById("loginError");
  const loginScreen = document.getElementById("loginScreen");
  const splashScreen = document.getElementById("splashScreen");

  if (input.value.trim() === "CA2026") {
    error.textContent = "";
    input.blur();

    document.body.classList.add("opening-mode");

loginScreen.remove();
splashScreen.classList.add("show");

    const loginSound = document.getElementById("loginSound");
    loginSound.currentTime = 0;
    loginSound.volume = 0.08;

    setTimeout(() => {
      loginSound.play().catch(() => {});
    }, 80);

    setTimeout(function () {
  splashScreen.remove();
  showOpeningScreen();
}, 1600);
  } else {
    error.textContent = "パスコードが違います";
  }
}



/* =========================
   Common modal: policy / research notice
========================= */
function togglePolicyModal() {
  const modal = document.getElementById("policyModal");
  if (!modal) return;

  modal.classList.add("show");
}

function closePolicyModal() {
  const modal = document.getElementById("policyModal");
  if (!modal) return;

  modal.classList.remove("show");
}

document.addEventListener("click", function (event) {
  const modal = document.getElementById("policyModal");

  if (!modal || !modal.classList.contains("show")) {
    return;
  }

  if (event.target && event.target.id === "policyModal") {
    closePolicyModal();
  }
});

function openAdminLogin() {
  if (window.CampsiteAdminAuth?.openAdminEntry) {
    return window.CampsiteAdminAuth.openAdminEntry();
  }

  alert("管理者認証を準備中です。少し待ってから再度お試しください。");
}

function closeAdminLogin() {
  const modal = document.getElementById("adminLoginModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function checkAdminCode() {
  if (window.CampsiteAdminAuth?.loginFromModal) {
    return window.CampsiteAdminAuth.loginFromModal();
  }

  const error = document.getElementById("adminLoginError");
  if (error) {
    error.textContent = "管理者認証を準備中です";
  }
}
document.addEventListener("DOMContentLoaded", function () {

  const accessCodeInput =
    document.getElementById("accessCodeInput");

  if (accessCodeInput) {
    accessCodeInput.addEventListener("keydown", function (e) {

      if (e.key === "Enter") {
  e.preventDefault();
  checkAccessCode();
}

    });
  }

  const adminaccessCodeInput =
    document.getElementById("adminCodeInput");

  if (adminaccessCodeInput) {
    adminaccessCodeInput.addEventListener("keydown", function (e) {

     if (e.key === "Enter") {
  e.preventDefault();
  checkAdminCode();
}

    });
  }
  /*
    iPhone / Chrome 対策:
    KMZ / KML / ZIP は accept 指定があると選択不可になる場合があるため、
    ファイル選択制限は外し、読み込み時にJS側で判定する。
  */
  [
    "distanceFile",
    "adminReviewFile",
    "adminCheckFile",
    "adminDensityFile",
    "capacityFile",
    "circleOnlyFileInput",
    "deduplicatePoiFile"
  ].forEach(id => {
    const input = document.getElementById(id);

    if (input) {
      input.removeAttribute("accept");
    }
  });
  const distanceInput =
  document.getElementById("distanceFile");

if (distanceInput) {
  distanceInput.addEventListener("change", function () {
    const file = distanceInput.files[0];

    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (
      !fileName.endsWith(".kmz") &&
      !fileName.endsWith(".kml") &&
      !fileName.endsWith(".zip")
    ) {
      alert("完成KMZ / KML / ZIP ファイルを選択してください。PDFやJSONは読み込めません。");
      distanceInput.value = "";
      return;
    }

    loadDistanceFile();
  });
}

});

document.addEventListener("click", function (event) {

  const log =
    document.getElementById("updateLog");

  const badge =
    document.querySelector(".version-badge");

  if (!log || log.style.display !== "block") return;

  const clickedInsideLog =
    log.contains(event.target);

  const clickedBadge =
    badge && badge.contains(event.target);

  if (!clickedInsideLog && !clickedBadge) {
    log.style.display = "none";
  }

});
function showOpeningScreen() {
  const opening = document.getElementById("openingScreen");

  if (opening) {
    opening.classList.add("show");
  }
}

function startAdventure() {
  const opening = document.getElementById("openingScreen");

  let targetButton = null;

  document.querySelectorAll(".tab-button").forEach(button => {
    const onclick = button.getAttribute("onclick") || "";

    if (onclick.includes("openTab('tool'")) {
      targetButton = button;
    }
  });

  openTab("tool", targetButton);

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });

  if (opening) {
    opening.style.opacity = "0";
    opening.style.transition = "opacity 0.4s ease";
  }

  setTimeout(() => {
    if (opening) {
      opening.classList.remove("show");
    }

    document.body.classList.remove("opening-mode");

    if (opening) {
      opening.style.opacity = "1";
    }
  }, 400);
}
let openingSceneChanged = false;

function changeOpeningScene() {
  if (openingSceneChanged) return;

  openingSceneChanged = true;

  const left = document.getElementById("openingSceneLeft");
  const right = document.getElementById("openingSceneRight");
  const glow = document.getElementById("sceneMagicGlow");
  const sheepTapArea = document.getElementById("sheepTapArea");
  const toolsArea = document.querySelector(".sign-tools");
  if (!left || !right) return;

  if (glow) {
    glow.classList.remove("play");
    void glow.offsetWidth;
    glow.classList.add("play");
  }

  left.classList.remove("active");

  setTimeout(() => {
  right.classList.add("active");
  
document
  .querySelector(".opening-scene-wrap")
  .classList.add("is-right");
  if (toolsArea) {
    toolsArea.style.display = "block";
  }
}, 250);

  if (sheepTapArea) {
    sheepTapArea.style.display = "none";
  }
}

function backToOpening() {
  const opening = document.getElementById("openingScreen");
  const left = document.getElementById("openingSceneLeft");
  const right = document.getElementById("openingSceneRight");
  const sheepTapArea = document.getElementById("sheepTapArea");
  const toolsArea = document.querySelector(".sign-tools");
  const glow = document.getElementById("sceneMagicGlow");
const openingWrap = document.querySelector(".opening-scene-wrap");
openingWrap?.classList.remove("is-right");

document.getElementById("soulIcon")?.classList.remove("show");
resetCampsiteLabTab();
  if (!opening) return;

  openingSceneChanged = false;

  if (left) left.classList.add("active");
  if (right) right.classList.remove("active");
  if (sheepTapArea) sheepTapArea.style.display = "block";
  if (toolsArea) toolsArea.style.display = "none";
  /* オープニングタブで戻った時は光演出を消す */
  if (glow) glow.classList.remove("play");

  document.body.classList.add("opening-mode");

  opening.style.opacity = "1";
  opening.style.transition = "opacity 0.4s ease";

  opening.classList.add("show");
}
function goOpeningTab(tabId) {
  const opening = document.getElementById("openingScreen");

  let targetButton = null;

  document.querySelectorAll(".tab-button").forEach(button => {
    const onclick = button.getAttribute("onclick") || "";

    if (onclick.includes(`openTab('${tabId}'`)) {
      targetButton = button;
    }
  });

  /*
    オープニングを表示したまま、先に裏側のタブを切り替える。
    opening-mode中は .container が非表示なので、前のタブは見えない。
  */
  document.body.classList.add("opening-mode");

  if (opening) {
    opening.classList.add("show");
    opening.style.opacity = "1";
    opening.style.transition = "none";
  }

  openTab(tabId, targetButton);

  window.scrollTo({
    top: 0,
    behavior: "auto"
  });

  /*
    フェードさせずに閉じる。
    これで前回のタブが一瞬見える現象を防ぐ。
  */
  setTimeout(() => {
    if (opening) {
      opening.classList.remove("show");
      opening.style.opacity = "1";
      opening.style.transition = "none";
    }

    document.body.classList.remove("opening-mode");
  }, 120);
}
function showSoulIcon(){
  const icon = document.getElementById("soulIcon");
  if (!icon) return;

  icon.classList.add("show");

  setTimeout(() => {
    icon.classList.remove("show");
  }, 2500);
}
/* =========================
   Campsite Lab Secret Tab
========================= */

/* オープニングの羊→Lab看板から、分離したLabページへ入る */
function openCampsiteLab() {
  window.location.href = "lab.html";
}
/* オープニングへ戻った時にLabタブを再び隠す */
function resetCampsiteLabTab() {
  const labTab =
    document.querySelector(".lab-secret-tab");

  if (!labTab) {
    return;
  }

  labTab.classList.remove("show");
  labTab.classList.remove("active");
}
/* =========================
   おかえりなさいモーダル
========================= */

function openReturnModal() {
  const modal = document.getElementById("returnModal");

  if (!modal) {
    return;
  }

  const sheepImage =
    modal.querySelector(".return-modal-sheep");

  if (
    sheepImage &&
    !sheepImage.getAttribute("src")
  ) {
    sheepImage.setAttribute(
      "src",
      sheepImage.dataset.src
    );
  }

  modal.style.display = "flex";

  requestAnimationFrame(() => {
    modal.classList.add("show");
  });
}

function closeReturnModal() {
  const modal = document.getElementById("returnModal");

  if (!modal) {
    return;
  }

  modal.classList.remove("show");
  modal.style.display = "none";
}

function closeReturnModalByBackdrop(event) {
  if (event.target.id === "returnModal") {
    closeReturnModal();
  }
}

function goFromReturnModal(tabId) {
  closeReturnModal();
  openTab(tabId);
}

/* =========================
   KMZ生成完了モーダル
========================= */

function openKmzCompleteModal() {
  const modal = document.getElementById("kmzCompleteModal");

  if (!modal) {
    return;
  }

  modal.style.display = "flex";

  requestAnimationFrame(() => {
    modal.classList.add("show");
  });
}

function closeKmzCompleteModal() {
  const modal = document.getElementById("kmzCompleteModal");

  if (!modal) {
    return;
  }

  modal.classList.remove("show");
  modal.style.display = "none";
}

function closeKmzCompleteModalByBackdrop(event) {
  if (event.target.id === "kmzCompleteModal") {
    closeKmzCompleteModal();
  }
}

function openGoogleMyMaps() {

  setWorkflowStep("mymaps");

  window.open(
    "https://mymaps.google.com/",
    "_blank"
  );
}
function toggleVersionHistory() {
  const modal =
    document.getElementById("versionHistoryModal");

  modal.style.display =
    modal.style.display === "flex"
      ? "none"
      : "flex";
}
document.addEventListener("DOMContentLoaded", () => {
  const versionInfo =
    document.getElementById("versionInfo");

  if (typeof setupAliasReviewAdminUi === "function") {
    setupAliasReviewAdminUi();
  }

  localStorage.removeItem("campsiteAdminUnlocked");

  if (typeof hideAliasReviewAdminBox === "function") {
    hideAliasReviewAdminBox();
  }

  if (versionInfo) {
    versionInfo.textContent =
      APP_VERSION + " ℹ";
  }
});

/* Campsite Lab機能は js/lab.js に分離しました。 */

function getAliasReviewCategoryLabel(category) {
  const labels = {
    REST: "休憩",
    STAY: "滞在",
    LOOP: "回遊",
    CAUTION: "注意",
    EXCLUDE: "除外",
    HOLD: "保留"
  };

  return labels[category] || category;
}

function getAliasReviewStatusForCategory(category) {
  if (category === "EXCLUDE") {
    return "excluded";
  }

  if (category === "HOLD") {
    return "hold";
  }

  return "reviewed";
}

function setAliasReviewStatus(message, type = "info") {
  const status = document.getElementById("aliasReviewStatus");

  if (!status) {
    return;
  }

  const color =
    type === "error"
      ? "#fecaca"
      : type === "success"
        ? "#bbf7d0"
        : "#cbd5e1";

  status.innerHTML = `
    <div style="color:${color};">
      ${escapeHtml(message)}
    </div>
  `;
}

async function fetchAliasReviewRemainingCount() {
  if (!window.campsiteSupabase) {
    return 0;
  }

  const { count, error } = await window.campsiteSupabase
    .from("alias_review_queue")
    .select("id", {
      count: "exact",
      head: true
    })
    .eq("review_status", "pending");

  if (error) {
    console.error("未分類レビュー残数取得エラー:", error);
    return 0;
  }

  return count || 0;
}

async function fetchNextAliasReviewItem() {
  if (!window.campsiteSupabase) {
    setAliasReviewStatus("Supabaseに接続されていません。", "error");
    return null;
  }

  const { data, error } = await window.campsiteSupabase
    .from("alias_review_queue")
    .select(`
      id,
      poi_name,
      normalized_name,
      count,
      sample_lat,
      sample_lng,
      source,
      review_status,
      suggested_category,
      review_note,
      created_at
    `)
    .eq("review_status", "pending")
    .order("count", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(30);

  if (error) {
    console.error("未分類レビュー取得エラー:", error);
    setAliasReviewStatus("未分類POIの取得に失敗しました。", "error");
    return null;
  }

  const items = Array.isArray(data) ? data : [];

  if (!items.length) {
    return null;
  }

  const nextItem = items.find(item => {
    return !aliasReviewSkippedIds.includes(String(item.id));
  });

  if (nextItem) {
    return nextItem;
  }

  /*
    30件すべてを「あとで見る」した場合は、
    スキップリストを一度リセットして先頭に戻る。
  */
  aliasReviewSkippedIds = [];

  return items[0];
}

function renderAliasReviewItem(item, remainingCount) {
  const card = document.getElementById("aliasReviewCard");
  const nameEl = document.getElementById("aliasReviewPoiName");
  const metaEl = document.getElementById("aliasReviewMeta");
  const mapLink = document.getElementById("aliasReviewMapLink");
  const noteEl = document.getElementById("aliasReviewNote");
  const remainingEl = document.getElementById("aliasReviewRemainingCount");

  if (remainingEl) {
    remainingEl.textContent = `残り ${remainingCount}件`;
  }

  if (!item) {
    currentAliasReviewItem = null;

    if (card) {
      card.style.display = "none";
    }

    setAliasReviewStatus("レビュー待ちの未分類POIはありません。", "success");
    return;
  }

  currentAliasReviewItem = item;

  if (card) {
    card.style.display = "block";
  }

  if (nameEl) {
    nameEl.textContent = item.poi_name || "名称なし";
  }

  if (metaEl) {
    metaEl.innerHTML = `
      出現数：${escapeHtml(item.count || 1)}件<br>
      正規化名：${escapeHtml(item.normalized_name || "-")}<br>
      source：${escapeHtml(item.source || "-")}
    `;
  }

  if (noteEl) {
    noteEl.value = "";
  }

  const lat = Number(item.sample_lat);
  const lng = Number(item.sample_lng);

  if (
    mapLink &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  ) {
    mapLink.href = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    mapLink.style.display = "inline-flex";
  } else if (mapLink) {
    mapLink.href = "#";
    mapLink.style.display = "none";
  }

  setAliasReviewStatus("分類ボタンを押すと保存して次へ進みます。");
}

async function loadAliasReviewCard() {
  if (aliasReviewIsLoading) {
    return;
  }

  aliasReviewIsLoading = true;

  setAliasReviewStatus("未分類POIを読み込み中です…");

  try {
    const remainingCount =
      await fetchAliasReviewRemainingCount();

    const item =
      await fetchNextAliasReviewItem();

    renderAliasReviewItem(item, remainingCount);
  } catch (error) {
    console.error(error);
    setAliasReviewStatus("未分類レビューの読み込みに失敗しました。", "error");
  } finally {
    aliasReviewIsLoading = false;
  }
}

async function submitAliasReview(category) {
  if (!currentAliasReviewItem) {
    alert("レビュー対象がありません。");
    return;
  }

  if (!window.campsiteSupabase) {
    alert("Supabaseに接続されていません。");
    return;
  }

  const noteEl = document.getElementById("aliasReviewNote");
  const reviewNote = String(noteEl?.value || "").trim();

  const reviewStatus =
    getAliasReviewStatusForCategory(category);

  setAliasReviewStatus(
    `${getAliasReviewCategoryLabel(category)}として保存中です…`
  );

  const updatePayload = {
    review_status: reviewStatus,
    suggested_category: category,
    review_note: reviewNote,
    reviewed_at: new Date().toISOString(),
    reviewed_by: "会長"
  };

  const { error } = await window.campsiteSupabase
  .from("alias_review_queue")
  .update(updatePayload)
  .eq("id", currentAliasReviewItem.id)
  .eq("review_status", "pending");

  if (error) {
    console.error("未分類レビュー保存エラー:", error);
    setAliasReviewStatus("レビュー結果の保存に失敗しました。", "error");
    return;
  }

  setAliasReviewStatus(
    `${getAliasReviewCategoryLabel(category)}として保存しました。次を読み込みます。`,
    "success"
  );

  await loadAliasReviewCard();
  await loadAliasReviewHistory();
  await loadAliasDictionaryCandidates();
}
/* =========================
   CAMP-102: レビュー履歴表示
========================= */

async function loadAliasReviewHistory() {
  const list =
    document.getElementById("aliasReviewHistoryList");

  if (!list) {
    return;
  }

  if (!window.campsiteSupabase) {
    list.innerHTML = `
      <div class="alias-review-history-empty">
        Supabaseに接続されていません。
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div class="alias-review-history-empty">
      レビュー履歴を読み込み中...
    </div>
  `;

  const { data, error } = await window.campsiteSupabase
    .from("alias_review_queue")
    .select(`
      id,
      poi_name,
      normalized_name,
      suggested_category,
      review_status,
      review_note,
      reviewed_by,
      reviewed_at
    `)
    .not("reviewed_at", "is", null)
    .order("reviewed_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("レビュー履歴取得エラー:", error);

    list.innerHTML = `
      <div class="alias-review-history-empty">
        レビュー履歴の取得に失敗しました。
      </div>
    `;
    return;
  }

  if (!data || !data.length) {
    list.innerHTML = `
      <div class="alias-review-history-empty">
        まだレビュー履歴はありません。
      </div>
    `;
    return;
  }

  list.innerHTML = data.map(item => {
    const label =
      getAliasReviewCategoryLabel(
        item.suggested_category || item.review_status
      );

    const reviewedAt =
      formatAliasReviewDate(item.reviewed_at);

    const name =
      item.poi_name ||
      item.normalized_name ||
      "名称なし";

    const note =
      item.review_note
        ? `<div class="alias-review-history-note">メモ：${escapeHtml(item.review_note)}</div>`
        : "";

    return `
      <div class="alias-review-history-item">
        <div class="alias-review-history-main">
          <div class="alias-review-history-name">
            ${escapeHtml(name)}
          </div>

          <div class="alias-review-history-result">
            → ${escapeHtml(label)}
          </div>
        </div>

        <div class="alias-review-history-meta">
          ${escapeHtml(reviewedAt)}
          ${
            item.reviewed_by
              ? ` / ${escapeHtml(item.reviewed_by)}`
              : ""
          }
        </div>

        ${note}
      </div>
    `;
  }).join("");
}

function formatAliasReviewDate(value) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");

  return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
}
/* =========================
   CAMP-104: 辞書反映候補一覧
========================= */

async function loadAliasDictionaryCandidates() {
  const list =
    document.getElementById("aliasDictionaryCandidateList");

  if (!list) {
    return;
  }

  if (!window.campsiteSupabase) {
    list.innerHTML = `
      <div class="alias-dictionary-candidate-empty">
        Supabaseに接続されていません。
      </div>
    `;
    return;
  }

  list.innerHTML = `
    <div class="alias-dictionary-candidate-empty">
      辞書反映候補を読み込み中...
    </div>
  `;

  const { data, error } = await window.campsiteSupabase
  .from("alias_review_queue")
  .select(`
      id,
      poi_name,
      normalized_name,
      suggested_category,
      review_status,
      review_note,
      reviewed_by,
      reviewed_at,
      dictionary_status,
      dictionary_reviewed_at,
      dictionary_reviewed_by
    `)
  .eq("review_status", "reviewed")
  .order("reviewed_at", { ascending: false })
  .limit(50);

  if (error) {
    console.error("辞書反映候補取得エラー:", error);

    list.innerHTML = `
      <div class="alias-dictionary-candidate-empty">
        辞書反映候補の取得に失敗しました。
      </div>
    `;
    return;
  }

  const candidates = (data || []).filter(item => {
  return (
    item.suggested_category &&
    item.suggested_category !== "HOLD" &&
    item.suggested_category !== "EXCLUDE" &&
    item.dictionary_status !== "adopted" &&
    item.dictionary_status !== "rejected"
  );
});

  if (!candidates.length) {
    list.innerHTML = `
      <div class="alias-dictionary-candidate-empty">
        まだ辞書反映候補はありません。<br>
        未分類レビューで「休憩・滞在・回遊・注意」に分類すると、ここに表示されます。
      </div>
    `;
    return;
  }

  list.innerHTML = candidates.map(item => {
    const label =
      getAliasReviewCategoryLabel(item.suggested_category);

    const reviewedAt =
      formatAliasReviewDate(item.reviewed_at);

    const name =
      item.poi_name ||
      item.normalized_name ||
      "名称なし";

    const note =
      item.review_note
        ? `<div class="alias-dictionary-candidate-note">メモ：${escapeHtml(item.review_note)}</div>`
        : "";
const dictionaryStatus =
  item.dictionary_status || "none";

const dictionaryStatusLabel = {
  adopted: "採用済み",
  later: "後で確認",
  rejected: "見送り",
  none: "未判断"
}[dictionaryStatus] || "未判断";
    return `
      <div class="alias-dictionary-candidate-item">
        <div class="alias-dictionary-candidate-main">
          <div class="alias-dictionary-candidate-name">
            ${escapeHtml(name)}
          </div>

          <div class="alias-dictionary-candidate-result">
            → ${escapeHtml(label)}
          </div>
        </div>

        <div class="alias-dictionary-candidate-meta">
          ${escapeHtml(reviewedAt)}
          ${
            item.reviewed_by
              ? ` / ${escapeHtml(item.reviewed_by)}`
              : ""
          }
        </div>

                ${note}

        <div class="alias-dictionary-candidate-status">
          辞書判断：${escapeHtml(dictionaryStatusLabel)}
        </div>

        <div class="alias-dictionary-candidate-actions">
          <button
            type="button"
            onclick="updateAliasDictionaryCandidateStatus('${escapeHtml(item.id)}', 'adopted')"
          >
            ✅ 採用
          </button>

          <button
            type="button"
            onclick="updateAliasDictionaryCandidateStatus('${escapeHtml(item.id)}', 'later')"
          >
            🕓 後で確認
          </button>

          <button
            type="button"
            onclick="updateAliasDictionaryCandidateStatus('${escapeHtml(item.id)}', 'rejected')"
          >
            🚫 見送り
          </button>
        </div>
      </div>
    `;
  }).join("");
}
/* =========================
   CAMP-105: 辞書反映候補ステータス管理
========================= */

async function updateAliasDictionaryCandidateStatus(id, status) {
  if (!id) {
    alert("候補IDが取得できませんでした。");
    return;
  }

  if (!window.campsiteSupabase) {
    alert("Supabaseに接続されていません。");
    return;
  }

  const labels = {
    adopted: "採用",
    later: "後で確認",
    rejected: "見送り"
  };

  const label = labels[status] || status;

  const ok = confirm(
    `この候補を「${label}」にしますか？`
  );

  if (!ok) {
    return;
  }

  const { data: item, error: fetchError } =
    await window.campsiteSupabase
      .from("alias_review_queue")
      .select(`
        id,
        poi_name,
        normalized_name,
        suggested_category,
        review_note
      `)
      .eq("id", id)
      .single();

  if (fetchError || !item) {
    console.error("辞書候補取得エラー:", fetchError);
    alert("辞書候補の取得に失敗しました。");
    return;
  }

  if (status === "adopted") {
    const aliasName =
      item.poi_name ||
      item.normalized_name ||
      "";

    const normalizedAlias =
      item.normalized_name ||
      item.poi_name ||
      "";

    const dictionaryMap = {
      REST: {
        dictionary_id: "LAB_REST",
        canonical_name: "休憩"
      },
      STAY: {
        dictionary_id: "LAB_STAY",
        canonical_name: "滞在"
      },
      LOOP: {
        dictionary_id: "LAB_LOOP",
        canonical_name: "回遊"
      },
      CAUTION: {
        dictionary_id: "LAB_CAUTION",
        canonical_name: "注意"
      }
    };

    const dictionary =
      dictionaryMap[item.suggested_category];

    if (!aliasName || !normalizedAlias || !dictionary) {
      alert("辞書登録に必要な情報が不足しています。");
      return;
    }

    const aliasId =
      `ALIAS_${dictionary.dictionary_id}_${Date.now()}`;

    const { error: upsertError } =
      await window.campsiteSupabase
        .from("alias_master")
        .upsert(
          {
            alias_id: aliasId,
            dictionary_id: dictionary.dictionary_id,
            canonical_name: dictionary.canonical_name,
            alias_name: aliasName,
            normalized_alias: normalizedAlias,
            match_type: "exact",
            source_type: "admin_review",
            review_status: "active",
            active: true,
            note: item.review_note || ""
          },
          {
            onConflict: "normalized_alias,dictionary_id"
          }
        );

    if (upsertError) {
  console.error("辞書反映エラー:", upsertError);

  alert(
    "辞書への反映に失敗しました。\n\n" +
    (upsertError.message || JSON.stringify(upsertError))
  );

  return;
}
  }

  const { error } = await window.campsiteSupabase
    .from("alias_review_queue")
    .update({
      dictionary_status: status,
      dictionary_reviewed_at: new Date().toISOString(),
      dictionary_reviewed_by: "会長"
    })
    .eq("id", id);

  if (error) {
    console.error("辞書候補ステータス更新エラー:", error);
    alert("辞書候補ステータスの更新に失敗しました。");
    return;
  }

if (status === "adopted") {
  alert("辞書に反映しました。");
} else if (status === "later") {
  alert("後で確認にしました。");
} else if (status === "rejected") {
  alert("見送りにしました。");
}

await loadAliasDictionaryCandidates();

}

function closeAliasReviewPanel() {
  const panel = document.getElementById("aliasReviewPanel");

  if (panel) {
    panel.style.display = "none";
  }
}

async function skipCurrentAliasReviewItem() {
  if (!currentAliasReviewItem) {
    await loadAliasReviewCard();
    return;
  }

  aliasReviewSkippedIds.push(String(currentAliasReviewItem.id));

  setAliasReviewStatus("この候補をあとで見るにしました。次を読み込みます。");

  await loadAliasReviewCard();
  await loadAliasReviewHistory();
  await loadAliasDictionaryCandidates();
}

function isCampsiteAdminUnlocked() {
  return sessionStorage.getItem("campsiteAdminUnlocked") === "true";
}

function showAliasReviewAdminBox() {
  const box = document.getElementById("aliasReviewAdminBox");

  if (box) {
    box.style.display = "block";
  }
}

function hideAliasReviewAdminBox() {
  const box = document.getElementById("aliasReviewAdminBox");
  const panel = document.getElementById("aliasReviewPanel");

  if (box) {
    box.style.display = "none";
  }

  if (panel) {
    panel.style.display = "none";
  }
}
function setupAliasReviewAdminUi() {
  const toggleButton =
    document.getElementById("aliasReviewToggleButton");

  const closeButton =
    document.getElementById("aliasReviewCloseButton");

  const skipButton =
    document.getElementById("aliasReviewSkipButton");

  const panel =
    document.getElementById("aliasReviewPanel");

  const actionButtons =
    document.querySelectorAll("[data-review-category]");

  if (toggleButton && panel) {
    toggleButton.addEventListener("click", async () => {
      const isHidden =
        panel.style.display === "none" || !panel.style.display;

      panel.style.display = isHidden ? "block" : "none";

      if (isHidden) {
  aliasReviewSkippedIds = [];
  await loadAliasReviewCard();
  await loadAliasReviewHistory();
  await loadAliasDictionaryCandidates();
}
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      closeAliasReviewPanel();
    });
  }

  if (skipButton) {
    skipButton.addEventListener("click", async () => {
      if (aliasReviewIsLoading) {
        return;
      }

      await skipCurrentAliasReviewItem();
    });
  }

  actionButtons.forEach(button => {
    const pressOn = () => {
      button.classList.add("is-pressed");
    };

    const pressOff = () => {
      button.classList.remove("is-pressed");
    };

    button.addEventListener("touchstart", pressOn, {
      passive: true
    });

    button.addEventListener("touchend", pressOff);
    button.addEventListener("touchcancel", pressOff);
    button.addEventListener("mousedown", pressOn);
    button.addEventListener("mouseup", pressOff);
    button.addEventListener("mouseleave", pressOff);

    button.addEventListener("click", async () => {
      const category =
        button.getAttribute("data-review-category");

      if (!category || aliasReviewIsLoading) {
        return;
      }

      await submitAliasReview(category);
    });
  });
}



/* Campsite Lab出力・地図・KMZ機能は js/lab.js に分離しました。 */
