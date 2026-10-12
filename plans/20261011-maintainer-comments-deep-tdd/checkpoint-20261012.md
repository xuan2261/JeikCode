# Maintainer feedback follow-up — 2026-10-12

This is a revision-pinned evidence checkpoint for the existing multi-PR
investigation, not a new upstream submission or a claim that all comments are
resolved. Work was performed with the fork-first authorization boundary.

## Immutable source references

| Item | Observed SHA |
| --- | --- |
| Upstream `jeikl/JeikCode:beta` after fresh fetch | `acf6c35ad2ed156ce1638e77b39729c23bb3eb82` |
| Published fork source of PR #28, before formatting follow-up | `923507e77fbddb23213e126558fce7b626b4d1eb` |
| Published fork source of PR #28, after formatting follow-up | `d3d38de94dfb836f7b12235014b6daf7bbf7d090` |
| PR #30 unchanged head | `059d8bd7b48a0063fd008ce85d789d75376ec44c` |
| PR #31 unchanged head | `202e97538671e3b4f519c5f9862f9e9a116d06e2` |
| PR #44 unchanged head | `e38149d1587bb805fd26e20619af14fd3d2ccc82` |

## PR #28: maintainer's build-watch blocker and self-checks

- The default Git-metadata-only watcher and `JEIKCODE_BUILD_WATCH_ALL` opt-in
  are already present at `923507e77`. The published predecessor ran 6/6
  hermetic watcher regressions per OS in fork portability CI, with the Linux
  sandbox acceptance green at that predecessor SHA.
- On Windows, `cargo fmt -- --check` at `923507e77` found one remaining
  formatting hunk in `crates/jeikcode-daemon/src/lib.rs:10309`. The sole
  change preserves the same auth middleware, state, call arguments and
  registration order. Rechecking `cargo fmt -- --check` and
  `git diff --check` passed.
- `cargo clippy --workspace --all-targets --locked` finished with exit 0 on
  Rust 1.93.0/Windows after 5m35s, with nonfatal existing lint warnings.
  `JEIKCODE_HOME` was isolated under the system temporary directory and
  `CARGO_TARGET_DIR` selected an existing local validation cache.
- Independent strict read-only review of the exact unstaged one-file hunk
  returned GO, no Critical/Important; it did not execute tests or modify code.
- New commit `d3d38de94dfb836f7b12235014b6daf7bbf7d090`,
  `style(daemon): satisfy PR #28 rustfmt check`, has an English/Chinese body
  and required `Co-Authored-By` trailer. A non-force fork push advanced only
  `feat/community-self-repair-mvp` from `923507e77` to this SHA; live
  `git ls-remote` confirmed the exact published head. The unrelated local
  `edfbff1` worktree was preserved.
- **Hosted verification of the new SHA is NOT YET VERIFIED.** At inspection,
  GitHub reported one `linux-sandbox` job as **skipped**, not passed, in
  [run 38202085819](https://github.com/xuan2261/JeikCode/actions/runs/38202085819).
  [Upstream PR #28](https://github.com/jeikl/JeikCode/pull/28) had the new
  head but `mergeable_state: dirty` and no PR checks reported. The
  maintainer offered to handle upstream beta integration. Do not rebase or
  claim that predecessor CI verifies this commit.
- Optional workflow trigger remains intentionally fork-branch/dispatched;
  explain this when authorized to reply to the existing PR. Refresh outdated
  PR description SHA/verification entries only within the permitted upstream
  communication scope.

## PR #30: separate existing-beta safety hazards from the stale-branch leak

Independent read-only audit compared PR #30 with `acf6c35`. It found no
Critical and three Important source-level issues:

1. PR-only cross-run storage leak: its `tempdir().keep()` at
   `crates/jeikcode-capabilities/src/tools/bash_log.rs:99-109` retains an
   app-created directory across process exits, while process-local `LOGS`
   cannot reclaim orphaned predecessors. This accurately reproduces the
   maintainer's design concern in the PR source; current beta does **not**
   use that directory layout.
2. Current beta's `bash_log.rs:148-178` LRU scans a shared temp directory
   for filenames and may unlink an active/replaced or otherwise unowned log
   because it lacks a live-owner or object-identity check.
3. Current beta's session cleanup calls asynchronous task cancellation
   followed by immediate filename deletion in
   `bash_runtime.rs:157-175` and `daemon/lib.rs:5125-5136`; it does not
   await task/log closure before the deletion attempt.

Do not merge old #30 as-is and do not add a filename/PID-based sweeper.
The supported next slice is **design-only until maintainer coordination**:
private fixed parent; random process directory; held exclusive, nonblocking
owner lock; bounded one-time sweep; precise no-follow/identity-checked
deletion; safe session shutdown ordering. A missing/denied lock is unknown,
not proof of orphan status. A process UUID directory containing
replacement/foreign files must never be removed recursively merely because
its owner died. Distinguish a live-owner skip from a completed orphan
reclaim, and allow the global cap to remain temporarily over limit rather
than destroying live data.

Acceptance before source implementation: isolated two-process live-lock
preservation, crash/orphan reclamation, startup lock-publication race,
replaced directory/symlink safe skip, cap behavior with all owners alive,
session DELETE waits for completed writer, and Windows/POSIX proof. No
runtime RED/GREEN, CI or maintainer design agreement exists at this checkpoint.

## PR #31: latest-beta independent source disposition

Against `acf6c35`, a strict read-only reviewer found three Important
source-level gaps, **not yet runtime RED repros**:

- `/chat/watch`: `5493cfa30` introduced resumable per-session cursor
  semantics, but the snapshot/join race and swallowed `Lagged` gap can
  still silently omit content; investigate as a separate stream slice.
- Native `/live` and TUI input correlation: the kernel/coding path still
  loses `client_input_id` and may fall back to text/image matching;
  investigate independently of canonical history mutations.
- Canonical history patch/delete/truncate target resolution still ignores
  supplied stable message IDs and lacks one atomic mutation reconciliation
  barrier, so stale view indices/concurrent mutation may select the wrong
  canonical row or lose updates. Prioritize a narrowly scoped exact-ID
  mutation RED test on pristine `acf6c35`.

The fourth hypothesis (approval disk fallback must require an exact active
responder route) is already covered by current beta's fail-closed active
route checks and regression tests, so do not reimplement it without a new
reproduction.

Existing `.worktrees/m05-canonical-history-id-20261012` was observed as
dirty staged+unstaged WIP with HEAD `e53c0d28`. It was **not touched** and
its candidate diff was **not reviewed** by this audit. Preserve its ownership
and do not import the broad incompatible old PR #31 patch.

## PR #44 and delivery boundaries

- No maintainer comment or inline review thread needs a reply. Existing head
  `e38149d` CI/portability results (15/15) are historical exact-head proof.
- The branch does not merge cleanly into `acf6c35`. Read-only
  `git merge-tree` found TUI test conflicts in
  `event_loop/mod.rs` and `render/retained.rs`. Review updated beta
  behavior before resolving, without weakening assertions.
- No upstream comment/update, new PR, merge, auto-merge, release, publication,
  installation, or activation was performed by this follow-up. No upstream
  acceptance or installed-native behavior is claimed.

## Priority decision for the next authorized slice

1. PR #30: obtain agreement on orphan cleanup ownership/identity contract;
   add a discriminating current-beta RED fixture before any production
   lifecycle changes.
2. PR #31: continue *isolated* canonical mutation identity reproduction from
   `acf6c35`, without overwriting active WIP; preserve native `/live` and
   stream cursor investigations as separate slices.
3. PR #28: retain exact-head CI status as NOT YET VERIFIED until GitHub checks
   actually execute on `d3d38de`/the relevant merge ref and upstream
   maintainer resolves the declared integration responsibility.
4. PR #44: recheck beta delta and reconcile tests only when the branch is
   selected for its own focused fork milestone.
