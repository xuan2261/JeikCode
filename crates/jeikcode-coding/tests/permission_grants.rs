//! Verify that permission grants survive agent re-assembly (model swaps/reloads).

use std::sync::Arc;
use std::time::Duration;

use jeikcode_coding::{assemble, prepare, CodingAgentConfig, PrepareOptions, SessionMode};
use jeikcode_kernel::event::{AgentCommand, AgentEvent};
use jeikcode_kernel::stream::StreamEvent;
use jeikcode_kernel::testkit::RecordingProvider;
use jeikcode_kernel::tool::ToolCall;

#[ctor::ctor]
fn _isolate_jeikcode_home() {
    jeikcode_kernel::test_support::isolate_home();
}

#[tokio::test]
async fn always_allow_grants_survive_reassembly() {
    let home = tempfile::tempdir().unwrap();
    let project = tempfile::tempdir().unwrap();
    // Canonicalize: a path containing `../..` is an “unresolved parent traversal” per the write
    // gate's design → prompted WITHOUT remembering every time, so the grant can never survive
    // re-assembly (which is exactly what this test measures).
    let workspace_target = std::fs::canonicalize(
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../..")
            .join("target"),
    )
    .unwrap();
    let outside_dir = tempfile::tempdir_in(workspace_target).unwrap();
    let _home = jeikcode_config::test_util::IsolatedHome::at(home.path());

    let mut cfg = CodingAgentConfig::new("k", "http://unused", "test-model", project.path());
    cfg.timeouts = cfg.timeouts.with_content_liveness(Duration::from_secs(5));
    cfg.request_timeout = Some(Duration::from_secs(5));
    let opts = PrepareOptions {
        session: SessionMode::Disabled,
        skill_dirs: Some(vec![project.path().join("skills")]),
        plugin_skill_dirs: Vec::new(),
        shared_mcp_registry: None,
        mcp: false,
        memory: false,
        web: false,
        review: false,
        request_user_input: true,
        rate_limit_source: None,
    };
    let mut parts = prepare(&cfg, opts).await.unwrap();

    // Out-of-workspace write path
    let out_file = outside_dir.path().join("out.txt");
    let out_file_str = out_file.to_str().unwrap().to_string();

    // 1. Initial run: Model calls write_file (outside workspace, so WriteApprovalGate prompts).
    // The driver will approve with AllowAlways (decision: "allow_always").
    let provider1 = Arc::new(RecordingProvider::new(vec![
        vec![
            StreamEvent::ToolCall(ToolCall {
                id: "c1".into(),
                name: "write".into(), // 规范名（旧名 `write_file` 会走别名路径）
                arguments: format!(r#"{{"file_path":{:?},"content":"hello"}}"#, out_file_str),
            }),
            StreamEvent::Done { truncated: false },
        ],
        vec![
            StreamEvent::TextDelta("done writing".into()),
            StreamEvent::Done { truncated: false },
        ],
    ]));

    let mut h1 = assemble(&mut parts, &cfg, provider1).unwrap().spawn();

    h1.commands
        .send(AgentCommand::SendMessage {
            text: "write outside file".into(),
            images: vec![],
        })
        .unwrap();

    // 回复“始终允许 + 记住”——对应 UI 上的“本会话/始终允许”。
    // 排查结论（曾误判为实现 bug）：授权的记录/检查一直是对的；真正原因是本用例早先把文件
    // 写到带 `../..` 的路径下（未解析的父级穿越）——按写门设计，这种情况**每次都问、不记住**。
    // 夹具已规范化，授权正常跨重组生效。
    let mut seen_approval = false;
    while let Some(ev) = h1.events.recv().await {
        match ev {
            AgentEvent::Request { id, kind, .. } if kind == "approval" => {
                seen_approval = true;
                h1.commands
                    .send(AgentCommand::Respond {
                        id,
                        value: serde_json::json!({
                            "decision": "allow_always",
                            "remember": true
                        }),
                    })
                    .unwrap();
            }
            AgentEvent::TurnComplete { .. } => break,
            _ => {}
        }
    }
    h1.commands.send(AgentCommand::Shutdown).unwrap();
    let _ = h1.task.await;

    assert!(
        seen_approval,
        "Must have prompted for approval in the first run"
    );
    assert!(out_file.exists(), "The file should have been written");
    std::fs::remove_file(&out_file).unwrap();

    // 2. Re-assembly run: Assemble a new agent using the SAME parts but a NEW provider
    // (simulating a config reload or model switch).
    // This time, calling write_file on the same target must NOT prompt again because
    // the grant should survive in `parts.write_approval_grants`.
    let provider2 = Arc::new(RecordingProvider::new(vec![
        vec![
            StreamEvent::ToolCall(ToolCall {
                id: "c2".into(),
                name: "write".into(), // 规范名（旧名 `write_file` 会走别名路径）
                arguments: format!(
                    r#"{{"file_path":{:?},"content":"hello again"}}"#,
                    out_file_str
                ),
            }),
            StreamEvent::Done { truncated: false },
        ],
        vec![
            StreamEvent::TextDelta("done writing again".into()),
            StreamEvent::Done { truncated: false },
        ],
    ]));

    let mut h2 = assemble(&mut parts, &cfg, provider2).unwrap().spawn();
    h2.commands
        .send(AgentCommand::SendMessage {
            text: "write outside file again".into(),
            images: vec![],
        })
        .unwrap();

    let mut seen_approval_run2 = false;
    while let Some(ev) = h2.events.recv().await {
        match ev {
            AgentEvent::Request { kind, .. } if kind == "approval" => {
                seen_approval_run2 = true;
            }
            AgentEvent::TurnComplete { .. } => break,
            _ => {}
        }
    }
    h2.commands.send(AgentCommand::Shutdown).unwrap();
    let _ = h2.task.await;

    assert!(
        !seen_approval_run2,
        "Must NOT prompt for approval in the second run (grant should be remembered)"
    );
    assert!(
        out_file.exists(),
        "The file should have been written in the second run"
    );
}
