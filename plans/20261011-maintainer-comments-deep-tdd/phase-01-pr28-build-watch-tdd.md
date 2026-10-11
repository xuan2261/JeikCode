# Phase 01 — PR #28: cheap build-script Git watches (RED/GREEN)

**Status:** FORK_VERIFIED at published PR head
`923507e77fbddb23213e126558fce7b626b4d1eb`; upstream integration blocked.

## Source and ownership

- Maintainer blocker: [comment 6104142709](https://github.com/jeikl/JeikCode/pull/28#issuecomment-6104142709).
- Published PR head: `5c9ff20ec6acd3196eae71d48d356c69bf51048e`; historical PR base: `8f7d49d9efdb596cd1c74b2acf546ed0386d8722`.
- Existing `.worktrees/community-self-repair-mvp` is at **local** `edfbff1c44ce2e40a8fff7e21b5787dac63ac358`, ahead of the published branch by one docs commit. **Do not commit/push from that checkout.**
- Create an isolated owned worktree from immutable `5c9ff20...`; fork head is the eventual publication target only after independent review and scope authorization.

## Contract and TDD acceptance

1. **RED, real output not source pattern:** run
   `python scripts/test_build_watch_contract.py` in the isolated PR28 repair
   worktree. It uses `rustc --edition=2021` to compile the **actual**
   `crates/jeikcode-cli/build.rs` with a temporary `winresource` stub and
   executes the binary with `CARGO_MANIFEST_DIR` pointing inside a temporary
   real Git fixture; it does not copy `watch_repository` into a parallel
   implementation or create a Cargo target cache. With
   `JEIKCODE_BUILD_WATCH_ALL` absent, output contains Git metadata file paths
   and build.rs but **not** tracked `docs/guide.md` or `webui/src/app.ts`.
   The published source currently fails because `watch_repository` always
   enumerates `git ls-files --cached -z`.
2. With `JEIKCODE_BUILD_WATCH_ALL=1`, watch output **does** contain both
   tracked files. The build script must output
   `cargo:rerun-if-env-changed=JEIKCODE_BUILD_WATCH_ALL`, so Cargo notices
   switching the option without a Git change.
3. Linked worktree case: watch resolved `HEAD`, `index`, symbolic ref,
   `packed-refs` where present, and the worktree `.git` pointer file;
   never watch the repository directory recursively.
4. Preserve actual `git status`/commit/tree/dirty identity calculation at
   **build execution time**; explicitly accept stale unstaged-dirty display
   after an unrelated edit until a watched Git metadata path changes.
5. A source archive outside its own git root remains `+unknown` rather than
   adopting the identity of a containing/unrelated checkout.

## Implementation

Minimum actual source:

- `crates/jeikcode-cli/build.rs:56-60`: add
  `cargo:rerun-if-env-changed=JEIKCODE_BUILD_WATCH_ALL`.
- `build.rs:159-194`: preserve existing metadata path resolution and `.git`
  file watch. Wrap only unconditional `git ls-files` enumeration with
  `std::env::var_os("JEIKCODE_BUILD_WATCH_ALL").is_some()`; opt-in preserves
  existing invalid-UTF8/newline filtering.
- Use focused hermetic regression coverage with a deterministic temporary
  Git fixture. Prefer a real build-script harness over a brittle regex source
  test. Do not introduce new persistent helper binaries/caches.
- `.github/workflows/self-repair-acceptance.yml`: maintainer question is
  explicitly **nonblocking**. Preserve fork-branch push plus dispatch for
  heavyweight guarded acceptance unless separately agreed; document why it
  remains dispatchable after merge. If changing trigger, prove event filters
  and avoid unexpectedly running a long privileged sandbox build on every beta
  push.

## RED / GREEN / REFACTOR

- RED: run hermetic watch test before touching `build.rs`; ensure its failure
  directly names the unintended default watched tracked file.
- **Observed RED at published `5c9ff20...` (Git blob `2bd0f6a19d5cb98c5bc6b1ccdec736a6b68cfa29`):** strengthened hermetic
  harness ran 6 tests with **5 failed / 1 passed** (default/opt-in/detached/
  linked/host-overrides watcher directives; build-time dirty identity passed).
  The original 5-test version had 4 failed / 1 passed.
  (build-time dirty identity). Actual default directives watched tracked
  `docs/guide.md` and `webui/app.ts` and omitted the opt-in env watcher.
- GREEN: minimally gate tracked watches and env directive; rerun the exact test.
- **Observed GREEN in the isolated PR28 candidate:** all six
  tests **6/6 PASS after strengthening assertions to compare the entire
  `git ls-files -z` tracked set** in default and opt-in modes;
  `isolated_git_env` strips inherited Git overrides, disables host
  Git system/global configuration and Git signing/hooks via command flags;
  an adversarial host-override fixture is covered.
  `cargo fmt --package jeikcode -- --check` and `git diff --check`
  passed. This is local TDD proof only, **not** exact-head hosted CI.
- **Durable hosted test gate added:** `.github/workflows/portability.yml`
  runs the hermetic watcher harness in the Ubuntu/Windows/macOS native
  matrix **after existing native regression and check** and uploads
  `build-watch-test.log` even on failure.
- **Observed repo-wide `cargo fmt -- --check` nonzero:** it reports an
  existing formatting difference in `crates/jeikcode-daemon/src/lib.rs`
  around line 10309. That file is byte-identical to the immutable PR28
  published source (Git blob `b45830501a619647f70a940fe281c6093b595fc0`)
  and is outside this fix. Do not silently reformat it. Workspace-wide
  `cargo clippy --workspace --all-targets` is still NOT YET VERIFIED.

## Exact published acceptance — 2026-10-12 checkpoint

- Nonforce fast-forward of the existing fork PR branch
  `feat/community-self-repair-mvp` from `5c9ff20...` to
  `923507e77fbddb23213e126558fce7b626b4d1eb` verified by remote SHA.
  The unrelated locally ahead `edfbff1` worktree was preserved.
- [Fork CI 38176328221](https://github.com/xuan2261/JeikCode/actions/runs/38176328221):
  exact head, **5/5 SUCCESS**, including workspace Rust check.
- [Fork Portability 38176330751](https://github.com/xuan2261/JeikCode/actions/runs/38176330751):
  exact head, **10/10 SUCCESS**. The actual build-watch Python harness ran
  **6/6 PASS** on Ubuntu, macOS and Windows. Native regression tests and
  native cargo checks ran before the new test step in each OS job.
- [Fork Self-repair Acceptance 38176290753](https://github.com/xuan2261/JeikCode/actions/runs/38176290753):
  exact head, **linux-sandbox SUCCESS**. Real Linux sandbox acceptance ran
  4 tests, 0 failed/ignored. CLI repair, build identity, capability/skill,
  auth/daemon and WebUI gates completed; separately reported pre-existing
  ignored tests in other targeted library commands remain ignored rather
  than being relabeled as executed.
- [Upstream PR #28](https://github.com/jeikl/JeikCode/pull/28)
  remains open and **CONFLICTING** against advanced beta; this suppresses
  upstream `pull_request` runs. The maintainer explicitly offered to
  retarget/integrate the old PR after the watcher fix. Therefore
  **do not rebase/force-push**; successful exact-head fork checks do not prove
  the eventual merge commit or constitute approving review.
- The optional workflow question is answered by current source scope:
  `self-repair-acceptance.yml` intentionally retains fork-feature-branch
  `[repair-acceptance]` push and manual dispatch; no expensive beta push
  trigger was enabled. Repository-wide clippy has not been executed.
- REFACTOR: check temporary repo/worktree cleanup, path escaping, non-dir
  watches, detached-head case, `git diff --check` and scoped rustfmt.
- Hosted correctness: prioritize exact SHA PR CI/portability; full fmt/clippy
  if these are existing hosted gates, otherwise mark **NOT YET VERIFIED**
  instead of claiming `cargo check` substitutes for clippy.
- Independent review must explicitly verify no Windows build-manifest/icon
  change and no touch to CLI metadata identity code.

## Exit and prohibited actions

The fork milestone's RED→GREEN, independent source review and exact-head
hosted CI/Portability/real sandbox verification are complete. Upstream
integration and independent maintainer approval remain external gates.
Maintain the published PR's ancestry and attribution. No rebase, force-push,
release, or pretending that the locally ahead `edfbff1` was delivered.
