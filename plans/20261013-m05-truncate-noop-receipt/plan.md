# M05 / JC-14 — reject unconfirmed history TRUNCATE receipts (bounded WebUI API fix)

Date: 2026-10-13

## Outcome

Prevent rollback/re-submit and regenerate from changing the viewed transcript, L1/L2 cache, or issuing a replacement prompt after a TRUNCATE HTTP receipt that explicitly reports **no applied mutation** (`notFound:true` or `success:false`).

**This is not the full TRUNCATE/SSE/GET reconciliation milestone.** Its purpose is to land a minimal independently testable data-integrity improvement while preserving the blocked advanced candidate.

## Baseline, authority and branch

- Upstream `jeikl/JeikCode:beta` was fetched and audited: initial `d1a6308e7a062be86a969647a5fdb44da9c0f744`; latest audited `4e81f811e304819be30c30269c29604fc18a875b` (v7.2.3 release/version and stable version-gate changes only; no M05 code overlap).
- Reused verified fork commit `980602bcf8a464c537b249490bdfa8c7d0ba03c6`, with exact-SHA CI `38323266122` 5/5 success, as the branch parent. No rebase of a dirty worktree.
- Branch `fix/m05-truncate-noop-receipt-v724-20261013`, isolated worktree `.worktrees/m05-truncate-noop-receipt-v724-20261013`.
- Another WIP, `.worktrees/m05-history-truncate-receipt-v724-20261013`, is **BLOCKED** after multiple independent Important findings. Its changes and RED architecture fixture are intentionally preserved and **not** ported here.
- A checkout-generated unrelated working-tree CRLF delta exists at `extensions/jetbrains/gradlew.bat` (`core.autocrlf=true`). **Preserve it**; it is not staged, formatted, reverted or part of this milestone.
- Scope of authorization: fork-first implementation and validation. No upstream PR/comment, merge, release, tag, installation or publication.

## Root cause and implementation

- Both `handleRollbackSubmit` and `handleRegenerateAssistant` await `truncateSession` and then optimistically cut canvas/cache and schedule `deliver` without inspecting the response.
- Daemon `truncate_session` returns HTTP 200 `{success:true,notFound:true}` when the requested persisted target is not found; older index/text/role heuristics may also resolve a **different** raw row. For `inclusive:false`, the real keep-count is the target raw index; for `inclusive:true`, keep-count is index+1.
- The WebUI `truncateSession` API wrapper now resolves only when the returned JSON object has `success === true` and `notFound !== true`. It rejects definite no-op/failed/null receipts with `History truncation was not applied`; HTTP/network errors retain their prior rejection.
- **Deliberately do not reject an otherwise applied `success:true` solely because revision/target fields are missing or the server's persisted `target_index` differs from the original UI request.** The native resolver can re-target by exact/fuzzy text/role and commit before returning; reporting such a successful mutation as a retryable failure would leave the modal open for repeated destructive requests. Canonical target validation must instead happen at the native precondition/transaction boundary.
- There are no changes to the HTTP request, native daemon, SSE contract, cache schema, session lifecycle or `Chat.tsx` callback logic. The existing `ConfirmDialog` catches a rejected `onConfirm` Promise, displays an inline error, and does not close as a success. This aborts both callers before all their local actions.

## Acceptance and checks

- [x] Source/daemon contract investigation and scope separation from blocked ledger design.
- [x] TDD RED: `node --test src/api.test.ts` returned **27 pass / 1 fail**, showing the previous API wrongly resolved HTTP 200 `notFound`.
- [x] TDD GREEN: `node --test src/api.test.ts src/lib/historyMessages.test.ts src/lib/sessionDelete.test.ts` **46/46 PASS**.
- [x] Real mocked `fetch` verifies request URL/method/body and rejects HTTP 200 `notFound` (including a fully populated no-op receipt), `success:false` and null; preserves the prior success semantics for `inclusive:false`, `inclusive:true`, shifted target and older successful receipts; rejects HTTP 503/network error.
- [x] `git diff --check` PASS for scoped changes.
- [x] Initial independent reviews conflicted: worker-9 **GO** for receipt rejection, worker-8 **NO GO / 1 Important** because rejecting an already-applied shifted target created a retry hazard. Fixed by removing target/revision-based false-rejects; focused tests rerun **46/46 PASS**. Re-review of final candidate is required.
- [ ] Independent strict read-only code/contract review before commit.
- [ ] Targeted rechecks of reviewed final candidate; commit with Conventional Commit + required attribution; push non-force to fork, verify remote head exact SHA.
- [ ] Exact-SHA fork GitHub Actions applicable jobs and results; browser/native installed proof is **NOT YET VERIFIED**.

## Known exclusions / contract blockers

- **Not fixed:** ACK-before-SSE may erase a newly re-submitted optimistic user row; simultaneous real TRUNCATE operations may share the same `revision+target_index` because the native RMW is not transactionally serialized; stale active/offscreen GET/caches and the `/chat/watch` cursor contract remain unresolved.
- A successful but **wrong persisted target** may still be accepted by the legacy UI and leave transcript/cache inconsistent. This branch deliberately does not change that pre-existing behavior: native canonical-ID validation/atomicity must prevent the wrong mutation *before persistence*. Do not label this slice a full target-safety fix.
- **Not fixed:** successful TRUNCATE path still uses the old captured display index and stale historyTotal/turn-nav update. The separate advanced WIP requires backend contract decisions and browser-level verification before safe delivery.
- Fork native canonical-ID milestone `e10185424d659b767c79e058c0e543627d17513e`, PRs #28/#30/#31/#44, and the release/CI phase remain separate work.
