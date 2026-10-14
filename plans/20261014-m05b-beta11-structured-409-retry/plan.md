# M05b / JC-14 — Structured HTTP 409 is the only automatic chat-retry evidence

Date: 2026-10-14
Upstream base: `jeikl/JeikCode:beta`
`76116587564ff376351f4cb8927cafa346f7af5c`
(`v7.2.4-beta.11`).
Fork branch: `fix/m05b-beta11-structured-409-retry-20261014`.

## One outcome

Prevent an ambiguous connection, proxy or local error from being mistaken
for a **definitive failed `/chat` admission** simply because its human
error message contains `409`, `Conflict`, `session_busy`, or the
server's English busy wording. Only a numeric, structured HTTP
`status === 409` may enter the existing 409-specific optimistic
rollback, automatic requeue and remote-busy flow.

This is a **bounded WebUI-only behavior fix**, not a complete replacement
of rejected retry admission or lost-202 reconciliation.

## Root cause and direct evidence

- `webui/src/api.ts:292-303` preserves the actual non-2xx HTTP
  status on a rejected `postChatPrompt` error. A 409 still carries
  `status: 409` even if the error response body is malformed.
- Upstream daemon `crates/jeikcode-daemon/src/lib.rs:7873-7894`
  returns HTTP 409 for both `session_busy` and `request_busy`
  from the existing active-chat registry; the fix does not alter
  this protocol.
- Beta `webui/src/components/Chat.tsx:6263-6269` classifies
  message *substrings* as conflicts. The same boolean at
  `:6273-6307` removes the optimistic user and queues a new retry,
  then at `:6321-6328` marks the session busy. A transport error
  that merely quotes "409 Conflict" can therefore enter a
  definite-rejection branch even though no HTTP 409 was received.
- The earlier M05b fork `4029cff966925774cf11cc9ed02f9ab133d815a4`
  distinguished definite rejection from presentation hints in its
  Chat.tsx, but its broad typed admission/reconciliation work cannot
  be transplanted onto current beta without native contracts D1/D2/D3/D8.

## Reuse and contract impact

Add one small pure predicate `isDefiniteChatConflict(error, operationReceiptObserved)`
to existing `webui/src/lib/queuedDraft.ts`; wire it to the two existing
conditional paths in `Chat.tsx` without changing their success or
structured-409 behavior. Add a pure regression test and an API-level
mock to prove current `postChatPrompt` preserves numeric 409
independently of error-string content.

The `deliver` catch also encloses post-202 local callbacks. Capture the
moment `postChatPrompt` resolves, and **never** classify a later callback
error carrying its own `status:409` as rejection of the completed RPC.
This is an operation receipt fence, not a claim that HTTP 202 proves a
persisted canonical user message under still-pending D8.

No daemon, kernel, wire schema, persisted history, new lifecycle, native
authority or public API is changed. No agent delegation is introduced,
and beta's current watch/Stop/Send Now contracts are retained.

## TDD and acceptance

- True HTTP `409` with `session_busy` or `request_busy`, or
  HTTP 409 with malformed JSON, remains classified as definite rejection.
- HTTP 500 with a misleading `code=session_busy` is not a definite
  409; an ordinary `Error('409 Conflict')`, a text-only
  `session_busy`, an English busy sentence, or a `TypeError`
  from an unknown transport outcome are **not** automatically requeued.
- A `postChatPrompt` 202 followed by an unrelated synchronous UI callback
  error carrying `status:409` also cannot enter the 409 requeue path;
  that status did not originate from the `/chat` HTTP rejection.
- In the old 409 branch, queued items and mode/image payloads are
  still handled by the existing beta logic. New code does not assume
  a new server field or a stronger ACK.
- Keep the generic transport recovery path and stop queue draining
  on ambiguous transport failure. This is more conservative but
  does not positively confirm admission.

Observed test iteration (Node v22.22.0):

1. Add the new helper regression and HTTP409 API test; initially
   `node --test src/lib/queuedDraft.test.ts src/api.test.ts`
   returned **27 passing subtests plus one module-import failure**:
   the helper export was absent. This is **interface/schema RED**,
   not behavioral evidence that the runtime branch ran.
2. Implement the helper and replace the heuristic `isConflict`
   in `Chat.tsx`: the two-file targeted run returned
   **32/32 PASS**.
3. Independent source review found an inherited broad-try provenance
   gap: after successful HTTP 202, a throwing callback could supply its
   own `status:409`. A new pure-helper assertion
   `isDefiniteChatConflict({status:409}, true) === false`
   initially failed **true !== false** (behavioral RED).
   The new operation-receipt guard is applied only after an awaited
   `postChatPrompt` reply; re-run the affected regression tests and
   re-review the exact changed source before publication.
4. Verify TypeScript and build on final changed source or via
   applicable exact-SHA fork CI. Record source review and CI
   separately; never equate helper tests with a real browser/daemon
   lost-202 scenario.

## Explicit exclusions

This slice does **not** solve:

- accepted `/chat` with lost HTTP 202, or 202 returned before
  canonical user-message creation (design decision D8);
- duplicate prompts due to manual resend after an ambiguous outcome;
- exact `client_input_id` persistence in SSE, history or queue;
- queue disk ACK false-success, cross-client whole-vector last-writer-wins,
  hydration/restore races or process-crash admission transaction windows;
- native runtime/installed Desktop/Mobile/browser two-tab correctness.

Do not port the old fork's entire `Chat.tsx`, invent new server fields,
or weaken CI. The prior M05b candidate `4029cff` was
**NOT YET VERIFIED** because its Rust-quality CI failed. This
bounded 409 slice requires its own independent review, fork commit
and exact-SHA CI before it can be marked `FORK_VERIFIED`.

## Next milestone

Integrate these contract-preserving WebUI slices into a coherent beta
candidate **only after** selecting and coordinating native user-admission
identity (D1), queue persistence (D2/D3/D9), and the distinction between
operation-reservation 202 and admitted user (D8). Do not open an upstream
PR or merge into `jeikl/JeikCode:beta` without separate user
authorization.
