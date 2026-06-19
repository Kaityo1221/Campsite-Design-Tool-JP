(() => {
  "use strict";

  const PARK_CONFIGS = {
    sugaya: {
      testBatchId: "sugaya-20260619-v1",
      parkKey: "sugaya",
      parkName: "菅谷公園",
      createdAtStartUtc: "2026-06-18T23:51:49.356138+00:00",
      createdAtEndUtc: "2026-06-18T23:51:50.000000+00:00"
    }
  };

  const INVITE_CONFIGS = {
    "JUNPOKO-LOCAL": {
      reviewerName: "Junpoko",
      reviewerType: "local",
      roleLabel: "現地レビュー",
      showMap: true,
      intro:
        "現地を知っている人として、実際に使える場所か・危なくないかを見てください。"
    },

    "NAKANO-WAYFARER": {
      reviewerName: "中野さん",
      reviewerType: "wayfarer",
      roleLabel: "Wayfarer視点",
      showMap: true,
      intro:
        "現地にはいない前提で、Wayspot名・地図・位置から分類してください。"
    },

    "RUTO-NAME": {
      reviewerName: "るとくん",
      reviewerType: "name_only",
      roleLabel: "名前だけレビュー",
      showMap: false,
      intro:
        "POI名だけを見て分類してください。地図・座標は表示しません。"
    }
  };

  let appState = {
    
    parkConfig: null,
    inviteConfig: null,
    items: [],
    reviewedNames: new Set(),
    currentIndex: 0,
    selectedCategory: "",
    selectedConfidence: ""
  };
  let isSavingReview = false;

  document.addEventListener("DOMContentLoaded", initReviewPage);

  async function initReviewPage() {
    setupButtonEvents();

    const params = new URLSearchParams(window.location.search);
    const parkKey = params.get("park") || "";
    const inviteCode = params.get("invite") || "";

    const parkConfig = PARK_CONFIGS[parkKey];
    const inviteConfig = INVITE_CONFIGS[inviteCode];

    if (!parkConfig) {
      showStatus(
        "レビュー対象の公園が見つかりません。URLの park= を確認してください。",
        "error"
      );
      return;
    }

    if (!inviteConfig) {
      showStatus(
        "招待コードが正しくありません。URLの invite= を確認してください。",
        "error"
      );
      return;
    }

    appState.parkConfig = parkConfig;
    appState.inviteConfig = inviteConfig;

    setIntroText();

    if (!window.campsiteSupabase) {
      showStatus(
        "Supabaseに接続できません。js/lab-supabase.js の読み込みを確認してください。",
        "error"
      );
      return;
    }

    await loadReviewItems();
  }

  function setIntroText() {
    const intro = document.getElementById("reviewIntro");

    if (!intro) return;

    intro.innerHTML = `
      <strong>${escapeHtml(appState.parkConfig.parkName)}</strong> のPOIレビューです。<br>
      担当：${escapeHtml(appState.inviteConfig.reviewerName)}
      / ${escapeHtml(appState.inviteConfig.roleLabel)}<br>
      ${escapeHtml(appState.inviteConfig.intro)}
    `;
  }

  async function loadReviewItems() {
    showStatus("菅谷公園のレビュー対象を読み込んでいます…");

    try {
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
          created_at
        `)
        .gte("created_at", appState.parkConfig.createdAtStartUtc)
        .lt("created_at", appState.parkConfig.createdAtEndUtc)
        .order("count", { ascending: false })
        .order("normalized_name", { ascending: true });

      if (error) {
        console.error(error);
        showStatus("レビュー対象の読み込みに失敗しました。", "error");
        return;
      }

      appState.items = data || [];

      if (!appState.items.length) {
        showStatus(
          "レビュー対象が見つかりません。菅谷公園の created_at 条件を確認してください。",
          "error"
        );
        return;
      }

      await loadAlreadyReviewedItems();

      showStatus(
        `${appState.parkConfig.parkName}：${appState.items.length}件を読み込みました。`,
        "success"
      );

      renderCurrentItem();

    } catch (error) {
      console.error(error);
      showStatus("レビュー画面の初期化に失敗しました。", "error");
    }
  }

  async function loadAlreadyReviewedItems() {
    const { data, error } = await window.campsiteSupabase
      .from("poi_review_test_results")
      .select("normalized_name")
      .eq("test_batch_id", appState.parkConfig.testBatchId)
      .eq("reviewer_name", appState.inviteConfig.reviewerName);

    if (error) {
      console.error("既存レビュー取得エラー:", error);
      return;
    }

    appState.reviewedNames = new Set(
      (data || []).map(row => row.normalized_name)
    );
  }

  function renderCurrentItem() {
    resetSelections();

    const nextIndex = appState.items.findIndex(item => {
      return !appState.reviewedNames.has(item.normalized_name);
    });

    appState.currentIndex = nextIndex;

    if (nextIndex === -1) {
      showComplete();
      return;
    }

    const item = appState.items[nextIndex];

    const card = document.getElementById("reviewCard");
    const progressText = document.getElementById("reviewProgressText");
    const roleText = document.getElementById("reviewRoleText");
    const poiName = document.getElementById("reviewPoiName");
    const meta = document.getElementById("reviewMeta");
    const mapLink = document.getElementById("reviewMapLink");
    const note = document.getElementById("reviewNote");

    if (card) {
      card.style.display = "block";
    }

    if (progressText) {
      progressText.textContent =
        `${appState.reviewedNames.size + 1} / ${appState.items.length}`;
    }

    if (roleText) {
      roleText.textContent = appState.inviteConfig.roleLabel;
    }

    if (poiName) {
      poiName.textContent =
        item.poi_name || item.normalized_name || "名称なし";
    }

    if (note) {
      note.value = "";
    }

    renderMeta(item);
    renderMapLink(item);
  }

  function renderMeta(item) {
    const meta = document.getElementById("reviewMeta");

    if (!meta) return;

    if (appState.inviteConfig.reviewerType === "name_only") {
      meta.innerHTML = `
        名前だけレビューです。<br>
        地図・座標・現地情報は見ずに、POI名だけで分類してください。
      `;
      return;
    }

    meta.innerHTML = `
      出現数：${escapeHtml(item.count || 1)}件<br>
      正規化名：${escapeHtml(item.normalized_name || "-")}<br>
      source：${escapeHtml(item.source || "-")}<br>
      座標：${escapeHtml(item.sample_lat || "-")}, ${escapeHtml(item.sample_lng || "-")}
    `;
  }

  function renderMapLink(item) {
    const mapLink = document.getElementById("reviewMapLink");

    if (!mapLink) return;

    const lat = Number(item.sample_lat);
    const lng = Number(item.sample_lng);

    if (
      appState.inviteConfig.showMap &&
      Number.isFinite(lat) &&
      Number.isFinite(lng)
    ) {
      mapLink.href =
        `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
      mapLink.style.display = "inline-flex";
    } else {
      mapLink.href = "#";
      mapLink.style.display = "none";
    }
  }

  function setupButtonEvents() {
    document.querySelectorAll("[data-category]").forEach(button => {
      button.addEventListener("click", () => {
        appState.selectedCategory =
          button.getAttribute("data-category") || "";

        document.querySelectorAll("[data-category]").forEach(btn => {
          btn.classList.remove("is-selected");
        });

        button.classList.add("is-selected");
      });
    });

    document.querySelectorAll("[data-confidence]").forEach(button => {
      button.addEventListener("click", () => {
        appState.selectedConfidence =
          button.getAttribute("data-confidence") || "";

        document.querySelectorAll("[data-confidence]").forEach(btn => {
          btn.classList.remove("is-selected");
        });

        button.classList.add("is-selected");
      });
    });

    const submitButton = document.getElementById("saveReviewButton");

if (submitButton) {
  submitButton.addEventListener("click", submitCurrentReview);
}
  }

  async function submitCurrentReview() {
  if (isSavingReview) return;

  const item = appState.items[appState.currentIndex];

  if (!item) {
    showStatus("レビュー対象がありません。", "error");
    return;
  }

  if (!appState.selectedCategory) {
    alert("分類を選んでください。");
    return;
  }

  if (!appState.selectedConfidence) {
    alert("自信度を選んでください。");
    return;
  }

  const submitButton = document.getElementById("saveReviewButton");

  isSavingReview = true;

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.classList.remove("is-saved");
    submitButton.classList.add("is-saving");
    submitButton.textContent = "保存中…";
  }

  const note =
    String(document.getElementById("reviewNote")?.value || "").trim();

  const payload = {
    test_batch_id: appState.parkConfig.testBatchId,
    park_key: appState.parkConfig.parkKey,
    park_name: appState.parkConfig.parkName,

    source_queue_id: item.id,
    poi_name: item.poi_name || item.normalized_name || "",
    normalized_name: item.normalized_name || item.poi_name || "",
    sample_lat: toNullableNumber(item.sample_lat),
    sample_lng: toNullableNumber(item.sample_lng),

    reviewer_name: appState.inviteConfig.reviewerName,
    reviewer_type: appState.inviteConfig.reviewerType,

    selected_category: appState.selectedCategory,
    confidence: appState.selectedConfidence,
    review_note: note,
    reviewed_at: new Date().toISOString()
  };

  try {
    const { error } = await window.campsiteSupabase
      .from("poi_review_test_results")
      .upsert(payload, {
        onConflict: "test_batch_id,normalized_name,reviewer_name"
      });

    if (error) {
      console.error(error);
      showStatus("レビュー結果の保存に失敗しました。", "error");

      if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove("is-saving");
        submitButton.textContent = "もう一度保存する";
      }

      isSavingReview = false;
      return;
    }

    appState.reviewedNames.add(item.normalized_name);

    showStatus("保存しました。次のPOIへ進みます。", "success");

    if (submitButton) {
      submitButton.classList.remove("is-saving");
      submitButton.classList.add("is-saved");
      submitButton.textContent = "保存しました";
    }

    if (navigator.vibrate) {
      navigator.vibrate(30);
    }

    await wait(450);

    renderCurrentItem();

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove("is-saved");
      submitButton.textContent = "保存して次へ";
    }

    isSavingReview = false;

  } catch (error) {
    console.error(error);
    showStatus("保存中にエラーが発生しました。", "error");

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.classList.remove("is-saving");
      submitButton.textContent = "もう一度保存する";
    }

    isSavingReview = false;
  }
}

  function resetSelections() {
    appState.selectedCategory = "";
    appState.selectedConfidence = "";

    document.querySelectorAll(".is-selected").forEach(button => {
      button.classList.remove("is-selected");
    });
  }

  function showComplete() {
  const card = document.getElementById("reviewCard");
  const complete = document.getElementById("reviewCompleteBox");

  if (card) {
    card.style.display = "none";
  }

  if (complete) {
    complete.style.display = "block";
  }

  showStatus(
    "Complate!! いつもありがとう",
    "success"
  );

  triggerCompletionCelebration();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

  function showStatus(message, type = "info") {
    const box = document.getElementById("reviewStatusBox");

    if (!box) return;

    box.classList.remove("is-error", "is-success");

    if (type === "error") {
      box.classList.add("is-error");
    }

    if (type === "success") {
      box.classList.add("is-success");
    }

    box.innerHTML = escapeHtml(message).replace(/\n/g, "<br>");
  }
function wait(ms) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
  function toNullableNumber(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }
function triggerCompletionCelebration() {
  const layer = document.getElementById("celebrationLayer");
  if (!layer) return;

  layer.innerHTML = "";

  const colors = [
    "#facc15", "#fb7185", "#38bdf8", "#34d399",
    "#a78bfa", "#f97316", "#ffffff", "#fde68a"
  ];

  const shapes = ["square", "circle", "ribbon"];

  for (let i = 0; i < 70; i++) {
    layer.appendChild(createBurstPiece("left", colors, shapes, i));
    layer.appendChild(createBurstPiece("right", colors, shapes, i));
  }

  const emoji = document.createElement("div");
  emoji.className = "completion-emoji";
  emoji.textContent = "🎉🎊";
  layer.appendChild(emoji);

  if (navigator.vibrate) {
    navigator.vibrate([80, 60, 120]);
  }

  setTimeout(() => {
    layer.innerHTML = "";
  }, 1800);
}

function createBurstPiece(side, colors, shapes, index) {
  const piece = document.createElement("div");
  const color = colors[Math.floor(Math.random() * colors.length)];
  const shape = shapes[Math.floor(Math.random() * shapes.length)];
  const spreadY = `${Math.floor(Math.random() * 220) - 110}px`;
  const delay = `${Math.random() * 220}ms`;

  piece.className = `completion-burst ${side} ${shape}`;
  piece.style.background = color;
  piece.style.setProperty("--spread-y", spreadY);
  piece.style.animationDelay = delay;
  piece.style.top = `${42 + Math.random() * 18}%`;

  if (shape === "circle") {
    piece.style.borderRadius = "999px";
  }

  if (shape === "ribbon") {
    piece.style.width = `${8 + Math.random() * 6}px`;
    piece.style.height = `${16 + Math.random() * 12}px`;
  } else {
    const size = `${8 + Math.random() * 8}px`;
    piece.style.width = size;
    piece.style.height = size;
  }

  return piece;
}
  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
})();
