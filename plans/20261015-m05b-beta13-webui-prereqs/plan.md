# M05b / JC-14 — Bring independently verified WebUI safety prerequisites onto beta.13

Date: 2026-10-15.

Upstream base: `jeikl/JeikCode:beta`
`d0914b32ee756c909d2a6cf4655709709ec1dcca`
(`v7.2.4-beta.13`).

Fork branch: `fix/m05b-beta13-webui-retry-prereqs-20261015`.

## One coherent outcome

Make both small, previously independently verified M05b WebUI-only safety
changes available together on the current upstream beta baseline without
transplanting the older fork's large `Chat.tsx` implementation or changing
native admission, persistence, or public contracts.

## Reused, exact source

1. `4b243dd9f4bbec0384f793bdd8957b22602a40d2`:
   confirmed `GET /chat/queue` and `POST /chat/queue` transport/schema
   helpers in `webui/src/api.ts`, focused `api.test.ts` regressions,
   and its historical beta.11 plan.
   Fork CI [38528873570](https://github.com/xuan2261/JeikCode/actions/runs/38528873570)
   succeeded 5/5 at that exact source SHA.
2. `dbf1ec19d2e76748f83fa26c66f5c77c34abd565`:
   structured HTTP 409-only classification in `queuedDraft.ts`,
   its use in `Chat.tsx`, an operation-response fence against a
   post-202 UI callback masquerading as an HTTP 409 rejection,
   and focused classifier/API regressions.
   Fork CI [38582787817](https://github.com/xuan2261/JeikCode/actions/runs/38582787817)
   succeeded 5/5 at that exact source SHA.

Both original commits were based on beta.11
(`76116587564ff376351f4cb8927cafa346f7af5c`).
The upstream beta.11 → beta.13 changes did **not** modify the source
files of either slice, including `Chat.tsx`, `api.ts`, and their tests.
They did update separate update/reload and other components; those
upstream changes are retained.

## Actual contract and acceptance

- A real `/chat` HTTP 409 remains a definite rejection of **that POST
  attempt** even if its JSON body is unreadable. This is **not** proof
  that an earlier attempt of the same logical queued input was never
  admitted: the daemon can reserve an operation, lose its HTTP 202
  response, and later reject a duplicate attempt with 409 while the
  first operation is still live. A 409 cannot settle an earlier UNKNOWN.
  An exception whose text/code merely contains
  `409`, `Conflict`, or `session_busy` does not authorize automatic retry.
- Once a `postChatPrompt` 202 response resolves, any later UI callback
  with an unrelated `status:409` cannot be mistaken for rejection of
  that HTTP request. This flag is an **operation response** fence,
  *not* an assertion of canonical persisted user-message admission.
- Confirmed queue helpers reject malformed/failed GET and false-positive
  or unreadable POST ACKs and validate existing known queue-item fields.
  The helpers preserve opaque extension properties but do not certify
  admission identity; existing best-effort callers are unchanged.
- Existing beta Stop/Cancel/Send Now/Steer, queue persistence callers,
  SSE/watch lifecycle, images and approval-mode handling remain intact.
- Keep the source patch limited to `webui/src/api.ts`,
  `webui/src/api.test.ts`, `webui/src/components/Chat.tsx`,
  `webui/src/lib/queuedDraft.ts` and its tests, plus provenance plans.
- Run final-revision focused tests and typecheck, obtain independent
  read-only review of the complete beta.13 diff, then a self-contained
  fork commit and exact-SHA fork GitHub Actions CI (including Rust/TUI).
  Do not use old-SHA successes as verification for this combined source.

## Explicitly **not** delivered

- No existing `Chat.tsx` queue caller is migrated to the strict queue
  helpers, so this is **co-location of safe prerequisites**, not a full
  end-to-end rejected retry implementation.
- No durable originating `client_input_id` in the actual kernel user
  message, canonical history, SSE/replay or native queue metadata.
- No proven zero-loss/zero-duplicate recovery when HTTP 202 is lost or
  when a browser/process exits between queue removal and submission.
- No native queue disk ACK hardening, GET/clear serialization,
  per-test queue-root injection, cross-client CAS or legacy/mixed-version
  protocol migration.
- No claim that HTTP 202 means persisted user admission; it currently
  reserves a daemon operation before the actual user row necessarily exists.
- The existing beta's text-based requeue/deduplication and fresh retry ID
  on a true 409 remain unchanged. They are **not** evidence of safe
  recovery for an original retry whose preceding admission is UNKNOWN.
- No upstream PR/merge, tag, release, installer activation or installed-app
  verification.

## Native architectural decision gates (not approved)

The separate **local design-only branch**
`docs/m05b-native-admission-contract-20261014` contains
`plans/20261014-m05b-native-admission-contract/` at commit
`c45715a6bd39d44a00c58da631a99bdb62b639b3`.
That packet is **not included in this beta.13 integration tree** and
proposes:

- **D8 / N0**: Define the accepted-user boundary. Conservative default:
  treat HTTP 202 as an operation reservation, keep a pending retry
  UNKNOWN until its *exact* originating client ID appears on an
  authoritative **post-kernel admitted-user event or canonical persisted
  history**; absence is not rejection. Beta's current pre-runtime
  `ChatEvent::User` is emitted before the real kernel-created user row,
  so even a future client ID on that early event must not settle UNKNOWN.
- **D1 / N1**: Coordinate an optional, persisted origin
  `client_input_id` distinct from kernel LLM `request_id`, carried
  through the normal runtime-generated user row, watch replay and GET.
- **D9 / N3-00**: Before native queue failure/race tests, inject a
  verified temporary queue root **and isolated map**. Setting
  `JEIKCODE_HOME` alone does not redirect beta's queue-root path and
  must never be treated as isolation.
- **D2/D3**, **D7**, and **D5** remain separate decisions about queue
  wire durability, lost `/live/message` receipts, and multi-client CAS.

No design approval, owner, deadline or upstream authorization is inferred
from the old packet or this integration. The complete JC-14 remains
`NOT YET VERIFIED` until those separately agreed native and WebUI
end-to-end acceptance gates pass.
