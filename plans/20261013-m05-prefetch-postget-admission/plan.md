# M05 / JC-14 — WebUI idle prefetch post-GET admission

Date: 2026-10-13

## Outcome, scope and authority

Prevent an obsolete idle-prefetch GET from writing its session transcript to
the viewed session, in-memory background cache or L1/L2 after local view
switches, cancellation, session activation, a newer local cached transcript
or an **observed** SSE history mutation. This is one bounded WebUI-only
reliability correction; no authoritative multi-client revision is asserted.

- Upstream: `jeikl/JeikCode:beta` at
  `9aa46c5e1c01f8ba9a16fb642921045368df0626`, freshly fetched
  2026-10-13. No equivalent prefetch post-GET fence in current upstream.
- Fork-verified parent: `35f45630377c502469aaf1356c5851b84c3592c6`;
  exact-SHA fork CI
  [38371625647](https://github.com/xuan2261/JeikCode/actions/runs/38371625647)
  **completed/success 5/5**. Includes prior session cache race fence.
- Isolated branch/worktree:
  `fix/m05-prefetch-postget-admission-v724-20261013`,
  `.worktrees/m05-prefetch-postget-admission-v724-20261013`.
- `extensions/jetbrains/gradlew.bat` was checkout-CRLF-dirty when the
  worktree was created. Preserve and do not stage or normalize it.
- Target `FORK_VERIFIED` only. No upstream PR/comment, merge, release,
  publication, install, activation or public protocol/persistence changes.

## Reproduction and root cause

- `webui/src/components/Chat.tsx:3115-3153` obtains candidate sessions,
  checks cache once, sleeps 5–10 seconds and awaits `getSession`. On success
  it unconditionally calls `messageCacheRef.current.set` then
  `saveSessionCache`, without validating candidate/view/cache freshness
  **after** HTTP completes.
- A session switch A→B→A, cleanup of the previous prefetch effect, activation
  of a candidate, or a newer observed mutation/cache update can occur during
  that wait. A late result must not populate either L1 or L2.
- The already-fork-verified `sessionCache.ts` fences local asynchronous IDB
  callbacks, but a stale `getSession` callback that deliberately starts a
  **new** local save is a later write and is not rejected by that module.
- `session_mutation` for an offscreen/unloaded target may be observed without
  an existing cached row. L1 presence alone cannot detect this event.

## Bounded implementation

- Add `applyGuardedSessionPrefetch` in `sessionPrefetch.ts`. It captures
  initiating view generation and local observed-mutation epoch, checks
  cancellation, active/busy candidate and newer L1 cache **before GET** and
  **after GET**. No await is allowed between the second guard and the
  initiating synchronous L1/cache update.
- In `Chat.tsx`, recheck the current `sessionGenerationRef`,
  `busyRef`, `activeIdRef`, background/local running state and both
  `messageCacheRef` and `hasMemorySession` prior to cache admission.
- The preliminary IndexedDB existence probe must not hydrate L1 before the
  guard: `getSessionCache(..., { hydrateMemory: false })` returns an existing
  row without inserting it in L1. Recheck cancellation and observed epoch
  immediately after this probe; otherwise an old L2 row can bypass the HTTP
  guard entirely. **Intentional safety/performance tradeoff:** an existing L2
  candidate is still skipped without a network GET, but no longer promoted to
  module-local L1 by idle prefetch; opening it may pay a normal ~1–3ms IDB
  read. Original prefetch did not populate `Chat.messageCacheRef` for this
  path, so this does not remove its full zero-latency canvas switch path.
- Track one component-local invalidation epoch, incremented when
  `session_mutation` is observed on either active `handleEvent` or
  background `applyEventToSessionCache` route—even if no cached row exists.
  Also invalidate on observed global `session_deleted`, `session_upsert`
  and `activity` events. `activity` updates only a separate, prefetch-only
  set of currently running session IDs; it does not claim runtime ownership.
  An unrelated event or metadata-only upsert may conservatively cancel
  **one in-flight candidate**. Capture the mutation epoch per candidate
  (not once for the whole effect), so the next candidate can run afterward;
  use the effect-wide generation solely to block obsolete A→B→A views.
  The epoch is a single scalar, not a per-session history-version map.
- Reconcile the prefetch-only running Set on **every** observed global `sync`,
  including initial subscription when the observer Set is empty but another
  client already owns an active session, using existing `getActiveChatSessions`.
  Buffer newer
  `activity(true/false)` and `session_deleted` observations while the GET
  is pending and apply them after the active-list snapshot, so a late response
  cannot erase a more recent active-state event. Ignore superseded responses.
  **Only successful active-list reconciliation releases the UNKNOWN admission
  barrier**; a failed GET keeps prefetch blocked (even if the observer Set was
  empty), until a later successful sync. This may suppress optional warming
  during a sustained network failure, but cannot mistake unknown activity for
  an idle session. This is **best-effort observer state**:
  silently lost `/events` frames without a later sync can retain an old
  running hint until reconnection. That only suppresses optional prefetch,
  never authorizes a stale write or changes runtime ownership.
- **No prefetch is admissible while the global-sync active-session GET is still
  pending.** An initial sync can precede the observed `activity(true)` for an
  offscreen active candidate. Bump the epoch on sync, reject candidates at
  L2-probe/delay boundaries when reconciliation is unresolved, and retain an
  in-flight-reconciliation guard inside the final post-GET admission fence.
  Otherwise a candidate started after the sync bump could still write its
  stale pre-turn disk snapshot before `/chat/active` resolves.
- Keep candidate selection, throttle, network URLs, response schema, LRU,
  timestamp and IndexedDB storage schema unchanged.

## Verification

- [x] Source-backed root cause, fresh beta/roadmap/PR/worktree preflight.
- [x] Behavior TDD RED with a deliberately unguarded helper: 2 pass, 7 fail
  (`node --test src/lib/sessionPrefetch.test.ts`), before implementation.
- [x] Independent reviewers found two Important integration gaps in the
  earlier candidate: (1) preliminary L2 read could rehydrate stale L1;
  (2) observed remote `activity` did not affect candidate admission. Another
  Important performance issue was effect-wide mutation-epoch poisoning.
  All three were addressed in this revised candidate.
- [x] TDD additional RED: one new `sessionCache` L2 no-hydration case failed
  on the old API (17 pass/1 fail); an observed-activity state test failed on a
  deliberately inert helper (11 pass/1 fail).
- [x] Reconnect reconciliation TDD RED: naive active-list replacement failed
  to preserve a newer activity transition (13 pass/1 fail in prefetch tests).
- [x] Final source review found a further Important empty-observer bootstrap
  condition: initial/reconnect `sync` must reconcile even when no running
  activity was previously observed. Removed the nonempty-Set gate and added
  a deterministic empty-Set + active-server-snapshot regression.
- [x] Final review found a pending-reconciliation Important race: a candidate
  could start after sync but finish before the active-list HTTP reply. Added
  a deterministic deferred-result test that rejects admission while refresh
  is in progress and wired the same fence into Chat's L2/delay/GET path.
- [x] Subsequent independent review found that clearing UNKNOWN on failed
  `/chat/active` allowed an initially empty observer Set to admit an already
  running offscreen session. Now only a successful reconciliation clears the
  pending/UNKNOWN barrier; a failed fetch remains fail-closed. Added a
  negative-path regression for this case.
- [x] Revised TDD GREEN: **17/17** prefetch tests PASS, plus protected L2
  nonhydrating probe. Tests cover cleanup, A→B→A, activity transition,
  observer snapshot reconciliation, busy/newer cache, observed mutation with
  no L1 row and real cache writes.
- [x] Related local regression bundle: **136/136 PASS** in sessionPrefetch,
  sessionCache, sessionCacheCommit, historyMessages, sessionProjection,
  sessionDelete, sessionStore, globalEvents and API tests;
  `git diff --check` PASS on revised source.
- [ ] Independent strict read-only review(s) of exact staged code, fix/review
  any Critical/Important findings.
- [ ] Scoped commit with English/Chinese body, required JeikCode coauthor,
  non-force fork push, remote HEAD exact, CI success 5/5 at same SHA.
- [ ] Browser/network interleaving, actual multi-tab, Desktop/Mobile installed
  proof: **NOT YET VERIFIED**.

## Explicit exclusions

- Unobserved external/tab/daemon mutations cannot increment the component's
  local epoch; a same-generation GET without an observed SSE remains
  unversioned. This slice does **not** implement authoritative transcript
  revision, native history RMW/CAS, canonical persisted message-ID validation,
  HTTP ACK↔SSE operation deduplication or watch replay cursor correction.
- Do not mark the separate two intentionally RED diagnostic fixtures from
  `plans/20261013-m05-history-freshness-diagnostics/red/` GREEN merely by
  adding local prefetch fences. True cross-client revision is the prior
  `architecture-decision.md` maintainer decision, still DESIGN-ONLY/BLOCKED.
