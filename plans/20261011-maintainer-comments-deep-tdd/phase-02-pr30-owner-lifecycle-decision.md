# PR #30 — background-log ownership and orphan reclamation decision

**State:** DESIGN PROPOSAL ONLY. Do not treat this document as a maintainer
agreement, implementation authorization, accepted contract, or runtime PASS.
The existing PR #30 is not ready to merge as-is.

**Immutable reference:** upstream `jeikl/JeikCode:beta`
`acf6c35ad2ed156ce1638e77b39729c23bb3eb82` (2026-10-12).
Maintainer feedback:
[PR #30 comment](https://github.com/jeikl/JeikCode/pull/30#issuecomment-6104416947).
Executed ownership RED and its exact test-file hash are recorded in
[phase 02](phase-02-pr30-log-lifecycle-tdd.md). The local Windows RED
demonstrates 50/51 unowned matching files surviving the current
`enforce_global_lru_pool` at `bash_log.rs:149-178`; this is not a test of a
new owner-lock implementation.

## Decision requested: storage and deletion contract

The user-visible outcome is: a session's running background service remains
alive when appropriate, its output remains accessible while owned, session
deletion waits for the exact writer to close, and restarts eventually reclaim
only **provably owned, inactive** logs without touching other files in the
system temporary directory. Reuse `BashRuntimeState`, `BackgroundLogWriter`,
the existing cancellation path, and the proven identity-aware record model
from the historical PR #30. Do not add a daemon or polling scheduler.

Baseline constraints. Items 1–3, 5–6 are invariant safety requirements;
item 4 describes the **default/current PR #30 guarantee**. Its treatment
of foreign/replaced children may change **only** if the maintainer first
explicitly selects the disposable-container semantics of option B:

1. **A matching filename is not ownership.** The beta global LRU and
   session-prefix deletion may remove a live or unrelated matching file;
   generation-free PID or a sanitized session name cannot authorize deletion.
2. **Active writers are not evictable.** Session-scoped cancellation must be
   followed by an awaited task/writer shutdown before exact-file cleanup.
   Terminating the foreground must not implicitly kill the user's resident
   background service.
3. **An orphan must be proven dead.** A process-lifetime exclusive advisory
   lock may provide liveness evidence only for participants of the same
   protocol. Lock contention, access denied, invalid metadata, an unsupported
   filesystem, or a concurrent handoff mean **unknown => skip**.
4. **Default: preserve every replaced/foreign child.** A replaced directory,
   replaced file, symlink/reparse point, extra foreign entry, or mismatched
   identity must be relinquished, not followed or removed. Delete only
   individually verified owned regular files and remove a verified empty
   directory; otherwise retain it and report the gap. Option B cannot be
   implemented while this default is in force. Even if B is explicitly
   accepted, live/unknown owners, unverified roots, symlink traversal and
   stale path checks remain prohibited.
5. **Do not promise a fixed post-exit age.** An mtime or creation timestamp
   does not attest to the time of a crash; an age threshold is only an
   additional conservatism after a separate orphan/liveness proof.
6. **Bound cost and protect user data.** One lazy startup sweep, bounded
   entries/bytes/time, no scanning other system-temp siblings or arbitrary
   session names, and no hard-cap deletion of live/unknown owners. Keep
   per-writer 10 MiB/2,000-line rolling limits and explicitly report when a
   global reclaimable cap cannot converge.

## Two implementation candidates

| Choice | Approach | Advantages | Unresolved safety cost |
| --- | --- | --- | --- |
| **A — preferred if replacement protection remains contractual** | Fixed private parent, random per-process directory, held owner lock, persistent hard-link anchor per actual log plus exact live identity handles, bounded startup sweep | Pins the originally owned object across process death; foreign replacement is distinguishable from the anchored file | Requires real hard-link support on the target filesystem, Windows/POSIX identity tests, safe publication and conservative unsupported-filesystem fallback |
| B — disposable owner container | Same private parent / owner lock / publication barrier, but the verified dead process directory itself is declared disposable | Lower code and metadata complexity, closest to the maintainer's whole-orphan-directory suggestion | Intentionally allows removing a foreign/replaced regular file inside that directory; this **changes** PR #30's no-delete-replacement guarantee and requires explicit acceptance |
| C — partial containment only | Private temp area and exact in-memory writer identity, completed-log cleanup with **no** cross-run sweep | Smallest incremental patch | Crashed-process directories persist; does not resolve the maintainer's full cross-run concern |

**Proposed negotiation outcome:** prefer A if the maintainer requires the
existing guarantee that substituted/symlinked files survive. Choose B only
if the maintainer explicitly declares every entry of a verified orphan
process container disposable even if another same-user process replaces it.
C is a documented partial fallback, not completion. Do not transplant the
historical PR #30 branch wholesale.

### Publication and reclamation algorithm to validate, not yet implement

- Create a fixed app-owned parent with checked canonical location and
  platform-appropriate owner-only access. Do not assume the inherited
  Windows DACL is private without inspection. Do not include plaintext
  project/session titles or identifiers in paths.
- Use a parent-level protocol lock or another *proven* atomic-publication
  method to close the gap between creating a process directory and holding
  its `.owner.lock`; the sweeper must never observe a newly created,
  still-live owner as an unlocked orphan. Do not assume directory renaming
  with open handles behaves identically on Windows and Unix.
- Hold the owner lock for the process lifetime. Never infer liveness from a
  PID. Make all readers/writers use the same lock convention, and avoid
  duplicate locking of the same handle.
- For **A**, retain the original open regular-file handle/identity through
  the entire hard-link-anchor publication sequence. Create a uniquely
  named anchor in the private process namespace; immediately open the
  new anchor **without following symlinks/reparse points** and compare its
  actual file identity against the retained original handle. Only after
  this post-creation equality proof may the anchor be accepted/persisted.
  The pathname can be replaced *between* checking the visible log and
  calling a pathname-based `hard_link`, so a pre-creation identity check
  alone is insufficient. Any mismatch, missing anchor, unsupported hard
  link, or ambiguous handle error must fail closed: never delete a
  mismatched anchor or visible pathname as part of recovery. A correctly
  created anchor retains the original inode/file object across crash;
  after owner death, an authenticated anchored original alone is eligible
  for deletion, while a replaced visible path is left untouched.
- On startup, enumerate only a bounded number of entries immediately
  beneath the fixed parent. Reject symlinks/reparse points, directories
  outside the confined root, malformed records and lock failures. A
  successfully acquired nonblocking lock qualifies a *candidate* orphan;
  separately validate exact file and directory identities before unlink.
- At deletion, operate on proven completed, identity-matched files using
  platform-supported no-follow/handle-based operations; never use the old
  shared-temp prefix scan or unqualified `remove_dir_all`. Unknown content
  deliberately prevents full orphan-directory cleanup rather than being
  interpreted as app-owned data.

`fs2::FileExt` supports cross-platform `try_lock_exclusive`, but locks are
**advisory**, with platform differences; this must not become a claim of
filesystem isolation. The existing `fs2` dependency in
`jeikcode-capabilities/Cargo.toml` is optional and not automatically
activated by the `tools` feature. Verify feature closure rather than
assuming a default-feature build covers a tools-only embedder.
Reference documentation:
[fs2 locking](https://docs.rs/fs2/latest/fs2/trait.FileExt.html),
[Rust filesystem TOCTOU](https://doc.rust-lang.org/std/fs/index.html#time-of-check-to-time-of-use-toctou),
[Windows reparse-point handle flag](https://learn.microsoft.com/en-us/windows/win32/api/fileapi/nf-fileapi-createfilew),
[Rust hard links](https://doc.rust-lang.org/stable/std/fs/fn.hard_link.html),
[Windows CreateHardLinkW requirements](https://learn.microsoft.com/en-us/windows/win32/api/winbase/nf-winbase-createhardlinkw).
Windows `CreateHardLinkW` requires NTFS and cannot link directories; this
is a material portability qualification, not a license to weaken A on
ReFS or a filesystem without suitable hard-link guarantees.

## Maintainer decisions required before production changes

1. After the owner dies, **must foreign/replaced child files survive**, as
   the earlier PR #30 no-delete-replacement design promises? If yes, require
   A and its persistent original-object anchor; if no, explicitly authorize
   B's disposable UUID-container ownership semantics. The two guarantees
   cannot be claimed simultaneously without durable object identity.
2. Which mechanism establishes atomic `mkdir -> owner lock` publication on
   both Windows and POSIX? Is a short parent lock acceptable on lazy writer
   creation and startup sweep, without timers?
3. What counts as an orphan after process crash, and what retention/byte/file
   targets should apply to *reclaimable* data only? An age-based fallback
   without liveness proof is not acceptable.
4. Should legacy root-temp `jeikcode-back-*.log` files be left untouched or
   migrated through an independently authenticated ownership process?
   **Default recommendation: leave unknown legacy files untouched**.

## Acceptance / regression gate after agreement

- **RED/ownership (already executed on Windows):** 51 never-owned matching
  filenames; production helper wrongly removes one. The candidate GREEN
  must preserve all 51 while still evicting eligible authenticated completed
  records.
- **Cross-process liveness:** active owner lock blocks deletion; crash and
  restarted host reclaim only a known old orphan. A deliberately withheld
  lock-publication step must never make a live candidate appear orphaned.
- **Replacement/namespace safety:** replace a log, its lock, and the parent
  process directory with foreign content and symlink/reparse targets during
  reclamation. Under A, all foreign targets survive and the original
  anchored file is the only deletion candidate. Under B, record the
  explicitly accepted disposal policy rather than mislabeling foreign
  replacements safe. Under A, inject a deterministic pathname replacement
  **between initial file validation and hard-link creation**, then prove
  the post-creation original-handle/anchor-identity check rejects the
  mismatch without deleting either foreign pathname or anchor. Add an
  unsupported-hard-link fail-closed test.
- **Runtime lifecycle:** delete session A while B remains active; block until
  A's writer closes; PID reuse and reused session names never mix ownership;
  retained background services survive unrelated turn shutdown.
- **Boundedness:** scan limit, byte/file caps, unavailable locks, permission
  denial and a fleet of live owners all fail closed with truthful reporting.
- **Evidence:** narrow RED->GREEN locally on an isolated fork candidate;
  independent source/security review; exact-SHA GitHub Actions for Windows,
  Linux, macOS feature closure and native task lifecycle; no broad local
  Cargo rebuild when the matching CI scope already passes.

**Exclusions:** no upstream PR/comment, merge, installation, persistent
background sweeper, new public daemon endpoint, user-home migration or global
temporary-directory cleanup is authorized by this decision proposal.
