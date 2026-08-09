/* ======================================================
   UI大改修 10: 作成前の拠点診断
   合否や点数ではなく、現地調査と設計の確認ポイントを整理する。
   入力内容は送信・保存しない。
====================================================== */

const SITE_DIAGNOSIS_QUESTIONS = [
  {
    id: "publicUse",
    title: "一般に利用できる場所ですか？",
    note: "公園・広場など、参加者が通常利用できる場所か確認します。"
  },
  {
    id: "safeWalk",
    title: "安全に歩ける空間がありますか？",
    note: "歩道・園路・広場など、参加者が無理なく移動できるか確認します。"
  },
  {
    id: "loopRoute",
    title: "回遊できるルートがありますか？",
    note: "一周できる、または複数方向へ抜けられる動線があるか確認します。"
  },
  {
    id: "waitingSpace",
    title: "集合・待機できる場所がありますか？",
    note: "人が集まっても通行を妨げにくい場所があるか確認します。"
  },
  {
    id: "bottleneck",
    title: "狭い通路・信号など、詰まりやすい場所がありますか？",
    note: "ここだけは逆向きの質問です。「はい」の場合は現地で特に確認します。"
  },
  {
    id: "restFacilities",
    title: "トイレ・休憩場所がありますか？",
    note: "トイレ、ベンチ、東屋など、休憩できる場所を確認します。"
  },
  {
    id: "poiSpread",
    title: "既存POIは複数方向へ分布していますか？",
    note: "一か所だけに偏りすぎていないか、地図と現地の両方で確認します。"
  },
  {
    id: "fieldChecked",
    title: "実際に現地を歩いて確認しましたか？",
    note: "人の流れ、混雑、滞留場所などを現地で確認したか振り返ります。"
  }
];

function ensureSiteDiagnosisStyles() {
  if (document.getElementById("siteDiagnosisStyles")) return;

  const style = document.createElement("style");
  style.id = "siteDiagnosisStyles";
  style.textContent = `
    .site-diagnosis-menu-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      min-width: 44px;
      font-size: 28px;
      filter: drop-shadow(0 0 8px rgba(34,197,94,.35));
    }

    #site-diagnosis .site-diagnosis-lead {
      margin: 0 0 16px;
      color: #cbd5e1;
      font-size: 14px;
      line-height: 1.8;
    }

    #site-diagnosis .site-diagnosis-policy {
      margin: 0 0 18px;
      padding: 14px 16px;
      border: 1px solid rgba(56,189,248,.32);
      border-radius: 14px;
      background: rgba(14,165,233,.08);
      color: #dbeafe;
      font-size: 13px;
      line-height: 1.75;
    }

    #site-diagnosis .site-diagnosis-policy strong {
      color: #7dd3fc;
    }

    #site-diagnosis .site-diagnosis-question {
      margin: 0 0 12px;
      padding: 16px;
      border: 1px solid rgba(148,163,184,.26);
      border-radius: 14px;
      background: rgba(15,23,42,.68);
    }

    #site-diagnosis .site-diagnosis-question h3 {
      margin: 0 0 6px;
      color: #f8fafc;
      font-size: 16px;
      line-height: 1.55;
    }

    #site-diagnosis .site-diagnosis-question p {
      margin: 0 0 12px;
      color: #94a3b8;
      font-size: 12px;
      line-height: 1.7;
    }

    #site-diagnosis .site-diagnosis-options {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    #site-diagnosis .site-diagnosis-option {
      position: relative;
      display: block;
      cursor: pointer;
    }

    #site-diagnosis .site-diagnosis-option input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    #site-diagnosis .site-diagnosis-option span {
      display: flex;
      min-height: 42px;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      padding: 9px 8px;
      border: 1px solid rgba(148,163,184,.28);
      border-radius: 10px;
      background: rgba(30,41,59,.72);
      color: #cbd5e1;
      font-size: 13px;
      font-weight: 800;
      text-align: center;
      transition: .16s ease;
    }

    #site-diagnosis .site-diagnosis-option input:checked + span {
      border-color: rgba(56,189,248,.72);
      background: rgba(14,165,233,.18);
      color: #e0f2fe;
      box-shadow: 0 0 0 1px rgba(56,189,248,.16) inset;
    }

    #site-diagnosis .site-diagnosis-actions {
      margin-top: 18px;
    }

    #site-diagnosis .site-diagnosis-run {
      width: 100%;
      padding: 13px 16px;
      border: 1px solid rgba(34,197,94,.52);
      border-radius: 12px;
      background: rgba(34,197,94,.18);
      color: #dcfce7;
      font-size: 15px;
      font-weight: 900;
      cursor: pointer;
    }

    #siteDiagnosisResult {
      margin-top: 18px;
      scroll-margin-top: 14px;
    }

    #siteDiagnosisResult:empty {
      display: none;
    }

    #site-diagnosis .site-diagnosis-result-intro {
      margin-bottom: 12px;
      padding: 14px 16px;
      border: 1px solid rgba(168,85,247,.34);
      border-radius: 14px;
      background: rgba(126,34,206,.08);
      color: #e9d5ff;
      font-size: 13px;
      line-height: 1.75;
    }

    #site-diagnosis .site-diagnosis-result-card {
      margin-bottom: 12px;
      padding: 15px 16px;
      border: 1px solid rgba(148,163,184,.25);
      border-radius: 14px;
      background: rgba(15,23,42,.72);
    }

    #site-diagnosis .site-diagnosis-result-card.good {
      border-color: rgba(34,197,94,.34);
      background: rgba(34,197,94,.07);
    }

    #site-diagnosis .site-diagnosis-result-card.check {
      border-color: rgba(245,158,11,.38);
      background: rgba(245,158,11,.07);
    }

    #site-diagnosis .site-diagnosis-result-card.design {
      border-color: rgba(56,189,248,.34);
      background: rgba(14,165,233,.07);
    }

    #site-diagnosis .site-diagnosis-result-card h3 {
      margin: 0 0 10px;
      color: #f8fafc;
      font-size: 16px;
    }

    #site-diagnosis .site-diagnosis-result-card ul {
      margin: 0;
      padding-left: 20px;
      color: #dbe4f0;
      font-size: 13px;
      line-height: 1.75;
    }

    #site-diagnosis .site-diagnosis-result-card li + li {
      margin-top: 5px;
    }

    #site-diagnosis .site-diagnosis-next {
      margin-top: 14px;
      padding: 16px;
      border: 1px solid rgba(34,197,94,.35);
      border-radius: 14px;
      background: rgba(34,197,94,.08);
      text-align: center;
    }

    #site-diagnosis .site-diagnosis-next p {
      margin: 0 0 12px;
      color: #d1fae5;
      font-size: 13px;
      line-height: 1.7;
    }

    #site-diagnosis .site-diagnosis-next button {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid rgba(34,197,94,.5);
      border-radius: 10px;
      background: rgba(34,197,94,.18);
      color: #dcfce7;
      font-weight: 900;
      cursor: pointer;
    }

    @media (max-width: 520px) {
      #site-diagnosis .site-diagnosis-options {
        grid-template-columns: 1fr;
      }

      #site-diagnosis .site-diagnosis-option span {
        min-height: 40px;
        justify-content: flex-start;
        padding-left: 14px;
      }
    }
  `;

  document.head.appendChild(style);
}

function createSiteDiagnosisMenuButton() {
  const list = document.querySelector(".dashboard-prep .dashboard-list");
  if (!list || list.querySelector("[data-site-diagnosis-menu]")) return;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "tab-button dashboard-button neon-green";
  button.dataset.siteDiagnosisMenu = "true";
  button.innerHTML = `
    <span class="site-diagnosis-menu-icon" aria-hidden="true">🧭</span>
    <span class="dashboard-copy">
      <strong>拠点診断</strong>
      <small>現地調査の確認ポイントを整理</small>
    </span>
  `;
  button.addEventListener("click", () => {
    if (typeof window.openTab === "function") {
      window.openTab("site-diagnosis", button);
    }
  });

  list.prepend(button);
}

function getSiteDiagnosisQuestionHtml(question, index) {
  return `
    <div class="site-diagnosis-question" data-site-question="${question.id}">
      <h3>${index + 1}. ${question.title}</h3>
      <p>${question.note}</p>
      <div class="site-diagnosis-options">
        <label class="site-diagnosis-option">
          <input type="radio" name="siteDiagnosis_${question.id}" value="yes">
          <span>はい</span>
        </label>
        <label class="site-diagnosis-option">
          <input type="radio" name="siteDiagnosis_${question.id}" value="no">
          <span>いいえ</span>
        </label>
        <label class="site-diagnosis-option">
          <input type="radio" name="siteDiagnosis_${question.id}" value="unknown">
          <span>未確認</span>
        </label>
      </div>
    </div>
  `;
}

function createSiteDiagnosisSection() {
  if (document.getElementById("site-diagnosis")) return;

  const container = document.querySelector(".container");
  const tool = document.getElementById("tool");
  if (!container || !tool) return;

  const section = document.createElement("section");
  section.id = "site-diagnosis";
  section.className = "tab-content";
  section.innerHTML = `
    <div class="panel">
      <h2>🧭 作成前の拠点診断</h2>
      <p class="site-diagnosis-lead">
        KMZを作る前に、候補地を現地調査する時の確認ポイントを整理します。<br>
        分からない項目は「未確認」で大丈夫です。
      </p>

      <div class="site-diagnosis-policy">
        <strong>この診断は合否判定ではありません。</strong><br>
        候補地を落とすためではなく、「次に現地で何を見るか」を見つけるための補助機能です。<br>
        回答内容は外部へ送信・保存しません。
      </div>

      <div id="siteDiagnosisQuestions">
        ${SITE_DIAGNOSIS_QUESTIONS.map(getSiteDiagnosisQuestionHtml).join("")}
      </div>

      <div class="site-diagnosis-actions">
        <button type="button" class="site-diagnosis-run" data-site-diagnosis-run>
          診断結果を見る
        </button>
      </div>

      <div id="siteDiagnosisResult" aria-live="polite"></div>
    </div>
  `;

  tool.before(section);
  section.querySelector("[data-site-diagnosis-run]")?.addEventListener("click", renderSiteDiagnosisResult);
}

function getSiteDiagnosisAnswers() {
  const answers = {};

  SITE_DIAGNOSIS_QUESTIONS.forEach(question => {
    answers[question.id] = document.querySelector(
      `input[name="siteDiagnosis_${question.id}"]:checked`
    )?.value || "unknown";
  });

  return answers;
}

function pushUnique(list, text) {
  if (text && !list.includes(text)) list.push(text);
}

function buildSiteDiagnosisResult(answers) {
  const good = [];
  const check = [];
  const design = [];

  if (answers.publicUse === "yes") {
    pushUnique(good, "一般利用できる場所として確認できています。");
  } else if (answers.publicUse === "no") {
    pushUnique(check, "候補地の利用条件や立入可能な範囲を、設計前にもう一度確認してください。");
  } else {
    pushUnique(check, "一般利用できる場所か未確認です。利用条件・立入範囲を現地で確認してください。");
  }

  if (answers.safeWalk === "yes") {
    pushUnique(good, "歩行動線を確保しやすい候補地です。");
  } else {
    pushUnique(check, "参加者が安全に歩ける園路・歩道・広場があるか確認してください。");
  }

  if (answers.loopRoute === "yes") {
    pushUnique(good, "回遊型のプレイ動線を考えやすい候補地です。");
  } else {
    pushUnique(check, "一周できない場合、折り返し地点や一本動線で人が滞留しないか確認してください。");
    pushUnique(design, "一本の動線に集中する場合は、折り返し付近へPOIを密集させない設計を意識してください。");
  }

  if (answers.waitingSpace === "yes") {
    pushUnique(good, "集合・待機場所を設計へ組み込みやすそうです。");
    pushUnique(design, "集合場所は通行の余白を残し、POIを一か所へ集中させすぎないようにします。");
  } else {
    pushUnique(check, "集合・待機できる場所を探し、通行を妨げないか確認してください。");
  }

  if (answers.bottleneck === "yes") {
    pushUnique(check, "狭い通路・信号・横断歩道などのボトルネックがあります。時間帯も含めて人の流れを確認してください。");
    pushUnique(design, "狭い通路や信号付近へ追加POIを集中させず、立ち止まる場所を少し離して考えます。");
  } else if (answers.bottleneck === "no") {
    pushUnique(good, "大きな通行ボトルネックは今のところ見当たっていません。");
  } else {
    pushUnique(check, "狭い通路・信号など、人が詰まりやすい場所の有無を現地で確認してください。");
  }

  if (answers.restFacilities === "yes") {
    pushUnique(good, "トイレや休憩場所をプレイ動線へ組み込みやすそうです。");
    pushUnique(design, "休憩設備は回遊ルートから自然に立ち寄れる位置として考えます。");
  } else {
    pushUnique(check, "トイレ・ベンチ・休憩場所の位置を確認してください。長時間のイベントでは重要です。");
  }

  if (answers.poiSpread === "yes") {
    pushUnique(good, "既存POIを起点に、複数方向へプレイを分散させやすそうです。");
  } else {
    pushUnique(check, "既存POIの偏りを地図と現地で確認してください。");
    pushUnique(design, "既存POIが一か所に偏っている場合、追加POIでその密集をさらに強めないようにします。");
  }

  if (answers.fieldChecked === "yes") {
    pushUnique(good, "現地の人流や混雑を踏まえて設計へ進める状態です。");
  } else {
    pushUnique(check, "設計を固める前に、実際に候補地を歩いて人の流れ・滞留場所・混雑を確認してください。");
  }

  pushUnique(design, "「置ける場所」より「遊びやすい動線」を優先して追加POIを考えます。");
  pushUnique(design, "POI間隔は40mを基本とし、40mの確保が難しい場所だけ30m以上40m未満を調整候補として考えます。");

  if (!good.length) {
    good.push("まだ確認途中です。未確認項目を現地で見ながら、候補地の良い点を探していきましょう。");
  }

  return { good, check, design };
}

function getSiteDiagnosisListHtml(items) {
  return `<ul>${items.map(item => `<li>${item}</li>`).join("")}</ul>`;
}

function renderSiteDiagnosisResult() {
  const result = document.getElementById("siteDiagnosisResult");
  if (!result) return;

  const answers = getSiteDiagnosisAnswers();
  const diagnosis = buildSiteDiagnosisResult(answers);

  result.innerHTML = `
    <div class="site-diagnosis-result-intro">
      <strong>候補地の確認メモができました。</strong><br>
      これは合否ではありません。注意点を現地で確認しながら、設計の材料として使ってください。
    </div>

    <div class="site-diagnosis-result-card good">
      <h3>✅ 向いている点</h3>
      ${getSiteDiagnosisListHtml(diagnosis.good)}
    </div>

    <div class="site-diagnosis-result-card check">
      <h3>⚠ 現地で確認する点</h3>
      ${getSiteDiagnosisListHtml(diagnosis.check)}
    </div>

    <div class="site-diagnosis-result-card design">
      <h3>🗺️ 設計するとき意識する点</h3>
      ${getSiteDiagnosisListHtml(diagnosis.design)}
    </div>

    <div class="site-diagnosis-next">
      <p><strong>現地確認の見通しが立ったら、キャンプサイト作成へ進めます。</strong></p>
      <button type="button" data-site-diagnosis-next>キャンプサイト作成へ進む</button>
    </div>
  `;

  result.querySelector("[data-site-diagnosis-next]")?.addEventListener("click", () => {
    if (typeof window.openCampsiteStartModal === "function") {
      window.openCampsiteStartModal();
    }
  });

  result.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupSiteDiagnosis() {
  ensureSiteDiagnosisStyles();
  createSiteDiagnosisMenuButton();
  createSiteDiagnosisSection();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", setupSiteDiagnosis);
} else {
  setupSiteDiagnosis();
}
