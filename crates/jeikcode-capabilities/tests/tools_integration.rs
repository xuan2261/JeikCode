//! End-to-end: a real kernel `Agent` driving the real neutral tools through the
//! generic `ApprovalMiddleware`. This is the FIRST exercise of the kernel's
//! ToolMiddleware + approval round-trip seam with REAL risky tools (production only
//! ever exercised it with testkit stubs).

use jeikcode_capabilities::tools::{coding_tool_names, register_coding_tools, ApprovalMiddleware};
use jeikcode_kernel::agent::{Agent, AutoRespond};
use jeikcode_kernel::stream::StreamEvent;
use jeikcode_kernel::testkit::MockProvider;
use jeikcode_kernel::tool::{ToolCall, ToolRegistry};
use std::sync::Arc;

fn tool_call(id: &str, name: &str, args: &str) -> StreamEvent {
    StreamEvent::ToolCall(ToolCall {
        id: id.into(),
        name: name.into(),
        arguments: args.into(),
    })
}
fn done() -> StreamEvent {
    StreamEvent::Done { truncated: false }
}

#[test]
fn full_toolset_registers_and_mounts() {
    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let mounted = reg.mount(coding_tool_names());
    let names: Vec<String> = mounted.defs().into_iter().map(|d| d.name).collect();

    // `coding_tool_names()` is deliberately a SUPERSET of what `register_coding_tools`
    // installs: `fetch_output` is wired only when a session exists (never by this
    // function), and `todowrite` / `request_user_input` / `memory` sit behind env gates.
    // `mount()` silently drops names with no registration, so the invariant is
    // "mounted == the registered subset", not "mounted == every name".
    let registered: Vec<&str> = coding_tool_names()
        .iter()
        .copied()
        .filter(|name| !reg.mount(&[name]).defs().is_empty())
        .collect();

    for expected in &registered {
        assert!(
            names.iter().any(|n| n == expected),
            "{expected} is registered but did not mount; got {names:?}"
        );
    }
    assert_eq!(
        names.len(),
        registered.len(),
        "mount() must yield exactly the registered subset; mounted {names:?}, registered {registered:?}"
    );

    // The reason this test exists: the unconditional core toolset is never gated away.
    for core in ["read", "write", "edit", "run_command", "grep", "glob"] {
        assert!(
            names.iter().any(|n| n == core),
            "{core} is unconditional and must always mount; got {names:?}"
        );
    }
}

#[tokio::test]
async fn approval_allows_risky_write_and_it_lands() {
    let d = tempfile::tempdir().unwrap();
    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let provider = Arc::new(MockProvider::new(vec![
        vec![
            tool_call(
                "c1",
                "write_file",
                r#"{"file_path":"out.txt","content":"hello"}"#,
            ),
            done(),
        ],
        vec![StreamEvent::TextDelta("written".into()), done()],
    ]));
    let outcome = Agent::builder()
        .provider(provider)
        .tools(reg.mount(coding_tool_names()))
        .middleware(Arc::new(ApprovalMiddleware::in_memory()))
        .working_dir(d.path().to_path_buf())
        .max_rounds(5)
        .build()
        .run_to_completion("write the file", AutoRespond::AllowAll)
        .await;

    assert!(
        outcome.error.is_none(),
        "clean run expected: {:?}",
        outcome.error
    );
    assert!(
        d.path().join("out.txt").exists(),
        "approved risky write must land"
    );
    assert_eq!(
        std::fs::read_to_string(d.path().join("out.txt")).unwrap(),
        "hello"
    );
}

#[tokio::test]
async fn approval_denies_risky_write_and_it_is_blocked() {
    let d = tempfile::tempdir().unwrap();
    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let provider = Arc::new(MockProvider::new(vec![
        vec![
            tool_call(
                "c1",
                "write_file",
                r#"{"file_path":"out.txt","content":"hello"}"#,
            ),
            done(),
        ],
        vec![StreamEvent::TextDelta("ok".into()), done()],
    ]));
    let outcome = Agent::builder()
        .provider(provider)
        .tools(reg.mount(coding_tool_names()))
        .middleware(Arc::new(ApprovalMiddleware::in_memory()))
        .working_dir(d.path().to_path_buf())
        .max_rounds(5)
        .build()
        .run_to_completion("write the file", AutoRespond::DenyAll)
        .await;

    assert!(
        !d.path().join("out.txt").exists(),
        "denied risky write must NOT land"
    );
    // The blocked call surfaces as an error tool-result the model can react to.
    assert!(
        outcome
            .tool_results
            .iter()
            .any(|r| r.is_error && r.content.contains("denied")),
        "a denied tool-result should be surfaced; got {:?}",
        outcome.tool_results
    );
}

#[tokio::test]
async fn safe_tools_run_without_approval_prompt() {
    // read/grep/glob/list are Safe → DenyAll must NOT block them (approval only gates
    // Risky calls). Pre-seed a file, then have the model read it under DenyAll.
    let d = tempfile::tempdir().unwrap();
    std::fs::write(d.path().join("data.txt"), "alpha\nbeta\n").unwrap();
    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let provider = Arc::new(MockProvider::new(vec![
        vec![
            tool_call("c1", "read_file", r#"{"file_path":"data.txt"}"#),
            done(),
        ],
        vec![StreamEvent::TextDelta("read it".into()), done()],
    ]));
    let outcome = Agent::builder()
        .provider(provider)
        .tools(reg.mount(coding_tool_names()))
        .middleware(Arc::new(ApprovalMiddleware::in_memory()))
        .working_dir(d.path().to_path_buf())
        .max_rounds(5)
        .build()
        .run_to_completion("read the file", AutoRespond::DenyAll)
        .await;

    assert!(
        outcome
            .tool_results
            .iter()
            .any(|r| !r.is_error && r.content.contains("alpha")),
        "Safe read must run even under DenyAll; got {:?}",
        outcome.tool_results
    );
}

#[tokio::test]
async fn multi_tool_task_write_then_read_roundtrips() {
    let d = tempfile::tempdir().unwrap();
    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let provider = Arc::new(MockProvider::new(vec![
        vec![
            tool_call(
                "c1",
                "write_file",
                r#"{"file_path":"note.txt","content":"line one\nline two"}"#,
            ),
            done(),
        ],
        vec![
            tool_call("c2", "read_file", r#"{"file_path":"note.txt"}"#),
            done(),
        ],
        vec![
            StreamEvent::TextDelta("the file says line one".into()),
            done(),
        ],
    ]));
    let outcome = Agent::builder()
        .provider(provider)
        .tools(reg.mount(coding_tool_names()))
        .middleware(Arc::new(ApprovalMiddleware::in_memory()))
        .working_dir(d.path().to_path_buf())
        .max_rounds(6)
        .build()
        .run_to_completion("create and read note.txt", AutoRespond::AllowAll)
        .await;

    assert!(
        outcome.error.is_none(),
        "clean run expected: {:?}",
        outcome.error
    );
    // The write landed and the subsequent read saw its contents (with line numbers).
    assert!(
        outcome
            .tool_results
            .iter()
            .any(|r| !r.is_error && r.content.contains("line one")),
        "read should reflect the just-written content; got {:?}",
        outcome.tool_results
    );
    assert_eq!(
        std::fs::read_to_string(d.path().join("note.txt")).unwrap(),
        "line one\nline two"
    );
}

#[tokio::test]
async fn run_command_preserves_redirection_and_chaining() {
    let d = tempfile::tempdir().unwrap();
    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let provider = Arc::new(MockProvider::new(vec![
        vec![
            tool_call(
                "c1",
                "run_command",
                r#"{"command":"echo hello_world > out.txt && echo chained_done"}"#,
            ),
            done(),
        ],
        vec![StreamEvent::TextDelta("all done".into()), done()],
    ]));
    let outcome = Agent::builder()
        .provider(provider)
        .tools(reg.mount(coding_tool_names()))
        .middleware(Arc::new(ApprovalMiddleware::in_memory()))
        .working_dir(d.path().to_path_buf())
        .max_rounds(4)
        .build()
        .run_to_completion("execute compound command", AutoRespond::AllowAll)
        .await;

    assert!(
        outcome.error.is_none(),
        "clean run expected: {:?}",
        outcome.error
    );
    assert!(
        outcome
            .tool_results
            .iter()
            .any(|r| !r.is_error && r.content.contains("chained_done")),
        "tool result should reflect chained execution: {:?}",
        outcome.tool_results
    );
    assert!(
        d.path().join("out.txt").exists(),
        "redirected file out.txt must be created on disk"
    );
    let content = std::fs::read_to_string(d.path().join("out.txt")).unwrap();
    assert!(
        content.contains("hello_world"),
        "redirected content must match; got {content:?}"
    );
}

/// Regression for the reported failure `read: path does not exist: $TMPDIR/pr42.diff`:
/// a `$VAR` inside a tool PARAMETER must resolve to a real absolute path — and an
/// UNDEFINED name must stay literal (relative to the working dir) so a typo can never
/// escape the workspace.
#[tokio::test]
async fn env_vars_in_tool_params_resolve_to_real_paths() {
    use jeikcode_kernel::tool::{ProgressSink, Tool};
    use tokio_util::sync::CancellationToken;

    let working_dir = tempfile::tempdir().unwrap();
    // Lives OUTSIDE the working dir, reachable ONLY through the expanded variable — the
    // exact shape that used to become a relative path and 404.
    let probe =
        jeikcode_capabilities::special_dirs::temp_dir().join("jeik-env-expansion-probe.txt");
    std::fs::write(&probe, "env-expansion-ok").unwrap();

    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let mounted = reg.mount(&["read"]);
    let read = mounted.get("read").expect("read tool registered");

    let ctx = jeikcode_kernel::tool::ToolContext {
        working_dir: working_dir.path().to_path_buf(),
        cancel: CancellationToken::new(),
        progress: ProgressSink::noop(),
        requester: None,
    };

    let out = read
        .execute(r#"{"path":"$TMPDIR/jeik-env-expansion-probe.txt"}"#, &ctx)
        .await;
    assert!(!out.is_error, "`$TMPDIR/...` must resolve: {}", out.content);
    assert!(out.content.contains("env-expansion-ok"), "{}", out.content);

    // The quoted form — copied verbatim from the prompt's environment facts.
    let out = read
        .execute(
            r#"{"path":"\"$TMPDIR/jeik-env-expansion-probe.txt\""}"#,
            &ctx,
        )
        .await;
    assert!(!out.is_error, "quoted form must resolve: {}", out.content);

    // An UNDEFINED variable stays verbatim → relative under the working dir (fail-closed:
    // it must NOT silently become the absolute `/x`).
    let out = read
        .execute(r#"{"path":"$JEIKCODE_UNSET_DIR/probe.txt"}"#, &ctx)
        .await;
    assert!(
        out.is_error,
        "unset names must not resolve: {}",
        out.content
    );
    assert!(
        out.content.contains("$JEIKCODE_UNSET_DIR"),
        "the literal token must stay visible in the error: {}",
        out.content
    );

    let _ = std::fs::remove_file(&probe);
}

/// The REPORTED bug, on the new code, through the REAL tool: a native tool's localized
/// (GBK) line must not drag the UTF-8 lines around it into the legacy decoder.
#[cfg(windows)]
#[tokio::test]
async fn native_gbk_line_does_not_mangle_utf8_output() {
    use jeikcode_kernel::tool::{ProgressSink, Tool};
    use tokio_util::sync::CancellationToken;

    let dir = tempfile::tempdir().unwrap();
    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let mounted = reg.mount(&["run_command"]);
    let bash = mounted.get("run_command").expect("run_command registered");
    let ctx = jeikcode_kernel::tool::ToolContext {
        working_dir: dir.path().to_path_buf(),
        cancel: CancellationToken::new(),
        progress: ProgressSink::noop(),
        requester: None,
    };

    // `taskkill` prints a localized GBK error line on zh-CN Windows; the surrounding
    // Chinese comes from bash (UTF-8). Before the fix the whole span was GBK-decoded.
    let out = bash
        .execute(
            r#"{"command":"echo 中文行一; taskkill /F /PID 999999; echo 中文行二","summary":"encoding probe"}"#,
            &ctx,
        )
        .await;
    assert!(!out.is_error, "{}", out.content);
    assert!(
        out.content.contains("中文行一"),
        "UTF-8 line before the legacy line must survive: {:?}",
        out.content
    );
    assert!(
        out.content.contains("中文行二"),
        "UTF-8 line after the legacy line must survive: {:?}",
        out.content
    );
    assert!(
        out.content.contains("999999"),
        "the native line is still rendered: {:?}",
        out.content
    );
}

/// The temp fix, seen from inside a real tool shell.
///
/// MSYS rewrites `TMPDIR`/`TMP`/`TEMP` BY NAME when a native parent (the daemon) starts a
/// bash child, so whatever we export arrives as the MSYS view (`/tmp`). The `BASH_ENV` rc
/// re-exports the native values from INSIDE the shell — this test pins both halves: the
/// shell's own `$TMPDIR` is native, and a NATIVE program resolves it to the real directory.
#[cfg(windows)]
#[tokio::test]
async fn shell_temp_dir_is_the_same_real_directory_as_the_native_temp() {
    use jeikcode_kernel::tool::{ProgressSink, Tool};
    use tokio_util::sync::CancellationToken;

    let dir = tempfile::tempdir().unwrap();
    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let mounted = reg.mount(&["run_command"]);
    let bash = mounted.get("run_command").expect("run_command registered");
    let ctx = jeikcode_kernel::tool::ToolContext {
        working_dir: dir.path().to_path_buf(),
        cancel: CancellationToken::new(),
        progress: ProgressSink::noop(),
        requester: None,
    };

    let out = bash
        .execute(
            r#"{"command":"printf 'TMP=%s\\n' \"$TMPDIR\"; printf 'real=%s\\n' \"$(cygpath -w \"$TMPDIR\")\"; powershell -NoProfile -Command 'if (Test-Path -LiteralPath $env:TMPDIR) { \"TMPDIR_NATIVE_OK\" } else { \"TMPDIR_NATIVE_BAD\" }'; printf x > \"$TMPDIR/jeik-tmp-probe\"; ls -1 \"$TMPDIR/jeik-tmp-probe\"","summary":"temp probe"}"#,
            &ctx,
        )
        .await;
    assert!(!out.is_error, "{}", out.content);
    // The shell's view (`TMP=/tmp`) and the native dir must resolve to the SAME place:
    // `cygpath -w` on the view must equal the normalized native temp dir.
    let real_line = out
        .content
        .lines()
        .find(|l| l.starts_with("real="))
        .unwrap_or_default();
    let expected = jeikcode_capabilities::special_dirs::temp_dir();
    // Trailing separators differ between the OS API and `cygpath`; compare the paths.
    let expected_display = expected
        .to_string_lossy()
        .replace('\\', "/")
        .trim_end_matches('/')
        .to_string();
    assert!(
        real_line.replace('\\', "/").to_ascii_lowercase().contains(&expected_display.to_ascii_lowercase()),
        "`cygpath -w \"$TMPDIR\"` must equal the native temp dir {expected_display:?}: {real_line:?}"
    );
    // After the re-export the shell's OWN `$TMPDIR` is native — no MSYS view to convert.
    let tmp_line = out
        .content
        .lines()
        .find(|l| l.starts_with("TMP="))
        .unwrap_or_default();
    assert!(
        !tmp_line.contains("TMP=/"),
        "`$TMPDIR` must be native in the shell: {tmp_line:?}"
    );
    assert!(
        out.content.contains("TMPDIR_NATIVE_OK"),
        "a native program must resolve the shell's `$TMPDIR`: {:?}",
        out.content
    );
    // The same variable is usable for a real write+read round trip.
    assert!(
        out.content.contains("jeik-tmp-probe"),
        "writing through $TMPDIR must work: {:?}",
        out.content
    );
    let _ = std::fs::remove_file(
        jeikcode_capabilities::special_dirs::temp_dir().join("jeik-tmp-probe"),
    );
}

/// The background report on the new code: the WORKLOAD's two real ids, the stop recipe,
/// and a verified kill through that exact recipe.
#[cfg(windows)]
#[tokio::test]
async fn background_report_carries_actionable_pids_and_the_recipe_kills() {
    use jeikcode_kernel::tool::{ProgressSink, Tool};
    use tokio_util::sync::CancellationToken;

    fn running(pid: u32) -> bool {
        let out = std::process::Command::new("tasklist")
            .args(["/FO", "CSV", "/NH"])
            .output()
            .expect("tasklist");
        String::from_utf8_lossy(&out.stdout).contains(&format!("\"{pid}\""))
    }

    let dir = tempfile::tempdir().unwrap();
    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let mounted = reg.mount(&["run_command"]);
    let bash = mounted.get("run_command").expect("run_command registered");
    let ctx = jeikcode_kernel::tool::ToolContext {
        working_dir: dir.path().to_path_buf(),
        cancel: CancellationToken::new(),
        progress: ProgressSink::noop(),
        requester: None,
    };

    let out = bash
        .execute(
            r#"{"command":"sleep 30","background":true,"settle_secs":2,"summary":"background probe"}"#,
            &ctx,
        )
        .await;
    assert!(!out.is_error, "{}", out.content);
    assert!(
        out.content.contains("WinPID"),
        "the report must name the id kind: {:?}",
        out.content
    );
    // The workload leaf (`sleep.exe`) is attributed, so the report offers BOTH ids.
    assert!(
        out.content.contains("sleep"),
        "the workload process must be attributed: {:?}",
        out.content
    );
    let wrapper: u32 = out
        .content
        .split("taskkill /F /T /PID ")
        .nth(1)
        .and_then(|rest| rest.split_whitespace().next())
        .and_then(|pid| {
            pid.trim_end_matches(['`', ')', ','].as_slice())
                .parse()
                .ok()
        })
        .unwrap_or_else(|| panic!("no taskkill recipe in: {:?}", out.content));
    assert!(
        running(wrapper),
        "the wrapper shell must be alive: {wrapper}"
    );

    // Execute the printed recipe verbatim (single slashes — conversion is disabled).
    let status = std::process::Command::new("taskkill")
        .args(["/F", "/T", "/PID", &wrapper.to_string()])
        .status()
        .expect("taskkill");
    assert!(status.success(), "taskkill /F /T must succeed");
    for _ in 0..10 {
        if !running(wrapper) {
            break;
        }
        std::thread::sleep(std::time::Duration::from_millis(200));
    }
    assert!(
        !running(wrapper),
        "the printed recipe must actually stop the task (wrapper {wrapper})"
    );
}

/// The shell-side temp fix: `$TMPDIR_WIN` must reach a NATIVE program as a usable native
/// path — the channel behind `--directory "$TMPDIR/x"` (python/node), because MSYS
/// rewrites the plain `$TMPDIR` into its POSIX view for every child shell.
#[cfg(windows)]
#[tokio::test]
async fn native_temp_handle_is_usable_by_a_native_program() {
    use jeikcode_kernel::tool::{ProgressSink, Tool};
    use tokio_util::sync::CancellationToken;

    let dir = tempfile::tempdir().unwrap();
    let mut reg = ToolRegistry::new();
    register_coding_tools(&mut reg);
    let mounted = reg.mount(&["run_command"]);
    let bash = mounted.get("run_command").expect("run_command registered");
    let ctx = jeikcode_kernel::tool::ToolContext {
        working_dir: dir.path().to_path_buf(),
        cancel: CancellationToken::new(),
        progress: ProgressSink::noop(),
        requester: None,
    };

    // (a) the handle is a NATIVE path inside the shell, and (b) a native program
    // (PowerShell) resolves that very handle to an existing directory.
    let out = bash
        .execute(
            r#"{"command":"printf 'WIN=%s\\n' \"$TMPDIR_WIN\"; powershell -NoProfile -Command 'if (Test-Path -LiteralPath $env:TMPDIR_WIN) { \"TMPDIR_WIN_OK\" } else { \"TMPDIR_WIN_BAD\" }'","summary":"native handle probe"}"#,
            &ctx,
        )
        .await;
    assert!(!out.is_error, "{}", out.content);
    let win_line = out
        .content
        .lines()
        .find(|l| l.starts_with("WIN="))
        .unwrap_or_default();
    assert!(
        !win_line.contains("WIN=/"),
        "`$TMPDIR_WIN` must be a native path in the shell: {win_line:?}"
    );
    assert!(
        win_line.contains(":/"),
        "must carry a drive letter: {win_line:?}"
    );
    assert!(
        out.content.contains("TMPDIR_WIN_OK"),
        "a native program must resolve `$TMPDIR_WIN` to a real directory: {:?}",
        out.content
    );
}
