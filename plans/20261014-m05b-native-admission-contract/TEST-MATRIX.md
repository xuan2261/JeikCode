# M05b native admission prerequisites — targeted TDD and verification matrix

Date: 2026-10-14
Status: **PROPOSED TESTS ONLY — NOT EXECUTED ON THIS DESIGN BRANCH**
Source baseline: `jeikl/JeikCode:beta` at `aa95556236b1f294de029c5d5c6da6cf064ec16e`.

The original M05b WebUI `4029cff` has source-review GO and local helper
results, but its fork Actions run `38494762981` is **FAILURE**.
The separate beta.10 prototype was not runnable end-to-end: helper 26/26 and
API 28/28 PASS only with imported pure functions or mocked HTTP. These are
**not** native proof and must not be promoted into this matrix as GREEN.

## 1. Rules for the RED→GREEN implementation sequence

1. Read actual native and WebUI source at the freshly fetched target SHA,
   verify upstream has not already solved each contract, and preserve beta
   features introduced since `4029cff`.
2. Write a deterministic, in-scope failing assertion first. An unresolved
   symbol, missing test fixture or compilation error does not by itself
   reproduce the behavioral defect; label such failures `SCHEMA RED`.
3. **Before executing a real `/chat/queue` handler or failure-injection
   test, provide a verified isolated queue-root/map seam** and use a unique
   tempfile root. The current `session_queue_file_path` resolves via
   `jeikcode_config::util::real_home_dir()`, **not** `JEIKCODE_HOME`;
   `ScopedChatHome` alone does not isolate this directory and the
   `SESSION_QUEUES` singleton persists across tests. Either inject a
   separate queue root + map, or coordinate an approved production
   `Config::config_dir` migration with default-path parity and teaches
   updates. Never let failures or resets touch the developer's actual
   `~/.jeikcode/state/queues`. Do not run a full local Cargo workspace
   suite by default.
4. Keep existing baseline native library, TUI and WebUI CI checks unchanged.
   Verify the same exact fork commit SHA on every applicable job/matrix;
   missing, failed or skipped mandatory gates remain **NOT YET VERIFIED**.
5. Check the actual daemon HTTP boundary for return status/payload, not
   merely a helper's `Result`. Also verify the canonical GET and SSE/replay
   observations rather than relying on a mocked frontend fetch.

## 2. Admission boundary (N0) — HTTP reservation vs recorded input

| ID | Deterministic scenario | Required RED / contract choice |
| --- | --- | --- |
| N0-01 | POST `/chat` with a valid session and injected invalid provider/config. Schedule the processing failure after `ActiveChatRegistry::admit` but before the real user `Message` is pushed; record HTTP 202, emitted terminal, and canonical user history. | **Behavior RED:** current 202 can say `admitted` although no user message was recorded. GREEN requires either (A) an authoritative negative HTTP receipt before user admission, or (B) frontend treating 202 as provisional, preserving UNKNOWN R until exact N1 proof. Do not silently equate registry occupancy with user acceptance. |
| N0-02 | Queue-clear ACK succeeded; `/chat` returns 202 before the user task is scheduled; delay or cancel worker before user push. | Under reservation-only 202, R remains held UNKNOWN; neither 202 nor terminal absence proves it was delivered. This tests the *positive admission boundary*, not just lost network responses. |
| N0-03 | Real user message with exact request ID is recorded and SSE delivered, then HTTP 202 is dropped or arrives later. | Exactly that request can be settled from positive N1 identity independent of HTTP ordering. No duplicate new request ID, and no old same-text user consumes R. |
| N0-04 | 2xx with invalid or empty JSON from `postChatPrompt`, and an HTTP 409 with an exact API status/code. | Malformed 2xx is not fabricated as a proven user admission unless N0's stronger server contract explicitly guarantees it. Only explicit rejection is a negative; ambiguous receipt is UNKNOWN. |

These cases are **not executed**. Beta evidence:
`crates/jeikcode-daemon/src/lib.rs:7867-7894,7976-8027,8141-8148,8164-8221,8276-8284`;
`webui/src/api.ts:277-310`.

## 3. Identity contract (N1) — native and canonical HTTP

| ID | Lowest useful layer / deterministic scenario | Initial beta RED and required GREEN |
| --- | --- | --- |
| N1-01 | Kernel unit: serialize/deserialize a user `Message` with proposed `MessageMeta.client_input_id`, then an old serialized snapshot with the field absent. | **SCHEMA RED:** field missing on beta; after addition exact opaque ID survives, old snapshot loads as None and the visible prompt text is unmodified. |
| N1-02 | Daemon pre-runtime user-admission harness: issue `ChatRequest` with `request_id = req-R`; stop before the real runtime recreates the user row and inspect early-stop snapshot. | **Supplementary RED/GREEN only:** the pre-runtime user `Message.meta` must have req-R, but GREEN here cannot prove normal runtime persistence. This test alone must NEVER pass N1. |
| N1-02a | **Authoritative normal-runtime test:** prepare a submitted real user message with `request_id=req-R`, let `live_api::run_chat_turn_v2` extract it from pre-runtime conversation, then submit through `CodingRuntimeHandle` to kernel agent; reach a deterministic terminal persistence boundary and fetch canonical session tail/full GET. | **Behavior RED** even if N1-02 is GREEN: beta `run_chat_turn_v2` pops the pre-runtime row, `CodingRuntimeHandle::submit` carries no identity, and kernel pushes a fresh row. GREEN requires the **final kernel-created, persisted real user** to keep exactly req-R and the stable `message_id` across `InputIdentity` → CodingRuntime control → kernel user construction → canonical GET. Never accept pre-runtime-only proof or infer identity from text. |
| N1-03 | Daemon `ChatEvent::User` serialization from admitted `/chat`; JSON event must contain `client_input_id = req-R`. | **Behavior RED** on existing event JSON; GREEN adds the optional field without dropping `message_id`, `created_at`, ordering and existing SSE event type. |
| N1-04 | Deterministic live watch: attach before admission, attach after admission but before user event, and replay after user recorded. Exercise both `record_user_message` and fallback `replay_admitted_user` paths. | Current watch replay omits origin ID; GREEN requires one logical accepted-user correlation in each path, with exactly req-R despite event duplication/reorder. |
| N1-05 | Persist session with accepted user, then retrieve canonical GET `tail=48` and full history; use a long message run where matching user lies beyond the first-paint tail. | **Behavior RED:** `SessionMessage` lacks ID; GREEN preserves exact req-R in persisted user row in both positions, and missing matches never authorize automatic resend. |
| N1-06 | Legacy session/old daemon compatibility: no `client_input_id` on stored user row, synthetic/injected user row, or presentation row. | No invented ID, no match by text/time/role. A client with unknown admission remains fail-closed; older JSON clients can decode additive output. |
| N1-07 | Two accepted messages have identical text/images but distinct request IDs; one old user message matches text of a current UNKNOWN R. | Neither a text match nor a different client ID consumes R. Only the exact ID matching the same originating session settles it. |

Proposed native source locations:
`crates/jeikcode-kernel/src/message.rs:100-138`;
`crates/jeikcode-daemon/src/lib.rs:6050-6069,1418-1439,1555-1580,2736-2785,2925-2938,8276-8304,13610-13658`;
`crates/jeikcode-daemon/src/live_api.rs:1003-1015`;
`crates/jeikcode-coding/src/runtime.rs:1234-1244`;
`crates/jeikcode-kernel/src/agent.rs:1770-1791`.
Old fork identity-propagation examples:
`live_api.rs:974-985,857-873` → `coding/runtime.rs:1240-1282` →
`kernel/agent.rs:1761-1776` at `4029cff`; these are source examples
only, not production validation on the new beta.
Fork regression precedents: `lib.rs:12792-12858` at `4029cff`.

## 4. Queue item round-trip (N2)

| ID | Layer / scenario | Required RED and GREEN |
| --- | --- | --- |
| N2-01 | Serde unit: legacy queue JSON without marker and new queue JSON with `client_input_id: "chat-unknown:req-R"`, string retry ID, images, mode and kind. | **SCHEMA RED** for beta marker; GREEN round-trips all fields; old queue JSON still parses without marker. |
| N2-02 | Real daemon POST queue→GET queue→new process/load persisted queue. | GREEN retains the same original retry ID, payload and exact marker; do not accept frontend mock-only evidence. |
| N2-03 | Ordinary steer has nonempty `client_input_id`; pending rejected chat uses namespaced `chat-unknown:` marker. | GREEN never labels a normal steer as an UNKNOWN chat; no reclassification just because a string field is nonempty. |
| N2-04 | Local plain R collides by ID with server R carrying a stronger real UNKNOWN marker; local storage write failed. | GREEN merges server ID first, then checks exact admitted user identity. Reversed merge/filter must be caught as RED. |
| N2-05 | Local R absent on server after successful strict GET (clear may have ACKed before lost 202). | GREEN preserves R fail-closed; absence proves neither admission nor rejection. If server later supplies a real request marker, upgrade a local sentinel. |
| N2-06 | Mixed-version full-vector POST drops `client_input_id` from a server R. | Record as known cross-client/mixed-version limitation. Do not claim this fixed without a separately approved compare-and-swap or server preservation rule. |

## 5. Queue persistence and concurrency (N3)

| ID | Layer / scenario | Required RED and GREEN |
| --- | --- | --- |
| N3-00 | **Mandatory isolation precondition** before actual daemon queue-handler tests: inject a queue-root rooted at a verified temp directory, use a per-test queue map or safely scoped/reset table, and assert computed real path stays under that root. Test both existing default-path parity and explicit override without modifying the developer's config. | **Do not execute N3-01..N3-08 at handler level until this is true.** Beta `real_home_dir` ignores `JEIKCODE_HOME`; existing `ScopedChatHome` alone does not isolate this path. An approved `Config::config_dir` migration is a different decision, not an implicit test-only change (D9). |
| N3-01 | File fixture with regular queue file; POST replacement with a new item. | GREEN replaces the previous complete JSON value without partial content and only then updates the in-memory map; process/restart sees matching state. |
| N3-02 | Inject write failure by making the destination a directory or a controlled invalid path; POST new queue data. | **Behavior RED:** beta returns `success:true`; GREEN returns non-2xx with `success:false`, preserves old in-memory queue, and does not overwrite an old good file. |
| N3-03 | POST empty queue when persisted path is nonexistent vs a directory/error. | Missing file is idempotent success; a genuine remove failure is non-2xx and keeps old map state. Do not swallow the error. |
| N3-04 | Existing file contains unreadable or syntactically invalid JSON; GET is made with no map entry. | **Behavior RED:** beta returns `[]`; GREEN produces distinguishable non-2xx error. Only confirmed absence returns `200 []`. |
| N3-05 | Race with explicit synchronization: GET locks/checks map, pauses disk read; queue clear commits; GET resumes and tries to publish the old file. | **Behavior RED:** beta's split read/write guards can reinsert R. GREEN returns old state *before* a subsequently ordered clear, or an empty/new state *after* it, never reintroduces R into map after acknowledged deletion. No sleeps/stress loops. |
| N3-06 | Two concurrent server POSTs and GETs for the same session, with a deliberate file-write failure in one transaction. | GREEN serializes map/file visibility, gives each caller its own receipt and preserves the last successfully committed value. Does **not** claim cross-process/multi-client CAS. |
| N3-07 | Unsafe session identifiers containing path components, drive letters or separators, plus a valid opaque session key. | GREEN rejects paths outside the queue root; never perform tests in a real user configuration directory. Treat broader path-security audit separately. |
| N3-08 | Replacement/clear on Ubuntu and Windows (prefer macOS too), including existing target file, read-only paths and restart, in the **new candidate exact-SHA workflow**. | GREEN requires equivalent OS-level error reporting **from targeted daemon queue tests on those platforms**. Beta `.github/workflows/portability.yml:27-59` currently runs capabilities/coding/telemetry and TUI but not daemon queue tests; its PASS cannot certify N3. Add or identify a narrowly targeted daemon queue job/step only when authorized, and preserve existing CI gates. Temp root/isolation N3-00 remains mandatory. A successful temp-file rename is **not** proof of power-loss durability; do not assert `fsync` guarantees without a D3 decision. |

Reference points:
`crates/jeikcode-daemon/src/lib.rs:9078-9134` (beta);
`crates/jeikcode-config/src/util.rs:26-36` (production real home);
`crates/jeikcode-daemon/src/lib.rs:12756-12776` (config-only test isolation);
`crates/jeikcode-daemon/src/lib.rs:8036-8225` (old fork reference).

## 6. WebUI admission and controls after native prerequisites (N4)

| ID | Schedule | Required observation |
| --- | --- | --- |
| N4-01 | R held after HTTP 409; strict POST removing R succeeds; second `/chat` returns explicit 409. | Same original R ID/text/images/mode restored, no second retry ID, no fresh turn. |
| N4-02 | R clear ACK succeeds; server reserves `/chat` and returns 202; user acceptance occurs later or HTTP response is lost. | UNKNOWN marker keeps original R until N1 exact positive admitted-user identity; reservation-only 202 cannot consume R. No auto-resubmit; unmatched text cannot settle it. |
| N4-03 | Queue-clear GET started before ACK resolves afterward with old R. | Client tombstone prevents resurrection of that R, even after exact positive admission. |
| N4-04 | A→B→A while two strict queue GETs are outstanding. | Only current A generation may release hydration/writes. Offscreen successful A response does not unlock a replacement view. |
| N4-05 | Old localStorage plain R, server same-ID UNKNOWN R; Stop, Cancel, Send Now and Steer occur before strict GET. | No stale queue POST downgrades marker, no UNKNOWN is put into composer or submitted as a new turn. |
| N4-06 | Strict queue GET returns 503, invalid JSON or invalid item schema. | Hydration remains fail-closed, no drain/write/false clear ACK. Recovery requires later successful authoritative GET. |
| N4-07 | Already-accepted UNKNOWN R sits behind more than 48 transcript rows; project hash arrives after session ID. | Exact `client_input_id` full-history lookup resolves R only on the right session/generation; no second turn. |
| N4-08 | Native `/live/message` loses its HTTP receipt while pending optimistic steers and queue exist. | **PENDING D7 / NOT COVERED BY N1-N3.** Beta currently clears `queued` on this error. Positive SSE echo exists, but canonical persisted live request identity is not yet proven; do not claim GREEN without dedicated live persistence and recovery tests. |
| N4-09 | Multiple identical visible messages, pure-image queued R, ordinary steer with client ID. | No text/image-heuristic consumption of R or incorrect treating steer as chat admission; preserve distinct modes/images. |
| N4-10 | Terminate the browser process precisely after durable queue-clear ACK but before `/chat` starts or before a new UNKNOWN marker is persisted. | **DOCUMENTED OUT-OF-SCOPE GAP**, not a GREEN expectation for N1-N4. Recovering an unadmitted R from this window would require a separately approved server-side reservation/consume-and-admit transaction or durable dispatch ledger (decision D6). |

Use the existing fork `webui/src/lib/queuedDraft.test.ts`,
`webui/src/api.test.ts` and beta `chatTerminal`/session tests
as test designs; adapt them to beta instead of copying the entire old
`Chat.tsx`. Browser multi-tab/network failure needs its own harness and
cannot be claimed by Node mock tests.

## 7. Checkpoints and coverage, without false PASS

1. **After D8 admission-boundary approval and N1:** targeted native library tests at the patched
   daemon/kernel source; require N1-02a full normal-runtime canonical proof
   (early-stop N1-02 is insufficient). Keep daemon identity event/watcher tests,
   view projection and old-snapshot compatibility. Local Cargo may be used only
   for minimal reproduction of unpushed code; broad validation belongs in CI.
2. **After approval of N2/N3/D9:** first verify N3-00 isolated queue path/map
   without touching real home, then run targeted queue serde, error paths,
   transaction/read-vs-clear tests. Add a real HTTP boundary test because
   a passing helper test alone cannot prove ACK semantics. Explicitly ensure
   daemon queue tests run in a Windows and POSIX CI matrix at the candidate
   SHA (existing upstream portability matrix currently excludes them).
3. **After WebUI port:** focused queuedDraft/API + active and restored
   Chat safety tests, TypeScript typecheck and Vite build; verify that
   beta's existing stop/queue and streamCursor/sessionProjection tests
   still pass. Investigate any failure without loosening assertions.
4. **Independent reviews:** at least one read-only source reviewer and
   one contract/failure-mode review for native/queue behavior; rerun
   affected checks after any reviewed source change.
5. **Fork exact-SHA CI:** determine which workflow checks the new branch.
   Rust quality, TUI library contracts where applicable, WebUI quality
   and Windows/POSIX platform jobs must be associated with the **new**
   candidate SHA. Report skipped/absent/failed jobs precisely; never
   reuse `38494762981` as PASS evidence for an integrated commit.
6. **Browser and installed proof:** separate from library CI; schedule only
   with an authorized harness and actual binaries. Cross-client whole
   queue CAS and power-loss durability are not proven by this milestone.

## 8. Work not performed in this design checkpoint

No RED tests were added to production test sources, no native schema or
public API changed, no broad local builds were executed, and no new
implementation SHA or CI run exists. This is a **design acceptance packet**
for later implementation, not evidence that N0-N4 now work.
