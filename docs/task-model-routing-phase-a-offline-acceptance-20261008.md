# Phase A focused offline acceptance — 2026-10-08

## Disposition and ownership

Added **7 executable mock tests**, not schema-only substitutes. Genuine TaskTool dispatch builds and runs kernel child Agents; providers are in-memory fakes and factories record their real construction inputs. No live AI, HTTP, host activation, installation, branch change, configuration/default edit, retry-policy change, or D-drive operation. NOT_ACTIVE. This is **not complete matrix acceptance**: remaining limits are explicit below.

Read host AGENTS.md, full host closure and source-review reports, coordinator AGENTS.md/CLAUDE.md and the complete routing plan/prior execution report. The closure file is in C:/Work/JeikCode/docs, not the coordinator docs directory.

Own edits only:
- capabilities/src/tools/task.rs: test module declarations only.
- capabilities/src/tools/task_offline_acceptance.rs: 4 tests and mock helpers.
- capabilities/src/tools/task_offline_scope.rs: 1 test with actual write tool and child lifecycle.
- coding/src/provider_factory.rs: test module declaration and test fixture visibility only.
- coding/src/provider_factory_offline_acceptance.rs: 2 tests with recording/blocking factories.
- this report (paths above relative to crates/jeikcode-*).

Existing dirty work preserved. Concurrent edit.rs/repair.rs modifications appeared during this continuation; not touched or reverted. No routing implementation bug was established by these tests, so no production behavior changed.

## New tests, actual assertions, plan correspondence

1. `per_task_model_open_midstream_and_429_receipts_are_local_not_remote` (criteria 10, 12–14): three real child runs: nonretryable open failure, partial text then stream error, persistent 429 with Retry-After 0. All fail. Exactly one local call for open/midstream and six calls for 429, matching existing kernel `MAX_RATE_LIMIT_WAITS = 5` plus final open. Each final receipt is parsed JSON: exactly one, requested account/profile, provider account, resolved/effective API api, provider_called, remote identity null. Exactly two progress receipts: admission effective null and completion effective api. Secret endpoint diagnostics absent from final and collected progress. No alternate factory can run (legacy closures panic).
2. `per_task_model_same_provider_retry_keeps_binding_and_policy` (10, 12): retryable non-429 opening failure followed by success, real unchanged 3-second kernel backoff. Exactly two calls to same captured provider; no legacy selection. Parsed sole final receipt retains api and null remote identity despite model text claiming another model. Does not exercise HTTP adapter retries.
3. `per_task_model_cancel_during_stream_retains_attempted_binding` (13): pending stream signals actual provider entry, parent cancellation follows; bounded join completes Cancelled/error, exactly one call; parsed receipt retains requested and attempted effective api, remote identity null. Complements existing pre-request cancellation test.
4. `explicit_model_id_null_and_nonstrings_reject_mixed_batch_before_resolution` (2, 8): mixed valid task plus null, numeric, boolean, object or array ID rejects whole batch before resolver/provider construction (panic guards). No provider_called output. This documents current malformed-type batch contract rather than inventing per-child isolation.
5. `per_task_model_worker_scope_and_explore_mount_enforced_in_child_loop` (5, 15): mock emits actual write_file tool call outside declared allowed.txt scope. Actual registered WriteFileTool mounted for worker; middleware prevents outside.txt creation. Explore receives no write_file definition, and fabricated call cannot create file. Both retain local attempted route and remote unknown. This does not claim bash scope confinement or inherited human approval.
6. `per_task_model_running_and_queued_bindings_survive_refresh_and_session_change` (6–7, 11–12): actual TaskTool max_concurrent=1 dispatch resolves both providers before queue wait; first blocks inside provider stream. In-memory catalog/API/auth refresh and session change while running; release first then queued second. Exactly two calls, both old gemini-api; both final receipts old effective model and null remote. Both factory inputs retain old auth/session; subsequent resolution obtains new-api/new auth/new session. Parent model/key/protocol unchanged. No installed config reload occurs.
7. `explicit_model_id_empty_api_and_factory_auth_failure_are_safe` (9, 14): empty/whitespace API model rejected before recording factory construction; simulated authentication failure at production factory seam returns generic safe construction error without secret diagnostic. No actual authentication or HTTP.

## Existing tests re-executed, not replaced

Existing barrier-based `per_task_model_concurrent_routes_override_difficulty_and_isolate_failures` proves two different models simultaneously enter provider calls and invalid neighbor isolation. Existing `per_task_model_registry_to_fake_runner_receipts_and_parent_invariance` exercises actual registry-to-child execution with Gemini/GPT account/protocol/auth separation and parent invariance. Existing `per_task_model_binds_cross_provider_and_survives_refresh` asserts context 32000, output 1234, endpoint/auth/protocol and retained provider. These collectively address criteria 3–8, 11–12, 16; concurrency and parent invariance are complementary tests, not a new single integrated two-account concurrency test.

Existing schema/parser optional-field and omitted difficulty tests cover 1 and 4. Explicit invalid/unknown, absent resolver, mismatched binding and invalid-registry tests reject before mount/build and cover 2, 8–9, 16. Existing worker scope and sensitive-path tests remain intact. No blanket no-fallback claim: **explicit route does not select legacy/inherited alternatives; omitted ID retains existing legacy fallback. Same-provider retries remain unchanged.** API-model receipt is attempted local adapter identity, never remotely served proof.

## Final combined verification after all code edits

Cwd C:/Work/JeikCode; executable C:/Users/Z10PAD8C_Xuan2261/.cargo/bin/cargo.exe. All commands offline, exit 0:

```text
cargo.exe test --offline -p jeikcode-capabilities -p jeikcode-coding --lib per_task_model
  capabilities 11 passed; coding 3 passed
cargo.exe test --offline -p jeikcode-capabilities -p jeikcode-coding --lib explicit_model_id
  capabilities 4 passed; coding 2 passed
cargo.exe test --offline -p jeikcode-capabilities --lib tools::task::
  38 passed
cargo.exe test --offline -p jeikcode-coding --lib provider_factory::
  7 passed
git diff --check
  exit 0 (existing CRLF advisories)
```

**20 unique focused routing tests**, including 7 new; **45 task/factory regression tests** (overlap focused counts, do not sum as unique). Zero failures/ignored in final runs. Logs: target/task-routing-acceptance-final-{routing,explicit,task,factory}.log. Compilation warnings in existing code left untouched. Intermediate failures: mistaken expected 429 count 13 corrected to source-derived 6 after reading actual constant; mock Arc registration compile error corrected by registering before wrapping Arc. Neither retries nor production assertions were weakened or disabled. Tests compile both touched crates; no whole-worktree formatter or broad workspace rebuild in this continuation.

## Remaining evidence limits / not claimed complete

- No native CLI/TUI/parts startup integration test, catalog-absent/disabled startup/schema publication, or activated dispatcher check. Central TaskTool mock execution is genuine but not native frontend startup evidence. This is unimplemented coverage, not an unavailable Cargo runner excuse.
- Refresh test uses successful in-memory refresh; failed runtime reassembly/rollback, generation race stress and broader session transitions not tested. Same-model queued/running refresh and two-model concurrency are separate tests.
- No parent plan/approval mode transition while queued or inherited policy change test. Worker scope and explore mount enforcement tested; children still use existing AllowAll and shared policy, not frozen parent approval.
- Missing endpoint branch not individually tested (provider presets can supply endpoints); provider-build/auth failure and empty API branches covered. Missing tool capability provider negotiation/permission permutations not certified.
- No actual adapter/HTTP 429 or transport retry counts, SDK/gateway failover or remote identity evidence. Tested kernel retry policy with mocks only; no no_retry/no_fallback end-to-end certification.
- No spawn panic or timeout receipt test. Current TaskTool deliberately has no total wall-clock timeout, and production panic=abort prevents claiming recoverable crash receipts. No feature added to manufacture these tests.
- Redaction asserts mock diagnostics in progress/final fixtures, not arbitrary generated content or every logging channel. No public registry generation digest added.

Focused feasible additions above are executed and green; unresolved acceptance limits remain visible rather than mislabeled complete or active.
