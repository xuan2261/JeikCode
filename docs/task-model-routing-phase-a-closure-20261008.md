# Task model routing — Phase A patch-cleanup closure (2026-10-08)

## Disposition

Source-review cleanup closed with **no additional code fix required by the actual review**; NOT_ACTIVE and not live acceptance. Read coordinator AGENTS.md → CLAUDE.md, host C:/Work/JeikCode/AGENTS.md, the entire actual host `docs/task-model-routing-phase-a-review-20261008.md` (44 lines), and the prior worker execution report at C:/Work/NavSlidesEditor/docs/task-model-routing-phase-a-20261008.md. The requested review does exist in the host repository, not the coordinator repository.

The final review explicitly says “No definite new routing implementation defect observed in the reviewed paths.” Its four actionable risks are evidence/contract limitations, not established P1/P2 defects. No source or new mock test was added merely to broaden acceptance or alter existing semantics. This is not a claim that every possible routing defect has been excluded.

## Exact follow-up changed files

Only this new deliverable was written:

- **C:/Work/JeikCode/docs/task-model-routing-phase-a-closure-20261008.md**

No implementation, configuration, teaches/assets, default, retry policy, installation, or deployment files were edited by this follow-up. Existing dirty host source/assets and untracked prior reports were preserved. Host status before and after verification had the same existing path inventory. This does not establish ownership of concurrent edits. Verification output is in ignored `target/task-routing-closure-{task-tests,provider-tests,host-check}.log`; these are build artifacts, not source deliverables.

## Why no corrective change

- **Receipt failures:** `ObservedTaskProvider::chat_stream` marks local adapter entry before awaiting it; `TaskTool::execute` records `provider_called` and the bound `effective_api_model` after that entry, including request-opening failure. `remote_serving_identity` remains null. These are attempted local-route identities, not successful HTTP or remotely served proof. Changing the field to successful-only would contradict the existing tested contract without a definite reviewed defect. Explicit provider errors are sanitized; cancellation before request retains null effective identity.
- **Stale resolver:** `TaskModelRouting::resolve` clones a complete factory/base/catalog generation; `refresh_subagent_tiers` replaces it under its mutex. A constructed binding intentionally survives refresh. Parts closes over the shared routing object and runtime preserves/refreshes it. Existing sequential-refresh coverage proves old-provider retention and new-resolution selection; it does not prove every queued/failed-refresh permutation.
- **Provider/tool mode:** bound provider/options and tool mounts are captured before queued execution. Worker execution-policy middleware remains shared; parent human approval/plan modes are not frozen into children. Existing scope and hard sensitive-path gates remain installed. Immutable provider routing is not an immutable parent-mode guarantee. Expanding mode inheritance would be a separate policy change, not a reviewed routing fix.
- **Legacy/empty IDs:** omitted `model_id` preserves legacy difficulty factories and their existing host fallback. Empty/invalid explicit strings fail closed; absent resolver does not inherit. Explicit null/non-string IDs reject the argument batch during deserialization; the schema requires a string. Per-child isolation for malformed types is not an established requirement or regression, so parser behavior was not changed.

## Existing implemented types/hooks checked (not new follow-up implementation)

- `SubTask.model_id`, `deserialize_model_id`, `valid_task_model_id`; additive `TaskTool::parameters_schema`.
- `TaskModelBinding`, `TaskModelResolver`, `TaskTool::with_model_resolver`; binding validation before tool mounting, task-local ChatOptions, progress `<task_route>` and result/error `<route>` receipts.
- `ObservedTaskProvider` local request-entry observation; delegates session binding and adapter behavior.
- `TaskModelRouting::{snapshot_base,set_session_id,resolve}`, `install_subagent_tiers`, `refresh_subagent_tiers`; exact catalog resolution, account/protocol/model checks, explicit endpoint/auth replacement, parent sampling/tool-choice reset.
- `parts.rs` production registration supplies the resolver and worker execution-policy middleware; runtime carries routing during reassembly. This was source inspection, not a new native-startup integration test.

## Offline tests verified in this follow-up

Working directory: C:/Work/JeikCode. Verified executable: `C:/Users/Z10PAD8C_Xuan2261/.cargo/bin/cargo.exe`, reporting cargo 1.93.0 (083ac5135 2025-12-15). No installation, cache repointing, credential inspection, D-drive access, or live API use.

Exact commands (full executable path used):

```text
cargo.exe test --offline -p jeikcode-capabilities --lib tools::task::tests
  33 passed, 0 failed, 0 ignored, 872 filtered out
cargo.exe test --offline -p jeikcode-coding --lib provider_factory::tests
  5 passed, 0 failed, 0 ignored, 370 filtered out
cargo.exe check --offline -p jeikcode -p jeikcode-tuix
  exit 0, Finished dev profile
 git diff --check
  exit 0 (existing LF/CRLF advisory warnings)
```

These independently reproduce the prior Main counts (33 TaskTool tests, 5 provider-factory tests) and focused host check, rather than relying on the review's supplied results. There are 38 executed tests across these two suites, not zero-test filter successes. No new tests were needed for an unestablished defect.

Existing routing mock test names actually executed:

- `per_task_model_schema_and_parse_are_additive`
- `per_task_model_forwards_bound_options_and_engine_receipt`
- `per_task_model_omitted_preserves_difficulty_factories`
- `per_task_model_provider_error_retains_binding_without_fallback`
- `per_task_model_concurrent_routes_override_difficulty_and_isolate_failures`
- `per_task_model_cancel_before_request_retains_only_resolved_binding`
- `per_task_model_worker_scope_admission_unchanged`
- `explicit_model_id_without_resolver_never_inherits`
- `explicit_model_id_binding_mismatch_rejected_before_spawn`
- `explicit_model_id_invalid_or_unknown_never_mounts_or_falls_back`
- `per_task_model_binds_cross_provider_and_survives_refresh`
- `per_task_model_registry_to_fake_runner_receipts_and_parent_invariance`
- `explicit_model_id_invalid_registry_never_constructs_provider`

Additional policy/regression names executed include `child_sensitive_path_denial_is_terminal`, `child_middlewares_add_the_scope_gate_only_for_workers`, `worker_scope_gate_confines_writes_but_not_reads`, `worker_scope_gate_denies_workspace_escape_and_absolute_outside`, `worker_scope_gate_confines_search_replace_root`, `partial_batch_failure_is_not_overall_error`, and `parent_cancel_terminates_an_unbounded_subtask`. Provider suite also executed `dispatches_all_supported_provider_types` and `default_output_cap_matches_legacy_bounds`.

## Policy and evidence limits

No new retry/fallback policy: explicit resolution has no inherited fallback; omitted selection retains the legacy path. Normal adapter/kernel retry behavior remains unchanged, not externally certified. Children retain concurrency limits, round/no-progress policy, cancellation, worker scope and sensitive-path middleware; they run AutoRespond::AllowAll without inherited human approval gates. Mixed child failures remain isolated and only all-failed batches make the overall result an error.

The review's acceptance gaps remain: native startup schema/resolver publication (including disabled/catalog-absent modes), queued/running children across successful and failed refresh/session transitions, mode changes while queued, mid-stream failures and same-provider retry transport behavior, and individual missing-endpoint/empty-model/build-failure branches. No actual HTTP traffic or remote identity verification occurred. Existing old runtime/schema was neither replaced nor probed. The prior broad workspace check and 13 focused routing-test results are historical worker evidence, not newly rerun here. This report closes the requested source-review cleanup only; it does **not** declare Phase A live-ready or activated.
