//! Test support: a private home directory per test.
//!
//! Migration note: this used to `set_var("JEIKCODE_HOME")` at PROCESS scope and
//! restore it on drop. Process-wide env writes are now forbidden (see the
//! daemon's `env_write_guard_tests`) because `Config::config_dir()` resolves
//! once per process — a later flip would split "write" and "read" across two
//! different roots. The home override is instead THREAD-LOCAL, so parallel
//! tests never see each other's home and the resolved-once path stays valid.

use std::path::PathBuf;

/// A fresh temp home for the CURRENT THREAD until dropped.
///
/// Kept API-compatible on purpose: existing tests use `_home` purely as a
/// lifetime guard (and occasionally read `home.path`).
pub struct IsolatedHome {
    inner: jeikcode_config::test_util::IsolatedHome,
    /// The temp home directory this thread resolves while the guard lives.
    pub path: PathBuf,
}

impl IsolatedHome {
    /// Same value as the `path` field, method form (both spellings are used).
    pub fn path(&self) -> &std::path::Path {
        &self.path
    }
}

/// Create a fresh tempdir, point THIS thread's home at it, and return a guard
/// that restores the previous home and cleans up the dir on drop. Caller must
/// keep the returned value alive for the duration of the test.
pub fn isolated_home() -> IsolatedHome {
    let inner = jeikcode_config::test_util::isolated_home();
    let path = inner.path().to_path_buf();
    IsolatedHome { inner, path }
}
