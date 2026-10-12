# TUI replay accounting-divider assertion — beta.7 regression gate

**State:** local fork development; independent review and hosted exact-SHA CI
**NOT YET VERIFIED**. **Base:** upstream beta
`b05f91a369c833165d4fef529585b5683c94d6f8`.
**Branch:** `test/tui-accounting-divider-beta7-20261012`.
**Scope:** one existing TUI unit test, independent of M05 native canonical IDs,
WebUI history mutation lifecycle, and unrelated PR #44 implementation.

## Observed failure and root cause

On fork M05 exact-SHA Actions
`63d548544ecaff5db4c97b806c3f7f2526633e80`, both CI run
`38231942418` (Ubuntu) and Portability run `38231946651`
(Windows) failed in `modals::session_picker::tests::replay_ignores_accounting_only_turn_positions`.
The summary divider read `✓ Done · 1 rounds · 0 tools · 1ms · 77 tokens`,
but another `TurnSeparator` label named the resumed session using a clock
timestamp that happened to contain `987`. The assertion at
`session_picker.rs:1850` checks `!label.contains("987")` for **every**
`TurnSeparator`, including non-accounting `resumed:` labels. This
misclassifies an unrelated session title as a leaked total-token counter.

The test sets an invalid-position `TurnStat` with `total_tokens=987_654`;
its intended contract is that this stat never appears in an **accounting**
divider and does not replace the valid context values (77 / 100). The
production TUI render behavior is not shown to be wrong.

## Bounded test-only repair

1. Add deterministic fixture: `session.name = "session-987-fixture"` to
   eliminate reliance on a randomly generated timestamp; run targeted
   baseline RED before changing the assertion.
2. Scope the check to actual accounting/Done dividers and require exactly
   one expected summary. Assert that the `resumed:` label legitimately
   contains `987` without failing the accounting assertion.
3. Preserve existing `last_context.sent_tokens == 77` and
   `ctx_window == 100` assertions and all renderer code.
4. Targeted GREEN, rustfmt and diff check, independent read-only review.
5. If approved for fork-only delivery, commit/push separately from M05
   and verify exact-SHA Windows/macOS/Linux native portability coverage.
   A prior SHA or skipped job is not evidence for a new candidate.

## Observed targeted TDD evidence

- **RED**, Windows pinned Rust beta.7: with the deterministic
  `session-987-fixture` title and original blanket assertion,
  `cargo test --locked -p jeikcode-tuix --lib replay_ignores_accounting_only_turn_positions -- --nocapture`
  exited **101**, 0 passed / 1 failed. The failure printed
  `resumed: session-987-fixture` beside a correct
  `✓ Done · 1 rounds · 0 tools · 1ms · 77 tokens` divider.
- **GREEN**, same selector after narrowing the sentinel check to the
  unique accounting divider and verifying fixture presence:
  **1 passed / 0 failed**, exit 0, 1754 filtered out.
- **Independent source review (attempt 1): NO GO** due to unguarded global
  locale. The test uses English localized replay labels and had no
  `i18n::test_lock()`, risking false failure when parallel tests select
  Vietnamese/Chinese. Added the existing RAII locale test lock and
  `Locale::En` in this test (no product locale change).
- The final locale-guarded source passed
  `rustfmt --edition 2021 --check crates/jeikcode-tuix/src/modals/session_picker.rs`
  and `git diff --check`.
- Full local Windows TUI library contract gate
  `cargo test --locked -p jeikcode-tuix --lib -- --test-threads=1`
  passed: **1755 passed, 0 failed, 0 ignored, 0 filtered**, exit 0;
  `JEIKCODE_HOME` was isolated in a temporary path.
- Final independent GO and hosted exact-SHA Windows/macOS/Linux fork
  portability CI are **NOT YET VERIFIED** for this candidate.

## Explicit exclusions

No production TUI renderer change, cross-platform installer change,
release, upstream PR/comment, M05 daemon modification or WebUI mutation
contract update. Do not weaken security or silence genuinely failing
tests. The independent upstream beta.7 replay/live cursor contract issue
remains outside this unit-test repair.
