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
