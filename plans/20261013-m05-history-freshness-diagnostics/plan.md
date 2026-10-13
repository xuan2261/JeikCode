# M05 / JC-14 — cross-client history freshness diagnostic milestone

Date: 2026-10-13 (UTC+7)
Deliverable: **one test/evidence and maintainer-decision packet**, not a
history protocol implementation.

## Baseline and authority

- Upstream `jeikl/JeikCode:beta`: `9aa46c5e1c01f8ba9a16fb642921045368df0626`
  (fresh-fetched on 2026-10-13; no relevant change superseding this slice).
- Verified fork parent: `b0aa8967edf3319e70028e509178dac9cc885bc3`,
  run [38360103717](https://github.com/xuan2261/JeikCode/actions/runs/38360103717)
  **completed/success 5/5**.
- New isolated branch: `test/m05-history-freshness-diagnostics-v724-20261013`
  at `.worktrees/m05-history-freshness-diagnostics-v724-20261013`.
- Scope: WebUI cache transaction ordering tests, two isolated negative
  diagnostics, and native/GET/SSE revision decision packet. No changes to
  native/runtime, public API, stream protocol, cache schema or lockfiles.
- Existing `extensions/jetbrains/gradlew.bat` CRLF checkout dirt predates
  our changes and must remain unstaged/untouched.
- Authorization: fork-first test/evidence work, independent read-only
  review, scoped Conventional Commit, non-force fork push and exact-SHA CI
  when GO; no upstream PR/comment/merge/auto-merge/release/install/activation.

## Problem and acceptance

Local L1/L2 callback fencing is fork-verified, but it cannot compare distinct
tabs' history revisions or reject a late same-generation GET after a newer SSE.
Do not represent `cache_epoch`, `mtime_ms`, `bytes`, or watch replay
`after_seq` as an already-proven unique authoritative transcript version.

1. Targeted positive tests confirm local winner semantics after LRU eviction,
   same session ID under different project hashes, and the ordering of
   already-enqueued IndexedDB transaction actions.
2. Intentionally RED isolated diagnostics demonstrate unmet cross-client and
   A→B→A same-generation GET/SSE contract without breaking default CI.
3. A decision packet precisely locates current source boundaries, compares
   alternatives, lists maintainer-owned decisions and an acceptance matrix.
4. No unsafe speculative native/GET/SSE changes, no unrelated filesystem
   operations and no claim of actual two-browser-tab proof.

## Evidence and verification

- [x] Fresh origin/beta, remotes, Git worktrees, fork parent and roadmap checked.
- [x] Native `get_session_detail`, `get_session_freshness`, mutation revision,
  `/chat/watch` cursor, WebUI cold GET, prefetch, SSE and sessionCache
  source paths inspected.
- [x] Existing deterministic cache suite extended with two regressions:
  stale LRU winner eviction and same session ID across project hashes.
- [x] Added a transaction-commit simulator test file: four request-creation
  and deferred-commit-order cases; based on W3C's overlapping readwrite
  transaction ordering. It does not purport to execute browser IndexedDB.
- [x] Positive tests:
  `cd webui && node --test src/lib/sessionCache.test.ts
  src/lib/sessionCacheCommit.test.ts` — **21/21 PASS**,
  exit 0 on the new test-only candidate.
- [x] Affected regression bundle: `node --test` over the above two files
  plus `sessionDelete`, `sessionStore`, `sessionProjection`,
  `historyMessages` and `globalEvents`: **89/89 PASS**, exit 0,
  no skipped/cancelled/todo. `git diff --check` PASS.
- [x] Negative fixture 1, explicit manual command:
  `node --test plans/20261013-m05-history-freshness-diagnostics/red/cross-client-freshness.red.mts`
  — expected `NEW`, actual `OLD`, exit 1.
- [x] Negative fixture 2, explicit manual command:
  `node --test plans/20261013-m05-history-freshness-diagnostics/red/late-get-after-sse.red.mts`
  — expected `BBBB`, actual `AAAA`, exit 1.
- [x] `architecture-decision.md` describes evidence, three approaches,
  five maintainer decisions and eight independent acceptance cases.
- [ ] Hosted WebUI typecheck/build and applicable exact-SHA CI jobs;
  staged diff check and independent strict read-only review.
- [ ] Scoped commit, non-force push to fork, verify remote HEAD and exact-SHA
  CI result. Do not label this diagnostic slice fork-verified before that.
- [ ] Real IndexedDB/browser multi-tab, installed Desktop/Mobile and actual
  native cross-process transaction proof: **NOT YET VERIFIED**.

## Exclusions and next handoff

The two RED fixtures are explicitly outside `webui` and deliberately avoid
a `*.test.*` suffix so default test discovery will not execute them; they
are **not regressions to make GREEN**
under this design-only milestone. True authoritative version, cross-process
serialization/CAS, matching HTTP ACK/SSE identity, canonical IDs, cold-GET
precondition, and replay cursor semantics require separate maintainer
coordination. The next implementation milestone may instead be a bounded
contract-preserving WebUI post-GET prefetch admission guard with its own TDD.
