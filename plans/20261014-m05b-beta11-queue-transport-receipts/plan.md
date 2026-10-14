# M05b / JC-14 — Beta.11 strict queue transport receipts

Date: 2026-10-14
Base: `jeikl/JeikCode:beta` at `76116587564ff376351f4cb8927cafa346f7af5c` (`v7.2.4-beta.11`).
Target: new fork branch `fix/m05b-beta11-queue-transport-receipts-20261014`.
Milestone: **a bounded, independently verifiable WebUI API prerequisite**, not full M05b admission recovery.

## Outcome

Expose explicit HTTP/schema-aware companion functions for the existing
`/chat/queue` GET and POST endpoints. A caller *that opts in* can reject
transport failure, malformed server JSON, malformed queue items and a queue
POST without `success: true` instead of treating those as an authoritative
empty queue or an acknowledged update.

**Reuse:** keep the existing `apiFetch`, `authHeaders`, endpoint paths and
`QueuedMessageApiItem` shape. Preserve best-effort
`getChatQueue` / `saveChatQueue` unchanged for all existing callers.

**Public contract impact:** no daemon endpoint, Rust code, wire schema,
persisted field, native lifecycle, or existing WebUI caller is changed.
These are additive, currently unused WebUI TypeScript exports only.

## Root cause and source evidence

- Beta `webui/src/api.ts:416-427` returns `[]` on GET HTTP error,
  invalid JSON or a non-array body. Existing callers intentionally use
  this historical best-effort behavior.
- Beta `webui/src/api.ts:429-435` ignores POST errors and does not inspect
  the response. Its returned Promise is not an acknowledgement.
- Previous WebUI M05b fork `4029cff966925774cf11cc9ed02f9ab133d815a4`
  provides a scoped design precedent at its
  `webui/src/api.ts:394-428` and `webui/src/api.test.ts:9-67`.
  It is **not** safe to port its entire API module or Chat component onto
  beta.11: beta has newer `StopChatResult.released` and queue Send Now flow.
- Beta daemon `crates/jeikcode-daemon/src/lib.rs:9089-9134` can
  still return `200 []` on a persisted queue read/parse failure and
  `success:true` even if queue file removal/replacement fails.
  Consequently these new functions guarantee **only transport/schema
  interpretation of the daemon's response**, not persistence durability
  or real admission safety.

## Acceptance and TDD evidence

1. Existing best-effort GET and POST still behave as before on HTTP 503.
2. Strict GET returns a valid array with string retry IDs and mode fields,
   and rejects HTTP 503, non-array bodies, null items, missing `id`,
   `text`, or `kind`, and invalid JSON. Optional `images` must be
   an array of objects with string `media_type`/`data` and optional
   `approval_mode` must be one of the known modes. Beta daemon's nullable
   `Option` fields are normalized away rather than exposing null as
   `ImageData[]` or `ApprovalMode`. Unknown extension fields are
   preserved opaquely, **not validated as admission identities**.
   Session IDs remain URL-encoded.
3. Strict POST sends the unchanged `session_id`/`items` payload and
   resolves only when HTTP is successful and JSON includes
   `success: true`; HTTP 503, `success:false`, missing receipt and
   malformed JSON all reject.
4. Source edits remain confined to `webui/src/api.ts` and
   `webui/src/api.test.ts`, plus this milestone note.
5. No caller is migrated to strict mode before the native D1/D2/D3/D8/D9
   contracts and hydration ordering are coordinated.

Observed TDD:

- `node --test src/api.test.ts` on beta.11 with the new test cases but
  before the exports: **27 passed / 2 failed** because the strict
  exports did not exist. This is an **interface/schema RED**, not a
  behavioral reproduction of native queue durability.
- After implementing the two additive helpers:
  **29 passed / 0 failed** (Node 22.22.0).
- Independent review identified an additional important gap in the
  strict GET helper: the original implementation had validated only
  `id/text/kind`, while native `images` and `approval_mode` are
  weakly typed and may be null or malformed. The expanded test initially
  failed on an expected rejection; validation and null normalization
  have since been added. The final result must be rechecked and reviewed
  before any commit/push.
- `npm run typecheck`: **PASS** after locked dependency installation
  (`npm ci --ignore-scripts --no-audit --no-fund`).
- `npm run build`: **PASS**, Vite 4076 modules transformed;
  large-chunk warning is not a build failure.

These are local, pre-commit checks on an unpushed fork worktree.
Independent source review and exact-SHA fork CI must be recorded
separately; neither is implied by these results.

## Exclusions / blockers

This API-only slice **does not**:

- change the behavior of the current queue sender/drain;
- prevent a queue-clear ACK followed by unknown/failed `/chat`;
- turn `202 Accepted` into canonical user admission;
- persist `client_input_id` through daemon queue / SSE / history;
- make daemon `success:true` durable, distinguish corrupted persisted
  files from `[]`, or provide queue CAS/atomic remove-by-ID;
- fix `/live/message` lost ACK, browser process crash, or mixed-version
  cross-client last-writer-wins;
- prove browser two-tab, installed Desktop/Mobile, or native TUI behavior.

Native/public decisions D1–D9 remain recorded in the prior fork design
checkpoint `c45715a6bd39d44a00c58da631a99bdb62b639b3`;
the N0 prospective contract RED at `d893407185072756fd9ed5845141f729b6ffb76a`
is not GREEN. Old M05b WebUI candidate `4029cff` was pushed and
independently reviewed, but its exact-SHA run `38494762981`
had Rust quality failure; it is **NOT YET VERIFIED**.

## Next engineering milestone

Run a separate beta.11 **structured HTTP-409 rejection** WebUI safety
slice: on the existing `postChatPrompt` path, only an actual typed HTTP
409 may authorize automatic 409 retry/rollback; a text-only `409`
or `Conflict` message on an ambiguous transport error must not.
Keep all queue user identity and native changes out until coordinated.

After independent review GO and non-force fork push of this API slice,
inspect all applicable GitHub Actions on its exact commit SHA. Only
call the API slice `FORK_VERIFIED` if applicable mandatory gates pass;
do not inflate that verdict to overall JC-14/M05b.
