# Noah Mainline E2E Gate

Status: N1 test-only scaffold
Date: 2026-10-05

## Purpose

Verify the hidden Noah next-flow mainline without changing the current public user flow.

```
Wayfarer Map
  -> Bridge
  -> Campsite Design Tool
  -> Activity Range / project.polygon
  -> campsiteProject.v1
  -> completed CREATIVE MODE
```

## N1 hard boundaries

- No public route changes.
- No admin switch implementation in N1.
- No Creative Mode product-code changes unless a failing E2E proves a real integration defect.
- No Field Mode work.
- No MapTiler work.
- No Candidate Store mutation ownership changes.
- Existing public/default flow remains unchanged.
- Noah remains hidden until a later admin-switch phase is explicitly approved.

## Gate target

The eventual browser E2E must prove, on the hidden next-flow path:

1. A valid Bridge payload is received.
2. Receiver Adapter retains normalized POIs.
3. A confirmed selection polygon becomes `campsiteProject.v1.polygon`.
4. Selected POIs become `currentPois`.
5. Navigation enters `creative/index.html?campsiteProject=bridge`.
6. The completed Creative runtime opens the Bridge Project.
7. Existing POIs render.
8. `project.polygon` renders as the Creative Activity Range.
9. A candidate can be added and is followed by Candidate Adapter -> Geometry -> Unified Scene -> keyed Renderer.
10. Move -> Undo -> Redo remains functional.
11. Saving/syncing writes current POIs and the current Activity Range back to `campsiteProject.v1`.
12. No public/default entry route is changed by this gate.

## Existing evidence reused

N1 should reuse rather than duplicate:
- `check-bridge-three-device-e2e.mjs`
- `check-bridge-kwajalein-creative-e2e.mjs`
- `check-creative-runtime-build.mjs`
- the completed Creative WebKit gate
- C7 read-following Candidate/Unified integration tests

The missing assertion is the real browser seam from a Bridge Project into the completed Creative runtime.

## Release rule

Passing N1 does not publish Noah.
Public activation is a separate later phase through an administrator-controlled switch.

CI trigger note: the dedicated workflow is part of this branch and must execute before N1 can PASS.
