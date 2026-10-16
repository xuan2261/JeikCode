# M05 / JC-14 — Queue Hydration Identity & Persistence Contract

Date: 2026-10-16 (UTC+7)
Status: **DESIGN-COMPLETE / IMPLEMENTATION BLOCKED**
Delivery target: `FORK_VERIFIED` after an approved runtime contract and exact-SHA verification.
Current upstream baseline: `jeikl/JeikCode:beta` at `e1aad334338bb0f1639932afa5e24a29be84f867`.

## Authority and evidence boundary

This packet is a fork-side design record for maintainer coordination. It is not an
upstream approval and does not authorize a backend/public-protocol change by itself.

The accessible maintainer direction is product-level: single-agent-first, daily
pain points, frontend/UI edge-case fixes and polish, while core runtime/architecture
evolution remains maintainer-led
([issue #2 comment 6077597499](https://github.com/xuan2261/JeikCode/issues/2#issuecomment-6077597499)).

The earlier M05a history-identity packet explicitly marked its technical contract
as **NOT YET APPROVED** and identified persisted identity/version fencing,
GET/live authority and transaction ownership as open decisions
([issue #2 comment 6093263981](https://github.com/xuan2261/JeikCode/issues/2#issuecomment-6093263981)).

No accessible source, roadmap comment or upstream PR discussion contains exact
technical maintainer terms for queue ID authority, legacy collision migration,
queue revision/CAS, or durable queue tombstones. The owner has previously reported
that an agreement exists, but the terms are not recoverable from the accessible
evidence. Therefore all choices in the proposal below remain
`DESIGN_PROPOSED / POLICY_UNRESOLVED` until the exact agreement is captured.

## Outcome

Make WebUI queue hydration safe across refresh, session switches and multiple
clients without silently losing or resurrecting queued cards.

The bounded runtime outcome is:

1. Distinct cards with equal text remain distinct.
2. A queue item has an immutable identity that is safe across clients.
3. Concurrent whole-snapshot writes cannot silently overwrite a newer snapshot.
4. A successful deletion cannot be resurrected by an older client or failed
   refresh.
5. A failed GET is distinguishable from an empty queue.
6. A failed persistence write is never reported as success.
7. Approval mode, images, kind and queue identity survive a server round trip.
8. Session A operations cannot write session B while A/B switching is unsettled.

## Source-observed current contract

At upstream beta `e1aad334...`:

- `webui/src/components/Chat.tsx:319-328` defines `QueuedMessage.id` as a
  number and carries `text`, optional images, `approvalMode`, kind and a
  local-only `clientInputId`.
- `webui/src/api.ts:408-414` already declares `QueuedMessageApiItem.id` as
  `number | string` and includes the daemon wire field `approval_mode`.
- `webui/src/api.ts:416-435` exposes `/chat/queue` as a GET returning an array
  and a POST carrying a complete `items` array. Both helpers currently treat
  failures as best-effort: GET failure becomes `[]`; POST failures are swallowed.
- `crates/jeikcode-daemon/src/lib.rs:9415-9434` stores queue cards as
  `QueuedMessageItem` and accepts arbitrary JSON IDs, but the request is a
  complete `Vec<QueuedMessageItem>`.
- `crates/jeikcode-daemon/src/lib.rs:9437-9456` keeps an in-process
  `SESSION_QUEUES` map and persists each session to
  `$HOME/.jeikcode/state/queues/<session>.json`.
- `crates/jeikcode-daemon/src/lib.rs:9459-9482` reads the in-memory snapshot
  first, then the file, and returns `[]` for an absent/invalid/unreadable state.
- `crates/jeikcode-daemon/src/lib.rs:9485-9504` replaces the whole server array,
  removes the file for an empty array, ignores filesystem errors and returns
  `{"success":true}` regardless of whether persistence completed.
- The current queue route has no queue revision, conditional write, durable
  deletion marker or mutation receipt.

Existing reusable reliability patterns are present elsewhere:

- `crates/jeikcode-config/src/store.rs` provides a lock-protected read-modify-write
  transaction, content-derived revision, conditional `update_if_revision`, and
  atomic replacement.
- `crates/jeikcode-capabilities/src/fs.rs` provides cross-platform atomic file
  replacement. It is feature-gated but is already enabled by the daemon's
  `plugin`/`mcp` capabilities.

These are reusable implementation patterns, not evidence that queue semantics
have already been approved.

## Root causes carried forward from the blocked hydration experiment

The preserved local WIP reproduced these independent classes of failure:

1. Different peer cards can share a per-tab numeric ID; ID-based merging can
   silently discard a server card.
2. In-memory removal traces disappear on reload, allowing a canceled server card
   to reappear.
3. Text-based canvas filtering can discard a valid pending card whose text matches
   an earlier transcript row.
4. A session switch can perform a destination queue write before its hydration
   barrier becomes authoritative.
5. Whole-snapshot last-writer-wins permits a concurrent client to erase another
   client's queue changes.
6. A best-effort POST acknowledgement can report success after persistence failed.
7. `approval_mode` and `approvalMode` require explicit wire adaptation.

The separately verified queue-ID and single-apply steer-fold fixes address only
the first client-local layer. They do not settle server conflict authority,
revision/CAS or durable deletion.

## Contract options

### Option A — Client-only UUID + GET-before-POST

**Mechanism:** keep the existing array API; use UUIDs for new client IDs, defer
POST until GET completes, and persist local removal intents.

**Best property:** smallest source/public-contract change.

**Fails first:** concurrent clients. A read-merge-write sequence still has a
  last-writer-wins window because the server has no revision precondition.

**Disposition:** **REJECT for full hydration safety**. It remains useful as a
  client-side hardening layer but cannot close the data-integrity contract.

### Option B — Versioned whole-snapshot CAS + opaque IDs + durable tombstones

**Mechanism:** retain the existing whole-snapshot model but make each snapshot
  versioned and conditionally writable. Use opaque immutable IDs, persist deletion
  tombstones, and return a real commit receipt.

**Best property:** smallest architecture that closes the demonstrated concurrent
  overwrite and resurrection classes without introducing a new operation-log
  service or runtime owner.

**Fails first:** tombstone compaction/retention eventually needs an explicit policy;
  that policy is not currently documented.

**Disposition:** **RECOMMENDED**, subject to maintainer approval.

### Option C — Operation-based queue mutation log

**Mechanism:** replace whole-snapshot POSTs with append/idempotent add/remove
  operations, server-assigned operation receipts and replayable mutation history.

**Best property:** strongest conflict and retry semantics.

**Fails first:** complexity and lifecycle surface. It introduces a new durable
  operation protocol when the current product only needs a small pending queue.

**Disposition:** **DEFER** unless maintainer explicitly wants operation-log
  semantics.

## Recommended contract — DESIGN_PROPOSED, NOT APPROVED

### 1. Identity

- New queue cards use opaque UUID strings generated by the client using the
  existing WebUI random-ID utility.
- The daemon treats the ID as immutable and never derives identity from text,
  image content, array position or `String(id)` coercion.
- Numeric IDs remain readable for backward compatibility.
- A legacy numeric ID is not globally authoritative. If a legacy ID collides
  with a different payload, the write must preserve both cards by requiring the
  conflicting legacy card to receive a new opaque ID before retry.
- An opaque ID that already exists with a different payload is a conflict, not
  an overwrite.
- An ID present in a durable tombstone cannot be silently recreated; a new card
  must use a new ID.

**Policy still requiring exact approval:** whether legacy migration happens in the
server, client, or a versioned migration boundary, and whether numeric IDs may
ever be mutated in place.

### 2. Snapshot revision / conditional write

Recommended public shape:

```json
GET /chat/queue?session_id=S
{
  "revision": 17,
  "items": [ ... ],
  "tombstones": [ "opaque-id" ]
}
```

```json
POST /chat/queue
{
  "session_id": "S",
  "base_revision": 17,
  "items": [ ... ],
  "remove_ids": [ "opaque-id" ]
}
```

Successful commit result:

The approved contract must return success and the new revision, plus the
mutation-result identity/state required by the maintainer-selected A or B
mechanism. The exact field names are intentionally not frozen here.

Stale writer:

`409 Conflict`

with the authoritative current revision/snapshot available for reconciliation.

Required semantics:

- The server serializes the entire read-check-mutate-persist operation for one
  session.
- The revision check occurs before mutation.
- A stale `base_revision`performs no mutation and returns 409; a writer that
  omits the precondition after the versioned contract is active is rejected rather
  than silently falling back to last-writer-wins. Read-only compatibility may be
  negotiated separately; legacy writes must not bypass fencing.
- The successful revision is generated inside the same critical section as the
  persisted snapshot.
- A persistence error returns a non-success HTTP status and leaves the prior
  committed snapshot intact.
- The client never clears a local pending-removal intent merely because a POST
  was attempted; it clears it only after a successful commit receipt.
- If an ID appears in both `items` and `remove_ids` in one request, the server rejects
  the request before mutation; it does not invent delete-wins or item-wins precedence.
- If the response to a mutation is lost, the client resolves the UNKNOWN outcome
  by reading the authoritative snapshot/revision before retrying; it must not blindly
  reapply a mutation against an unknown revision.

The exact transport representation (`JSON` envelope versus headers such as
ETag/If-Match) remains a **policy choice**. The safety semantics above are the
required contract, not a forced wire spelling.

### Mandatory maintainer decision — lost POST response / mutation identity

Revision/CAS alone prevents a stale writer from overwriting a newer snapshot, but it
does not by itself identify whether a whole-snapshot mutation committed when its
response was lost. The maintainer must choose exactly one bounded mechanism before
QH-12 or runtime implementation can be accepted:

- **A. Durable per-session mutation receipt ledger.** Each mutation carries an opaque
  `mutation_id`; the server persists the mutation identity, committed revision and
  receipt atomically with the queue snapshot. Repeating the same mutation identity
  with the same request returns the original receipt without applying twice; reusing
  it with a different request is rejected. Receipt retention/GC is a separate explicit
  policy; after a receipt is no longer retained, recovery must fall back to authoritative
  GET + revision reconciliation rather than blind retry.

- **B. Intent/delta API.** Replace or adapt the whole-snapshot mutation with explicit
  add/remove (and any other required queue intent) operations that carry immutable
  item identity and return the resulting mutation identity/state. Lost responses are
  reconciled by the operation identity/state rather than by replaying an unknown whole
  snapshot.

**Current evidence chooses neither A nor B.** Do not silently select one, add a fixed
receipt retention count, or claim QH-12 closed until the maintainer decision is
captured.

### 3. Durable deletion

- Deletion is represented by an immutable item ID tombstone in server state.
- Applying a deletion and publishing the resulting revision is one transaction.
- GET exposes enough tombstone information for a client to avoid resurrecting a
  locally removed card.
- An older full snapshot cannot recreate an ID covered by a newer tombstone.
- A local removal intent survives reload and transport failure until a successful
  server commit acknowledges it.
- Tombstone garbage collection is **not specified** by existing evidence and must
  not be silently invented. Until an explicit compaction/retention policy exists,
  the safe first implementation should retain the tombstone state.

### 4. GET and session ownership

- Missing queue state is a valid empty snapshot with an explicit revision.
- Read/parse/transport failure is an error, not an empty array.
- WebUI hydration begins before any destination-session server write.
- A GET response is accepted only when its session/generation token still owns the
  active view.
- A failed GET leaves local queue/removal state intact and does not authorize a
  destructive server write.
- Session A state must never be persisted through a B-targeted request during
  an A→B→A transition.

No new queue live-event protocol is required for this bounded contract. Existing
live transport remains separate; GET is the authoritative queue snapshot boundary.

### 5. Same-ID and same-text conflict rules

| Case | Required result |
| --- | --- |
| Different IDs, same text | Keep both |
| Different IDs, same text + different images | Keep both, preserve each image set |
| Same opaque ID, identical payload | Idempotent/deduplicate |
| Same opaque ID, divergent payload | Reject conflict; never overwrite silently |
| Same legacy numeric ID, divergent payload | Treat as legacy collision; preserve both and migrate one to opaque ID |
| Tombstoned ID reintroduced | Reject/rekey; never resurrect silently |
| Text matches transcript row but queue ID is distinct | Do not consume by text alone |

## Acceptance matrix

The future runtime candidate must cover all of these before claiming `FORK_VERIFIED`:

| ID | Acceptance |
| --- | --- |
| QH-01 | First mount hydrates an authoritative empty queue without treating it as a failed GET. |
| QH-02 | A→B→A with overlapping GETs cannot publish an older response into the active session. |
| QH-03 | A pending local queue addition/removal is staged locally while GET is unresolved, then rebased by ID onto the authoritative snapshot before the first fenced write. |
| QH-04 | A local steer/cancel during hydration cannot write the destination session before hydration ownership is established. |
| QH-05 | Failed GET blocks destructive server writes and preserves local state for retry/reconciliation. |
| QH-06 | Server-only card with the same text but a different ID survives hydration. |
| QH-07 | Server/local cards with the same ID but divergent payload do not silently overwrite one another; legacy rekey/conflict mechanics follow the approved migration policy. |
| QH-08 | Legacy numeric ID and numeric-string/opaque-ID representations cannot cause unrelated-card deletion; exact migration mechanics are approved before implementation. |
| QH-09 | Canceled card does not reappear after reload, failed POST, or delayed stale GET. |
| QH-10 | Failed persistence never returns `success:true`. |
| QH-11 | A stale revision returns 409 and does not mutate the committed snapshot. |
| QH-12 | Two concurrent clients cannot lose either accepted change; lost-response recovery follows the maintainer-selected mutation-identity contract (A or B) rather than blind whole-snapshot retry. |
| QH-13 | Successful deletion is acknowledged only after durable commit; local removal intent is then cleared. |
| QH-14 | An old snapshot cannot resurrect an ID protected by a durable tombstone. |
| QH-15 | Approval modes `build`, `plan`, `bypass`, `accept_edits` survive GET/POST round trip. |
| QH-16 | Images, kind, text and opaque ID survive the wire round trip without local-only `clientInputId`. |
| QH-17 | Text-on-canvas filtering never consumes a distinct pending card solely because text matches. |
| QH-18 | Real two-client/browser integration exercises concurrent add/cancel, refresh and stale-write paths against the daemon. |
| QH-19 | The daemon queue persistence test uses an injected temporary queue root and isolated in-memory state; it never writes the real user home. |
| QH-20 | Exact-SHA fork CI covers the changed WebUI + daemon contracts; independent review finds no Critical/Important issue. |

## Implementation boundaries after approval

One bounded runtime milestone should:

1. add the approved queue snapshot/revision persistence model;
2. use the existing atomic-write and file-lock patterns rather than a new runtime owner;
3. add daemon route tests with isolated queue storage;
4. adapt WebUI hydration to the authoritative snapshot and receipt semantics;
5. retain the already verified UUID allocator, `serializeQueuedCard`/
   `deserializeQueuedCard`, and single-apply steer fold;
6. add deterministic concurrent/tombstone/session-switch regressions;
7. run the narrow local checks needed for reproduction, then exact-SHA fork CI;
8. perform independent source review and only then label the exact fork SHA
   `FORK_VERIFIED`.

The implementation must not bundle M05a history identity, process lifecycle,
multi-agent orchestration, scheduler changes, or unrelated cleanup/release work.

## Current disposition

**DESIGN-COMPLETE / IMPLEMENTATION BLOCKED.**

The source investigation and option analysis are complete. The recommended
contract is concrete enough to implement, but the accessible evidence does not
contain the exact maintainer-approved technical terms. The previous owner
statement that agreement exists is preserved as context; it is not converted
into an invented choice.

No production source, public API, persistence schema, dependency or lockfile was
changed by this design packet.
