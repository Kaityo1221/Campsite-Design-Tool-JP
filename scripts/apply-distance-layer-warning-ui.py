from pathlib import Path
import re

entry_path = Path('js/distance-entry.js')
file_path = Path('js/distance-file.js')
index_path = Path('index.html')

entry = entry_path.read_text(encoding='utf-8')
old_entry = entry

entry = entry.replace(
'''    #distance .distance-layer-warning{margin-top:14px;padding:12px 14px;border:1px solid rgba(245,158,11,.4);border-radius:12px;background:rgba(245,158,11,.1);color:#fde68a;font-size:13px;line-height:1.7}\n    #distance .distance-layer-warning strong{display:block;margin-bottom:3px;color:#fef3c7}\n''',
'''    #distance .distance-layer-name-warning{margin:0 0 12px;overflow:hidden;border:1px solid rgba(245,158,11,.42);border-radius:12px;background:rgba(245,158,11,.07);box-shadow:0 0 0 1px rgba(245,158,11,.03) inset}\n    #distance .distance-layer-name-warning summary{display:flex;align-items:center;gap:9px;padding:11px 13px;color:#fde68a;font-size:13px;font-weight:900;cursor:pointer;list-style:none;user-select:none}\n    #distance .distance-layer-name-warning summary::-webkit-details-marker{display:none}\n    #distance .distance-layer-name-warning summary::after{content:'›';margin-left:auto;color:#fbbf24;font-size:20px;line-height:1;transform:rotate(90deg);transition:transform .18s ease}\n    #distance .distance-layer-name-warning[open] summary::after{transform:rotate(270deg)}\n    #distance .distance-layer-name-warning-count{display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;padding:0 7px;border-radius:999px;background:rgba(245,158,11,.18);border:1px solid rgba(245,158,11,.32);color:#fef3c7;font-size:11px;font-weight:900}\n    #distance .distance-layer-name-warning-body{padding:0 12px 12px;border-top:1px solid rgba(245,158,11,.16)}\n    #distance .distance-layer-name-warning-note{margin:10px 1px 9px;color:#cbd5e1;font-size:12px;line-height:1.6}\n    #distance .distance-layer-name-row{display:grid;grid-template-columns:minmax(0,1fr) 26px minmax(0,1fr);align-items:center;gap:7px;margin-top:7px;padding:9px 10px;border-radius:10px;background:rgba(15,23,42,.68);border:1px solid rgba(148,163,184,.18)}\n    #distance .distance-layer-name-chip{display:block;min-width:0;padding:6px 8px;border-radius:8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:inherit;font-size:12px;font-weight:800}\n    #distance .distance-layer-name-chip-current{background:rgba(148,163,184,.10);color:#cbd5e1;border:1px solid rgba(148,163,184,.20)}\n    #distance .distance-layer-name-chip-formal{background:rgba(56,189,248,.10);color:#bae6fd;border:1px solid rgba(56,189,248,.30);box-shadow:0 0 12px rgba(56,189,248,.06)}\n    #distance .distance-layer-name-arrow{text-align:center;color:#fbbf24;font-size:15px;font-weight:900}\n''')

entry = entry.replace(
'''    <div class="distance-layer-warning"><strong>レイヤー名の確認</strong>「既存」または「追加」を含めてください。<br>例：既存ポケストップ、追加ジム</div>\n''',
''
)

entry = entry.replace(
'''      #distanceResult .distance-classification-body>.distance-warning{padding:8px 10px}\n''',
'''      #distanceResult .distance-classification-body>.distance-warning{padding:8px 10px}\n      #distance .distance-layer-name-row{grid-template-columns:1fr;gap:5px}\n      #distance .distance-layer-name-arrow{transform:rotate(90deg);line-height:1}\n      #distance .distance-layer-name-chip{white-space:normal;overflow-wrap:anywhere}\n''')

if entry == old_entry:
    raise SystemExit('distance-entry.js: expected replacements were not applied')
if 'レイヤー名の確認' in entry or '「既存」または「追加」を含めてください' in entry:
    raise SystemExit('distance-entry.js: legacy warning text still remains')
entry_path.write_text(entry, encoding='utf-8')

src = file_path.read_text(encoding='utf-8')
replacement = r'''function renderDistancePoiLayerNameWarningHtml(warnings = []) {
  if (!warnings.length) return "";

  const rows = warnings.map(item => {
    const current = escapeDistanceHtml(item.current || "");
    const recommended = escapeDistanceHtml(item.recommended || item.current || "");

    return `
      <div class="distance-layer-name-row">
        <code class="distance-layer-name-chip distance-layer-name-chip-current" title="${current}">${current}</code>
        <span class="distance-layer-name-arrow" aria-hidden="true">→</span>
        <code class="distance-layer-name-chip distance-layer-name-chip-formal" title="${recommended}">${recommended}</code>
      </div>
    `;
  }).join("");

  return `
    <details class="distance-layer-name-warning">
      <summary>
        <span aria-hidden="true">⚠</span>
        <span>レイヤー名に修正があります</span>
        <span class="distance-layer-name-warning-count">${warnings.length}件</span>
      </summary>
      <div class="distance-layer-name-warning-body">
        <div class="distance-layer-name-warning-note">
          距離チェックは続行できます。提出前に右側の正式名称へ変更してください。
        </div>
        ${rows}
      </div>
    </details>
  `;
}

function renderDistanceLoadErrorHtml'''

src2, count = re.subn(
    r'function renderDistancePoiLayerNameWarningHtml\(warnings = \[\]\) \{.*?\n\}\n\nfunction renderDistanceLoadErrorHtml',
    replacement,
    src,
    count=1,
    flags=re.S,
)
if count != 1:
    raise SystemExit(f'distance-file.js: warning renderer replacement count={count}')
file_path.write_text(src2, encoding='utf-8')

index = index_path.read_text(encoding='utf-8')
index2 = index.replace('js/distance-entry.js?v=3', 'js/distance-entry.js?v=4')
index2 = index2.replace('js/distance-file.js?v=3', 'js/distance-file.js?v=4')
if index2 == index:
    raise SystemExit('index.html: cache version replacements not applied')
index_path.write_text(index2, encoding='utf-8')

print('Applied A+C distance layer warning UI')
