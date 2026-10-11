# Phase 02 — PR #30: orphan-log lifecycle and owned deletion

**Status:** source diagnosis only; changes require careful lifecycle design.

## Baseline distinction

- PR30 `059d8bd7b48a0063fd008ce85d789d75376ec44c` uses
  `tempdir().keep()` in `crates/jeikcode-capabilities/src/tools/bash_log.rs`,
  with quota in current-process `LOGS`. The maintainer's
  [comment](https://github.com/jeikl/JeikCode/pull/30#issuecomment-6104416947)
  correctly identifies unbounded **cross-run** orphan accumulation there.
- Latest upstream `beta` at intake `c0e315473...` does **not** use that
  persistent process-dir design: it retains a global prefix scan/LRU that
  evicts old files across runs. Therefore do not write a beta test claiming
  the exact PR30 orphan bug is present on current beta.
- Beta's separate potential defects require reproduction: deterministic
  session/PID filenames and prefix deletion may affect active/replaced files;
  daemon cancel/delete can run before exact owned handles close. These were
  addressed more carefully in the PR30 design, but that branch has diverged
  from newer beta; do not import the entire branch.

## Outcome and design choices

One bounded ownership+lifecycle correction preserving existing Bash
foreground/background shutdown semantics and other sessions/services. A
file-system owner token must be **unforgeable by file name alone**; never
delete a live/unknown owner's directory. No periodic scan or timer.

Compare before choosing production design:

1. Fixed owned parent + randomized per-process directory + held exclusive
   liveness lock + one-shot startup reclamation as maintainer suggested.
2. Conservative per-file identity tracker plus existing global LRU with
   protected active-file handles.

Choose only after red behavior is demonstrated and cross-platform lock/path
semantics are reviewed with maintainer; lock-unavailable/permission-denied is
**unknown**, never proof of orphan status. Never use age alone to bypass a
failed/unknown liveness check for an arbitrary path.

## TDD matrix — distinguish existing RED from future design acceptance

First reproduce **genuine current-beta** failure paths, not the absence of a
newly proposed owner-dir scheme. Examples to investigate under deterministic
fixtures: concurrent live writers under global filename LRU, session-id
sanitization collisions, and daemon deletion racing an unclosed writer.
Only a demonstrably failing baseline fixture authorizes changing that path.

If the maintainer-coordinated design chooses process-owned directories,
test the following as **acceptance of that new design**, NOT a claim that
the existing beta orphan bug was already reproduced:

| Proposed-design scenario | Expected safe result |
| --- | --- |
| Two process launches leave stopped owner dir | Eligible old orphan reclaimed on next startup |
| Another process holds live owner lock | Never delete its directory or active log |
| Sweeper races with mkdir before a new owner has acquired/published its lock | The new owner is never reclaimed; require atomic safe publication/coordination rather than assuming an unlocked directory is an orphan |
| Orphan whose **directory/lock timestamp age** is below selected threshold | Retain; a lock alone does **not** reveal time of death |
| Liveness cannot be established (`AccessDenied`, file-lock error, platform unsupported) | Fail closed / skip rather than treating as dead |
| Hard file/byte cap with all owners live | Do not evict live owners; explicitly report cap cannot converge |
| 200+ unrelated or intentionally malformed child dirs | Bounded scan; do not follow/jump symlinks or reparse points |
| Child directory replaced or log symlinked after enumeration | Revalidate identity/handle and relinquish; never delete outside owned root |
| Owned process directory renamed/replaced after liveness check | Skip/relinquish by directory-handle identity; never pathname-recursively delete the replacement |
| PID reused across sessions | Random suffix prevents collision; session ownership still from in-memory identity |
| Session A deleted while B/host alive | A's exact closed artifacts only removed; B/host preserved |
| Shutdown while background service survives | No unauthorized cancellation, log truncation or deletion |
| Windows and POSIX with owner alive/crashed | Platform-specific lock lifetime and process exit behavior verified |

## Implementation boundaries

- Fresh upstream `beta` **new worktree/branch** with one outcome, not the
  old PR30 checkout; no cloned global cleanup subsystem.
- Reuse existing runtime plumbing, but **re-prove spawn-time owner stability**
  under reprepare/session switching: beta's `BashRuntimeState.session_id`
  is mutable and cannot be treated as an immutable per-task delete
  authority. Port an immutable owner token only if the RED case requires it.
  New durable owner locks or temp root names are
  lifecycle/filesystem contract changes: **coordinate before production
  implementation**, even though test-first reproduction is authorized.
- Scope all deletion to a private known fixed parent. Any backstop on unknown
  liveness remains a design choice pending safety review; do not implement
  age-only destructive fallback by default.
- **No `remove_dir_all` / path-recursive deletion after a stale check.**
  Use no-follow and handle-backed identity checks on the process directory and
  every expected regular file. Treat symlinks, reparse points, foreign entries,
  access denial and any observed path swap as **relinquish/skip**, not as
  permission to traverse. Unlink only the specific verified files; remove the
  owner directory only when empty and identity still matches. RED race tests
  must replace both a child log and the **process directory itself**.
- A process may run longer than an hour before crashing; creation/mtime age
  is **not** exit age. Do not promise a one-hour post-exit grace period without
  an explicit trustworthy exit marker or heartbeat and crash policy.
- An owner directory MUST NOT be discoverable as reclaimable in the
  `mkdir -> acquire/hold liveness lock` startup window. Include a barrier
  fixture between creation and lock publication; choose a construction with
  atomic publication or parent-level coordination, not a PID/age guess.
- Hard byte/file budgets apply to **reclaimable completed or orphaned data**;
  live owner directories are never evictable and can temporarily exceed the
  aggregate cap. Continue to enforce a per-live-file size bound and report
  aggregate non-convergence without deleting a live owner.
- If a file lock crate is chosen, verify dependency/feature closure on the
  project's real supported combinations: `fs2` is optional in current beta
  and not automatically included by `tools`; raw `windows-sys` locking may
  need explicit `Win32_Storage_FileSystem`. Prove compilation in
  provider+tools, default native and Windows/POSIX jobs rather than assuming
  one default-feature CI run covers all edges.
- Avoid heavy local broad builds; use separate Windows/macOS/Linux hosted
  checks and existing authenticated daemon DELETE smoke for actual behavior.

## Exit gate

Independent security/portability review with exact path:line, RED→GREEN tests
covering process restart and the **selected ownership mechanism** (both
Windows/POSIX lock APIs only if that mechanism uses locks), CI-backed
actual runtime DELETE smoke, and separate maintainer acceptance. Only after
all PR30 requested problems truly resolve should a concise
[@jeikl notification](https://github.com/jeikl/JeikCode/pull/30#issuecomment-6106747396)
be considered; a plan or green unrelated check is not sufficient.
