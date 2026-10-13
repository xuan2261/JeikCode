# M05 / JC-14 — local L1/L2 cache operation ordering

Date: 2026-10-13

## Outcome and authority

Fix one reproduced local WebUI history-cache integrity defect: an older
IndexedDB read may repopulate memory after a newer save, delete or clear.
Also fence writes and deletes still waiting for database initialization so
they cannot enqueue an obsolete operation after a newer local mutation.

- Base: fork-verified M05 PATCH `bf4e751e281fcf1b6e1974df204c39cedb8eb1cc`
  (exact-SHA fork CI `38339381145`, 5/5 success).
- Fresh upstream `jeikl/JeikCode:beta`: `9aa46c5e1c01f8ba9a16fb642921045368df0626`
  (`v7.2.4-beta.4`). Compared to previous `4e81f811e`, upstream did not
  change `webui/src/lib/sessionCache.ts` or its tests. The release/provider
  changes remain separate for later integration review.
- Isolated fork worktree/branch:
  `.worktrees/m05-session-cache-race-v724-20261013`,
  `fix/m05-session-cache-race-v724-20261013`.
- `extensions/jetbrains/gradlew.bat` is checkout-generated CRLF dirt present
  before our edits. Preserve it and exclude it from staging.
- Target: `FORK_VERIFIED` only. No upstream PR/comment, merge, release,
  publication, installation, activation or public protocol change.

## Reproduction and root cause

- An IndexedDB `get` callback in `sessionCache.ts` previously unconditionally
  called `setMemorySession` with the old persisted result. If a newer
  `saveSessionCache`, `deleteSessionCache`, or `clearAllSessionCache` happened
  while that read was pending, the callback could overwrite current L1 or
  restore a removed session. The return value could be stale too.
- Saves and deletes update L1 immediately, then await `getDB()` before
  enqueuing a transaction. A superseded operation could still enqueue an
  obsolete IDB write/delete once database initialization completed.
- These races were observed with manually ordered fake-IDB callbacks at the
  actual module boundary. This is **not** browser/multi-tab/native proof.

## Scoped design

- Track only pending per-key read/write/delete operations, and pending global
  clears; remove tokens when requests settle to avoid an unbounded key-version
  map. New local mutations invalidate earlier same-key requests; clear
  invalidates all earlier pending requests.
- Complete a disk read only after checking for a newer local mutation,
  an in-flight removal or a newer L1 entry. Return current memory/null instead
  of repopulating it with a stale disk row.
- Block cold L2 reads while the relevant delete/global clear waits for the
  database. Once a transaction is enqueued, retain IndexedDB's own ordering
  for overlapping store transactions; do not infer transaction durability from
  the scheduling of `store.put/delete/clear`.
- Preserve synchronous L1 semantics, thirty-entry LRU budget, message and
  metadata shape, IndexedDB database name/version/store, external calls and
  browser storage schema.

## Validation and release gates

- [x] Source root cause inspected; user-approved bounded implementation.
- [x] TDD RED on unmodified implementation: 3 pass, 7 failed; no cancelled
  tests after stabilizing the controlled-IDB harness.
- [x] TDD GREEN after implementation: 15/15 `node --test
  src/lib/sessionCache.test.ts` success; `git diff --check` success.
- [x] Related local regression suite: `node --test` over sessionCache,
  sessionDelete, sessionStore, sessionProjection, historyMessages and
  globalEvents tests: **83/83 PASS**. Staged `git diff --check` PASS.
- [x] Independent STRICT READ-ONLY source/test review of staged candidate:
  worker-10 **GO**, zero Critical/Important at staged patch identity
  `d7843dc0c92d215f106a1fe43daf2d0245d7b373` (before this
  documentation-only evidence update). Reviewer did not execute tests.
- [ ] Hosted WebUI TypeScript/typecheck/build and applicable CI jobs must
  pass at the eventual exact authored commit SHA before FORK_VERIFIED.
- [ ] Scoped Conventional Commit (English/Chinese body and required co-author
  trailer), non-force fork push, exact remote HEAD check, and applicable
  exact-SHA GitHub Actions all successful.
- [ ] Real browser/IndexedDB, multi-tab, Desktop/Mobile installed proof:
  NOT YET VERIFIED.

## Explicit exclusions

- No authoritative cross-tab/session-history revision, mutation-operation ID,
  prefetch/cold GET freshness, `/chat/watch` cursor, native RMW atomicity,
  canonical persisted target validation or active-turn ownership change.
- A fresh external writer can still invalidate a previously fetched GET.
  Fixing that requires the distinct maintainer-owned history revision contract
  documented in the TRUNCATE architecture decision packet.
- This milestone does not certify completed IndexedDB transactions: current
  cache APIs return after enqueuing IDB requests, as before. Tests prove
  request ordering and local cache guards; real browser proof remains open.
