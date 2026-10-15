//! Shared path resolution for every capability that touches the jeikcode config
//! tree (`mcp` / `session` / `memory`) — ONE home for the rule, one place to
//! document its single known divergence from production.

use std::path::PathBuf;

/// The jeikcode config/data root: `$JEIKCODE_HOME` if set & non-empty, else
/// `~/.jeikcode`. Mirrors `jeikcode_core::config::Config::config_dir` so everything
/// L1 persists (`sessions/`, `memory.md`, MCP OAuth tokens) lands in the SAME tree
/// as production's.
///
/// KNOWN DIVERGENCE (deliberate L1 simplification): the core helper additionally
/// resolves `$SUDO_USER` via getpwnam, so under `sudo` WITHOUT `$JEIKCODE_HOME` set
/// production resolves the invoking user's home while this resolves root's — the
/// two stacks would then read/write parallel trees. Setting `$JEIKCODE_HOME`
/// (checked first, byte-identical to production) keeps them aligned.
pub(crate) fn config_dir() -> PathBuf {
    // SINGLE SOURCE OF TRUTH: delegate to the config crate. This used to be a
    // byte-for-byte copy of `Config::resolve_config_dir` — two implementations
    // that could drift, and whose divergence would silently split the sessions
    // root from the config root. Delegating also makes the resolved-once memo
    // and the test-only home override apply to both at the same time.
    jeikcode_config::Config::config_dir()
}

// NO unit test here ON PURPOSE: testing this means mutating the process-global
// `JEIKCODE_HOME`, and libtest runs the lib's unit tests in parallel threads — any
// future unit test touching `config_dir()` (memory.md, session paths, OAuth token
// store) would race it nondeterministically. The `$JEIKCODE_HOME`-wins behavior is
// exercised by the env-isolating INTEGRATION binaries (each its own process):
// capabilities `tests/session.rs` + `tests/mcp.rs`, coding `tests/full_assembly.rs`.
