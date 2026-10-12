# M05 / PR #31 — native canonical history identity checkpoint

**State:** fork-development, pending exact-SHA hosted verification. This
checkpoint is a *narrow native-daemon slice*, not the entire original PR #31.
**Immutable base:** upstream `jeikl/JeikCode:beta`
`b05f91a369c833165d4fef529585b5683c94d6f8` (v7.2.2-beta.7).
**Fork branch:** `fix/m05-daemon-id-beta7-20261012`.

## Problem / acceptance

The existing session-history PATCH resolver could target a different saved
message when the WebUI-supplied index was stale and two user messages had
identical visible text. On pristine `7fe1dedc`, a persisted handler test
reproduced that behavior RED (exit 101, expected `patched first`, observed
`same text`).

The daemon resolver now makes `expected_message_id`/`target_message_id`
authoritative whenever supplied. Invalid, empty, foreign, duplicate, and
role-mismatched IDs fail closed and cannot silently fall back to an index or
matching text. Clients that supply no ID retain the previous legacy
position/text selection. PATCH, DELETE, and TRUNCATE use existing request
fields, with unchanged HTTP response and `SessionMutation` event shapes.

## Reuse, contract impact, and exclusions

- Reuse `NativeSessionManager`, persisted snapshot identities, the
  existing resolver, and existing handler/event plumbing.
- Keep all upstream beta.7 `/chat/watch`, `after_seq`, live-frame
  `seq`, admitted-user replay, and message/part stream code unchanged
  behaviorally. The only non-M05 hunk in `lib.rs` is a rustfmt-only change
  within the new upstream live replay path.
- Do not change native response status for a `notFound: true` mutation.
  First-party WebUI rejection is separately implemented in an uncommitted
  integration worktree, not included here.
- Do **not** claim atomic concurrent mutation safety. The current
  stop-and-wait timeout and load/mutate/save read-modify-write race are
  upstream/excluded and require a separate persistence design.
- Upstream beta.7's independent live-event sequence/replay-index
  alignment concern is **not** fixed, nor claimed fixed, in this slice.
- No WebUI, lifecycle, scheduler, Agent Hub, release, installer, or
  upstream PR/comment actions are included.

## Focused verification ledger

| Evidence | Observed result |
| --- | --- |
| Pristine-beta persisted wrong-target PATCH reproduction | RED (exit 101), before production fix |
| Windows beta.7 `cargo test --locked -p jeikcode-daemon --lib canonical_history -- --nocapture` | 2 passed, 0 failed, 402 filtered |
| Windows beta.7 `cargo test --locked -p jeikcode-daemon --lib resolve_target_message_index -- --nocapture` | 2 passed, 0 failed, 402 filtered |
| `python scripts/test_history_message_identity.py` | 6 passed, isolated ephemeral `rustc` harness |
| `rustfmt --edition 2021 --check crates/jeikcode-daemon/src/lib.rs` | Required before scoped checkpoint |
| Hosted fork CI and portability matrix on the **new commit SHA** | NOT YET VERIFIED until dispatched and inspected |

These checks do not prove native installed-app behavior, atomic multiwriter
history safety, WebUI adoption of canonical message IDs, or upstream
integration. The uncommitted WebUI integration and earlier beta.4/beta.6
worktrees remain untouched and preserved.

## Fork-only delivery gate

Strict independent source review -> explicit allowlist
(`lib.rs`, two existing CI workflows, resolver harness, this plan)
-> bilingual English/Chinese Conventional Commit with PR #31 traceability
and `Co-Authored-By: JeikCode <code@jeikcode.top>` -> non-force push
to `xuan2261/JeikCode` -> verify remote HEAD SHA -> dispatch existing
fork Actions on exact feature ref and inspect their head SHA, jobs/matrix,
and conclusions. Both workflows' automatic push filters exclude this
feature branch, so a mere push is **not** CI evidence.
