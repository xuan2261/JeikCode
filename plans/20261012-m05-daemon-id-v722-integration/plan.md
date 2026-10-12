# Native M05 canonical-ID and TUI test gate — v7.2.2 fork integration

## Outcome and boundary

Combine the already-reviewed native canonical history ID resolver with the
independently reviewed TUI accounting-divider test correction so that a single
fork revision can be validated by both hosted CI and cross-platform Portability.
This is a focused validation/integration milestone, not a new WebUI protocol.

## Source baseline and provenance

- Upstream: `jeikl/JeikCode:beta` at `82c17380453e35f8781cf2b90487d1a1932cc47e`
  (`v7.2.2`, release-only delta since beta.7 `b05f91a369c833165d4fef529585b5683c94d6f8`).
- New fork branch: `fix/m05-daemon-id-verified-v7.2.2-20261012`.
- Source patch 1: `63d548544ecaff5db4c97b806c3f7f2526633e80`, native
  canonical-ID resolver, handler tests and validation workflows.
- Source patch 2: `cb6b5f330a4f985208b9848b34a57dc87cd0f92e`,
  TUI test-only accounting-divider filtering and locale guard.
- Both source patches were applied to the new release baseline without code
  conflicts. Their historical plans remain intact as source evidence.
- Unrelated `extensions/jetbrains/gradlew.bat` CRLF-only worktree dirt is
  expressly excluded from staging and from the intended commit.

## Acceptance and evidence separation

- Native PATCH/DELETE/TRUNCATE with a valid canonical message ID resolves the
  exact unique ID, refusing empty, duplicate, missing or incompatible IDs;
  callers without IDs retain documented positional compatibility.
- Local Windows validation on the uncommitted integrated candidate:
  `canonical_history` **2/2 PASS** and `resolve_target_message_index` **2/2 PASS**
  using Rust 1.93.0, Cargo `--locked` and isolated `JEIKCODE_HOME`.
- Hermetic Python/Rust resolver contract harness on the same integrated
  working tree: **6/6 PASS**; staged diff whitespace check: **PASS**.
- TUI source checkpoint `cb6b5f3` has exact-SHA fork CI **5/5 SUCCESS**
  (run `38248610880`) and Portability **10/10 SUCCESS**
  (run `38234967756`), including Linux/macOS/Windows native jobs.
- Native source checkpoint `63d5485` has targeted tests and independent source
  review GO; its historical CI/Portability runs **FAILED** because the
  unrelated TUI test was still defective at that SHA. Do not relabel them.
- The integrated candidate requires its own independent read-only source
  review before commit/push, and its own exact-SHA fork CI/Portability after
  push. Until these gates finish, integrated `FORK_VERIFIED` is NOT YET VERIFIED.

## Exclusions and decisions not implied

- Do not include the dirty full WebUI M05 beta.7 candidate. Its unwatched
  cold-GET cache race still needs coordination on event/persistence freshness.
- Do not change beta.7 inherited `/chat/watch` live/replay `seq` semantics,
  public wire contracts, or native concurrent history read-modify-write
  atomicity here. Those are separate decisions and acceptance tests.
- Do not include PR #30 log ownership/lifecycle work or PR #44 old TUI contract
  assumptions; the maintainer has already replaced much of PR #44 on beta.
- No upstream PR/comment/merge, tags, releases, publication, installation,
  runtime activation or user-home data migration is authorized by this plan.
- Preserve original checkpoint branches, other worktrees, upstream history
  and fork remote without force-push or history replacement.
