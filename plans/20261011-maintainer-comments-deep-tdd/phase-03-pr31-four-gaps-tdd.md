# Phase 03 — PR #31: investigate the four residual replay gaps

**Status:** current-beta reproduction required; old PR will not merge as-is.
For D, a source-only audit on `fdf655f200185b7516b60b0fc84fb151ccbd9236`
confirms absent canonical ID enforcement; a real TDD RED is still required.

## Authority

[Maintainer comment 6104803365](https://github.com/jeikl/JeikCode/pull/31#issuecomment-6104803365)
explicitly declines merging PR31 as-is. Current beta already covers
unanswered approval after reconnect, WebUI id-driven message/part ordering,
session cleanup and session switch generation guards. The older branch was
built around a different index/view-generation replay architecture.

Treat the listed four items as **hypotheses**, not automatically missing
features. Use the latest upstream beta SHA for every reproduction. Old
`202e975...` CI passing coding/daemon/kernel tests and the real native
HTTP smoke prove that branch, **not** necessity of moving its design to beta.

## Four isolated TDD investigations

### Executed verification of existing PR #31-D WIP — 2026-10-12

This is **LOCAL WIP TESTED**, not `FORK_VERIFIED`, integration or public
contract approval. It supplements the earlier source-only discovery. The
worktree `C:/Work/JeikCode/.worktrees/m05-canonical-history-id-20261012`
remains on immutable HEAD
`e53c0d28bc9e5710b23cbe35cbccbde1e81a984a`, with **staged plus
unstaged changes** in daemon, WebUI, workflow and test files. The unrelated
`extensions/jetbrains/gradlew.bat` line-ending difference remains
untouched. Current upstream `beta` is still
`acf6c35ad2ed156ce1638e77b39729c23bb3eb82`, two commits ahead;
the WIP has **not** been integrated or pushed at a new SHA.

Targeted native and lightweight test evidence on Windows / Rust 1.93.0 /
Node 22.22.0, with an isolated temporary `JEIKCODE_HOME` and locked Cargo
dependencies:

| Command | Observed result | What it actually proves |
| --- | --- | --- |
| `python scripts/test_history_message_identity.py` | **6/6 PASS**, exit 0 | Hermetic Rustc harness compiles and exercises the production daemon resolver function with test-only type stubs |
| `cd webui; node --test src/api.test.ts src/lib/historyMessages.test.ts src/lib/sessionCache.test.ts` | **40/40 PASS**, exit 0, 0 skipped | API receipt/ID forwarding, history target-selection and L1/L2 cache invalidation assertions |
| `cargo test -p jeikcode-daemon --lib resolve_target_message_index --locked -- --nocapture` | **2/2 PASS**, exit 0, 398 filtered | Real native kernel message types: reasoning/text compatibility and unique canonical ID targeting |
| `cargo test -p jeikcode-daemon --lib canonical_history_mutation_handlers --locked -- --nocapture` | **1/1 PASS**, exit 0, 399 filtered, native test body 0.13 seconds | Actual in-process daemon PATCH/DELETE/TRUNCATE handlers over a persisted native snapshot; confirms stable ID matching, wrong-ID reject and mutation event targeting |

The daemon command rebuilt the unpushed test candidate locally because
hosted CI could not yet exercise an uncommitted branch. The first local
compilation ended in 2m50s with nonfatal existing warnings. These are
**Windows-local**, not Linux/macOS or exact-head hosted CI results. The
native test is an in-process handler/persistence test, not an independent
running-daemon HTTP/browser acceptance test.

This dirty working-tree source snapshot has these SHA-256 anchors,
independently useful until WIP changes:

```text
crates/jeikcode-daemon/src/lib.rs    f3afd86b82c3de2bbd3b2fa689227c86dafa6248829d69e2585b9ab6eb1d7aea
scripts/test_history_message_identity.py    a779566183a8e55d6e972125801d9a590d70816ab0fb39825b18a29004ab54da
webui/src/api.ts    75291819d3f773923b38aa597417e8ea9d997444a3061173e747fdf1e638ac06
webui/src/components/Chat.tsx    9f347f1db7313d0e13e26aa9b8f3d1477940e51ef7fef022f656163b87c113d1
webui/src/lib/historyMessages.ts    ce72b595dfbca9f03861d973643c8d80a0a1f27a6e89f610cb70f2e6209474a3
webui/src/lib/sessionCache.ts    ab4bf5d26556aec8eeeb245e761bbd61898360b6c2db3019142afed3bf1d9aeb
```

**Independent strict read-only review — NO GO for beta.4 integration**
(no Critical; two Important items):

1. **Beta cursor preservation is a blocking integration gap.** Upstream
   commit `5493cfa30` introduces per-session `after_seq` resume cursors
   and part-identity/idempotent canvas reconciliation. The e53c-based
   WIP `webui/src/api.ts` and `Chat.tsx` do not contain those semantics.
   A future integration must start from `acf6c35`'s Chat/API/session
   projection and layer the WIP ID/tombstone logic **without reverting** the
   new stream cursor, and clear the relevant normal/sync cursors on
   patch/delete/truncate in both active and background sessions. Do not
   resolve by blindly overwriting the upstream Chat file.
2. **Atomic history mutation is an acknowledged data-loss boundary.**
   PATCH/DELETE/TRUNCATE still load snapshots outside a session-wide
   read-modify-write lock and only serialize final `save_snapshot`.
   Concurrent handlers can overwrite or resurrect each other's changes.
   The handlers also currently ignore a `false` return from bounded
   `stop_and_wait`, which means a prior active turn may still be
   persisting. This is a **pre-existing**, explicitly excluded contract,
   not repaired by ID-based targeting. Before claiming full data integrity,
   obtain the maintainer's atomicity decision and a deterministic RED test.

The same review found the current strong-ID resolver and native handler
targeting internally sound and no new Important issue in the
IndexedDB/tombstone fences. First-party WebUI now rejects 200
`{success:true,notFound:true}` no-op receipts; daemon delete/truncate still
emit that old ambiguous shape, which remains public-HTTP debt rather than
evidence of successful mutation.

**Remaining gates:** beta.4 cursor-preserving integration and re-review;
targeted TypeScript and package-lock-aligned WebUI verification; a
coordinated decision on atomic mutation and active-turn persistence; then
fork commit/push and exact-SHA CI/portability only when the candidate is
coherent. No full workflow/matrix/native-installed proof exists for this WIP.

### A — Atomic `/live` join / `through_sequence` / `replay_gap`

First reproduce a **consumer-observable** loss, duplication or identity
corruption with a real HTTP/SSE race: multiple clients join while 2,048+
events force journal eviction, and frames fragment across reads. Verify
whether beta's id-driven reconciliation already ensures complete and
ordered output. Only if this RED survives should an atomic snapshot
watermark, `through_sequence` or explicit `replay_gap` become candidate
solutions. Genuine repeated reasoning and stable part identity must not
be sacrificed; new wire fields require maintainer schema coordination.

### B — Kernel/TUI `client_input_id` provenance

RED must first show the **wrong identical steer** being acknowledged or
cancelled after two same-text turns, a queued/rejected steer, native cancel
or a session switch. Test live and persisted source separately. If current
beta cannot distinguish the originating operation, propagate immutable
`client_input_id` through kernel and TUI; IDs must not be reconstructed
by text matching. Check whether upstream already carries IDs to the
boundary. No new durable orchestrator or second identity FIFO.

### C — Exact active approval disk-fallback guard

Reused `call_id`, stale `approval_id`, previous completed permission,
partially restored GET and session switch: disk fallback must not resurface an
already resolved approval or send a response to another session. RED test must
use exact `permission_bridge` state/active responder route and pin **both
Expired and Absent** responder routes returning null despite persisted
sidecar/replay. A stale card sharing `call_id` with a newer
`approval_id` must never consume or clear that newer responder. Preserve
source authority and no cross-session approval; do not widen acceptance to
make stale cards actionable.

### D — Canonical history mutation reconciliation barrier

**SOURCE-PROVEN / RED NOT YET VERIFIED**, not a completed fix.
On upstream beta `fdf655f20`, `crates/jeikcode-daemon/src/lib.rs`
`resolve_target_message_index` (around 5221–5365) still ignores the
existing request-side `expected_message_id`/`target_message_id` fields.
Patch/delete/truncate call sites around 5416/5530/5677 resolve by index,
role and fuzzy text, then only echo supplied IDs into events.
`webui/src/components/Chat.tsx` already hydrates `Message.id`, while
outbound mutation call sites around 6980–7225 still omit it. These paths
were independently inspected on immutable `fdf655f20`; do not interpret
the source finding as an executed RED test.

Interleave two sessions, delayed GET and SSE with raw/filtered history
indices, same-text duplicate messages and hidden system/tool payloads.
Mutation route must target a stable canonical identity: mismatched
`expected_message_id`/role/text and foreign lease or stale runtime-generation
ownership must reject safely, not delete another row. Reproduce on beta
with existing `expected_message_id` and `resolve_target_message_index`
before introducing a new view-generation or index-mapping protocol.
**No expected-revision request field exists today**; adding one is a separate
public-contract architecture decision only if the existing identity and lease
contracts cannot close a proven race. Preserve all
patch/delete-agent/delete-turn/truncate and subsequent submit tests.
Companion WebUI tests must also ensure identity mismatch or
`notFound:true` responses do not perform optimistic local deletion or
truncation. Prefer authoritative ID resolution using existing request
fields, preserving legacy index/text fallback **only when no stable ID was
provided**. Do not introduce a new revision/schema field merely to fix
this source-proven identity hole.

## Execution / go-no-go per item

1. Independent reader scouts exact beta implementation and test coverage.
2. Minimal RED reproducible fixture on beta; no RED means **no source fix**,
   only record equivalence evidence.
3. Discuss public contract or architecture changes before source mutation.
4. Implement one minimal correction per independently needed gap in its own
   fork branch. Preserve worker compatibility and CodingRuntime.
5. Independent review, exact-SHA CI/portability, native HTTP+Bash smoke when
   changed, final integration delta review; seek explicit upstream PR
   authorization for each separate submission.

Avoid rebase/force-push/recycling old PR31, hidden test skips, and changing the
existing positive approval or idempotent replay tests to fit a new design.
