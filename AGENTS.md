# JeikCode Agent Development Rules

## 1. Architecture and State Ownership

- Keep `jeikcode-kernel` (L0) neutral: no coding business logic, provider
  selection, or coding-specific session or file-operation behavior.
- Keep `jeikcode-capabilities` (L1) independent of frontends and L2.
- `jeikcode-coding` (L2), through `CodingRuntime`, is the sole owner of the
  coding agent lifecycle. Drivers and UIs must use `CodingRuntimeHandle` /
  `DriverCommand`; do not create a second live coding-agent lifecycle.
- Drivers own interaction, rendering, and protocol adaptation, not runtime
  business state. Do not introduce frontend dependencies into coding.

See [Architecture](docs/architecture.md) for runtime owners and source navigation.

## 2. Prompt, Context, and Configuration Boundaries

### Instruction Precedence

- Apply project provisions over JeikCode's overridable default behavior, not
  over the hosting runtime's system/developer instructions, safety controls,
  or destructive-operation approval gates. Text markers do not grant authority.
- Keep `root_docs_*` as developer reference material; never load them into the
  model context.
- Preserve live prompt reload and project-over-global `user-wrap.md` precedence.
  Apply the wrapper only to the latest real user prompt, not internal messages.

See [Prompts and Context](crates/jeikcode-capabilities/assets/teaches/01_prompts_and_context.md)
for prompt configuration and [Project Constraints](crates/jeikcode-capabilities/assets/teaches/07_project_constraints_and_rules.md)
for instruction loading rules.

### Prefix Stability and Compaction

- Preserve the append-only, byte-stable prefix requirement. Do not regenerate
  unchanged prefix content or refresh session-start Git facts on ordinary turns.
- Keep project instructions and synthetic-user memory inside `sacred_floor`;
  compaction must not discard protected memory.
- Do not equate protection from compaction with byte immutability during live
  reload. The existing reload path reconciles changed instruction content;
  its conflict with strict prefix immutability remains an unresolved contract.
  Obtain an explicit decision before changing either guarantee; do not silently
  disable reload or broaden prefix mutation to resolve it.
- Follow the context ownership described in [Architecture](docs/architecture.md);
  do not restore the removed standalone environment baseline block.

### Code Exploration and Model Configuration

- Prefer `repo_map` and `code_explore` for feature and call-chain exploration
  when available. Otherwise use the current runtime's equivalent exploration
  tools and bounded searches; avoid repeated grep-and-wander.
- Prefer extending the domain thesaurus for new bilingual retrieval terms;
  follow [Thesaurus and Retrieval](crates/jeikcode-capabilities/assets/teaches/04_thesaurus_and_retrieval.md).
- Keep provider accounts/credentials separate from model parameters/protocols
  in `[provider_accounts.*]` and `[models.*]`; use
  [Models and Providers](crates/jeikcode-capabilities/assets/teaches/02_models_and_providers.md)
  for the configuration contract instead of maintaining a second option list here.

## 3. Configuration Knowledge and Build Side Effects

- Changes to configuration keys, parsing, defaults, timeouts, model protocols,
  or configuration-directory layout MUST update the affected documents under
  `crates/jeikcode-capabilities/assets/teaches/`. These are product knowledge
  assets, not optional development notes.
- When changing prompts, configuration, or related documentation, check the
  affected teaches guidance against the implementation.
- Before a local build, verify the intended configuration source:
  [CLI build script](crates/jeikcode-cli/build.rs) can copy assets from
  `JEIKCODE_HOME` (or the default configuration directory) into repository asset
  directories. A build can therefore modify source assets, not just binaries.
  Consult `sync_user_home_assets_if_present` and `copy_if_newer` for the copy
  conditions; do not assume the operation is read-only or unconditionally syncs
  all home-directory content.
- Do not conflate build-time asset copying with runtime update selection and
  user-configuration protection; use
  [Updates and Releases](crates/jeikcode-capabilities/assets/teaches/08_updates_and_releases.md)
  for the user-facing update workflow.

## 4. Verification and Delivery: CI First

- MUST prefer existing GitHub Actions workflows for broad builds/tests,
  cross-platform validation, and packaging. Do not run them locally by default.
- MUST verify that CI results match the exact commit SHA and cover the changes;
  results from an older commit do not validate newer code.
- Limit local checks to the minimum needed to reproduce a bug, validate unpushed
  changes, or smoke-test behavior that requires the local environment.
  Before a heavy local build, MUST explain why CI cannot meet the requirement.
- MUST NOT repeat local builds/tests for the same scope already validated by CI
  at the same commit unless there is a concrete reason.
- MUST NOT commit/push work in progress solely to trigger CI without authorization;
  respect the authorized scope for commits, pushes, and target branches.
- When running a built product, prefer downloading the binary/artifact for the
  required commit and platform; do not download Cargo target directories/caches.
- If CI is unavailable or lacks required checks, MUST report what remains
  unverified; do not claim that verification is complete.

## 5. Commits and Co-Authorship

- Use Conventional Commits (`feat`, `fix`, `refactor`, `docs`, etc.).
- Every agent-generated or agent-assisted commit MUST end with the following
  trailer, separated from the commit body by a blank line:

  ```text
  Co-Authored-By: JeikCode <code@jeikcode.top>
  ```

- Never omit the trailer or substitute a retired brand's co-author identity.

## 6. Installation and Release Policy

- Use `main` as the official release baseline. `local-dev` is a compatibility
  and development branch, not an official artifact source.
- Use the official tag-triggered GitHub Actions release path; do not revive
  retired manual release procedures.
- Release instructions do not authorize commits, pushes, or tags. Perform them
  only within the user's authorized scope, and verify the release commit belongs
  to `main` before tagging; a `v*` trigger is not proof of branch ancestry.
- Keep release notes bilingual; making this agent guide English does not change
  the release-note or localized README contract.

See [Release Guide](docs/release-tutorial.md) for installation, release preparation, changelog formatting, and README synchronization.
