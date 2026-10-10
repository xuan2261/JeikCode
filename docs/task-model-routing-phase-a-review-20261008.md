# Task model routing — Phase A source review (2026-10-08)

## Verdict and evidence boundary

Implementation source now exists; this is a source review, not a live-runtime acceptance or deployment sign-off. Reported verification: **33 task tests and 5 provider-factory tests pass**, and **`cargo check --offline -p jeikcode -p jeikcode-tuix` passes**. These results were supplied with the review request, not rerun here. No provider calls, configuration/credential inspection, deployment, or binary replacement was performed.

The reported running binary still exposes the old task schema. The current source schema includes optional `tasks[].model_id` (`crates/jeikcode-capabilities/src/tools/task.rs:419–443`). Consequently, a newly built runtime is expected to advertise this field; the existing process is not evidence that this implementation is active. Compilation and mock tests do not establish live routing or remotely served model identity. Whether external provider queries work is a separate, unknown question.

## Actual construction and wiring

Repository-wide source search found **one production `TaskTool::new` site**: `crates/jeikcode-coding/src/parts.rs:468–478`. It supplies both legacy difficulty factories, fixed explore/worker tool mounts, an optional explicit resolver, concurrency/round/no-progress settings, and the parent's execution-policy middleware. The remaining direct constructors are tests:

- `crates/jeikcode-capabilities/src/tools/task.rs:1216,1320,1332,1349,1670,1709,1760,1814,1839,1868`.
- `crates/jeikcode-coding/src/provider_factory.rs:573`.

No separate production TUI or CLI task constructor was found. The native CLI/TUI host constructs `CodingRuntimeStart` at `crates/jeikcode-cli/src/main.rs:2874–2893`; `jeikcode-tuix` consumes runtime handles/events rather than constructing a task tool. Other host entry points use the same coding runtime: `crates/jeikcode-cli/src/acp/engine.rs:62`, `crates/jeikcode-clix/src/code.rs:195`, and `crates/jeikcode-daemon/src/kernel_runtime.rs:173–176`.

The routing catalog is carried through `crates/jeikcode-coding/src/config.rs:400,459`. Runtime startup installs routing when `subagent_config` exists (`runtime.rs:1822–1827`); parts closes over that routing object (`parts.rs:464–474`). A bare coding config without the catalog has no explicit resolver: explicit IDs fail closed rather than silently using the host. Session binding is forwarded at `parts.rs:1588–1589`.

## Current behavior

- **Explicit exact-registry override:** `TaskModelBinding` contains registry/account/API-model identities, the provider, and chat options; `TaskModelResolver` returns this binding or an error (`task.rs:310–319`). An explicit ID takes precedence over difficulty. Admission checks binding ID, account prefix, nonempty API model, and provider `model_name()` agreement before mounting tools (`task.rs:520–555`). The production resolver looks up the exact logical catalog key, verifies its account and protocol, derives the target model config, requires its endpoint, and replaces parent credentials and sampling/tool-choice overrides (`provider_factory.rs:371–413`). There is no explicit-route fallback to parent or tier providers. Omitted IDs retain the fast/capable branch (`task.rs:558–561`), whose legacy host fallback remains in `parts.rs:432–448`.
- **Receipts are local evidence, not model self-identification:** unresolved/construction failures have null resolved/effective identities and generic diagnostics (`task.rs:547–555`). Admission records a resolved binding but leaves effective identity null. `ObservedTaskProvider` marks entry into `chat_stream` before awaiting the adapter (`task.rs:320–339`); terminal receipts then set `status=provider_called` and `effective_api_model` to the bound model (`task.rs:678–682`). Thus a request-opening failure can legitimately have an effective *local attempted* model, but does not prove a sent HTTP request, successful response, or actual remote model. `remote_serving_identity` stays null. Explicit outcome errors are sanitized (`task.rs:664–666`); generated child text is not used to determine route identity.
- **Provider/tool capture:** each resolution clones one complete factory/base/catalog generation, constructs a provider, and retains it across later refreshes (`provider_factory.rs:350–413,422–423`). Runtime model switching preserves routing cells and refreshes them after successful assembly (`runtime.rs:4110–4126,4238–4245`). Providers, tool mounts, scope, working directory, options, and middleware references are captured before queued execution (`task.rs:563–593,619–639`). This is not an immutable snapshot of every parent mode: worker execution-policy middleware is shared by reference; parent plan/approval mode gates are not copied into children. Children run `AutoRespond::AllowAll`, with sensitive-path and worker-scope gates (`task.rs:248–260,634–650`). Parent mode admission remains a separate concern.
- **Retries:** this routing layer introduces no retry settings, alternate-model retry, or re-resolution during a child run. The wrapper delegates to the same captured provider; normal adapter/kernel retry machinery remains in force. This does not establish retry behavior through an actual external provider. Mixed failures remain per-child, and only an all-failed batch makes the overall tool result an error (`task.rs:739–745`).

## Defects and actionable risks

**No definite new routing implementation defect observed in the reviewed paths.** This is bounded source-review evidence, not a claim that no defects exist.

1. **Receipt interpretation risk:** `task.rs:337–338,678–682` marks a local adapter invocation, even if it fails before network transmission. Consumers must not label `effective_api_model` as successful or remotely verified routing. The existing provider-error test explicitly expects that field to remain populated (`task.rs:1299–1310`). If the acceptance requirement means “effective only after a successful request,” the current implementation does not meet that stronger requirement; distinguish attempted route from successful/remote route rather than fabricating proof.
2. **Old binary/schema operational gap:** source support cannot make the current process advertise the field. Validate the new runtime's schema and wiring separately before declaring feature acceptance; no such action was taken here.
3. **Input isolation limitation:** explicit null/non-string `model_id` fails deserialization of the entire argument batch (`task.rs:285–286,306–308,457–473`), unlike an invalid string ID, which produces an isolated unresolved child receipt. This is current behavior, not proof of a regression; clarify the intended malformed-input contract.
4. **Mode guarantees are narrower than provider snapshots:** shared worker policy is not a frozen mode snapshot (`parts.rs:478`; `task.rs:505,593,638`). Do not infer immutable parent tool-mode state or inherited human approval gates from immutable provider routing.

## Tests still needed for acceptance

- Native runtime/parts integration proving schema publication and resolver availability through the CLI/TUI startup path, including catalog-absent and subagent-disabled cases.
- Queued and running children across successful and failed model/catalog refreshes; verify old bindings stay fixed, new admissions use the committed generation, and session binding is preserved.
- Explicit routes under parent plan/approval/execution restrictions, including a mode change while queued; assert worker scope and hard restrictions cannot be bypassed.
- Request-opening and mid-stream failures with progress and final receipt assertions, ensuring no claim of remote success and no diagnostic leakage; same-provider retries must not switch registry bindings.
- Null/non-string IDs in mixed batches and exact-registry rejection branches not individually covered by the visible tests (missing endpoint, empty API model, provider-build failure).

The visible tests cover concurrent mock routes, difficulty override, fail-closed admission/binding mismatches, cancellation before provider invocation, options forwarding, basic worker-scope admission, sequential refresh retention, and parent-config invariance. They do **not** close the runtime, mode-transition, transport, or remote-identity evidence gaps above.
