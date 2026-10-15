//! Test-only isolation of `JEIKCODE_HOME`.
//!
//! jeikcode persists sessions / config / memory under `JEIKCODE_HOME` (default
//! `~/.jeikcode`). Tests that construct a `SessionManager`, run the agent, or
//! otherwise persist without setting `JEIKCODE_HOME` write into the developer's
//! REAL home — a full `cargo test` run leaves dozens of junk `sessions/<hash>/`
//! buckets (working dirs that are throwaway `tempfile` paths).
//!
//! [`isolate_home`] redirects `JEIKCODE_HOME` to a throwaway temp dir the FIRST
//! time it runs, only when the var isn't already set. It's idempotent (guarded by
//! a `Once`), so calling it from a `#[ctor]` in each test binary sets one stable
//! value before libtest spawns any thread — no `set_var` race (unlike per-test
//! `set_var`, which races under the parallel harness). Tests that set their own
//! `JEIKCODE_HOME` still win.
//!
//! Gated behind the `test-support` cargo feature so the env-mutating helper never
//! enters a normal (non-test) build. Consuming crates enable it via a
//! dev-dependency and call it from a `#[ctor]` in their own `#[cfg(test)]` module
//! (and every `tests/*.rs` integration binary):
//!
//! ```ignore
//! // Cargo.toml
//! [dev-dependencies]
//! jeikcode-kernel = { path = "../jeikcode-kernel", features = ["test-support"] }
//! ctor = "0.2"
//! ```
//! ```ignore
//! #[cfg(test)]
//! #[ctor::ctor]
//! fn _isolate_jeikcode_home() {
//!     jeikcode_kernel::test_support::isolate_home();
//! }
//! ```
//!
//! Putting the `#[ctor]` in the CONSUMING crate (and referencing this fn) is what
//! forces the linker to keep it — a bare `use … as _` on a ctor-only crate gets
//! dropped and never fires.

use std::sync::Once;

static INIT: Once = Once::new();

/// Redirect `JEIKCODE_HOME` to a per-process temp dir if unset. Idempotent and
/// race-free (runs once). Call from a `#[ctor]` so it lands before any test.
pub fn isolate_home() {
    INIT.call_once(|| {
        if std::env::var_os("JEIKCODE_HOME").is_some() {
            return; // explicit override (real run, or a test that set its own) wins
        }
        let dir = normalized_temp_dir().join(format!("jeikcode-test-home-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&dir);
        std::env::set_var("JEIKCODE_HOME", &dir);
    });
}

/// Temp root with POSIX-tainted values normalized away.
///
/// A Git-Bash-started test process can carry `TMPDIR=/tmp`, which makes
/// `std::env::temp_dir()` return a path that is NOT the OS temp root on Windows
/// (test homes then land under `<drive>:\tmp`). Production normalizes the temp
/// env once via the capabilities-side `special_dirs`; the kernel cannot depend on
/// that crate (it sits above the kernel), so this is the minimal equivalent for
/// the test seam. If a shared low-level temp helper ever exists, replace this copy.
fn normalized_temp_dir() -> std::path::PathBuf {
    let dir = std::env::temp_dir();
    #[cfg(windows)]
    {
        if dir.to_string_lossy().starts_with('/') {
            if let Some(local) = std::env::var_os("LOCALAPPDATA") {
                return std::path::PathBuf::from(local).join("Temp");
            }
            if let Some(profile) = std::env::var_os("USERPROFILE") {
                return std::path::PathBuf::from(profile)
                    .join("AppData")
                    .join("Local")
                    .join("Temp");
            }
        }
    }
    dir
}
