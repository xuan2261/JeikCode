# M05b / JC-14 — Rejected retry admission receipt (WebUI-only)

Date: 2026-10-14

## Intended outcome and scope

When an earlier rejected `/chat` prompt is retained as a queue item, an ACK for
removing it from `/chat/queue` is **not** an ACK for the replacement `/chat`.
Do not consume the exact original retry before admission, or silently retry a
submission whose HTTP ACK might have been lost. Cover automatic queue drain
and **Send Now** with the same rule.

This is a bounded WebUI-only correction. Reuse the existing request identity
and server `client_input_id` in SSE/history; do not change the daemon, queue
wire schema, runtime ownership, history protocol or session lifecycle contracts.

- Upstream remote `origin` = `jeikl/JeikCode`, freshly fetched `beta` at
  `6593bc84472592e5283b5c03c8fb1268935f3e9b` (v7.2.4-beta.9).
- User fork remote `fork` = `xuan2261/JeikCode`; in-progress M05b parent HEAD
  `202e97538671e3b4f519c5f9862f9e9a116d06e2` on
  `fix/m05-approval-replay-20261010`. Existing upstream PR #31 remains open;
  its integration and earlier untracked handoffs were not touched.
- Isolated worktree: `.worktrees/m05b-retry-admission-receipt-20261014`,
  branch `fix/m05b-retry-admission-receipt-20261014`, based on that M05b parent
  without rebasing or altering published ancestry.
- Target: scoped fork verification **if** review and exact-SHA CI gates permit.
  No upstream PR/edit/comment, merge, release, publish, install or activation.

## Reproduction / contract

Original `dispatchRejectedChatRetryAfterQueueClear` awaited strict server queue
clear, called `deliver()` fire-and-forget, and returned success before `/chat`
accepted. If the next admission failed, the retry had been removed from memory,
localStorage and the daemon queue. **Send Now** repeated the ordering gap.

The daemon admits a `/chat` request before sending HTTP 202. A dropped 202
response is therefore **unknown**, not an authoritative rejection. Retrying
blindly under a fresh request ID may duplicate the turn. Explicit 409 is a
different outcome: keep the **original** retry ID rather than queueing a second
ID for the same text/images/mode.

## Bounded solution candidate

1. Await a typed `admitted` / `rejected` / `unknown` receipt after queue clear.
   Keep per-session dispatch reservations during that wait and restore the
   original retry after definite pre-admission rejection.
2. For unknown HTTP admission, keep the original retry with a reversible,
   namespaced marker `chat-unknown:<request_id>` in the existing queue
   `clientInputId` string (fail-closed sentinel only for an unexpected
   callback without an ID). Distinguish this marker from the ordinary Steer
   correlation ID, which can also survive the transition back to `kind=queue`.
   Preserve its images, mode, text and ID across
   local/server queue storage. Do not automatically drain, Send Now, or steer
   while any unknown attempt remains in that viewed session.
3. Consume an unknown retry only when an authentic SSE user event or canonical
   GET transcript contains the **same decoded** `client_input_id`. Reuse the
   existing idle watcher with replay and an immediate read-only GET to cover
   a completed-before-replay admission without fabricating runtime busy. The
   usual 48-row tail is attempted first; if it omits the exact ID, a single
   full GET covers long tool turns. After exact confirmation, only a fresh
   authoritative idle-state check can release `terminal_unknown` and enable
   later queued input. No new wire transport or native behavior.
4. Make the pending state explicit in localized queue UI (Chinese, English,
   Vietnamese). A manual recovery action remains distinct from automatic
   resubmission.
5. Retain the in-memory queue-clear tombstone after an acknowledged clear,
   even through UNKNOWN and subsequent exact confirmation. It rejects older
   same-tab `/chat/queue` GET snapshots that would otherwise resurrect R.
6. On session hydration, do not auto-drain **any queued input** or write a
   stale queued list until a strict `/chat/queue` GET has reconciled. The
   hydration admission barrier applies even when localStorage is empty or
   contains only ordinary Q; the server may still retain an UNKNOWN R. Prefer
   the server's
   stronger `chat-unknown:` hint when it shares an ID with stale localStorage.
   When a local R is **absent** from the authoritative server queue, preserve
   it with a fail-closed UNKNOWN marker rather than guessing it can be resent;
   this does not imply the server accepted or rejected it. A failed/malformed
   queue GET must not be silently treated as an empty response. The new
   `getChatQueueConfirmed` shares the existing endpoint and changes only the
   WebUI internal error-reporting semantics for this safety-critical caller.
   Hydrating a server snapshot does not POST the same snapshot back, avoiding
   an unnecessary whole-list write. A failed lookup retains a per-session
   safety gate until a later successful hydration.
   Key that admission gate by the view generation so an old A GET cannot
   release a new A→B→A hydration. Merge stronger server UNKNOWN hints before
   checking exact admitted-user history identity, otherwise a stale plain
   local R would become an unmatchable sentinel despite positive evidence.
   Centralize the server-write admission barrier in `persistSessionQueue`:
   direct Steer/Cancel/background writers must not bypass it. A deferred
   write must never resolve like a successful strict queue-clear receipt.
   Track dirty queues by session, preserve them across switches, and flush
   only after a current-generation successful queue GET.
   A successful HTTP GET for a now-offscreen A is **not** a successful
   hydration of that view; do not release its write barrier without merging.
7. The normal Cancel/Stop, incomplete-terminal and live-submit-failure paths
   must not turn UNKNOWN retries into an ordinary composer draft or discard
   them. Preserve those rows while recovering other safe queue items; block
   the UNKNOWN Cancel/Send Now/Steer controls with an explanatory label. If a
   strict queue GET is still pending, defer Stop/terminal restore-or-discard
   until its **owned** successful hydration; otherwise a plain stale local R
   could be POSTed over a stronger server UNKNOWN before GET completes.
8. A restored UNKNOWN after reload/switch also invokes the same positive-only
   canonical tail→full request-ID reconciliation as immediate ACK loss. A
   per-session/view/attempt in-flight key prevents duplicate GET work. The
   final positive confirmation fences older same-tab queue responses before
   consuming R; absence does not authorize a second submission. If server
   later supplies a real attempt ID for a local fail-closed sentinel, upgrade
   that marker rather than indefinitely suppressing available positive proof.
   If the session ID arrives before its project hash, re-arm the canonical
   lookup on project metadata resolution without creating another chat turn.

## Verification and evidence

- [x] Source-backed reproduction: original helper reported success on an
  unawaited admission; initial 12/14 test result (two intended behavioral RED).
- [x] Additional RED for typed unknown, duplicate retry IDs: 13/16 before
  implementation (three intended behavioral failures).
- [x] Focused `node --test src/lib/queuedDraft.test.ts src/api.test.ts`:
  **54/54 PASS**, including lost ACK, explicit 409, old queue GET, Steer
  correlation, full transcript tail fallback, same-ID server UNKNOWN upgrade,
  missing server R fail-closed and strict GET error semantics.
- [x] Related `node --test` of queuedDraft, chatTerminal, pendingPermission,
  sessionProjection, historyMessages and API: **174/174 PASS** on the latest
  uncommitted candidate including write-barrier and generation-fence tests.
- [x] `npm run typecheck` (`tsc --noEmit`): **PASS** on the latest uncommitted
  candidate (after strict hydration/API changes).
- [x] `npm run build` (`tsc --noEmit` plus Vite): **PASS** on the final
  uncommitted implementation. Vite reported its pre-existing size warning;
  no build failure.
- [x] `git diff --check`: **PASS** (Git emits nonfatal CRLF warnings).
- [ ] Independent strict read-only review of final scoped diff; fix and re-review
  any introduced Critical/Important finding.
- [ ] Commit/push non-force to fork and verify exact-SHA fork CI if GO.
- [ ] Browser two-tab, network-loss timing, Desktop/Mobile installed binary:
  **NOT YET VERIFIED**.

## Explicit inherited blockers and exclusions

- Server `/chat/queue` currently replaces a **whole queue vector**. A peer can
  add Q after this tab's last snapshot and lose Q when this tab writes a stale
  remaining list while clearing R. Same-tab serialization does not make this
  safe across tabs/devices. True atomic remove-by-ID or version/CAS requires
  native/public contract coordination with the maintainer. This WebUI-only
  receipt guard does **not** claim to resolve that existing multi-client risk.
- A missing/ambiguous admission receipt cannot be safely turned into a
  negative merely because history omits its request. Unknown
  may remain blocked and require operator reconciliation; automatic retry is
  deliberately disabled. A positive exact identity can retire the retry;
  **absence of an ID is never authoritative proof of rejection**. A local
  retry missing from a healthy server queue is therefore conservatively
  held UNKNOWN, which can reduce automatic progress if persistence failed.
- M05a persisted history revision/source identity and native history atomic
  RMW are design-only/blocked. Do not relabel RED multi-client history
  diagnostics as fixed by a local queue admission fence.
- The existing PR #31 Rust quality check has unrelated ten TUI test failures
  at its historical upstream merge check. No old-SHA CI result certifies this
  new candidate; investigate or coordinate separately, do not weaken tests.
