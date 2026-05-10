async function generateCircleOnlyKMZ() {
  const files = Array.from(document.getElementById("circleOnlyFileInput").files);
  const status = document.getElementById("circleOnlyStatus");

  const radii = Array.from(
    document.querySelectorAll('input[name="circleOnlyRadius"]:checked')
  ).map(e => Number(e.value));

  if (files.length === 0) {
    alert("CSV / KML / KMZ ファイルを選択してください");
    return;
  }

  if (radii.length === 0) {
    alert("30m円または40m円を選択してください");
    return;
  }

  showLoading("円だけKMZ生成中…");

  try {
    let points = [];

    for (const file of files) {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    const text = await file.text();
    points.push(...parseCSV(text));
  } else if (
    fileName.endsWith(".kml") ||
    fileName.endsWith(".kmz") ||
    fileName.endsWith(".zip")
  ) {
    points.push(...await getPointsFromKmlOrKmz(file));
  }
}
   points = points.filter(p => {
  if (isDummyPoint(p)) return false;

  const layerName = p.layer || "";
  if (
    layerName.includes("円") ||
    layerName.includes("30m") ||
    layerName.includes("40m")
  ) {
    return false;
  }

  return true;
});
    const beforeCount = points.length;

    if (beforeCount === 0) {
      alert("円を作成できるスポット座標が見つかりませんでした");
      status.textContent = "";
      return;
    }

    const result = removeDuplicate(points);
    points = result.uniquePoints;

    const parser = new DOMParser();
    const outputXml = parser.parseFromString(
      `<?xml version="1.0" encoding="UTF-8"?>
      <kml xmlns="http://www.opengis.net/kml/2.2">
        <Document>
          <name>Campsite Circle Only Output</name>
        </Document>
      </kml>`,
      "application/xml"
    );

    const doc = outputXml.getElementsByTagName("Document")[0];

    const folders = {
      circle40: createFolder(outputXml, doc, "40m円（基本距離）"),
      circle30: createFolder(outputXml, doc, "30m円（調整用）")
    };

    points.forEach(p => {
      radii.forEach(radius => {
        const circlePlacemark = createCirclePlacemark(outputXml, p, radius);

        if (radius === 40) {
          folders.circle40.appendChild(circlePlacemark);
        } else if (radius === 30) {
          folders.circle30.appendChild(circlePlacemark);
        }
      });
    });

    const serializer = new XMLSerializer();
    const newKml = serializer.serializeToString(outputXml);

    const zip = new JSZip();
    zip.file("doc.kml", newKml);

    const blob = await zip.generateAsync({ type: "blob" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);

    const now = new Date();
    a.download = `campsite_circles_${now.getFullYear()}${now.getMonth() + 1}${now.getDate()}.kmz`;
    a.click();

    status.innerHTML =
      `読み込み：${beforeCount}件<br>` +
      `重複削除：${result.duplicateCount}件<br>` +
      `円作成対象：${points.length}件<br>` +
      `✔ 円だけKMZを生成しました`;

    const success = document.getElementById("successSound");
    if (success) {
      success.currentTime = 0;
      success.volume = 0.12;
      setTimeout(() => {
        success.play().catch(() => {});
      }, 100);
    }

  } catch (error) {
    console.error(error);
    alert("円だけKMZの生成中にエラーが発生しました");
    status.textContent = "";
  } finally {
    hideLoading();
  }
}

async function generateKMZ() {

  if (
    window.ENABLE_QUIZ &&
    localStorage.getItem("quizPassed") !== window.QUIZ_VERSION
  ) {
    window.showQuiz();
    return;
  }

  showLoading("読み込み中…");

  const files = Array.from(document.getElementById("fileInput").files);
  const status = document.getElementById("status");

  const radii = Array.from(
    document.querySelectorAll('input[name="radius"]:checked')
  ).map(e => Number(e.value));

  if (files.length === 0) {
    alert("CSV / KML / KMZ ファイルを選択してください");
    hideLoading();
    return;
  }

  if (radii.length === 0) {
    alert("30m円または40m円を選択してください");
    hideLoading();
    return;
  }

  await waitForRender();

  let points = [];

  for (const file of files) {
    const fileName = file.name.toLowerCase();

    if (fileName.endsWith(".csv")) {
      const text = await file.text();
      points.push(...parseCSV(text));
    } else if (
  fileName.endsWith(".kml") ||
  fileName.endsWith(".kmz") ||
  fileName.endsWith(".zip")
) {
  points.push(...await getPointsFromKmlOrKmz(file));
}  }

  const beforeCount = points.length;

 if (beforeCount === 0) {
  alert("スポット座標が見つかりませんでした");
  status.textContent = "";
  hideLoading();
  return;
}
await waitForRender();

  const result = removeDuplicate(points);
  points = result.uniquePoints;
setLoadingText("KMZ生成中…");
  // status.innerHTML = `
//   <span class="loading">
//     <span class="spinner"></span>
//     KMZ生成中…
//   </span>
// `;
  await sleep(3000);
  
await waitForRender();
  const parser = new DOMParser();
  const outputXml = parser.parseFromString(
    `<?xml version="1.0" encoding="UTF-8"?>
    <kml xmlns="http://www.opengis.net/kml/2.2">
      <Document>
        <name>Campsite Design Output</name>
      </Document>
    </kml>`,
    "application/xml"
  );

  const doc = outputXml.getElementsByTagName("Document")[0];
const hiddenStyle = outputXml.createElement("Style");
hiddenStyle.setAttribute("id", "hiddenStyle");

const iconStyle = outputXml.createElement("IconStyle");
const scale = outputXml.createElement("scale");
scale.textContent = "0";

iconStyle.appendChild(scale);
hiddenStyle.appendChild(iconStyle);
doc.appendChild(hiddenStyle);
  const folders = {
  pokestop: createFolder(outputXml, doc, "既存のポケストップ"),
  gym: createFolder(outputXml, doc, "既存のジム"),
  power: createFolder(outputXml, doc, "既存のパワースポット"),

  addPokestop: createFolder(outputXml, doc, "追加希望ポケスト"),
  addGym: createFolder(outputXml, doc, "追加希望ジム"),
  addPower: createFolder(outputXml, doc, "追加希望パワスポ"),

  circle40: createFolder(outputXml, doc, "40m円（基本距離）"),
  circle30: createFolder(outputXml, doc, "30m円（調整用）")
};

addDummyPlacemark(outputXml, folders.addPokestop, "ここに追加ポケストを配置");
addDummyPlacemark(outputXml, folders.addGym, "ここに追加ジムを配置");
addDummyPlacemark(outputXml, folders.addPower, "ここに追加パワスポを配置");

points.forEach(p => {
  const kind = classifyType(p.type, p.name, p.layer);
  const pointPlacemark = createPointPlacemark(outputXml, p);

  if (kind === "gym") {
    folders.gym.appendChild(pointPlacemark);
  } else if (kind === "power") {
    folders.power.appendChild(pointPlacemark);
  } else {
    folders.pokestop.appendChild(pointPlacemark);
  }

  radii.forEach(radius => {
    const circlePlacemark = createCirclePlacemark(outputXml, p, radius);

    if (radius === 40) {
      folders.circle40.appendChild(circlePlacemark);
    } else if (radius === 30) {
      folders.circle30.appendChild(circlePlacemark);
    }
  });
});

  const serializer = new XMLSerializer();
  const newKml = serializer.serializeToString(outputXml);

  const zip = new JSZip();
  zip.file("doc.kml", newKml);

  const blob = await zip.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const now = new Date();
a.download = `campsite_${now.getFullYear()}${now.getMonth()+1}${now.getDate()}.kmz`;
 a.click();

const success = document.getElementById("successSound");
success.currentTime = 0;
success.volume = 0.12;

setTimeout(() => {
  success.play().catch(() => {});
}, 100);

// どんな状況でも消す（最強）
setTimeout(() => {
  hideLoading();
}, 300);
status.innerHTML =
    `読み込み：${beforeCount}件<br>` +
    `重複削除：${result.duplicateCount}件<br>` +
    `出力：${points.length}件<br>` +
    `✔ KMZを生成しました`;
  status.style.transform = "scale(1.05)";
setTimeout(() => {
  status.style.transform = "scale(1)";
}, 120);
}