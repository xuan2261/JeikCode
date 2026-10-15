//! JeikCode disk/TOML config system.
//!
//! Leaf crate — depends only on `jeikcode-telemetry` + serde/toml/anyhow, so every
//! stack layer can read `config.toml` without depending on a runtime/driver crate. See
//! `docs/superpowers/plans/2026-07-11-extract-jeikcode-config.md`.

/// UI language selection (`Config.language`).
pub mod locale;

/// Localization message tables + `t()`/`Msg`.
pub mod i18n;

/// Vendored leaf helpers (home-dir resolution, vision heuristic) config needs.
pub mod util;

/// `[network.proxy]` config types + process-env proxy policy. HTTP-owning crates
/// apply this policy to their own reqwest builders.
pub mod proxy;

/// Every server address the client talks to, each overridable by env with
/// today's value as the default.
pub mod endpoints;

/// TLS-version policy for the explicit process-wide env ceiling and the
/// endpoint-scoped first-party fallback latch. Pure URL/env/atomic logic; HTTP
/// clients remain in their owning leaf/provider crates.
pub mod tls;

/// The disk/TOML config system: [`Config`](config::Config) + all sub-configs,
/// load/save and paths.
pub mod config;

/// Transactional, cross-process-safe access to `config.toml`.
pub mod store;

/// Test-only isolation seam. Always compiled so INTEGRATION tests can use it too:
/// dev-dependency features apply to the test target, not to the crate's own lib
/// build that those integration tests link against — a feature-gated seam would
/// silently do nothing there. Installing an override only ever happens in tests;
/// production never calls it, so behavior is unchanged (and the resolved-once
/// memo makes the check free after the first call).
#[doc(hidden)]
pub mod test_util;

/// Pure parsers for OS system-proxy descriptions: Windows ProxyServer/ProxyOverride
/// and macOS `scutil --proxy` output → normalized HTTP(S)_PROXY / NO_PROXY values.
pub mod system_proxy;

/// Local scheduled-task model, file store, and next-run calculator.
pub mod schedule;

pub use config::{provider::ProviderConfig, Config};
pub use store::{ConfigCommit, ConfigRevision, ConfigSnapshot, ConfigStore};
