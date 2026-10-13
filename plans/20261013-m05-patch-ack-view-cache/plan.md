# M05 / JC-14 — PATCH ACK view isolation and cache snapshot safety

Date: 2026-10-13

## Outcome, authority and baseline

One bounded WebUI history-PATCH reliability outcome: a late persisted ACK must
never project session A's rewrite onto a newly viewed B; the ACK must check the
daemon's actual persisted `source_index` and **not** rewrite the requested row
when it differs; and the UI/cache write must use
one synchronously computed transcript instead of saving an uninitialized
`[]` while a framework state updater is pending.

- Upstream: `jeikl/JeikCode:beta` at `4e81f811e304819be30c30269c29604fc18a875b` (fresh-fetched on 2026-10-13). No changes since the previously audited release/version-gate delta.
- Fork branch/worktree: `fix/m05-patch-ack-view-cache-v724-20261013`,
  `.worktrees/m05-patch-ack-view-cache-v724-20261013`.
- Parent: fork-verified TRUNCATE no-op receipt `b25a40d661a6123b505433aa2e2f1f054a69bdc8`, exact-SHA CI `38335573863` 5/5 SUCCESS. Includes prior DELETE receipt milestone `980602bc`.
- New worktree has an unrelated checkout/CRLF dirty
  `extensions/jetbrains/gradlew.bat`. Preserve it, never stage/restore/format it.
- Target authorization `FORK_VERIFIED`; no upstream PR/comment, merge,
  tag, release, publish, install or activation.

## Reproduced contract, not assumptions

- PATCH not-found returns HTTP **404** `{success:false,error:'message not found'}`
  (`crates/jeikcode-daemon/src/lib.rs:5481-5493`), unlike DELETE/TRUNCATE
  HTTP 200 `notFound:true`. `readApiJson` already rejects PATCH 404. Do not
  present 200 PATCH notFound as a reproduced daemon bug.
- Valid PATCH modifies a resolved raw persisted row, increments cache epoch,
  persists the snapshot, emits `session_mutation` with `source_index:real_index`
  **before** returning HTTP 200 `success:true,revision,source_index`
  (`lib.rs:5495-5540`).
- Existing `Chat.tsx:6713-6756` ignored the response, wrote into whichever
  session canvas `setMessages(prev)` saw at ACK time, and persisted
  `nextMessages` initialized to `[]` before the queued state updater
  assigned it. A→B→A could also match session ID but not view generation.
- Daemon's native resolver can re-target using text/role heuristics; a successful
  shifted `source_index` is **already persisted**. Rejecting that response as
  retryable would be unsafe. This milestone skips its local projection if the
  applied source differs, rather than editing a second row.

## Scoped design

- `applyConfirmedHistoryPatch` fences current session ID and generation
  before the request and after ACK; 404/network/non-2xx/200 `success:false` or
  `notFound:true` cannot modify local state.
- `patchUserHistoryBySourceIndex` accepts one unique original user row by
  reference, even when an ID is present. A new object under the same ID/source
  can represent an SSE-first or newer peer update and must not be overwritten
  by the older ACK. Duplicate/raw-index reuse/role mismatch fail closed.
- On an ACK for the current generation, check the persisted
  `receipt.source_index` (fallback only if omitted for legacy). If it equals
  the requested row and that row is unchanged, derive the next
  canvas/ref/L1/L2 snapshot **synchronously**.
  If applied source shifted or cannot be projected, do not mispatch either
  row or report an already-persisted mutation as a retryable HTTP error.
- On an ACK for an offscreen generation, never modify current B canvas,
  editing state, tokens, metadata **or shared A cache**. In particular, an
  old g1 ACK cannot overwrite a newer g3 A cache after A→B→A. Authoritative
  refresh of A after a successful offscreen mutation remains a separate,
  coordination-required GET/cache revision contract and is not claimed fixed.
- Keep wire request/response, native daemon, global GET/SSE cursor,
  persistence ownership, cache schema, and session lifecycle unchanged.

## Targeted validation

- [x] Source root-cause audit plus separate independent read-only source
  analysis; workers identified cross-view rewrite and ignored shifted
  `source_index` as Important.
- [x] TDD RED: `node --test src/lib/historyMessages.test.ts` failed with
  missing `applyConfirmedHistoryPatch` export. Additional RED failed when
  `applyLocal` did not receive the actual PATCH receipt. A subsequently
  tested offscreen-cache projection design was **rejected after independent
  Important review** (A→B→A could overwrite newer A cache); that code and its
  tests were removed from this scoped candidate.
- [x] TDD GREEN: `node --test src/api.test.ts
  src/lib/historyMessages.test.ts src/lib/sessionDelete.test.ts`
  currently **53/53 PASS** on reduced candidate; `git diff --check` PASS.
- [x] Real mocked `patchSessionMessage` verifies 404, 200 false,
  successful/shifted raw source index, 503 and network failure, method and
  request body; helper tests exercise A→B→A strict fencing, duplicate/stale
  source reference (including stable-ID SSE-first replacement), applied
  shifted response without second local rewrite, synchronous cache snapshots.
- [x] Independent design reviewers confirmed the original cross-view,
  shifted-source and async-cache problems, then **NO GO** for unsafe offscreen
  ACK cache projection. Reduced candidate removes offscreen writes entirely;
  preliminary read-only review indicates SAFE PARTIAL GO, final exact-source
  re-review pending after updating tests/docs.
- [ ] Independent strict read-only review(s) of exact updated code. Fix
  Critical/Important and re-review.
- [ ] Targeted final test, staged diff-check, Conventional Commit with
  required `Co-Authored-By: JeikCode <code@jeikcode.top>`, non-force push to
  fork, remote HEAD exact SHA.
- [ ] Exact-SHA fork GitHub Actions applicable matrix.
- [x] Initial commit `f9218b69b35be5633fd9aee696aa755ab44d1bbe`
  was pushed non-force, fork HEAD matched, and CI
  [38338959862](https://github.com/xuan2261/JeikCode/actions/runs/38338959862)
  ran at that exact SHA. **RESULT: FAIL**, not PASS: 3 jobs SUCCESS
  (Version consistency and Windows/Ubuntu installer integrity);
  WebUI quality failed on `tsc` because the new `parts` array's
  `kind` inferred `string` rather than literal `'text'` at
  `Chat.tsx:6755`; Rust quality was **SKIPPED**. This failed SHA cannot
  certify WebUI correctness.
- [x] Focused candidate postcommit correction: keep `kind: 'text' as const`
  in the PATCH projection callback. No behavior/contract change.
- [ ] Review exact follow-up patch, run targeted test, commit new SHA,
  push non-force and dispatch/verify **new exact-SHA CI** before promotion
  to FORK_VERIFIED.
- [ ] Real browser (session switch, SSE ordering), multi-tab,
  installed Desktop/Mobile/native proof: **NOT YET VERIFIED**.

## Exclusions / risks

- Concurrent native PATCH/DELETE/TRUNCATE RMW ownership/atomicity,
  pre-validation stop/cancel side effects, canonical persisted-message-ID
  resolver enforcement and sender identity are separate milestones requiring
  maintainer coordination. Old native canonical-ID fork milestone
  `e10185424d659b767c79e058c0e543627d17513e` is not in upstream beta.
- Cold GET/prefetch epoch invalidation, asynchronous L2 write ordering, and
  `/chat/watch` replay cursor semantics remain inherited unresolved contracts.
  A successful offscreen PATCH can leave the original source session A's warm
  canvas/cache stale until an authoritative refresh. This is **NOT FIXED** here;
  the API helper deliberately never writes stale-generation A or newer-view B
  state, and cannot claim cross-client authoritative freshness.
- A server-applied shift may have patched an unintended persisted user row.
  This UI slice cannot undo that server mutation and must not call it a full
  fail-closed target precondition. It avoids falsely painting a second row.
- Advanced TRUNCATE/rollback/regenerate WIP stays BLOCKED; never combine its
  receipt-ledger design into this milestone.
