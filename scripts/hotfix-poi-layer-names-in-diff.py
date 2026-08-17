from pathlib import Path

path = Path('js/poi-spacing-kmz-diff.js')
text = path.read_text(encoding='utf-8')

needle = '''  function getParentFolderName(element) {
    let current = element?.parentElement || null;
    while (current) {
      if (nodeName(current) === "folder") {
        return directChildText(current, "name");
      }
      current = current.parentElement;
    }
    return "";
  }
'''
insert = needle + '''
  function canonicalPoiLayerName(value) {
    const names = window.CampsitePoiLayerNames;
    if (names && typeof names.canonicalize === "function") {
      return names.canonicalize(value);
    }

    const fallback = new Map([
      ["既存のポケストップ", "既存 PokéStop"],
      ["既存のジム", "既存 Gym"],
      ["既存のパワースポット", "既存 PowerSpot"],
      ["追加希望ポケスト", "新規 PokéStop"],
      ["追加希望ジム", "新規 Gym"],
      ["追加希望パワスポ", "新規 PowerSpot"],
      ["追加 PokéStop", "新規 PokéStop"],
      ["追加 Gym", "新規 Gym"],
      ["追加 PowerSpot", "新規 PowerSpot"]
    ]);
    return fallback.get(String(value || "").trim()) || String(value || "").trim();
  }

  function normalizePoiFolderNames(xml) {
    let renamed = 0;
    Array.from(xml.getElementsByTagName("Folder")).forEach(folder => {
      if (circleMetersFromFolder(folder) !== null) return;

      const nameNode = Array.from(folder.children || []).find(node =>
        nodeName(node) === "name"
      );
      if (!nameNode) return;

      const current = String(nameNode.textContent || "").trim();
      const canonical = canonicalPoiLayerName(current);
      if (!canonical || canonical === current) return;

      nameNode.textContent = canonical;
      renamed += 1;
    });
    return renamed;
  }
'''
if needle not in text:
    raise SystemExit('getParentFolderName insertion point not found')
text = text.replace(needle, insert, 1)

needle2 = '''    reorderCircleFolders(xml);

    return {
      text: new XMLSerializer().serializeToString(xml),
      result
    };
'''
replace2 = '''    reorderCircleFolders(xml);
    const renamedPoiFolders = normalizePoiFolderNames(xml);

    return {
      text: new XMLSerializer().serializeToString(xml),
      result,
      renamedPoiFolders
    };
'''
if needle2 not in text:
    raise SystemExit('patch return insertion point not found')
text = text.replace(needle2, replace2, 1)

needle3 = '''        status.innerHTML =
          "既存レイヤー・既存円は変更していません。<br>" +
          `✔ ${statusText(50, patched.result[50])}<br>` +
'''
replace3 = '''        status.innerHTML =
          `POIレイヤー名：${patched.renamedPoiFolders > 0 ? `${patched.renamedPoiFolders}件を正式名称へ更新` : "正式名称を確認"}<br>` +
          "既存POI・既存円の内容は保持しています。<br>" +
          `✔ ${statusText(50, patched.result[50])}<br>` +
'''
if needle3 not in text:
    raise SystemExit('status insertion point not found')
text = text.replace(needle3, replace3, 1)

text = text.replace('   - Existing non-circle layers and KMZ assets are preserved\n', '   - Existing non-circle layer contents and KMZ assets are preserved\n   - Legacy POI Folder names are normalized to the formal six names\n', 1)
path.write_text(text, encoding='utf-8')

upload = Path('js/kmz-upload.js')
u = upload.read_text(encoding='utf-8')
old = 'import("./poi-spacing-kmz-diff.js?v=1")'
new = 'import("./poi-spacing-kmz-diff.js?v=2")'
if old not in u:
    raise SystemExit('kmz diff cache token not found')
u = u.replace(old, new, 1)
upload.write_text(u, encoding='utf-8')
