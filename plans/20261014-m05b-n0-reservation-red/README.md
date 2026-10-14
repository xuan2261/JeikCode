# M05b / JC-14 — N0 reservation versus user-admission RED diagnostic

Date: 2026-10-14 (Asia/Ho_Chi_Minh)
State: **REPRODUCTION / PROPOSED-CONTRACT RED ONLY**.

This is a bounded, executable diagnostic for the **WebUI RPC receipt
classification**, not a correction to JeikCode and not evidence that the
daemon has accepted a user message. No daemon, kernel, public API, frontend
runtime, test suite, lockfile or CI workflow source is modified.

## Source and authority

- Base: freshly fetched `jeikl/JeikCode:beta`
  `76116587564ff376351f4cb8927cafa346f7af5c`,
  `v7.2.4-beta.11`.
- Remotes: `origin = jeikl/JeikCode`, `fork = xuan2261/JeikCode`.
- Fork-reviewed M05b WebUI-only code remains on
  `4029cff966925774cf11cc9ed02f9ab133d815a4`, exact-SHA run
  [38494762981](https://github.com/xuan2261/JeikCode/actions/runs/38494762981)
  **4/5 jobs SUCCESS / Rust quality FAILURE / NOT YET VERIFIED**.
- Previous design-only decision packet:
  [`c45715a6`](https://github.com/xuan2261/JeikCode/commit/c45715a6bd39d44a00c58da631a99bdb62b639b3),
  `plans/20261014-m05b-native-admission-contract/README.md`,
  decisions **D1–D9**. In particular D8 (what constitutes a user
  admission receipt) is **PENDING maintainer coordination**.
- GitHub PR `jeikl/JeikCode#31` remains OPEN/DIRTY and is not modified.
- This standalone diagnostic branch is rooted at **beta.11**, not the
  older fork M05b implementation.

No approved native lifecycle/public-contract change is inferred from an
executable RED test. The conservative proposed D8 policy under test is:
**HTTP 202 identifying a reserved operation is not authoritative proof
that a user message was created and durably accepted**. Only a separately
defined server acceptance receipt or a positive exact `client_input_id`
from the canonical accepted user can consume the original queued retry.

## Actual source-backed chain on beta.11

| Boundary | Source evidence | Consequence |
| --- | --- | --- |
| Registry reservation | `crates/jeikcode-daemon/src/lib.rs:7867-7895` uses `active_chats.admit(req.session_id, req.request_id)`. | Reserves an operation; not yet a persisted user turn. |
| Async worker | `lib.rs:7976-8007` spawns `process_chat_request`, with no handshake waiting for its accepted-user boundary. | The caller is not told whether the worker will finish pre-user setup. |
| RPC response | `lib.rs:8018-8027` returns HTTP 202 with `status: "admitted"`. | The word `admitted` currently describes an operation reservation. |
| Pre-user errors | `lib.rs:8141-8148` reads config and resolves provider via fallible `?` expressions; `:8164-8221` resolves/assigns the session before the user is pushed. | A worker may fail before the user exists, after 202 was already returned. |
| User-created boundary | `lib.rs:8276-8304` pushes `user_msg`, records the user in the registry, then emits `ChatEvent::User`. | This occurs in the asynchronous worker, not before the RPC 202 return. |
| WebUI RPC classification | `webui/src/api.ts:277-310` sends `Accept: application/json`, returns a 2xx JSON receipt unvalidated and fabricates `{status:'admitted',operation_id:''}` on malformed 2xx JSON. | Both an ordinary reservation-shaped 202 and a malformed 202 look like final user admission to callers. |
| True 409 control | `webui/src/api.ts:292-303` carries `status=409` and `code=session_busy` on the thrown error. | An explicit server rejection can remain distinct from UNKNOWN. |

This source chain is independently checkable, but it is **static
evidence**, not a real HTTP/instrumented daemon trace. The two related
product files are pinned by actual Git blob IDs in the verifier:
`webui/src/api.ts` = `bd0d75ef223f59d140883d756995fba103d997ca`
and `crates/jeikcode-daemon/src/lib.rs` =
`34adb5c17afc1f7dd79caec387f4d2cf268c3392`.

The upstream existing test `webui/src/api.test.ts:372-410` asserts
that a server-shaped 202 returns `admitted` with an operation ID. It
is a valid test of **current behavior**, but it does not establish the
stronger safety property in D8. This diagnostic deliberately lives
**outside** that production suite to avoid contradictory assertions.

## Files and what is executed

- `observed-api.test.mjs`: 4 PASS observations of the **actual**
  `webui/src/api.ts` module using a scoped replacement of
  `globalThis.fetch`: normal 202, malformed 202 fallback, exact
  409, and a transport-error control.
- `proposed-contract.red.mjs`: 2 **expected behavioral assertion
  failures** (ordinary reservation 202 and malformed 202 incorrectly
  appear as final `admitted`), plus 1 PASS control for exact HTTP 409.
  These are **proposed D8 acceptance requirements**, not an upstream
  approved new protocol. The `.red.mjs` suffix avoids accidental discovery
  by a repository-root `node --test` with no explicit file argument.
- `verify-expected-red.mjs`: verifies the two production source blobs,
  establishes that the checked-out `HEAD` descends from the exact
  beta.11 commit and has **no committed changes outside this diagnostic
  directory**, checks the **static source ordering** from registry
  reservation to spawned worker/HTTP 202, runs the actual API tests in
  isolated child processes and accepts ONLY the two named behavioral
  failures. It verifies both failure sections independently (each must
  be an assertion comparing actual/expected `admitted`), and explicitly
  requires the HTTP 409 control to PASS. An
  import/setup exception, unexpected failure, missing RED or changed
  source blob fails the verifier. Exit code zero means the expected
  diagnostic RED was observed, **not** that the product is fixed.

## Exact replay

From the worktree root on Node 22:

```powershell
node --test plans/20261014-m05b-n0-reservation-red/observed-api.test.mjs
node --test plans/20261014-m05b-n0-reservation-red/proposed-contract.red.mjs
node plans/20261014-m05b-n0-reservation-red/verify-expected-red.mjs
```

The first invocation is expected to exit 0 with **4/4 PASS**. The
second is intentionally expected to exit 1 with **2 RED assertion
failures / 1 PASS control**. The third accepts precisely that
combination and exits 0 when it reproduces the current WebUI gap.

Observed during authoring on Node `v22.22.0`, Windows:

```text
OBSERVED_API=4/4 PASS
EXPECTED_CONTRACT_RED=2 ASSERTION FAILURES, 1 CONTROL PASS
SOURCE_PROVENANCE=BETA11_BASE_ANCESTRY_AND_DIAGNOSTIC_ONLY_COMMITS
NATIVE_ORDER=STATIC_SOURCE_GUARD_PASS; NOT A DAEMON TEST
VERDICT=REPRODUCED_WEBUI_API_GAP_ONLY; NATIVE_N0_NOT_EXECUTED
```

The first harness edit exposed a **test-setup mistake**: `apiFetch`
supplies a `Headers` instance, so direct
`init.headers.Accept` was undefined. The test was corrected to
read `Headers.get('Accept')` and rerun. That setup failure is
**not counted as contract RED**. The two final failures come from
`assert.notEqual(..., 'admitted')`, not missing imports, mocks,
syntax errors or dependencies.

## Safety and verification boundaries

- The tests do **not** start a server, connect to a network, invoke a
  real provider, read/write production sessions, modify
  `JEIKCODE_HOME`, or touch the user's real home. Only
  `globalThis.fetch` is replaced and restored inside the child
  test process; the URL token is a local fake.
- Native 202-before-user order is based on current source and a
  deliberately labeled **static guard**. The tests do **not** execute
  a real Rust `chat_stream`, wait for `process_chat_request`, or
  establish its real scheduling, SSE, journal or persistence behavior.
- The tests do **not** fix WebUI, queue-clear durability, retry loss,
  server identity propagation, `/live/message` lost ACK, process-crash
  gaps, multi-tab/cross-device last-writer-wins, or CAS.
- On any future source update the pinned-source verifier must be
  **re-scouted and adjusted based on actual behavior**, not made green
  by accepting different failures. The verifier permits a docs-only
  diagnostic commit on top of the pinned beta.11 `HEAD`; it rejects
  commits containing any other changed path or a different merge-base,
  so the post-commit diagnostic remains runnable without misattributing
  an unrelated later source change to beta.11.
- Checkout-created CRLF changes to
  `extensions/jetbrains/gradlew.bat` were present immediately after
  the isolated worktree was created. They are unrelated and are not
  to be staged, formatted or cleaned as part of this diagnostic.
- No normal product test/assertion or CI gate should be weakened to
  make this intentionally RED diagnostic pass.

## Result and next authorized step

**N0 WebUI receipt-classification reproduction complete** once the
test commands and independent review confirm the above on the exact
source. **N0 native admission fix remains DESIGN-ONLY/BLOCKED**.
Before changing `chat_stream`, `CodingRuntime`, kernel metadata,
public ACK semantics or queue persistence, the maintainer must decide
**D8** (202 reservation vs authoritative user-acceptance receipt),
and the related **D1/D2/D3/D4/D9** contract/isolation boundaries.

If D8 selects provisional 202, the next implementation slice should
first add a positive exact accepted-user identity on the *actual*
normal-runtime persisted user message and test it through SSE and
canonical GET (the old fork's pre-runtime-only identity is not
sufficient). Then port the WebUI queue safety onto beta with typed
UNKNOWN semantics and appropriate targeted Windows/POSIX native CI.
No upstream PR, merge, release, install, queue CAS or lifecycle
redesign is authorized by this diagnostic.
