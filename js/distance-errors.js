// ======================================================
// CAMP-009: KML/KMZ 異常系メッセージ整理
// ======================================================

function createKmlKmzErrorMessage(errorType, detail = "") {
  const detailText = detail
    ? `<br><small>${escapeDistanceHtml(String(detail))}</small>`
    : "";

  const messages = {
    no_file: `
      ⚠ ファイルが選択されていません。<br>
      KML または KMZ ファイルを選択してください。
    `,

    unsupported_extension: `
      ⚠ 対応していないファイル形式です。<br>
      読み込めるのは <strong>.kml</strong> または <strong>.kmz</strong> です。<br>
      Google My Maps から出力した完成KMZを選択してください。
      ${detailText}
    `,

    zip_instead_of_kmz: `
      ⚠ ZIPファイルはそのままでは読み込めません。<br>
      Google My Maps からエクスポートした <strong>.kmz</strong> ファイルを選択してください。<br>
      もしZIPとして保存されている場合は、拡張子や出力方法を確認してください。
      ${detailText}
    `,

    kmz_without_kml: `
      ⚠ KMZの中にKMLファイルが見つかりませんでした。<br>
      Google My Maps から再度エクスポートしてください。<br>
      「レイヤをKML/KMZにエクスポート」ではなく、完成版のKMZを使ってください。
      ${detailText}
    `,

    KML_NOT_FOUND: `
      ⚠ KMZ内にKMLファイルが見つかりませんでした。<br>
      Google My Mapsから書き出した完成KMZか確認してください。<br>
      KMZ内にKMLファイルが見つからないため、読み込めません。
      ${detailText}
    `,

    empty_kml: `
      ⚠ KMLの中身が空、または読み取れるデータがありません。<br>
      My Maps上にPOI・線・ポリゴンが入っているか確認してください。
      ${detailText}
    `,

    parse_failed: `
      ⚠ KML/KMZの解析に失敗しました。<br>
      ファイルが壊れているか、対応していない形式の可能性があります。<br>
      Google My Maps から再エクスポートして、もう一度試してください。
      ${detailText}
    `,

    jszip_unavailable: `
      ⚠ KMZ処理ライブラリを読み込めませんでした。<br>
      通信環境を確認して、ページを再読み込みしてください。
      ${detailText}
    `,

    no_placemark: `
      ⚠ KML内にPlacemarkが見つかりませんでした。<br>
      POI、ルート線、活動範囲ポリゴンが入っているか確認してください。
      ${detailText}
    `,

    no_poi: `
      ⚠ POIとして読み取れる地点が見つかりませんでした。<br>
      My Maps上の地点データ、またはレイヤー名を確認してください。
      ${detailText}
    `,

    unknown: `
      ⚠ ファイルの読み込み中にエラーが発生しました。<br>
      KML/KMZの形式を確認してください。
      ${detailText}
    `
  };

  return messages[errorType] || messages.unknown;
}

function showKmlKmzError(targetElementId, errorType, detail = "") {
  const target = document.getElementById(targetElementId);

  const html = `
    <div class="distance-warning">
      ${createKmlKmzErrorMessage(errorType, detail)}
    </div>
  `;

  if (target) {
    target.innerHTML = html;
  } else {
    alert(
      createKmlKmzErrorMessage(errorType, detail)
        .replace(/<br>/g, "\n")
        .replace(/<[^>]+>/g, "")
    );
  }
}