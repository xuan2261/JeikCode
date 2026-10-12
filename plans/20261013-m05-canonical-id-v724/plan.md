# M05 / JC-14 — canonical history message-ID routing on beta v7.2.4

**Milestone status:** fork-development; exact-head CI and final independent review pending until recorded.
**Base:** `jeikl/JeikCode:beta` at `a132ec9cd5499a1270bfbbe8c944b80c6459095a` (freshly fetched 2026-10-13).
**Source lineage:** selectively port the native ID resolver/tests from already fork-verified `05a81aaa5636907ea81d54bc93124367a593bfd6`, not its TUI/CI changes.
**Branch:** `fix/m05-canonical-id-v724-20261013` on `xuan2261/JeikCode` (fork only).

## Problem, outcome and reuse

The PATCH, DELETE and TRUNCATE native handlers already deserialize `expected_message_id` or `target_message_id`. The upstream `resolve_target_message_index` at this base ignores these fields and uses physical index plus full/partial text heuristics. After hidden presentation rows, repeated text or stale UI indices, this may select a *different persisted message*.

**Outcome:** when a canonical ID is supplied, it uniquely determines the physical persisted target or the handler makes no persisted history mutation. A foreign, empty, duplicated or role-incompatible ID never falls through to an index/text target. Legacy ID-less callers retain existing matching behavior. The **pre-existing** `stop_and_wait` and native cancel run *before* the resolver even for rejected requests; this milestone deliberately does not claim rejection before all side effects.

**Reuse:** existing `Message.id`, existing wire request fields, existing handlers, old native integration fixtures. One resolver parameter plus all three call sites and tests. No new schema, UI session cache, SSE cursor, lifecycle ownership or tool contract.

**Observed caller limitation:** current upstream WebUI still sends history mutation requests by index/text without the existing optional canonical ID fields. This server-only slice protects clients that supply a canonical ID; **it does not make current WebUI history controls ID-authoritative**. A separate, carefully reviewed WebUI wiring + stale-cache strategy is needed before claiming end-to-end UI correctness.

## Scope, tests and expected checks

- Production: `crates/jeikcode-daemon/src/lib.rs` native resolver and exactly PATCH/DELETE/TRUNCATE call sites.
- CI acceptance: extend the **existing** `.github/workflows/portability.yml` Linux/Windows/macOS matrix with only the tiny production-resolver Python contract; extend the existing `.github/workflows/ci.yml` Ubuntu Rust-quality job with the exact native `canonical_history` handler regression tests after its prebuilt embedded WebUI artifact is available. Retain all existing checks. Avoid building the entire daemon again on three OS runners just for the pure resolver, which adds unjustified cost.
- Regression: native daemon tests for unique/foreign/duplicated ID, role mismatch, ID-less caller and real persisted handler mutation; `scripts/test_history_message_identity.py` additionally covers empty/blank IDs, extracting/compiling the *production resolver* against a tiny type stub.
- Existing native test's persisted scenario includes repeated user/assistant text, hidden internal User messages, patch/delete/truncate and subsequent native submit. Do not replace with a pure mocked-handler test.
- RED (fresh upstream `a132ec9cd`, before production patch): original six-case `python scripts/test_history_message_identity.py` fails `rustc E0061` at 7 five-argument calls because the existing resolver accepts only four. Added an extra invalid/blank-ID fixture after this RED run.
- GREEN after selective port: same command first passed 6/6, then with extra invalid/blank-ID test passed **7/7** on Windows Python 3.11.5 / Rust 1.93.0, 0 failures; `cargo +1.93.0 fmt --manifest-path crates/jeikcode-daemon/Cargo.toml -- --check` and `git diff --check` passed.
- Pending: strict independent review of exact candidate against upstream drift; hosted fork CI and Portability at exact pushed SHA. Cross-platform pure resolver is checked by the stub; real native handler integration is run on hosted Ubuntu only, **not** proven across three OS or in a packaged application. No claim of real HTTP/backend success at this base before hosted proof.

## Exclusions and ownership

- Do **not** port obsolete `chat_watch` rustfmt hunks, unrelated TUI divider, CI workflow edits or release updates from `05a81...`.
- Separate Important unresolved risks: WebUI callers currently not sending IDs, handler pre-validation `stop_and_wait`/cancel side effect even for rejected IDs, concurrent native history load/validate/mutate/save atomicity, unwatched WebUI GET freshness, authoritative history revision, and replay cursor sequence namespace. Coordinate end-to-end semantics and architecture with maintainer; this slice does **not** resolve them.
- No changes to prompt/config/teaches requirements, dependencies, public message fields, frontend behavior or existing runtime lifecycle.
- Preserve the unrelated pre-existing worktree-only `extensions/jetbrains/gradlew.bat` CRLF delta and other branches.
- No upstream PR/comment/merge, tag, publication or install without explicit authorization.

## Evidence ledger and next actions

1. **Source check:** current beta still ignored IDs in 3 handler calls; parent `05a81...` fixes those without new serialized fields.
2. **RED→GREEN:** 7 Rust argument-count compiler diagnostics to initial 6/6, final **7/7** resolver smoke PASS. Stub smoke is not a substitute for real integration tests.
3. **Next gate:** independent reviewer GO, then Conventional Commit with `Co-Authored-By: JeikCode <code@jeikcode.top>`; non-force push only to fork branch, verify remote HEAD.
4. **Final gate:** exact-SHA fork GitHub Actions CI/Portability coverage review, classify missing/skipped or wrong-SHA results as NOT YET VERIFIED, not PASS.
