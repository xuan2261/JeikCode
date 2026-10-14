# M05b / JC-14 — Native admission and queue persistence prerequisites

Date: 2026-10-14 (Asia/Ho_Chi_Minh)
Status: **DESIGN-ONLY — CONTRACT DECISION PENDING / IMPLEMENTATION BLOCKED**
Target: fork-first design checkpoint, **not** an implementation, upstream submission, release or native verification.

## 1. Outcome and authority

The next M05b integration must preserve a rejected queued prompt between the
server's acknowledged removal of its queue entry and the *separate* admission
of its replacement `/chat` request. A lost HTTP 202 is **UNKNOWN**, not a
negative acknowledgement; sending a new request ID in that state could create
a second turn.

This packet proposes the native prerequisites needed to carry the
already-reviewed WebUI M05b safety contract onto current upstream beta. It is
not approval to change native persistence, lifecycle or public interfaces:
the maintainer must settle the decisions in section 5 before implementation.

- Upstream remote `origin` = `jeikl/JeikCode`; live-fetched
  `origin/beta` = `aa95556236b1f294de029c5d5c6da6cf064ec16e`,
  `v7.2.4-beta.10`.
- Fork `xuan2261/JeikCode`; prior M05b WebUI patch
  `4029cff966925774cf11cc9ed02f9ab133d815a4`.
- Prior exact-SHA Actions run
  [38494762981](https://github.com/xuan2261/JeikCode/actions/runs/38494762981):
  four jobs SUCCESS, `Rust quality` FAILURE (ten inherited TUI tests).
  `4029cff` is **NOT FORK_VERIFIED**.
- At the upstream `aa9555623` baseline,
  [Beta native portability run 38501209186](https://github.com/jeikl/JeikCode/actions/runs/38501209186)
  completed SUCCESS, including native-library jobs on Ubuntu, macOS
  and Windows. The separate
  [CI run 38501209023](https://github.com/jeikl/JeikCode/actions/runs/38501209023)
  was SKIPPED at that same SHA, including its WebUI/Rust quality jobs.
  Neither upstream result validates a future fork integration commit.
- Upstream PR [#31](https://github.com/jeikl/JeikCode/pull/31)
  remains OPEN and points to `202e97538671e3b4f519c5f9862f9e9a116d06e2`;
  it does not include `4029cff`. The
  [fork roadmap #2](https://github.com/xuan2261/JeikCode/issues/2)
  was read live before this milestone. No issue/PR/comment was modified.
- This is a new isolated design branch rooted at the verified upstream
  beta SHA. Existing dirty worktrees, local-only beta.10 WebUI prototype and
  fork M05b candidate must remain untouched.

### Acceptance for *this* milestone

Produce an evidence-backed decision packet, cross-platform verification matrix,
explicit exclusions and independently reviewed design. No production code,
schema, tests or CI workflow is changed; source correctness and installed-app
verification remain **NOT YET VERIFIED**.

## 2. Actual beta contracts and failure chains

All line references here use exact upstream `aa9555623`.
The old fork code at `4029cff` is a **reference candidate**, not proof that
the same source can be transplanted to beta. In particular, beta's
`StopChatResult.released`, streaming identity and WebUI lifecycle must survive.

| Boundary | Beta source and observation | Broken invariant |
| --- | --- | --- |
| HTTP `/chat` reservation versus user acceptance | `crates/jeikcode-daemon/src/lib.rs:5987-6002` receives string `ChatRequest.request_id`; `:7867-7894` reserves the ActiveChat slot; `:7976-8007` spawns processing and `:8018-8027` returns HTTP 202 with `status:"admitted"` **before** the worker necessarily creates the user message. Worker config/provider/session loading can fail at `:8141-8148,8164-8221` before the user row is pushed at `:8276-8284`. | HTTP 202 proves registry reservation but does **not currently prove canonical user-message admission**. Treating it as definitive success may consume an R that was never recorded. Transport loss after reservation is additionally UNKNOWN. |
| Accepted user in snapshot | `crates/jeikcode-kernel/src/message.rs:100-138` has numeric `MessageMeta.request_id` for **LLM requests**, not the WebUI submission ID. `crates/jeikcode-daemon/src/lib.rs:8276-8304` creates the user message without storing `req.request_id`. | The initiating request identity cannot be recovered from persisted history. |
| Normal runtime reconstitutes the submitted user | Beta `crates/jeikcode-daemon/src/live_api.rs:1003-1015` removes the daemon's pre-pushed user row from the snapshot; `crates/jeikcode-coding/src/runtime.rs:1234-1244` submits only `UserInput` and `crates/jeikcode-kernel/src/agent.rs:1770-1791` creates a new, actual runtime user message. | Adding identity solely to the daemon's pre-runtime row could pass early-stop tests while the normal final persisted user row still loses the initiating ID. |
| User SSE and watch replay | `lib.rs:6050-6069` `ChatEvent::User`, `:1418-1439` replay insertion, `:1555-1580` direct replay and `:8293-8304` live event omit the client request ID. `:2481-2488` mirrors input with `client_input_id: None`. | An exact, positive admitted-user identity is missing from all ordinary watch paths. |
| Canonical history HTTP GET | `lib.rs:2736-2785` `MessageInfo`, `:2925-2938` conversion and `:4313-4343` session GET lack an originating `client_input_id`; `webui/src/api.ts:797-821` also omits it. | A refresh or long-history lookup cannot settle an UNKNOWN by text matching without risk. |
| Queue item wire | `lib.rs:9044-9055` `QueuedMessageItem` has no `client_input_id`; the queue GET/POST at `:9089-9134` round-trip only known fields. `webui/src/api.ts:408-435` also lacks an identity field and discards API errors. | The WebUI `chat-unknown:<request_id>` admission marker is dropped by a server round-trip. |
| Queue write acknowledgement | `lib.rs:9115-9134` updates memory then ignores file-write or file-remove errors and unconditionally sends `success:true`. | ACK can falsely certify a failed disk removal; retry is consumed when it can be resurrected after restart. |
| Queue GET and clear interleaving | `lib.rs:9089-9112` drops the read lock before reading the queue file, then acquires the write lock to cache that read. A concurrent clear can complete in between. | A stale GET may repopulate server memory *after* an acknowledged clear. A corrupt/unreadable file also looks like `[]`. |
| Beta WebUI queue flow | `webui/src/components/Chat.tsx:6672-6677` removes a card before fire-and-forget `deliver`; `:6686-6710` uses its shared Send Now flow. `:2558-2584` publishes local queue before best-effort server GET. | The WebUI M05b guard cannot be transferred as a standalone helper patch. |

The reviewed fork ancestry contains useful narrow examples:

- `crates/jeikcode-kernel/src/message.rs:117-119` carries an optional
  `client_input_id` sidecar; `crates/jeikcode-daemon/src/lib.rs:7398-7431`
  propagates `ChatRequest.request_id` into the user message and event.
- Fork `lib.rs:7984-7996` defines an additive queued `client_input_id`.
  `:8053-8096` writes a same-directory temporary file, then renames it,
  and commits the in-memory vector only on success; `:8207-8225` returns a
  failed HTTP receipt when persistence rejects a write.
- Fork `lib.rs:8181-8205` serializes GET fallback with queue writes. **It
  still treats malformed/unreadable existing persisted files as an empty
  queue**. Therefore its GET must not be described as fail-closed or reused
  without a deliberate error-semantics design.
- Existing fork tests at `lib.rs:8000-8012`, `:8100-8139`,
  `:8143-8171`, `:8174-8179` and `:12792-12858` are migration
  *examples*, not same-SHA beta validation.
- For the **normal runtime** identity path, fork
  `crates/jeikcode-daemon/src/live_api.rs:974-985,857-873` extracts
  `InputIdentity` from the pre-runtime message and calls
  `submit_identified`; fork
  `crates/jeikcode-coding/src/runtime.rs:1240-1282` carries that identity
  through `CodingRuntimeControl::Submit`; fork
  `crates/jeikcode-kernel/src/agent.rs:1761-1776` attaches it to
  the **actual kernel-created user message**. These are implementation
  references, not an authorization to transplant old native architecture.

## 3. Proposed minimum contract (not approved)

### N0 — Define the actual admission boundary (prerequisite to N1)

**Current finding:** beta's HTTP 202 JSON says `status:"admitted"`,
yet `ActiveChatRegistry::admit` has only reserved the session/operation
slot. The processing task starts asynchronously *after* that reservation;
`ConfigStore::read()?`, `resolve_chat_provider(...) ?`, session loading
and session assignment can fail **before** the user input is pushed and
its identity is recorded. The current WebUI `postChatPrompt`
(`webui/src/api.ts:277-310`) returns a `PromptAck` on 2xx, and even
substitutes a synthetic admitted-looking acknowledgement when 2xx JSON
cannot be parsed. Therefore a successful HTTP 202 is **not by itself**
proof that the queued payload has become a canonical user message.

Two viable contract directions require a maintainer choice:

- **Conservative/client-first (recommended for the bounded slice):**
  define HTTP 202 as `operation_reserved`, not final input acceptance.
  Keep the original retry as UNKNOWN after queue-clear until an exact
  user `client_input_id` appears in admitted-user SSE or canonical GET
  under N1. If processing fails before user admission, do **not** infer
  safe re-submission merely from a terminal error or missing history:
  a later authoritative negative receipt keyed by request ID would be
  needed for automated retry. This preserves safety but can block
  progress without manual reconciliation.
- **Server-authoritative user-admission receipt:** move or augment the
  API receipt boundary so it is sent only after the user input crosses
  an agreed persisted/observably replayable acceptance boundary;
  pre-admission config/provider errors return an authoritative negative
  outcome. This has daemon lifecycle/latency and public-contract
  implications and is **not** approved as part of this packet.

Merely changing the 202 JSON label, or relying on `ActiveChatRegistry`
occupancy, does not establish a persisted user message. Conversely,
once N1's exact positive event is observed, the client can settle that
specific request without guessing from its text. N0 needs behavioral
tests before declaring either direction accepted.

### N1 — Exact source-input identity

**Invariant:** for an accepted ordinary `/chat` user message, the same opaque
request ID submitted as `ChatRequest.request_id` must be recoverable from:
live `ChatEvent::User`, standby/watch replay, and the canonical persisted
`SessionMessage` returned via tail or full GET. Key reconciliation by both
session and exact client identity; neither the visible text, a timestamp,
`message_id`, nor numeric `MessageMeta.request_id` substitutes for it.

Recommended additive design:

1. Add `MessageMeta.client_input_id: Option<String>` with serde default and
   omit when None. Attach `req.request_id.clone()` to the originating
   real user input, never to synthetic users or model-generated messages.
2. **Preserve identity past the native runtime boundary:** the daemon's
   pre-runtime user message at `lib.rs:8276-8284` is **popped** by
   `live_api.rs:1003-1015`; beta `CodingRuntimeHandle::submit(UserInput)`
   at `coding/runtime.rs:1234-1244` and kernel's user push at
   `kernel/agent.rs:1770-1791` do not preserve that pre-runtime sidecar.
   An approved minimal identity-bearing submission path must carry the
   originating `client_input_id` and stable `message_id` across
   `live_api` → `CodingRuntime` / `DriverCommand` → kernel agent,
   and attach both to the **actual normal-run user row** when constructed.
   Reuse existing runtime ownership and worker compatibility; coordinate
   any `CodingRuntime` public-contract change. A pre-runtime/early-stop
   identity assertion alone is never a sufficient GREEN.
3. Add optional `client_input_id` to `ChatEvent::User`; carry the same
   ID through `record_user_message`, event bus, fallback replay and
   `replay_admitted_user`. Do not alter watch cursor or live event ordering.
4. Include the metadata field in `MessageInfo::from_kernel_in` and expose
   it in existing `GET /projects/:hash/sessions/:id` responses.
   Presentation/synthetic/legacy user rows lacking the ID remain optional
   `None`; no backfill from text. Add matching optional TypeScript types.
5. Keep the original `Message.id` and `user_identified` logic independent.
   Request ID identifies *which submission* was admitted; message ID
   identifies *which persisted row* it became.
6. If HTTP 202 is lost, only a positive exact `client_input_id` on a user
   event/canonical history can consume the UNKNOWN retry. An empty/failed GET
   or a textual match cannot prove a negative admission.

**Compatibility boundary:** adding a nullable optional field preserves
deserialization of older history snapshots. It does *not* make a running old
daemon able to positively reconcile unknown requests. The WebUI must fail
closed on a daemon without the identity capability rather than assuming a
matching string proves delivery.

### N2 — Existing queue item round-trip

**Invariant:** `/chat/queue` POST→GET→restart preserves the original queued
`id`, text, images, approval mode, kind, and the optional
`client_input_id` byte-for-byte in the JSON value. The original retry ID
is not replaced with a new ID after HTTP 409.

Recommended additive design:

- Extend `QueuedMessageItem` with optional
  `client_input_id: Option<String>`; support older queue files with no
  field; do not change routes or add a new mandatory wire member.
- Only `client_input_id` values with the explicit
  `chat-unknown:` namespace mark unresolved `/chat` submissions.
  Ordinary steer client IDs are not UNKNOWN chat attempts.
- On hydration merge same-ID server UNKNOWN metadata **before**
  applying exact-user-history confirmation. Gate all queue draining and
  server writes until a successful authoritative server GET is merged
  for that view generation (A→B→A included).
- In a mixed-version deployment an older client can POST a whole-vector
  queue without the new field and erase the marker. The optional-field
  extension alone **cannot guarantee cross-device safety**; deployment
  compatibility and later CAS/remove-by-ID are independent decisions.

### N3 — Honest queue file/GET receipts

**Invariant:** a queue-clear success receipt means the server has completed
the defined *file operation and in-memory state transition* with no error.
It does not mean the replacement `/chat` was accepted. A failed GET must
not be converted into an authoritative empty queue for admission decisions.

Recommended minimal in-process/OS-filesystem contract:

1. **Establish an isolated queue-root seam before ANY real handler failure
   injection or race test.** Beta `lib.rs:9078-9086`
   `session_queue_file_path` calls
   `jeikcode_config::util::real_home_dir()`, which at
   `crates/jeikcode-config/src/util.rs:26-36` does not consult
   `JEIKCODE_HOME`. The existing daemon `ScopedChatHome` at
   `lib.rs:12756-12776` only isolates the config API, not this queue
   filesystem path. The queue map at `lib.rs:9067-9075` is a
   process-global `OnceCell`. Introduce a **test-injected queue root +
   isolated per-test map**, or separately coordinate routing production
   queue storage through the existing `Config::config_dir` (including
   default-path equivalence, migration and teaches consistency).
   Prove the selected seam never uses the user's real
   `~/.jeikcode/state/queues`; do **not** launch HTTP handler tests
   against the current implementation merely by setting
   `JEIKCODE_HOME`. This design choice remains D9 PENDING.
2. Validate queue session identifiers as identifiers, not filesystem paths.
   Source `lib.rs:9078-9087` currently trims only the empty case before
   using it in a path. Scope path-boundary tests with the queue persistence
   fix; track any broader security review separately.
3. Serialize an existing session's GET disk fallback and updates with the
   queue lock so a pre-clear file snapshot cannot be reinserted after a
   successful clear. The lock covers persistence + map publish.
4. For replacement: serialize payload, write a unique temporary file in the
   same directory, replace the destination, and update memory **only after**
   the persistence operation succeeds. Never remove an existing file first
   merely to make rename succeed, since failure would lose the last good
   queue. Check Windows and POSIX behavior in actual CI.
5. For removal: missing file may be a successful *idempotent* clear, but
   permissions, directory-at-file-path, inaccessible root, write and
   malformed-file errors are not successful receipts. Failure retains
   the earlier authoritative state and yields non-2xx `success:false`
   for the strict client.
6. GET must distinguish verified absence (`200 []`) from a file that
   exists but cannot be read or decoded (`5xx`); no fallback to `[]`
   on malformed data. The legacy best-effort WebUI client may continue to
   catch errors, but the admission-critical caller must not.
7. Document the ACK strength exactly. A successful write/rename at the
   OS API level is **not** proof of persistence across a power failure.
   Rust `File::sync_all` explicitly attempts to flush filesystem data
   and metadata; define whether crash/power-loss durability is required
   before promising it.

Official Rust documentation:
`https://doc.rust-lang.org/std/fs/fn.rename.html` (rename and
platform-specific behavior) and
`https://doc.rust-lang.org/std/fs/struct.File.html#method.sync_all`
(file sync cost/strength). These documents do not establish that the
current JeikCode queue implementation is crash-safe.

### N4 — Existing WebUI integration (after N1-N3)

Retain beta's `dispatchQueuedCard`/Send Now and
`StopChatResult.released`. For a rejected original retry only, use
strict queue-clear ACK → a delivery attempt with an **N0-defined**
admission receipt → restore or exact reconciliation. Under a
reservation-only 202, the retry remains UNKNOWN until N1's exact
accepted-user proof. Prevent a second retry ID
after an explicit 409, and distinguish HTTP status/code from unreliable
error-text hints. Unknown blocks subsequent drain, Cancel, Stop-to-composer,
Steer and Send Now until exact confirmation. Keep per-session generation,
serialization, localStorage failure, stale GET and i18n protections from the
reviewed fork slice. Ordinary queue items retain beta's existing semantics
where safe; do not transplant the old WIP `Chat.tsx`.

**Live transport is a separate identity question.** Beta
`/live/message` already accepts an opaque `client_input_id`
(`crates/jeikcode-daemon/src/live_api.rs:2469-2475`) and echoes it
through in-memory live input events
(`crates/jeikcode-daemon/src/live_hub.rs:643-713`). But that is not
proof that the client ID survives in the canonical persisted user
message returned by session GET. Beta
`webui/src/components/Chat.tsx:6132-6148` also treats every failed
live HTTP response as unsent and clears `queued`. Thus N1's ordinary
`/chat` request-ID sidecar, even when implemented, **does not**
automatically solve lost `/live/message` receipts. Either include
the live runtime's actual accepted-user persistence/positive recovery
under an approved expanded N1 or explicitly exclude that path from
this bounded port, leaving a separate M05b live safety slice.

## 4. Guarantees and explicit exclusions

These are **proposed acceptance invariants**, not verified behavior:

- Queue-clear ACK and chat-admission ACK are separate receipts.
- HTTP 202 is currently a *reservation* receipt, not positive proof the
  originating user message was recorded (N0).
- Unknown client transport is not a negative admission proof.
- Exact positive identity is authoritative; missing identity fails closed.
- Authoritative queue GET happens before session queue POST or drain.
- Every queue writer follows its own session's hydration and write-order fence.
- File-operation failure cannot return `success:true`; corrupt file cannot
  return `200 []` for strict consumers.
- Concurrent GET and clear cannot revive a deleted item in daemon memory.
- No frontend, daemon or kernel changes in this **design checkpoint**.

Out of scope until separately agreed: whole-vector cross-tab/device CAS or
atomic remove-by-ID; full power-loss/host-crash durability guarantees; M05a
history revision and atomic transcript RMW; broad daemon lifecycle changes;
full `Chat.tsx` migration; changes to TUI CI gates; browser two-tab or
installed Desktop/Mobile proof; upstream PR, merge, release or installation.
Full `/live/message` lost-receipt recovery is also unverified pending
decision D7; neither its ephemeral echo nor N1's `/chat` history proof
may be counted as a canonical live acceptance receipt.

**Separate crash-window limitation:** a browser process can terminate *after*
the server has acknowledged removal of R but *before* it submits `/chat`
or persists a later UNKNOWN marker. Neither a correct queue-clear ACK nor
exact admitted-user identity makes those two HTTP requests transactional.
If no `/chat` turn was accepted, both the server queue and the browser's
persisted queue may now lack R. The reviewed WebUI receipt patch and N1-N3
do **not** prove zero-loss recovery across an arbitrary tab/process crash
in this interval. A durable server-side dispatch reservation/ledger or a
single atomic consume-and-admit protocol would require an additional
maintainer-approved lifecycle/public-contract decision; never hide that
gap behind the phrase "exactly once".

## 5. Decision register — maintainer approval required

| ID | Decision required | Recommended default / alternatives | Status |
| --- | --- | --- | --- |
| D1 | Is an optional, persisted originating `client_input_id` allowed in kernel user metadata, SSE and session GET? | **Recommend yes**, distinct from `MessageMeta.request_id: u64` and `Message.id`; no text backfill. Alternative is a separately coordinated positive admission ledger. | **PENDING** |
| D2 | May existing queue JSON carry an optional `client_input_id` with unchanged route and item `id`? | **Recommend yes** with serde default; mixed-version whole-vector writes remain a known gap, not claimed safe. | **PENDING** |
| D3 | What does queue `success:true` certify? | **Recommend completed OS file operation + memory update**, with failed reads/writes returning errors. Stronger power-loss guarantee needs a separate fsync/transaction decision. | **PENDING** |
| D4 | How must old daemons / legacy ID-less history be handled? | **Recommend server-first rollout or explicit compatibility gate**, no blind retry, no text heuristic as negative proof. Do not invent a capability endpoint without approval. | **PENDING** |
| D5 | Is whole-vector multi-client CAS included now? | **Recommend defer** as a separate public-contract milestone; disclose limitation, do not claim cross-device concurrency solved. | **PENDING** |
| D6 | Must crash/kill recovery between queue-clear ACK and the next `/chat` request be guaranteed? | **Recommend explicitly exclude** from this bounded slice unless maintainers authorize a durable server-side consume/admission transaction or dispatch ledger. Network ACK-loss while the client is alive remains the current target. | **PENDING** |
| D7 | Is lost `/live/message` admission within this native prerequisite milestone? | **Recommend separate scoped live identity/persistence slice** or extend N1 only after validating the actual live runtime persistence path. An ephemeral `InputAccepted.client_input_id` cannot substitute for persisted canonical identity. | **PENDING** |
| D8 | What authoritative event proves ordinary `/chat` input was admitted? | **Recommend treat current 202 as reservation/provisional**, retain R UNKNOWN until N1 exact user SSE/history proof. Alternative: coordinate a stronger server acceptance/negative receipt emitted at the actual user boundary. No automatic retry on absence. | **PENDING** |
| D9 | How will queue-root failure/race tests be isolated from real user state? | **Require a test-injected queue root and fresh per-test queue map** (preferred), or coordinate use of `Config::config_dir` with migration and default-path parity. `JEIKCODE_HOME` alone does not redirect current `real_home_dir()` queue persistence. | **PENDING** |

No owner, approval, deadline, ticket, upstream agreement or roadmap state
change is inferred from this packet.

## 6. TDD, QA and delivery gates

The exact proposed tests and deterministic schedules are in
[`TEST-MATRIX.md`](TEST-MATRIX.md). Add true behavioral RED assertions
against the beta implementation before editing relevant code; tests that
merely fail to compile due to a missing field are setup/schema RED, not
proof of the user-visible race.

After maintainer agreement, deliver one bounded native prerequisite at a
time from fresh upstream `beta`: focused RED → minimal GREEN → local
targeted verification → independent read-only review/fix/re-review → scoped
fork Conventional Commit and non-force push → **exact-SHA** CI. Prefer
existing CI for broad Rust/TUI and cross-platform checks. Do not weaken
gates to conceal inherited PR #31 failures.
At present `.github/workflows/portability.yml:27-59` does not execute
daemon queue tests in its Ubuntu/Windows/macOS matrix. An authorized native
implementation must add or identify a targeted **daemon queue contract**
job/step on Windows and at least one POSIX runner at the candidate SHA
before claiming cross-platform queue persistence verified. A green native
libraries/TUI matrix alone does not cover that change.

## 7. Recorded result / next step

**DESIGN-ONLY / PENDING.** No native, wire or WebUI runtime edit in this
design branch. Request maintainer decisions D1-D4/D8/D9 and explicit D6/D7 boundaries before the first
implementation slice. Keep `4029cff` and the separate beta.10 diagnostic
worktree untouched. After a decision, the first candidate should test N1
canonical admitted-user identity end-to-end without replacing the existing
runtime or replay contract.
