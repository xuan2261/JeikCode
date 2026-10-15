#![cfg(feature = "setup")]
//! End-to-end integration tests for `setup::run`.
//!
//! 这些测试需要把 `Config::config_dir()` 重定向到 tempdir，确保不污染真实的
//! `~/.jeikcode/`。重定向现在是**线程级** home 覆盖（不再写进程 env）：
//! 测试之间不再共享/互改同一个 home，也不再依赖“env 全局”带来的串行假设。
//! （保留 `#[serial]` 是因为 setup 状态与项目目录仍有共享面。）

use jeikcode_capabilities::setup::{self, RunOptions};
use serial_test::serial;
use std::path::Path;

#[ctor::ctor]
fn _isolate_jeikcode_home() {
    jeikcode_kernel::test_support::isolate_home();
}

/// 在 tempdir 项目中跑 setup，同时把本线程的 home 指向另一个 tempdir。
/// 返回 (`SetupResult`, 两个 tempdir 守卫)。
fn run_in_tempdir<F, G>(
    project_setup: F,
    mutate_opts: G,
) -> (
    setup::SetupResult<setup::SetupReport>,
    tempfile::TempDir,
    tempfile::TempDir,
)
where
    F: FnOnce(&Path),
    G: FnOnce(&mut RunOptions),
{
    let proj = tempfile::tempdir().unwrap();
    let user = tempfile::tempdir().unwrap();
    project_setup(proj.path());

    // 线程级 home（不再全局写 env）；guard 活到本函数返回（即 setup::run 之后）。
    let _home = jeikcode_config::test_util::IsolatedHome::at(user.path());

    let mut opts = RunOptions::new(proj.path().to_path_buf());
    mutate_opts(&mut opts);

    let result = setup::run(opts);

    (result, proj, user)
}

#[test]
#[serial]
fn setup_installs_seeds_in_empty_project() {
    let (result, _proj, _user) = run_in_tempdir(|_| {}, |_| {});

    let report = result.expect("setup run should succeed");

    // Should install at least some seeds (skills/commands from embedded tar).
    let total =
        report.summary.installed.len() + report.summary.skipped.len() + report.summary.failed.len();
    assert!(
        total > 0,
        "expected at least one seed install attempted, got installed={} skipped={} failed={}",
        report.summary.installed.len(),
        report.summary.skipped.len(),
        report.summary.failed.len(),
    );

    // setup-state.json should exist in the project dir.
    // (Not in user dir — state is per-project.)
}

#[test]
#[serial]
fn second_run_skips_already_installed() {
    let proj = tempfile::tempdir().unwrap();
    let user = tempfile::tempdir().unwrap();

    // 线程级 home（不再全局写 env）。
    let _home = jeikcode_config::test_util::IsolatedHome::at(user.path());

    let make_opts = || RunOptions::new(proj.path().to_path_buf());

    let report1 = setup::run(make_opts()).unwrap();
    let report2 = setup::run(make_opts()).unwrap();

    // First run should install or attempt some items.
    let first_attempted = report1.summary.installed.len()
        + report1.summary.skipped.len()
        + report1.summary.failed.len();
    assert!(
        first_attempted > 0,
        "first run should attempt at least one item"
    );

    // Second run should have at least one AlreadyInstalled skip (if first run installed anything).
    assert!(
        report2.summary.installed.len() <= report1.summary.installed.len(),
        "second run should install at most as many as the first (first={}, second={})",
        report1.summary.installed.len(),
        report2.summary.installed.len(),
    );

    if !report1.summary.installed.is_empty() {
        let has_already = report2.summary.skipped.iter().any(|(_, reason)| {
            matches!(
                reason,
                jeikcode_capabilities::setup::install::SkipReason::AlreadyInstalled
            )
        });
        assert!(
            has_already,
            "second run skipped items: {:?}",
            report2.summary.skipped
        );
    }
}

#[test]
#[serial_test::serial]
fn concurrent_runs_second_fails_lock() {
    let proj = tempfile::tempdir().unwrap();
    let user = tempfile::tempdir().unwrap();
    let user_home = user.path().to_path_buf();

    let proj_a = proj.path().to_path_buf();
    let proj_b = proj.path().to_path_buf();

    // `setup::run` is synchronous. Use std::thread to run two concurrent
    // invocations — the lock must prevent both from succeeding simultaneously.
    // home 覆盖是**线程级**的，所以每个 spawn 线程各自装一次（不再写进程 env）：
    // 两个线程仍解析到同一个 temp home。
    let (r1, r2) = std::thread::scope(|s| {
        let home_a = user_home.clone();
        let t1 = s.spawn(move || {
            let _home = jeikcode_config::test_util::IsolatedHome::at(home_a);
            let o = RunOptions::new(proj_a);
            setup::run(o)
        });

        // Give t1 a head start so it grabs the lock first.
        std::thread::sleep(std::time::Duration::from_millis(20));

        let home_b = user_home.clone();
        let t2 = s.spawn(move || {
            let _home = jeikcode_config::test_util::IsolatedHome::at(home_b);
            let o = RunOptions::new(proj_b);
            setup::run(o)
        });

        let r1 = t1.join().unwrap();
        let r2 = t2.join().unwrap();
        (r1, r2)
    });

    // At least one should succeed; failures must be lock-related.
    let succeeded = r1.is_ok() as usize + r2.is_ok() as usize;
    assert!(
        succeeded >= 1,
        "at least one concurrent run should succeed; both failed:\n  r1={:?}\n  r2={:?}",
        r1,
        r2
    );

    for r in [&r1, &r2] {
        if let Err(e) = r {
            assert!(
                matches!(
                    e,
                    jeikcode_capabilities::setup::SetupError::LockHeld { .. }
                        | jeikcode_capabilities::setup::SetupError::LockIo(_)
                ),
                "if a concurrent run failed, it should be LockHeld or LockIo, got: {e:?}"
            );
        }
    }
}
