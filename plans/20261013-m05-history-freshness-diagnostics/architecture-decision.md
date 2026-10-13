# JC-14 / M05 — authoritative history freshness and ordering decision

Date: 2026-10-13 (UTC+7)
Status: **DESIGN-ONLY / MAINTAINER DECISION REQUIRED** for native/public contracts.
No change to daemon, public API, SSE schema, session persistence or scheduling
is authorized by this packet. Nothing here has been posted upstream.

## 1. Scope and observed baseline

- Upstream: `jeikl/JeikCode:beta` at
  `9aa46c5e1c01f8ba9a16fb642921045368df0626` (fresh-fetch 2026-10-13).
- Source parent: fork-verified local L1/L2 cache ordering
  `b0aa8967edf3319e70028e509178dac9cc885bc3`, exact-SHA fork CI
  [38360103717](https://github.com/xuan2261/JeikCode/actions/runs/38360103717)
  **completed/success 5/5**.
- Diagnostic worktree/branch:
  `.worktrees/m05-history-freshness-diagnostics-v724-20261013`,
  `test/m05-history-freshness-diagnostics-v724-20261013`.
- The preceding local cache fix synchronizes operations **inside one module
  instance**; it neither provides an authoritative cross-client history
  revision nor serializes native writes.

## 2. Evidence inventory — current source

| Boundary | Verified source behavior | Consequence |
| --- | --- | --- |
| Native GET | `crates/jeikcode-daemon/src/lib.rs:4303-4337` constructs `SessionDetail`; `:842-875` and `webui/src/api.ts:806-827` have no transcript `revision` or mutation ID | A delayed GET cannot be compared against the latest SSE/ACK revision |
| Cheap freshness | `lib.rs:4231-4281` uses file sizes and last modified milliseconds plus `running` | Signature is a heuristic, not a serialized snapshot identity; equal-size rewrite/time collision is possible |
| Mutation transport | `lib.rs:5505-5539,5762-5804` increments `snapshot.cache_epoch`, emits `session_mutation.revision` before HTTP ACK | A `cache_epoch`-derived wire revision exists on one event path but is not a committed version of the GET body |
| GET admission | `Chat.tsx:2776-2782` checks only viewed ID/generation; `:2847-2851` saves completed-turn GET to local cache before comparing displayed content | Same-generation SSE can be followed by an older GET cache write |
| Warm comparison | `Chat.tsx:2864-2886` uses counts and text length; `:2879` inhibits shorter disk adoption | Same-length PATCH changes can look identical; shrink/compaction and actual delete have ambiguous precedence |
| Background prefetch | `Chat.tsx:3125-3144` checks cancellation before GET, but not after the awaited GET nor against a history revision | Old result may be cached after peer mutation, session switch or effect cleanup |
| SSE projection | `Chat.tsx:5836-5982` updates existing L1 canvas/cache by source index and can persist a projection; absent cached row produces no authoritative tombstone | Unobserved/offscreen revisions have no durable invalidate-on-entry marker |
| Local IDB | `webui/src/lib/sessionCache.ts` now fences pending operations in its own JS module; IndexedDB store remains a shared cache | One independently running tab can write an older snapshot after another tab's newer write |
| Watch cursor | `lib.rs:8670-8748` defines `after_seq` over replay frames; `>=` retains an inclusive replay boundary | SSE stream sequence is not a durable transcript revision or unique mutation ID |

The native history RMW does **not** hold a lock across the entire
load/validate/mutate/save transaction: `lib.rs:5457` loads outside the lock,
while `SessionManager::save_snapshot` holds a cross-process
`with_meta_lock` only around final replacement
(`crates/jeikcode-capabilities/src/session/manager.rs:1531-1537,1636-1648`).
There **is** already a reusable cross-process commit mechanism:
`SessionManager::commit_native_runtime_mutation` (`manager.rs:2666-2741`)
loads current snapshot/meta/presentation inside that lock and supports
validated multi-artifact commit. It accepts a snapshot prepared before
locking, so it is a **reuse candidate**, not a proven drop-in solution for
history RMW; mutation/precondition application still must operate on the
current snapshot under a serializable boundary. The existing TRUNCATE architecture
packet in the sibling worktree
`plans/20261013-m05-history-truncate-receipt/architecture-decision.md`
documents a collision scenario; this packet does **not** invent a working
CAS/transaction guarantee from `cache_epoch += 1`.

## 3. Deterministic results and evidence boundaries

**GREEN — application-owned local properties**

- `webui/src/lib/sessionCache.test.ts` includes the new LRU-eviction and
  same-session-ID/different-project regressions. A delayed read whose newer
  winner was evicted returns a cache miss; it does not reintroduce old bytes.
- `webui/src/lib/sessionCacheCommit.test.ts` uses a controlled FIFO
  **transaction-commit simulator**. It checks save→delete, delete→save,
  clear→save→clear and clear→clear→save while every transaction has already
  been enqueued. This tests our operation creation order, **not** a browser's
  transaction durability or multi-process atomicity.
- IndexedDB 3.0 specifies serial scheduling for overlapping readwrite scopes:
  https://w3c.github.io/IndexedDB/#transaction-scheduling
  A successful commit is signalled by the transaction `complete` event:
  https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event
  The current cache APIs return once work is enqueued; they do not wait for
  this event. That preserved contract must not be called durable completion.

**INTENTIONALLY RED — unmet cross-client/view contracts**

- `red/cross-client-freshness.red.mts`: two actual `sessionCache`
  module instances share one simulated IndexedDB store. After tab A commits
  `NEW`, stale tab B writes `OLD`. Expected `NEW`, actual `OLD`,
  exit 1. This is a cache-boundary simulation, not a real two-tab browser run.
- `red/late-get-after-sse.red.mts`: a causal *model* of
  `Chat.tsx:2776-2782,2847-2850` invokes the real cache module.
  A→B→A starts GET for generation 3, a newer peer SSE projects `BBBB`,
  then an earlier GET result `AAAA` arrives within **the same** generation.
  Expected cache `BBBB`, actual `AAAA`, exit 1. This does **not** mount
  `Chat.tsx`; full React/browser integration remains unverified.

Both RED tests are deliberately outside `webui/`, avoid a `*.test.*`
suffix, and are **not** part of `npm test`. They document acceptance gaps;
they must not be made GREEN with
fake assumptions or treated as evidence that daemon data is already lost.

## 4. Options and trade-offs

| Option | Benefit | Limitation / verdict |
| --- | --- | --- |
| **A. WebUI-local generations, tombstones and post-GET rechecks** | Low contract impact; can stop known local stale callbacks and accidental prefetch-to-active writes | Cannot prove an unobserved peer write is newer, cannot distinguish same-generation old GET without observed mutation; **safe partial slice only** |
| **B. Use current `bytes/mtime_ms` or text length as the version** | Minimal work and no protocol change | Equal-sized rewrites, mtime resolution, prefetch TOCTOU and concurrent writers make it non-authoritative; **NO GO as correctness guarantee** |
| **C. Serialized native transcript version used as mutation identity (or version + explicit operation ID)** | Allows GET, HTTP ACK, SSE, cache L1/L2, and peer tabs to establish a monotonic order; supports conflicting updates and idempotent projection | Requires native transaction/ownership coordination and public data contract changes; **recommended direction, BLOCKED pending maintainer decision** |

An implementation of **C** needs a serializable per-session load–precondition–
mutation–save–revision allocation boundary (or durable CAS with conflict
rejection). GET must return the revision for **the same snapshot as its
messages**. If every applied mutation obtains a unique durable revision, that
revision can itself correlate the matching HTTP receipt and SSE event; an
additional operation ID is only needed if the chosen retry/multi-event contract
cannot use revision as identity. Consumers must distinguish local optimistic
turns from committed history. IndexedDB cannot be guarded only with a
per-tab in-memory counter.

## 5. Exact decisions to coordinate with maintainer

1. **Native transaction owner:** reuse/extend the existing
   `with_meta_lock`/`commit_native_runtime_mutation` seam versus durable
   optimistic CAS, while validating/mutating the **current** snapshot under
   the chosen boundary. Who allocates persistent unique revision and,
   only if necessary, a separate operation ID? What are conflict semantics?
2. **GET/ACK/SSE contract:** expose snapshot revision in GET (including
   paginated/tail views), echo matching revision or committed operation ID
   in ACK and SSE, and define stale/conflicting client behavior. Is a
   compatibility/migration window needed for old clients?
3. **Cross-tab/cache owner:** define a versioned per-session cache record with
   atomic compare-before-write, or select a single cache writer; define
   invalidation for offscreen sessions, idle prefetch, IndexedDB eviction,
   refresh and background completions. Avoid regressing in-flight live turns.
4. **Stream sequencing:** confirm how the watch replay cursor and unique
   transcript/mutation revisions are *separate* namespaces, with dedup and
   resume tests. No silent `after_seq` semantics change in this milestone.
5. **Canonical mutation preconditions:** decide the authority of persisted
   message IDs and timing of `stop_and_wait` relative to target validation;
   avoid turning stale target errors into cancellation of a live turn.

## 6. Minimum acceptance matrix for implementation approval

1. Two concurrent writers (separate daemon processes/tabs) never accept
   conflicting history writes with the same authoritative revision/identity.
2. A GET returns a version bound to its exact messages. A GET captured before
   SSE version N and delivered afterward cannot roll L1/L2/canvas back.
3. A→B→A with a newer in-flight generation, late GET, and same-length PATCH
   cannot restore old bytes or overwrite active optimistic/streaming rows.
4. Prefetch GET finishing after session switch, mutation, or effect cleanup
   cannot write a stale active/offscreen cache, including empty/hidden rows.
5. HTTP ACK→late own SSE and SSE→ACK project once by operation identity, while
   a distinct peer mutation to the same index is not silently discarded.
6. Delayed L2 transaction/clear/eviction, two browser tabs and cold refresh
   never demote a newer authoritative cache revision.
7. Duplicate text, same-length rewrite, reused raw index, wrong message ID,
   and partial/tail history windows fail closed and preserve turn navigation.
8. Browser two-tab tests plus native integration on supported platforms must
   validate exact SHA, with live-turn safeguards and no weakened CI checks.

## 7. Next bounded slice without public-contract approval

Separately reproduce and, once accepted, repair the **WebUI-only prefetch
post-GET admission** (`Chat.tsx:3139-3144`) using cancellation/session
generation guards and a same-tab mutation epoch. It can prevent accidental
stale writes to the active view. It does **not** solve unobserved peer
mutations or establish cross-client authoritative freshness, so retain the
RED contract fixtures and **do not** mark full JC-14 history freshness fixed.

No upstream PR/comment, merge, release, publish, install, native protocol
implementation or changes to unrelated worktrees were made by this packet.
