//! Process-environment normalization that every entry point (`jeikcode`, the daemon,
//! `jeikcode-clix`) calls once at startup.
//!
//! Deliberately ONE test in its OWN binary: it mutates the process environment, which
//! must not race the tests sharing another test binary.

#[test]
fn sanitize_repoints_posix_temp_vars_to_the_native_temp() {
    if !cfg!(windows) {
        return;
    }

    // Simulate a Git-Bash launch: the temp vars hold the MSYS view (`/tmp/`), which native
    // children resolve as `<drive>:\tmp` — the root cause behind the reported 404s.
    // SAFETY: this single-threaded test owns the process it mutates.
    unsafe {
        std::env::set_var("TMPDIR", "/tmp/");
        std::env::set_var("TMP", "/tmp/");
        std::env::set_var("TEMP", "/tmp/");
    }

    jeikcode_capabilities::special_dirs::sanitize_process_temp_env();

    for name in ["TMPDIR", "TMP", "TEMP"] {
        let value = std::env::var(name).unwrap_or_default();
        assert!(!value.starts_with('/'), "{name} must be native: {value:?}");
        assert!(
            value.as_bytes().get(1) == Some(&b':'),
            "{name} must carry a drive letter: {value:?}"
        );
    }
    // The replacement is the USER's real temp dir (HKCU\Environment on Windows), not the
    // stale POSIX mount and not a fresh empty directory.
    let dir = jeikcode_capabilities::special_dirs::temp_dir();
    assert!(dir.is_dir(), "{dir:?}");
    assert_eq!(
        std::env::temp_dir(),
        std::path::PathBuf::from(std::env::var("TEMP").unwrap()),
        "std::env::temp_dir() must agree with the sanitized TEMP"
    );
}
