# M05a / JC-14 — History mutation identity: design decision packet

**Date:** 2026-10-10

**Status:** DESIGN-ONLY / MAINTAINER CONTRACT DECISION REQUIRED. **Not a production fix.**

**Source:** `jeikl/JeikCode:beta`, `8f7d49d9efdb596cd1c74b2acf546ed0386d8722` (`v7.2.1-beta.8`).

**Tracker:** https://github.com/xuan2261/JeikCode/issues/2
**Related upstream feature:** https://github.com/jeikl/JeikCode/issues/27

## 1. Outcome, boundaries and acceptance

The user must be able to edit, delete, truncate or regenerate the **exact
persisted message** selected in WebUI, or receive an explicit, non-destructive
conflict. A presentation-only row must never acquire authority to mutate
provider/runtime history. Duplicate text, tool folding, pagination, display
truncation, synthetic rows and concurrent edits must not redirect a mutation.

This slice **only** measures the current failure and proposes an implementable
contract. It does not implement it, alter the public wire schema, rewrite a
snapshot, disable production controls, or modify an upstream repository.
Main-agent execution and storage ownership remain unchanged.

Acceptance for a future *implementation*, not a claim about this packet:

1. Every mutable displayed message has an authoritative, uniquely resolvable
   **canonical persisted** source identity; presentation-only, uncommitted
   inflight or indeterminate rows do not.
2. Mutating endpoints check exact project/session, identity, role, revision and
   allowed action **before any side effect** — including stopping/cancelling
   the active turn, changing a snapshot/sidecar or optimistically altering UI.
3. Stale, ambiguous, missing, duplicate or invalid identifiers return a stable
   conflict/precondition failure; no reverse substring search or fallback to a
   different row is allowed.
4. Read and compare happen under one owner/transaction boundary. A concurrent
   rewrite/truncate/presentation update may invalidate the view but cannot
   redirect an authorized mutation to a different message.
5. The front end never submits an array display index as if it were a
   persisted position; optimistic updates only occur after a verified server
   acknowledgement for the same source identity.
6. Existing raw-index API clients have an explicitly reviewed transition path.
   A serialized contract change is **not** inferred from this document.

## 2. Root cause — verified source chain

| Boundary | Observed beta.8 behavior | Consequence |
| --- | --- | --- |
| Kernel persisted snapshot | `crates/jeikcode-kernel/src/message.rs:148-235` stores a `Message` with role, text, tool data and optional execution metadata, but **no universal immutable message ID**. `SessionSnapshot` has a `cache_epoch` (`:1327-1347`), not an HTTP precondition contract. | Raw array position and provider tool IDs are not durable identity. |
| GET projection | `crates/jeikcode-daemon/src/lib.rs:3545-3569` uses `merge_catalog_session_messages_for_display`; `:3746-3755` filters cold-summary/reminder rows and `:3756-3835` inserts presentation entries. `SessionDetail.messages` exposes no per-row source reference (`:525-545`). | API `offset` and `message_count` count *display* rows, not arbitrary indices of `snapshot.messages`. A presentation row has no raw equivalent. |
| Native AfterTurn anchors | `crates/jeikcode-capabilities/src/session/manager.rs:630-641` defines `TurnStat.after_message` in native-snapshot coordinates when `position_valid`. `lib.rs:3756-3770` resolves that coordinate, but `:3807-3839` applies it to a **filtered** runtime array, appending unmatched anchors last. | An inserted AfterTurn row can shift unexpectedly if hidden rows preceded its native anchor; a fixture using post-filter `after_visible` would not model actual ordering. |
| Inflight-only display overlay | `crates/jeikcode-daemon/src/legacy_convert.rs:1259-1263` overlays `SessionManager::overlay_inflight_for_display` (`manager.rs:1381-1395`) when a prefix-extending checkpoint exists, **without updating the canonical stored snapshot**. | A visible message may exist only in inflight display state. Do not issue destructive authority or canonical mutation identity for that row. Revisions for writes must bind to the canonical store. |
| Live snapshot projection | `crates/jeikcode-daemon/src/live_api.rs:1454-1471,2101-2116,2216-2239` sends `LiveWireEvent::Snapshot { messages: Vec<MessageInfo>, ... }` without per-row origin or history revision. `webui/src/components/Chat.tsx:3310-3312` reconstructs the canvas directly from these events, including an idle reconnect. | A new identity contract scoped **only to GET** would leave live-derived history without authoritative mutation identity. A live snapshot must supply validated canonical authority or trigger a fresh GET before exposing destructive actions. |
| Content projection | `cap_display_field` (`:512-523`) caps content at 24 KiB and adds a display-only marker; `MessageInfo::from_kernel_in` (`:2175-2196`) also transforms user content. | `expected_text` is not a byte-for-byte persisted identity, particularly for long or wrapped/image text. |
| WebUI projection | `webui/src/components/Chat.tsx:3146-3164` assigns **user** `sourceIndex = sourceOffset + rawIndex`, where `rawIndex` enumerates the API display array. Assistant history rows at `:3207-3212` have no sourceIndex; tool result rows at `:3213-3247` fold into assistant cards. | User indices can be display indices; assistant delete falls back to `origIdx` after folding at `:7887-7888`. Neither is a reliable persisted coordinate. |
| WebUI-only filters | `webui/src/lib/historyMessages.ts:17-20,71-75` excludes synthetic/internal user rows and `verify_cadence` assistant rows without tool calls. These can remain present in API display. | Even with no tool result rows, an assistant's post-filter `origIdx` may target a hidden assistant/user in persisted history. |
| Existing mutation resolver | The **unmodified** `lib.rs:4499+` resolver scans raw messages backwards by `expected_text`, then falls back to the requested index. PATCH/DELETE/TRUNCATE call it without an expected role (`:4585-4590`, `:4702-4707`, `:4826-4831`). | Duplicate/substrings can select a later row; a wrong index or empty text can mutate a different role's raw row. |
| Premature mutation side effects | The existing PATCH route at `lib.rs:4543-4550` calls `stop_and_wait` and `cancel_via_registry` **before** loading the target and checking its identity; DELETE/TRUNCATE have analogous pre-check interruption paths. | A stale/forged history-mutation request can disrupt a currently active turn even if the final target resolution rejects the operation. Future fail-closed authorization must precede any interruption. |
| Persistence | `NativeSessionManager::load_snapshot` is independent of `save_snapshot`; `save_snapshot` serializes then acquires a metadata lock for the atomic file write (`manager.rs:1530-1545`). | Atomic file replacement does **not by itself** prove atomic compare-and-swap across the earlier read, target resolution and write. |

**Previous attempted fix is blocked.** The other local worktree
`fix/m05-history-target-index-20261010` holds uncommitted, staged diff
`2804cb3acb1ecd13c488a399d1eebd3bc8e222ea`. Its raw-index-first
resolver passed four local targeted tests, but separate source reviewers
identified three Important gaps: folded assistant rows, filtered/inserted
display rows, and truncated content. Keep that candidate unchanged and
unpublished. The old plan's assertion that all WebUI `sourceIndex` values
were already absolute persisted offsets is disproven by the code above.

## 3. Reproducible, non-destructive diagnostic fixtures

Run on the **design branch descended from beta.8, with unchanged daemon and
WebUI runtime files**, with Node 22:

```powershell
node --test plans/20261010-m05-history-identity-contract/projection-fixtures.test.mjs
```

`fixtures.json` models raw snapshot rows, cold/reminder filtering, native
`AfterTurn` anchors, inflight-only display overlays, presentation entries,
WebUI internal-message filtering (using the real pure `historyMessages.ts`
helpers), tool-result folding, content capping and selected UI actions.
Hidden cold summaries carry the actual
`internal_origin="jeikcode.legacy_cold_summary"`; reminders use the
`<system-reminder>` prefix defined by `reminder.rs:27-36`. The model
deliberately has **no** invented `hidden:true` server behavior.
The test checks the model against source signatures, verifies that
the upstream SHA is an ancestor of HEAD and that daemon/WebUI Git blob
identities (after standard Windows line-ending clean filters) equal the exact
upstream revision. The `raw_key` oracle and `index_first_target`
are **test-only**, not existing API fields. It does **not** model the complete
vision annotation/image sidecar restoration, todo state, legacy imported
session decoder or real HTTP route. A passing diagnostic asserts the
presence of an unsafe or blocked behavior; it is **not** proof that the
production mutators are repaired, nor an end-to-end HTTP or browser test.

| Diagnostic case | Unmodified beta resolver | Blocked raw-index-first candidate |
| --- | --- | --- |
| Assistant after folded tool result | Wrong: selects preceding raw user | Wrong: same raw user |
| Repeated user text (`continue`) | Wrong: selects last matching turn | Correct by coincidence |
| Later empty tool-result text | Wrong: an empty raw string matches any non-empty expected string as a substring | Correct only with known raw index |
| Presentation-only user row | Wrong: selects real raw user | Rejects this example |
| Presentation shifts a real user | Text match happens to find right row | Rejects valid selection |
| Cold-summary row filtered out | Text match happens to find right row | Rejects valid selection |
| Over-24-KiB displayed user text | Index fallback happens to work | Rejects valid selection |
| Image-only messages after presentation | Wrong: selects another raw user | Wrong: same raw user |
| Hidden reminder before assistant | Wrong: selects internal reminder | Wrong: same reminder |
| Presentation-only assistant after turn | Wrong: selects raw user | Wrong: same raw user |
| Tail pagination after inserted presentation | Wrong: substring match selects a later **assistant** (`second reply`) for user text `second` | **Also wrong:** index lands on that assistant, and permissive substring checking accepts it |
| Native AfterTurn anchor after a filtered reminder | Wrong: presentation can occupy the snapshot-coordinate slot of a different visible row | Wrong: assistant/display index can select a persisted user |
| `verify_cadence` assistant omitted only by WebUI | Wrong: selected real assistant deletes an internal assistant | Wrong: same internal assistant |
| Synthetic user row omitted only by WebUI | Wrong: selected assistant can target hidden user | Wrong: same hidden user |
| Inflight-only user row with repeated content | Wrong: current displayed inflight user resolves to an **older canonical user** | Rejects this example; inflight row still lacks durable authority |

These are **counterexamples**, not a comprehensive runtime replay. A future
acceptance test must exercise real `CatalogSessionView`, `SessionSnapshot`,
`PresentationFile`, GET page/window responses and HTTP PATCH/DELETE/TRUNCATE
with an isolated `JEIKCODE_HOME`.

## 4. Contract alternatives

| Option | Core mechanism | Advantage | First failure / cost |
| --- | --- | --- | --- |
| **A. Existing-shape dual-coordinate heuristic** | Infer a raw index from `display_index` plus an internal server projection; compare text and reject ambiguous matches. | No new API fields; low code churn. | Empty/image-only, duplicate text, filtered/inserted rows and concurrent views can be ambiguous. An index can be accepted only when authoritative mapping, not text heuristics, proves it. Does **not** establish stable persisted identity. |
| **B. Persisted message ID + explicit origin + revision** (**recommended target**) | Persist a unique stable ID for each canonical message, expose an optional source reference on GET rows and a strong revision validator, and require both for destructive mutations. | Correct under duplicate text, folded tools, paging and transformed display; can reject presentation/inflight and stale edits deterministically. | Requires maintainer coordination on kernel/session schema, migration, ownership, API and atomic updates. A future persisted-ID schema **must reject old writers** (snapshot version increase or protected separate authority), otherwise old beta binaries silently drop unknown ID fields on rewrite. |
| **C. Snapshot-bound authenticated source token** | Bind project bucket, session, canonical source, revision **and permitted action** in a MAC/signed token or random server-side nonce mapping; reject any alteration/expiry/replay or invalid authority. | Avoids retrofitting IDs into every stored message; potentially cheaper transitional contract. | Token changes across revisions, so it is not a durable message ID; use exact canonical projection, transaction checks and key/nonce lifecycle. Merely base64-encoding raw index is not authorization. |

**Better near-term safety mitigation:** hide or disable destructive actions
whose origin cannot be proven, including assistant history rows that lack
`sourceIndex` and any presentation-only/ambiguous row, until the reviewed
contract lands. This is a **separate UI-only scope** for product approval
because it deliberately reduces functionality; it cannot repair existing raw
API callers or eliminate backend reverse-text mutations.

**Recommended direction:** B for the full JC-14 target; keep C as a possible
compatible transitional mechanism only if the maintainer rejects persisted
ID migration. A by itself is not a sufficient identity guarantee. No option
is accepted merely by creating this packet.

## 5. Proposed wire and mutation semantics — **not implemented**

Illustrative *additive* fields, subject to maintainer approval:

```json
{
  "history_revision": "opaque-strong-revision",
  "messages": [
    {"role": "user", "content": "hello", "source": {"kind": "persisted", "message_id": "opaque-id"}},
    {"role": "assistant", "content": "presentation-only", "source": {"kind": "presentation"}},
    {"role": "assistant", "content": "uncommitted display", "source": {"kind": "inflight"}}
  ]
}
```

- A WebUI action uses `message_id` and a strong revision/precondition
  (`If-Match` is one standards-based option), rather than `origIdx`,
  displayed text, `turn_ordinal` or the provider's `call_id`. Existing
  `expected_message_id` and `target_message_id` request fields are already
  declared in `api.ts:915-979` but **not backed by persisted universal IDs**
  or checked by today's mutation resolver; they cannot be assumed functional.
- **Two supported view sources need one policy:** catalog GET returns the
  canonical/presentation/inflight origin model above; `/live` snapshots
  currently return the old `Vec<MessageInfo>` without any source or revision.
  Before enabling edit/delete/regenerate on a live-derived canvas, either
  carry the same versioned source/revision in `LiveWireEvent::Snapshot`
  (public live-wire change, maintainer approval required), **or** mark the
  snapshot non-authoritative for mutation and fetch a fresh canonical GET
  identity/revision before rendering/enabling those actions. An active live
  snapshot's inflight-only rows never get canonical mutation authority.
- The server resolves the bound session + origin under one exclusive
  read/compare/write operation, checks revision, unique ID, expected role and
  mutability, and either commits exactly the selected row or returns a stable
  conflict. The raw index is an implementation detail, never an authoritative
  identity. A presentation-only or inflight-only selection never writes a
  canonical snapshot, and never receives a usable mutation token.
- Consider `412 Precondition Failed` for stale strong validators and `409
  Conflict` for an invalid/ambiguous target. A `404` may mean the session is
  absent. Do not return `200 {success:true,notFound:true}` for a dangerous
  conflict without deliberate compatibility handling in WebUI.
- `cache_epoch` may aid implementation but cannot be used as the *sole*
  revision validator until all relevant snapshot, presentation and importer
  writes are shown to increment/serialize it under the same owner. Existing
  `save_snapshot` locking covers an individual write, not a proven
  transactional read/compare/write.
- Provider-facing model message content and prompt-cache bytes must remain
  unchanged. IDs should be opaque, not content-derived; synthetic/internal
  rows must have an explicit action policy. Existing legacy snapshots need
  deterministic, reviewed fail-closed migration/recovery rather than
  silently guessing IDs from text or position.
- **Old-writer fence is mandatory.** Current `SNAPSHOT_VERSION = 1`
  (`message.rs:1311-1316`); an old binary's `serde_json` decoder
  (`manager.rs:3906-3936`) may discard an added ID field and rewrite the
  snapshot without it. A new ID authority must either require a snapshot
  version bump that old writers reject (`validate_snapshot` already rejects
  future versions at `manager.rs:3843-3849`) or live in a separately versioned,
  protected authority that cannot be invalidated by old writers. Cross-version
  downgrade behavior is a compatibility decision, not an implicit safe default.
- **Opaque tokens must be authenticated.** Option C must either use a
  server-side random nonce stored with its project/session/canonical row/
  revision/purpose binding, or a MAC/signature covering these facts. All
  bit-flip, cross-project, cross-session, cross-action, expiry and replay
  attempts must be rejected. Token bytes must not reveal a naked mutable index.

RFC 9110 documents conditional requests / `If-Match` for preventing
lost updates: https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match .
RFC 6902 illustrates an atomic `test` precondition before a mutation:
https://www.rfc-editor.org/rfc/rfc6902.html#section-4.6 . These are design
references, **not** claims that JeikCode currently implements either format.

## 6. Acceptance matrix for the implementation milestone

All tests must run with private test sessions under an isolated
`JEIKCODE_HOME`, no mutation of the user's normal session store.

| Gate | Fixture/assertion | Expected behavior |
| --- | --- | --- |
| T01 | Duplicate and substring user text, same text in multiple roles | Mutate only exact ID, never reverse-search fallback |
| T02 | Assistant + multiple tool calls/results folded into one card | Assistant delete targets its source, not user/tool rows |
| T03 | Cold-summary and reminder rows hidden from API | Raw source resolution survives display filters |
| T04 | AtStart and AfterTurn presentation-only user/assistant rows | No persisted source ID or destructive action |
| T05 | Full history, tail window and pagination offset | Source identity invariant under visible window |
| T06 | 24-KiB cap, Unicode boundary, wrapped/vision user message | Display-only transformations do not change source identity |
| T07 | Image-only or tool-only, empty text, repeated attachments | No text-only fallback; mutable raw requires valid source |
| T08 | Stop/reconnect/reload, fresh/legacy/native imported session; old writer opens new snapshot | ID persists across normal restarts, **downgrade either rejects schema or preserves a separately protected authority**; no silent ID erase |
| T09 | Two clients mutate same session, stale revision | Exactly one accepted; loser conflicts; bytes unchanged on loser |
| T10 | Concurrent truncate and edit/delete, turn and message modes | No stale offset retargeting or provider-history corruption |
| T11 | Wrong project/session, forged/duplicate/stale ID; token bit flip, field tampering, cross-action replay | Reject before writing; authenticated purpose/project/session/row/revision binding |
| T12 | Failed save, crash/recovery, updated cache_epoch, inflight and presentation | Snapshot, sidecars and display remain consistent; inflight-only rows never carry canonical mutation capability |
| T13 | Old index-only API client and new identity-aware client; old binary writes upgraded snapshot | Maintainer-approved compatibility/deprecation and fail-closed mixed-writer version policy |
| T14 | Browser confirmation/cancel, 404/409/412, stale optimistic UI | No optimistic remove/regeneration after conflict; helpful message |
| T15 | GET during parked approval or active inflight append; mutation before authoritative commit | Visible inflight-only source remains non-mutable; canonical revision and owner checked transactionally |
| T16 | Idle existing session reconnects through `/live` snapshot, then assistant delete/regenerate | Either live wire carries the same authoritative canonical source/revision or controls remain disabled until a fresh, identity-bearing GET; no canvas `origIdx` fallback |
| T17 | Active/parked `/live` snapshot includes canonical plus uncommitted inflight rows, then mutation | Live and GET agree on canonical authorization boundary; inflight rows cannot be mutated or issued a stale token; after terminal, revision refresh is required |
| T18 | Invalid/stale/missing source ID or revision is submitted while a live turn is running | Precondition rejection has **no side effects**, including no stop/cancel of active runtime, no writes, no optimistic UI update or queued-input loss |

Run targeted unit/property tests, real-session integration tests,
WebUI component/browser smoke, Windows+Linux CI, and packaged app checks as
separate evidence classes. A passing pure-projection fixture is **not**
an HTTP acceptance test.

## 7. Maintainer decision required before implementation

The following are the narrow questions to resolve with the maintainer.
No upstream issue comment or PR is posted by this fork-only design work.

1. **Identity owner and old-writer fence:** Should the native/kernel
   `Message` persist an opaque `message_id` with explicit legacy migration
   **and SNAPSHOT_VERSION upgrade/downgrade rejection**, or should a
   separately versioned protected authority / authenticated snapshot-bound
   `source_token` be the smaller first public contract?
2. **Projection/public compatibility across GET and live:** Can `SessionDetail.messages` add
   a typed `source` reference for canonical persisted, presentation-only
   **and inflight-only** rows, and a strong `history_revision`/ETag derived
   from the canonical owner? For `/live` snapshots, should the native wire
   add the same authority (with versioning), **or** should every live-derived
   history action require a fresh canonical GET before enabling mutation?
   What precisely happens to existing raw-index-only HTTP clients and old
   binary writers during rollout?
3. **Atomic mutation/ownership:** Which native session manager entry point
   owns one exclusive load–check–mutate–save transaction across snapshot and
   presentation, and what is the approved fail-closed legacy policy?
   In particular, how are validity checks performed **before** any
   stop/cancel of an active runtime, without introducing a time-of-check
   versus time-of-use race?

**Recommended next authorized slice after resolution:** implement one
read-only canonical source-identity/projection mapping with real catalog
fixtures **and an explicit live-snapshot authority policy**, in an isolated
new fork branch. Only after GET and live consumers agree on the contract,
implement the revision-guarded mutation path with an atomic owner. Independent
reviewers should verify the exact chosen contract
and historical corruption regressions before a fork push. No automatic
upstream submission, merge, release, install or activation.

## 8. Evidence status

- **Observed:** upstream `beta.8` source signatures; existing M05a staged
  patch and independent blockers, without touching them.
- **Design-model tested:** `node --test .../projection-fixtures.test.mjs` —
  21 source-pinned diagnostic assertions on Windows/Node 22; an initial
  expectation was falsified twice: a later assistant `second reply`
  substring-matched the requested user `second` in **both** the beta
  reverse-text resolver and the blocked raw-index-first candidate. The
  fixture records the cross-role mis-target rather than weakening either
  production or test logic.
- **Not yet verified:** native HTTP responses using actual legacy/imported
  fixture sessions, persisted-ID migration, atomic concurrency, Chrome/Desktop/
  Mobile/TUI interactions, Linux CI for any future runtime implementation.
- **Contract:** **UNAPPROVED**. Design-only completion does not complete JC-14.
