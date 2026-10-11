# Phase 05 — Evidence reconciliation, safety and maintainer follow-up

**Status:** requires completed or explicitly blocked source phases.

## Verification ledger

Every claim must record: repository, branch, exact base/head SHA, affected
files, independent review, test command, host/OS, CI run and job URL,
conclusion, and what the check actually exercises.

| Gate | PASS requires | NOT YET VERIFIED if |
| --- | --- | --- |
| TDD | A discriminating test fails before change and passes after | The baseline was inferred from a stale PR without execution |
| Local check | Exact command and complete output receipt | Missing toolchain, skipped test or private cache not observed |
| Hosted CI | Actual job and matching immutable SHA, test selected and executed | Run absent/pending/skipped/cancelled or different SHA |
| Portability | Relevant Windows/macOS/Linux jobs test the affected path | A POSIX-only smoke is substituted for native Windows |
| Runtime smoke | Assembled CodingRuntime/daemon/HTTP/Bash process path was exercised | Unit/handler-only simulation substitutes for physical path |
| Source review | Reviewer independent of author checked exact candidate | Self-review only or source changed after review |
| Approval | Actual `jeikl` / permitted maintainer approving review and protected merge state | Reviewer merely requested or commented informally |

## Follow-up communication rules

- Do not post “all problems solved” to #30 until the orphan log lifecycle
  suggestion has a demonstrated safe, accepted resolution and necessary
  existing approvals/CI are verified.
- For #28, answer the optional CI and workflow-trigger notes with exact
  choices. Do not confuse an optional question with a code-blocking failure.
- For #31, preserve the existing PR for traceability; do not propose merging
  it or claiming all four residuals needed new code without current beta RED.
- For #44, report latest green checks accurately while still requesting
  independent approval. Do not duplicate a pending review request.
- User-facing progress and final summary are Vietnamese; PR text and code
  evidence remain English and maintain existing bilingual release notes.

## Final user handoff

Deliver the five-comment matrix, per-PR disposition, changed paths and SHAs,
RED/GREEN reproduction receipts, hosted exact-head checks, separate
unresolved architecture decisions and required maintainer actions. Name
which milestones are `SOURCE_REVIEWED`, `FORK_VERIFIED`,
`UPSTREAM_READY`, `SUBMITTED`, `INTEGRATED`, or `BLOCKED`; do not
collapse the statuses.
