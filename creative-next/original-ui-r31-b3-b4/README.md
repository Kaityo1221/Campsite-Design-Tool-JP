# Creative Next r31 B3/B4 — isolated continuation

Test-only entry: `creative-next/original-ui-r31-b3-b4/index.html` served over HTTPS or localhost. Open through a web server, not a `file:` URL. No production link or deployment is added.

Select one KMZ/KML, wait for REVIEW, then explicitly start. Existing POIs are entirely read-only; only new POIs may change. The frozen B2 adapter connects the same Session, Leaflet map and timeline. Accepted legacy conversion creates separate bytes and never writes the original. Ambiguous or absent legacy circle ownership yields `LEGACY_CIRCLE_AMBIGUOUS` HOLD; there is no inferred repair.

Save menu → **下書きを保存** stores a source-bearing snapshot in exactly three keys under `campsite-creative-next-v1-r31-b3-b4`. Writes require SHA-256, exclusive Web Locks, revision preconditions and verified readback. There is no autosave, old-key access, enumeration, migration, deletion or overwrite of other workspaces. Missing safe persistence capabilities yields HOLD while in-memory editing/export remain available.

On a fresh page, **前回のデータから再開** requires explicit confirmation and a verified READY snapshot. Restore rechecks full source identity, existing POI immutability, edited polygons and exportability before activation. The restored Session starts a new empty undo/redo timeline; undo history is not persisted. FALLBACK/CORRUPT saves remain HOLD, with no automatic pointer repair. A live Session cannot be replaced; start a fresh page for another dataset.

**KMZで出力 → ダウンロード** verifies the resulting archive by reimporting it, then downloads a separate `creative-next-r31-edited.kmz`. The original file is never opened for writing. **保存先を選ぶ** remains an explicit HOLD because filesystem overwrite cannot be safely guaranteed; use Download. Uncommitted UI drafts are never checkpointed. Back returns to the entry without creating another Session; Continue returns to the same map/history.

Build: `node creative-next/qa/r31-b3-b4/build.cjs`. Checks: `node creative-next/qa/r31-b3-b4/run.cjs`. Dependencies and CI are pinned in the dedicated workflow. Frozen B1/B2 browser assertion sequences are reused in memory with only presentation/output routing adapted; original files and evidence are never written. Detailed generated results stay in CI artifacts, not Git.

**iPhone Safari実機未検証。** Chromium/Edge with mobile viewports does not substitute for Safari, IME, mobile dialogs, storage quota or real network/device validation. No merge, publication or production readiness claim.
