# Creative Next / Campsite cross-origin portable return (LAB only)

**2026-10-15 JST. Status:** Development/test candidate. Phase 1 HOLD, PO X-04 format **NOT APPROVED**. Nothing here authorizes a production release or changes the legacy Bridge protocol.

## Problem solved by the experiment

The existing r31 isolated IndexedDB is scoped to one exact origin. A distinct Vercel preview revision URL or a future Campsite deployment on another origin cannot read those browser records, nor should any code attempt to bypass browser origin isolation.

The prior read-only `Campsite Return LAB` successfully verifies a **same-origin** row with the existing `campsite-project-kmz-linked-pair-LAB` manifest and its three SHA-256 hashes. The portable experiment adds a *manual* user-initiated download/file-select transfer for testing the **cross-origin boundary**, without adding a new production API.

## Explicit test-only format

A ZIP called `campsite-return-test-only.zip` contains precisely two entries:

- `linked-pair.json`: a versioned **LAB** envelope (`kind=campsite-creative-next-portable-return-LAB`, `version=0`, source `revision`) containing the already verified `campsite-project-kmz-linked-pair-LAB` manifest. That inner manifest carries the complete canonical Project JSON, independent Creative activity areas JSON, project/handoff/snapshot identities, and project/area/KMZ SHA-256 checksums.
- `creative-new-v1.kmz`: the complete NEW_V1 Creative edit artifact with its original in-band semantics intact.

No GeoJSON/KML geometry is inferred from "first polygon". The Project's current design polygon, historical observation polygon and Creative activity-area polygons remain distinct. The Wayfarer snapshot's interior/reference100/reserve200 zones and its completeness flag travel only in the canonical Project JSON, not as expanded editable POIs.

**This ZIP is not the NEW_V1 KMZ and not the production interchange contract.** No existing production file parser must be taught to treat a ZIP as a KMZ. The experimental format might be replaced by an approved signed manifest + files, a user-mediated share, or another explicitly reviewed transport.

## Security and failure gates

- User must explicitly click `検証済みセットをダウンロード` after same-origin readback and lineage verification. Receiver must explicitly choose a local ZIP and type the expected Project ID + Handoff ID.
- No network request carries Project bytes; no wildcard postMessage, automatic cross-origin data copying, upload endpoint, or shared cookie is added.
- Receiver is **read-only**; the file-import path must neither open an IndexedDB for writing nor write `campsiteProject.v1`, old Creative journals, or the original KMZ. Its UI reports `productionReady:false`, `writeAllowed:false`.
- Fail closed on missing/wrong IDs, missing ZIP entries, extra entries, unexpected directory paths, wrong envelope kind/version, size overflow, invalid ZIP CRC, canonical JSON hashes, KMZ SHA256, POI count/identity, hidden Reference leakage, incomplete observation, missing source lineage. Do not silently repair.
- Archive maximum 16 MiB compressed; inner JSON manifest maximum 9 MiB, KMZ maximum 8 MiB. These are provisional **LAB** limits, not device limits or an approved anti-bomb strategy for production. Treat all untrusted ZIPs cautiously and validate further before public upload support.
- **ZIP is not encrypted or authenticated**. SHA-256 protects accidental/undetected modification relative to its own manifest, but does not establish a trusted publisher. Never put real member data, private locations or authenticated Wayfarer responses into test ZIPs; use synthetic fixtures only.
- The full preflight is repeated after unpacking. Unsupported project fields/edits fail HOLD rather than undergoing a lossy conversion. No production origin may host the LAB receiver.

## Concrete code and test coverage

- `creative-next/contracts/portable-return-bundle-lab.mjs`: immutable bundle creation + two-file ZIP staging and verification.
- `creative-next/qa/campsite-return-lab/`: local saved-row verification followed by explicit manual download; separate file-select verification UI.
- `creative-next/qa/portable-return-bundle.test.mjs`: linked-pair preservation, wrong IDs, corrupt archive, extra ZIP entries, altered manifest/KMZ and incomplete Wayfarer coverage.
- `creative-next/qa/three-function-r31-browser-lab.cjs`: source-origin real r31 editing/save + download, then different browser origin input from file, verify **without** creating a receiver storage row or the production `campsiteProject.v1` key, wrong Handoff ID rejection.
- CI tests both direct repository resources and allowlisted static-preview bundle with Chromium viewports 390×844 and 393×852; WebKit simulator is a separate job, never counted as real iPhone Safari device evidence.

## Remaining before production

PO X-01 polygon ownership/UI, PO X-04 canonical transport and cross-origin identity authenticity, deletion tombstones, Base/Local/Remote diff/re-observation, multi-generation rollback, receiver's actual Campsite Project editing/Distance UI, Android real device, Safari native export/import, production auth/security review, and explicit release approval remain HOLD.

**Frozen:** `main`, approved r31 UI branch, legacy Bridge receiver and `campsiteProject.v1`. PR #368 stays Draft.
