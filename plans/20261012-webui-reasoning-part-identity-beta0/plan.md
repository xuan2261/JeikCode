# WebUI live reasoning part identity — v7.2.3-beta.0

## Outcome and scope

Preserve the authoritative `partId` of live assistant reasoning after tool/text
boundaries. When an incoming live reasoning frame carries a **new** part ID,
create that new part instead of appending its content to a prior reasoning part
and retaining the prior ID. Existing-ID continuations and ID-less legacy
fallback retain their existing behavior. No HTTP/SSE schema or daemon changes.

## Source and reproduction

- Upstream: `jeikl/JeikCode:beta` at
  `e725babcc335ba4b9fb3d0c3e8b35d462ec5d131` (`v7.2.3-beta.0`).
- Fork branch: `fix/webui-reasoning-part-identity-beta0-20261012`.
- Upstream source commit `27531a597` separated live append from replay
  substring deduplication, correctly fixing repeated live URLs/text.
- Remaining defect in that source: `mergeReasoningIntoParts` exact part-ID miss
  falls through to `lastReasoningIdx` and appends a new part's text to an old
  reasoning part across a tool/text boundary. The old part ID remains attached
  to the new content, breaking display order and later replay reconciliation.
- A new deterministic Node test starts with reasoning part A, then a tool, and
  delivers live reasoning part B with a different ID. It verifies that B opens
  after the tool, subsequent B chunks extend only B, and a late A continuation
  updates A without corrupting B. Another assertion covers adjacent reasoning
  blocks with distinct authoritative IDs even when a tool row is absent.
- Against pristine upstream implementation with **only the test added**:
  `node --test src/lib/sessionProjection.test.ts` returned **RED**,
  32 passed / 1 failed, exit 1 (expected `reasoning,tool,reasoning`, actual
  `reasoning,tool`).

## Minimum correction and local evidence

- For an identified live reasoning frame: exact matching part updates in place;
  when no part has that ID, append a fresh `{kind:'reasoning', text, id:partId}`.
  Do not use the legacy last-reasoning fallback for identified frames.
- Do not change the replay (`replay=true`) branch, live text merge, the
  approved upstream repeated-URL/reasoning behavior or ID-less legacy code.
- On the patched local tree, `node --test src/lib/sessionProjection.test.ts`:
  **34 passed / 0 failed**, exit 0.
- `node --test src/lib/chatTerminal.test.ts src/lib/sessionCache.test.ts`:
  **40 passed / 0 failed**, exit 0.
- Node version used: `v22.22.0`, matching the pinned major version.

## Required delivery gates

1. Check exact staged files and diff integrity; preserve untracked/user files.
2. Obtain independent strict read-only review of the test, production correction,
   source baseline and any changed contract.
3. If GO, author a focused bilingual Conventional Commit with the exact
   `Co-Authored-By: JeikCode <code@jeikcode.top>` trailer, push only to fork
   without rewriting shared ancestry, and verify the fork remote SHA.
4. Run existing fork `ci.yml` by workflow dispatch at the exact pushed SHA;
   require all applicable jobs successful, especially locked WebUI install,
   typecheck, tests and production build. The native Portability matrix is
   **NOT APPLICABLE** to this WebUI-only logic change, absent new evidence of a
   native contract impact. Do not disguise absent CI as PASS.

## Explicit exclusions

- Full M05 WebUI cache mutation integration remains **NO GO** because of the
  unwatched cold-GET/prefetch race. No changes to history persistence or cache
  revision contracts in this milestone.
- The inherited upstream `/chat/watch` cursor mismatch and inclusive replay
  filter remain a separately coordinated protocol milestone.
- Do not change native canonical history identity already fork-verified at
  `05a81aaa5636907ea81d54bc93124367a593bfd6`, or PR #30 log ownership.
- No upstream PR/comment, merge, release, tag, publication, installation,
  activation or external notification is implied by preparing this fix.
- Preserve unrelated `extensions/jetbrains/gradlew.bat` line-ending dirt and
  other dirty worktrees verbatim; do not reset/clean them.
