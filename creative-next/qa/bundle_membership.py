from pathlib import Path
import posixpath,re,json
base=Path(__file__).parent.parent/'creative-next'
rel=[
'phase-1a/core/poi-model.mjs','phase-1a/core/poi-id.mjs','phase-1a/core/poi-limits.mjs','phase-1a/core/poi-commands.mjs','phase-1a/core/history.mjs','phase-1a/core/poi-store.mjs',
'phase-1b/core/diagnose-kmz-candidate.mjs','phase-1b/core/stage-kmz.mjs','phase-1b/core/dependent-circles.mjs','phase-1b/core/activity-areas.mjs','phase-1b/core/legacy-kasai-convert.mjs','phase-1b/core/export-kmz.mjs','phase-1b/core/journal-save.mjs','phase-1b/integration/legacy-poi-preview.mjs','phase-1b/integration/isolated-editor-session.mjs','phase-2-preview/leaflet-map-view.mjs','phase-2-preview/preview.mjs']
code=['(function(){"use strict";const modules=Object.create(null),cache=Object.create(null);function __require(key){if(cache[key])return cache[key].exports;if(!modules[key])throw Error("Bundle module missing: "+key);const module={exports:{}};cache[key]=module;modules[key](__require,module,module.exports);return module.exports;}']
for path in rel:
 src=(base/path).read_text();exported=[]
 def imp(m):
  args,source=m.groups()
  full=posixpath.normpath(posixpath.join(posixpath.dirname(path),source))
  return 'const {'+args.replace(' as ',': ')+'}=__require('+json.dumps(full)+');'
 src=re.sub(r'^\s*import\s*\{([^}]*)\}\s*from\s*[\'\"]([^\'\"]+)[\'\"];?\s*$',imp,src,flags=re.M)
 def exp(m):
  exported.append(m.group(2));return m.group(1)+' '+m.group(2)
 src=re.sub(r'^export\s+((?:async\s+)?function|class|const)\s+(\w+)',exp,src,flags=re.M)
 def exp_list(m):
  exported.extend(x.strip() for x in m.group(1).split(','));return ''
 src=re.sub(r'^export\s*\{([^}]+)\};?\s*$',exp_list,src,flags=re.M)
 if re.search(r'^import\s|^export\s',src,re.M):raise Exception('Unsupported ES export/import: '+path)
 code.append('modules['+json.dumps(path)+']=function(__require,module,exports){\n'+src+'\nObject.assign(exports,{'+','.join(exported)+'});\n};')
code.append('__require("phase-2-preview/preview.mjs");})();')
out=base.parent/'qa/MEMBERSHIP_BROWSER_BUNDLE.js';out.write_text('\n'.join(code));print('BUNDLE_PASS',len(rel),'modules',out.stat().st_size,'bytes')
