---
title: Maintainer feedback across open PRs — deep TDD delivery
status: in_progress
mode: deep
verification: tdd
date: 2026-10-11
repository: jeikl/JeikCode
fork: xuan2261/JeikCode
upstream_beta_pin: c0e315473b34a45cb18831fda5be8169b085ca29
---

# Deep TDD plan: address all actionable feedback from maintainer `jeikl`

## Outcome

Resolve and substantiate **every actionable item** in maintainer `jeikl`'s
comments on the user's currently open PRs without replacing upstream fixes,
silently changing architecture, weakening test gates, or bypassing independent
maintainer review. Explicitly classify requests already satisfied, optional
questions, superseded designs, and externally blocked acceptance.

The source of truth is **live GitHub comments and immutable Git source**, not
historical PASS labels. A green fork check is not an upstream approval.

## Scope and inventory

At intake `gh search prs --author xuan2261 --state open` returned **10 open
PRs across repositories**. Four target `jeikl/JeikCode` and contain **five
issue comments** from `jeikl`: #28 (one), #30 (two), #31 (two), #44 (zero).
The other six open PRs have no issue/review/inline comments by `jeikl`.
The REST inventory also returned **zero submitted review or inline-review
comments** from `jeikl` across the four JeikCode PRs.

| PR | Exact maintainer source | Disposition at intake |
| --- | --- | --- |
| [#28](https://github.com/jeikl/JeikCode/pull/28) | [6104142709](https://github.com/jeikl/JeikCode/pull/28#issuecomment-6104142709) | **Blocking:** default 1,200-path `cargo:rerun-if-changed` watch in `crates/jeikcode-cli/build.rs`. **Non-blocking:** fmt/clippy evidence and feature-only acceptance workflow trigger. Maintainer offers to integrate baseline; do not rebase this PR. |
| [#30](https://github.com/jeikl/JeikCode/pull/30) | [6104416947](https://github.com/jeikl/JeikCode/pull/30#issuecomment-6104416947), [6106747396](https://github.com/jeikl/JeikCode/pull/30#issuecomment-6106747396) | Temporary process-log directories can survive exit without cross-run reclamation. Suggested scoped owner-lock + once-per-start orphan sweep; notify maintainer **only after** genuinely resolving requested issues. |
| [#31](https://github.com/jeikl/JeikCode/pull/31) | [6100887996](https://github.com/jeikl/JeikCode/pull/31#issuecomment-6100887996), [6104803365](https://github.com/jeikl/JeikCode/pull/31#issuecomment-6104803365) | Original PR **will not merge as-is**. Upstream already handles approval recovery, id-based replay, session switch and some cleanup; reproduce four remaining suspected gaps on latest beta before isolated minimal fixes. First comment was a scheduling update only. |
| [#44](https://github.com/jeikl/JeikCode/pull/44) | No `jeikl` comment submitted | No code feedback. Upstream PR-event CI [38142278504](https://github.com/jeikl/JeikCode/actions/runs/38142278504) 5/5 and Portability [38142278466](https://github.com/jeikl/JeikCode/actions/runs/38142278466) 10/10 PASSED at `e38149d1587bb805fd26e20619af14fd3d2ccc82`; protected approval still missing. |

## Authority and exclusions

- Default **FORK_VERIFIED**. User authorizes investigation, planning and scoped
  implementation; **no merge/auto-merge/tag/release/publish/install/activate**.
  A new upstream PR or material public-contract change requires its own
  coordination/authorization. Updating existing PRs is not an approval bypass.
- Preserve `C:/Work/JeikCode` root's unrelated untracked files and every
  worktree/branch/backup. Never reset, clean, force-push or rewrite shared
  history. Never fold #30/#31 old branches blindly into current beta.
- Keep source/core/tool schemas/prompts English and published docs in their
  current language. Preserve the English/Chinese released CHANGELOG.
- CI-first; use exact SHA/run matrix, `cargo --locked`, isolated
  `JEIKCODE_HOME`, pinned Rust/Node. Avoid heavy local Cargo target caches.
  Cross-platform tests and binaries belong on GitHub Actions where supported.
- Core maintainer owns lifecycle, persistence and public API architecture.
  New replay schema, durable orchestration or filesystem garbage collection
  contracts require an explicit interface decision before production rollout.
- A source review is not independent GitHub approval; a test that was skipped,
  cancelled or not selected is **NOT YET VERIFIED**.

## Phase index and owner boundaries

| Phase | Outcome | Ownership | Gate |
| --- | --- | --- | --- |
| [01 — PR #28](phase-01-pr28-build-watch-tdd.md) | Fix tracked-file rebuild regression; address verification and workflow-trigger note | Dedicated local worktree from **published PR #28 SHA** `5c9ff20ec6acd3196eae71d48d356c69bf51048e` only; never touch its locally ahead `edfbff1` checkout | RED hermetic watch test -> minimal GREEN fix -> review -> exact-head CI |
| [02 — PR #30](phase-02-pr30-log-lifecycle-tdd.md) | Bound orphan log storage without regressing exact session ownership | Fresh isolated branch from latest upstream `beta`; old #30 is read-only reference | Red process-restart/symlink/liveness fixtures; maintainer design coordination; Windows/POSIX proof |
| [03 — PR #31](phase-03-pr31-four-gaps-tdd.md) | Reproduce/repair only four gaps still real on current beta | One fresh beta branch **per independently accepted gap**, no PR31 branch recycling | RED native/HTTP/ID/revision contract on beta, then smallest compatible fix, source+CI review |
| [04 — PR #44](phase-04-pr44-review-gate.md) | Complete review loop without touching passing source | Existing fork branch `e38149d`, unchanged | Maintainer approval and upstream merge only when separately authorized |
| [05 — Integration](phase-05-integration-evidence.md) | Reconcile evidence, reviewer questions and closure | Prime/report owner; no cross-worktree writers | Exact SHA CI & status, regression review, explicit blockers and only then maintainer notification |

## TDD and review protocol (every implementation slice)

1. Pin upstream/fork head and worktree ownership; record a discriminating
   failing test on the **unmodified candidate source**. Record expected
   failure and why it proves the maintainer issue rather than incidental setup.
2. RED: run only the narrow reproduction or hermetic source harness; do not
   use an unfocused CI-red result as proof of a specific root cause.
3. GREEN: implement minimum contract-preserving change; keep all unrelated
   production behavior, positive/negative/security coverage, and test names.
4. REFACTOR: targeted formatting, `git diff --check`, source/teaches/docs
   parity, boundary/symlink/restart coverage as applicable.
5. Advice checkpoint **before writes and on every failed verification**:
   independent read-only advisor assesses the evidence, blast radius and
   whether the existing outcome remains safe. Workers have strictly separate
   file/worktree ownership; they cannot authorize upstream writes.
6. Independent review of exact staged commit candidate; correct findings,
   re-review, then Conventional Commit with
   `Co-Authored-By: JeikCode <code@jeikcode.top>`.
7. Non-force fork push only when coherent and authorized; validate exact
   published SHA in hosted CI and portability. Keep missing jobs as
   **NOT YET VERIFIED**. No local broad rebuild merely to repeat green CI.
8. Before a **new** upstream submission, fresh-fetch beta and compare
   equivalent fixes, contracts and merge diff. **Exception: PR28's maintainer
   explicitly assumes responsibility for retargeting/integration**; do not
   rebase/re-audit its old PR base as a precondition to the narrow watch fix.
   Request explicit upstream authorization when necessary.

## Acceptance matrix

| Contract | Minimum evidence |
| --- | --- |
| PR28 normal builds do not watch unrelated tracked files | Run actual build-script watcher in isolated temporary Git repo: default Git-metadata-only set, opt-in all tracked files, env toggle, normal vs linked worktrees; hermetic RED->GREEN log |
| PR28 build identity stays honest | Existing `build_info` tests and exact-head build/acceptance gates; report dirty-detection refresh tradeoff |
| PR28 workflow trigger is intentional/useful | Explicit decision: fork-only gated push + dispatch vs post-merge beta trigger, documented without enabling surprise expensive beta jobs |
| PR30 no across-run log accumulation | Two-process restart fixture, aged orphan reclaimed, live owner untouched, symlink/replaced paths relinquished, bounded scan and disk budget, Windows+Unix live-lock proof |
| PR31 each gap truly missing on beta | Specific RED test and current beta source/binary evidence for /live watermark, kernel/TUI input IDs, exact pending approval route, canonical mutation barrier |
| PR44 upstream ready | Already 15/15 PASS on exact head; reviewDecision must become APPROVED, source/base rechecked before any integration decision |
| Cross-PR quality | No tests disabled to achieve PASS, no replacement of upstream's id-driven model without maintainer agreement, no unrelated shared-worktree change |

## Decision log / known tradeoffs

- #28: metadata-only default is explicitly requested by maintainer and restores
  cheap rebuilds; unstaged tracked edits may not refresh the embedded dirty bit
  until Git metadata changes. Opt-in full watch retains that accuracy for
  developers who need it. Include `cargo:rerun-if-env-changed` for the switch.
- #30: the old beta prefix-scanning LRU bounds retained files but risks deleting
  active or replaced files; #30's precise ownership removes those hazards but
  its `tempdir().keep()` loses cross-run cleanup. Do **not** choose a PID-only
  or fail-open orphan deletion strategy. Even maintainer examples are design
  input, not permission to delete unknown/unowned files.
- #31: current beta's idempotent-identity approach differs from PR31's
  index/reconciliation barrier. Extend what is proven missing instead of
  transplanting an incompatible second replay pipeline.
- #44: green checks do not satisfy branch-protection approval.

## Evidence log and progress

| Date | Event | Status |
| --- | --- | --- |
| 2026-10-11 | Complete GitHub enumeration of 10 open authored PRs, 4 JeikCode and 6 elsewhere; 5 `jeikl` issue comments, no `jeikl` reviews/inline | **AUDITED**, not yet closed |
| 2026-10-11 | PR44 upstream PR-event CI 5/5 + Portability 10/10 at `e38149d` | **CI VERIFIED**, still REVIEW_REQUIRED |
| 2026-10-12 | PR28 actual-build-script strengthened RED 5 fail / 1 pass at published baseline; hermetic GREEN 6/6, Git-env isolation, 3-OS hosted regression step added after native checks | **LOCAL TDD VERIFIED**, independent review/hosted exact-SHA CI pending |
| 2026-10-11 | PR30 storage/liveness and PR31 four-gap migration require independent source/repro assessment | **DESIGN / REPRO**, not production implemented |
| 2026-10-12 | Live upstream `beta` was observed at `fdf655f200185b7516b60b0fc84fb151ccbd9236`, later than the immutable planning pin `c0e315...`. Recheck newest beta before opening **new** Phase02/03 worktrees; preserve PR28's maintainer-approved no-rebase exception | **BASELINE ADVANCED**, not an instruction to rewrite existing branches |

## Red-team questions to resolve before delivery

1. Can a Rust build script watch only its own metadata without accidentally
   missing detached HEAD/linked-worktree refs or rebuilding from outer repos?
2. Does the TDD test inspect actual watcher output rather than merely match
   text, and does the opt-in switch itself invalidate Cargo fingerprints?
3. Can an orphan sweep ever delete logs owned by live/unknown processes, or
   follow symlinks/reparse points outside its confined root? How does Windows
   distinguish a held lock from access denied? Does the claimed disk cap hold?
4. Can replay's fresh/live frames be deduplicated without losing genuinely
   identical reasoning deltas or canonical tool-part identities?
5. Are there old comments requiring a response but not a code change? Never
   make an empty/nonblocking suggestion into a release prerequisite.
6. Have all verification claims been connected to a matching head/base SHA
   and run/job, and are optional tests distinct from branch-protection rules?

## Next execution step

Continue **Phase 01** on the isolated published-#28-head worktree
`.worktrees/pr28-build-watch-tdd-20261011`, after its recorded hermetic
RED→GREEN proof. Finish independent exact-diff review, then publish only a
coherent candidate with exact-head hosted verification. Do not push the
locally ahead `edfbff1` commit from the old PR28 checkout. The remaining
phases follow independent TDD reproduction, not a blanket import of #30/#31.
