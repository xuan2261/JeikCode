//! Test-only isolation seam (`test-util` feature).
//!
//! Why this exists: every test in a process otherwise shares the ONE user home
//! (`$JEIKCODE_HOME` → `~/.jeikcode`). One test's config write rewrites the very
//! file another test is asserting on, and — worse — tests that repointed the
//! PROCESS-WIDE `JEIKCODE_HOME` env var ("scoped home" guards) could flip the
//! resolved home *between* another test's write and read, so the same logical
//! path landed in two different buckets (the observed sidecar flake).
//!
//! The override is THREAD-LOCAL: the Rust test harness runs each test on its own
//! thread and `#[tokio::test]` defaults to a current-thread runtime, so a guard
//! gives exactly one test a private home while every other thread keeps the real
//! path. Tests therefore never need `std::env::set_var` at all — runtime env
//! stays constant, which is what makes the resolved-once production path safe.
//!
//! Production builds never enable `test-util`, so `Config::config_dir()` keeps
//! its exact behavior there — this seam has zero production impact.
//!
//! Usage in a test:
//! ```ignore
//! let _home = jeikcode_config::test_util::isolated_home();
//! // config.toml, sessions/, sidecars … all resolve under the private temp home
//! ```
use std::cell::RefCell;
use std::path::PathBuf;

thread_local! {
    static HOME_OVERRIDE: RefCell<Option<PathBuf>> = const { RefCell::new(None) };
}

/// The thread-local home override, when a test guard installed one.
pub fn overridden_home() -> Option<PathBuf> {
    HOME_OVERRIDE.with(|slot| slot.borrow().clone())
}

/// RAII guard: this thread resolves its home (and therefore `config.toml`,
/// `sessions/`, sidecars) under a private temp directory until dropped.
pub struct IsolatedHome {
    dir: PathBuf,
    previous: Option<PathBuf>,
    /// Only a guard that created its dir removes it on drop.
    owned: bool,
}

impl IsolatedHome {
    /// Point this thread's `Config::config_dir()` at a fresh temp home.
    pub fn new() -> Self {
        let dir = unique_dir();
        let _ = std::fs::create_dir_all(&dir);
        let previous = HOME_OVERRIDE.with(|slot| slot.borrow_mut().replace(dir.clone()));
        Self {
            dir,
            previous,
            owned: true,
        }
    }

    /// Point this thread at an EXISTING directory (the caller owns cleanup).
    pub fn at(dir: impl Into<PathBuf>) -> Self {
        let dir = dir.into();
        let previous = HOME_OVERRIDE.with(|slot| slot.borrow_mut().replace(dir.clone()));
        Self {
            dir,
            previous,
            owned: false,
        }
    }

    /// The private home directory this thread resolves while the guard lives.
    pub fn path(&self) -> &std::path::Path {
        &self.dir
    }
}

impl Default for IsolatedHome {
    fn default() -> Self {
        Self::new()
    }
}

impl Drop for IsolatedHome {
    fn drop(&mut self) {
        HOME_OVERRIDE.with(|slot| *slot.borrow_mut() = self.previous.take());
        if self.owned {
            let _ = std::fs::remove_dir_all(&self.dir);
        }
    }
}

/// Give the current thread its own home directory (see [`IsolatedHome`]).
pub fn isolated_home() -> IsolatedHome {
    IsolatedHome::new()
}

/// Back-compat alias: isolating the home also isolates `config.toml`.
pub fn isolated_config() -> IsolatedHome {
    IsolatedHome::new()
}

fn unique_dir() -> PathBuf {
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
    std::env::temp_dir().join(format!("jeikcode-home-test-{}-{seq}", std::process::id()))
}
