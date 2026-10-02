# Wayfarer Observe Flow phase gates

Updated: 2026-10-02
Branch: `feature/wm-wayfarer-observe-flow` · Draft PR #275

## WM-3C — LIVE PASS

Acceptance is based on the project owner's real-device screenshots and reported
results from the `wm3c-bridge-pc-test` artifact (ID `11212232381`, SHA-256
`b17b5b34e6361186174a87fd489124f26d21471ab806a5fb094d56ee3598115a`).

All six diagnostics passed: Relay接続 / Polygon受信 / GCS開始 / RESULT返却 /
Project保存 / Reference表示.

Observed counts: INTERIOR 37, REFERENCE_100 23, displayed Reference 23,
editable GUID duplicates suppressed 37.

Fixed product decisions:

- Creative Polygon is the source of truth; Wayfarer is the acquisition surface.
- Observation references do not enter `records` or `currentPois`.
- INTERIOR uses normal display; REFERENCE_100 is lighter.
- RESERVE_200 is retained internally and hidden.
- Do not draw 100m or 200m boundary lines (explicit owner decision).
- Field/Distance known red signatures reproduce on actual main.

This acceptance supersedes earlier WM-3C live-pending notes in PR #275.
The PR remains Draft; acceptance does not authorize a production release.

## Next roadmap phase: WM-4

Source: `wayfarer-observe-flow-spec-v1.md`, sections 20 and 22:
Project / Handoff backward-compatible extension precedes polygon editing (WM-5),
reference inspection/distance warnings (WM-6), and diff/merge (WM-7).

WM-3B-2D already introduced optional `wayfarerObservation`. WM-4 continues with
small subphases instead of creating a second schema or duplicating snapshots.

### WM-4A — observation retention through Creative lifecycle: local PASS

The RESULT receiver writes a freshly parsed Project to session storage, while
Creative's timer / pagehide / Next / Back callbacks retain the previously loaded
Project object. Saving that stale object could erase the accepted observation.

The feature Reference patch now wraps the existing Creative sync function:

- Read the stored Project immediately before sync.
- Require matching source, projectId and Bridge handoff identity.
- Carry the stored optional `wayfarerObservation` into the loaded object.
- Preserve observation removal instead of resurrecting an old snapshot.
- Stop detached callbacks after Project removal, replacement or unreadable storage.
- Keep editable arrays and the current polygon owned by the existing Creative sync.

The extension TEST bundle is generated from the same feature patch, so both entry
paths receive the fix. Production baseline `bridge-project-patch.js` and public
deployment are unchanged.

Gate:

1. Reproduce observation loss with the new lifecycle test before the fix.
2. Feature and packaged TEST lifecycle tests pass for timer, pagehide, Next,
   resume, replacement observation, missing observation and handoff isolation.
3. Existing Bridge architecture/Project recovery regressions pass.
4. Real Creative WebKit Reference gate passes across two autosave ticks.
5. Review the diff before marking WM-4A PASS.

All five local gates passed on 2026-10-02. The failure was reproduced before
the fix, both lifecycle paths passed afterward, `check:bridge-architecture` and
`check:bridge-next` passed, and the real Creative iPhone/WebKit Reference test
passed with its new two-autosave-tick assertions. Diff review found only the
feature sync wrapper, tests/CI wiring and contract/acceptance documentation.
Remote CI is checked separately after committing to PR #275.

### WM-4B — acquisition metadata / initial Handoff audit: PASS

Audit found one concrete contract gap: WM-3 already retained the polygon/zones and
completeness result, but the first legacy Bridge payload carried only its normal
POIs/reference data and did not transport the accepted observation snapshot.

The narrow implementation therefore:

- gives each observation an explicit `snapshotId` while retaining `observedAt`;
- retains acquisition bounds, cell/tile geometry diagnostics and explicit
  geometry/transport/source/completeness state;
- when a current accepted Wayfarer observation exists, the initial PC Bridge
  handoff reuses that exact polygon+200m zone snapshot instead of re-fetching the
  current viewport;
- carries the same optional `wayfarerObservation` through exporter -> Receiver
  Adapter -> `campsiteProject.v1`;
- initializes the Gateway polygon from that observation;
- attaches the observation to the Project only while Project polygon and
  acquisition polygon still match;
- never promotes `coverageComplete:false` because transport succeeded.

Gate before PASS:

1. WM-3 controller metadata regression passes.
2. Bridge exporter retains one observation snapshot without exposing diagnostics.
3. Receiver -> Adapter -> Project E2E retains snapshot identity/time, reserve
   zone, stable POI state and incomplete completeness.
4. A changed polygon rejects the stale observation.
5. Existing Bridge architecture/Next regressions pass.
6. Diff review confirms no WM-5/6/7 behavior, schemaVersion change, main merge or
   public release.

WM-4B PASS was fixed on 2026-10-02 after implementation, regression and diff review.

Evidence:

- production/test head: `71b6765f772d32d95cbd2cc3cc7f30cbfecd4a13`;
- Campsite Bridge PC Check #282: PASS, including WM-3 metadata, Bridge V1 export,
  PC route, existing architecture and syntax gates;
- Bridge Next Flow Check #217: PASS, including the strengthened three-device
  Receiver -> Adapter -> Project handoff assertions;
- Campsite Bridge Setup Check #195 and Distance Advice QA #151: PASS;
- the strengthened E2E explicitly verifies acquisition polygon, snapshot ID/time,
  GUID, POWERSPOT type, Active/Inactive state, REFERENCE_100/RESERVE_200,
  100m/200m distances, acquisition bounds and explicit completeness;
- `coverageComplete:false` remains false while transport can be true;
- stale observations are rejected when the current Project polygon differs;
- RESERVE_200 is carried only inside `wayfarerObservation`; it is excluded from
  normal Bridge POI channels so the Gateway cannot render the hidden reserve band;
- observation references/reserve remain outside `currentPois`;
- `campsiteProject.v1` / schemaVersion `1.0` remain unchanged.

During final review, the first strengthened E2E run (#215) failed only because
Node's strict deep comparison crossed a VM realm while values were identical.
That assertion was corrected. The same review then found and fixed a real
RESERVE_200 visibility leak in the initial handoff normal POI channel before PASS.

No WM-5/6/7 behavior was implemented. No merge to `main` and no production
publication was performed. PR #275 remains Draft.
