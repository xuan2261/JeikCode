use super::*;
use futures::StreamExt;
use jeikcode_kernel::{message::Message, provider::{ChatOptions, LlmProvider}, stream::{ProviderError, StreamEvent}, tool::{ToolCall, ToolDef}};
use std::sync::Mutex;

#[derive(Default)]
struct Recording {
    builds: Mutex<Vec<(CodingAgentConfig, Option<String>)>>,
    calls: Mutex<Vec<(String, ChatOptions)>>,
    next: Mutex<Option<String>>,
    batch: Mutex<Option<Vec<String>>>,
    release: tokio::sync::Notify,
    entered: tokio::sync::Notify,
    contexts: Mutex<Vec<(String, Vec<Message>)>>,
}
struct Provider { model: String, recording: Arc<Recording> }
#[async_trait::async_trait]
impl LlmProvider for Provider {
    fn model_name(&self) -> &str { &self.model }
    async fn chat_stream(&self, messages: &[Message], tools: &[ToolDef], options: &ChatOptions) -> Result<futures::stream::BoxStream<'static, StreamEvent>, ProviderError> {
        if self.model != "gpt-5" || tools.iter().any(|t| t.name == "task") {
            self.recording.calls.lock().unwrap().push((self.model.clone(), options.clone()));
        }
        self.recording.contexts.lock().unwrap().push((self.model.clone(), messages.to_vec()));
        if self.model == "blocked-api" { self.recording.entered.notify_one(); std::future::pending::<()>().await; }
        if self.model == "held-api" || (self.model == "held-parent" && tools.iter().any(|t| t.name == "task")) {
            self.recording.entered.notify_one();
            self.recording.release.notified().await;
        }
        if self.model == "failed-api" { return Err(ProviderError { message: "offline terminal failure".into(), ..Default::default() }); }
        let mut events = vec![];
        if self.model == "parent-api" || self.model == "gpt-5" || self.model == "held-parent" || self.model == "next-parent" {
            let batch = if tools.iter().any(|t| t.name == "task") { self.recording.batch.lock().unwrap().take() } else { None };
            if let Some(ids) = batch {
                events.push(StreamEvent::ToolCall(ToolCall { id: "offline-batch".into(), name: "task".into(), arguments: serde_json::json!({"tasks":ids.into_iter().map(|id| serde_json::json!({"description":"offline queued", "prompt":"answer without tools", "model_id":id})).collect::<Vec<_>>()}).to_string() }));
                events.push(StreamEvent::Done { truncated: false });
                return Ok(futures::stream::iter(events).boxed());
            }
            let next = if tools.iter().any(|t| t.name == "task") { self.recording.next.lock().unwrap().take() } else { None };
            if let Some(id) = next {
                assert!(tools.iter().any(|t| t.name == "task"), "actual runtime must mount task");
                events.push(StreamEvent::ToolCall(ToolCall { id: "offline-task".into(), name: "task".into(), arguments: serde_json::json!({"tasks":[{"description":"offline", "prompt":"answer without tools", "model_id":id}]}).to_string() }));
            } else { events.push(StreamEvent::TextDelta("parent complete".into())); }
        } else {
            assert!(!tools.iter().any(|t| t.name == "task"), "child must not recursively mount task");
            events.push(StreamEvent::TextDelta("child complete".into()));
        }
        events.push(StreamEvent::Done { truncated: false });
        Ok(futures::stream::iter(events).boxed())
    }
}
impl CodingProviderFactory for RecordingFactory {
    fn build(&self, cfg: &CodingAgentConfig, session: Option<&str>) -> Result<Arc<dyn LlmProvider>, crate::provider_factory::ProviderBuildError> {
        if cfg.model == "reject-parent" { return Err(crate::provider_factory::ProviderBuildError::Adapter("offline rejected reload".into())); }
        self.0.builds.lock().unwrap().push((cfg.clone(), session.map(str::to_owned)));
        Ok(Arc::new(Provider { model: cfg.model.clone(), recording: self.0.clone() }))
    }
}
struct RecordingFactory(Arc<Recording>);

// A distinct parent mock permits a genuinely omitted model_id request.
struct ResumeFactory { recording: Arc<Recording>, explicit: Mutex<Option<bool>> }
struct ResumeParent(Arc<ResumeFactory>);
#[async_trait::async_trait]
impl LlmProvider for ResumeParent {
    fn model_name(&self) -> &str { "parent-api" }
    async fn chat_stream(&self, messages: &[Message], tools: &[ToolDef], options: &ChatOptions) -> Result<futures::stream::BoxStream<'static, StreamEvent>, ProviderError> {
        // Session-title auxiliary requests use default options, not coordinator options.
        // Record mounted coordinator requests distinctly from those auxiliary calls.
        if tools.iter().any(|t| t.name == "task") {
            self.0.recording.calls.lock().unwrap().push(("parent-api".into(), options.clone()));
            self.0.recording.contexts.lock().unwrap().push(("parent-api".into(), messages.to_vec()));
        }
        let request = if tools.iter().any(|t| t.name == "task") { self.0.explicit.lock().unwrap().take() } else { None };
        let event = if let Some(explicit) = request {
            let mut task = serde_json::json!({"description":"offline resumed task", "prompt":"answer without tools", "difficulty":"hard"});
            if explicit { task["model_id"] = "mock/capable".into(); }
            StreamEvent::ToolCall(ToolCall { id: "resumed-task".into(), name: "task".into(), arguments: serde_json::json!({"tasks":[task]}).to_string() })
        } else { StreamEvent::TextDelta("parent complete".into()) };
        Ok(futures::stream::iter(vec![event, StreamEvent::Done { truncated: false }]).boxed())
    }
}
impl CodingProviderFactory for Arc<ResumeFactory> {
    fn build(&self, cfg: &CodingAgentConfig, session: Option<&str>) -> Result<Arc<dyn LlmProvider>, crate::provider_factory::ProviderBuildError> {
        self.recording.builds.lock().unwrap().push((cfg.clone(), session.map(str::to_owned)));
        if cfg.model == "parent-api" { Ok(Arc::new(ResumeParent(self.clone()))) }
        else { Ok(Arc::new(Provider { model: cfg.model.clone(), recording: self.recording.clone() })) }
    }
}

async fn assert_native_resumed_task_persistence(explicit: bool) {
    struct RestoreHome(Option<std::ffi::OsString>);
    impl Drop for RestoreHome {
        fn drop(&mut self) {
            match &self.0 { Some(v) => std::env::set_var("JEIKCODE_HOME", v), None => std::env::remove_var("JEIKCODE_HOME") }
        }
    }
    let dir = tempfile::Builder::new().prefix("native-resume-route-").tempdir().unwrap();
    let project = dir.path().join("project");
    std::fs::create_dir_all(&project).unwrap();
    let _restore = RestoreHome(std::env::var_os("JEIKCODE_HOME"));
    std::env::set_var("JEIKCODE_HOME", dir.path().join("home"));
    let manager = jeikcode_capabilities::session::SessionManager::for_project(&project);
    let id = "native-resume-route-fixture";
    let original = SessionSnapshot::new(vec![Message::user("saved-parent-provenance-marker"), Message::assistant("saved-parent-answer", vec![])]);
    let original_value = serde_json::to_value(&original).unwrap();
    let prefix_bytes = serde_json::to_vec(&original.messages).unwrap();
    persist_native_session(&manager, id, &project, &original);
    let recording = Arc::new(Recording::default());
    let factory = Arc::new(ResumeFactory { recording: recording.clone(), explicit: Mutex::new(Some(explicit)) });
    let mut registry = jeikcode_config::config::Config::default();
    registry.provider_accounts.insert("mock".into(), serde_json::from_value(serde_json::json!({"provider":"gemini", "base_url":"https://offline.invalid/v1", "api_key":"child-synthetic-secret"})).unwrap());
    for (profile, model, rank) in [("parent", "parent-api", 0), ("capable", "capable-api", 1)] {
        registry.models.insert(format!("mock/{profile}"), serde_json::from_value(serde_json::json!({"account":"mock", "model":model, "capable_model":rank, "context_window":32000, "max_tokens":1234})).unwrap());
    }
    let mut start = native_start(false);
    start.agent.working_dir = project.clone();
    start.agent.model = "parent-api".into();
    start.agent.provider_name = "stable-parent".into();
    start.agent.provider_type = "responses".into();
    start.agent.api_key = "parent-synthetic-secret".into();
    start.agent.chat_options.temperature = Some(0.7);
    start.agent.chat_options.max_tokens = Some(4321);
    start.agent.subagent_config = Some(Arc::new(registry));
    start.prepare.session = crate::SessionMode::Resume(id.into());
    start.provider_factory = Arc::new(factory);
    let mut reopen = native_start(false);
    reopen.agent = start.agent.clone();
    reopen.prepare.session = crate::SessionMode::Resume(id.into());
    reopen.provider_factory = start.provider_factory.clone();
    let mut runtime = CodingRuntime::start(start).await.unwrap();
    // Use the real metadata transaction, not a mock store-operation log.
    manager.update_meta(id, |meta| {
        meta.name = "stable parent title".into();
        meta.user_renamed = true;
    }).unwrap();
    let parent_meta = manager.read_meta(id).unwrap();
    runtime.handle.submit(UserInput::from("run resumed offline task")).await.unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(10), async {
        loop {
            if let CodingRuntimeEvent::TurnFinished(completion) = runtime.events.recv().await.unwrap().event {
                match completion {
                    TurnCompletion::Completed { reason, .. } => {
                        assert_eq!(reason, StopReason::Stopped, "lượt mock phải hoàn tất bình thường");
                    }
                    TurnCompletion::SnapshotUnavailable { error, .. } => {
                        panic!("snapshot của lượt mock không khả dụng: {error:?}");
                    }
                }
                break;
            }
        }
    }).await.unwrap();
    let live = runtime.handle.snapshot().await.unwrap();
    let live_value = serde_json::to_value(live.as_ref()).unwrap();
    runtime.handle.shutdown().await.unwrap();
    drop(runtime);
    let persisted = manager.load_snapshot(id).unwrap();
    let loaded = manager.load_native_session(id).unwrap();
    let value = serde_json::to_value(&persisted).unwrap();
    assert_eq!(value["messages"], live_value["messages"]);
    // Resume may refresh System persona, never the saved conversation prefix.
    let conversation: Vec<_> = persisted.messages.iter().filter(|m| m.role != jeikcode_kernel::message::Role::System).cloned().collect();
    assert_eq!(serde_json::to_vec(&conversation[..original.messages.len()]).unwrap(), prefix_bytes);
    assert_eq!(serde_json::to_value(&loaded.snapshot).unwrap()["messages"], value["messages"]);
    let bytes = std::fs::read(manager.snapshot_path(id).unwrap()).unwrap();
    let roundtrip: SessionSnapshot = serde_json::from_slice(&bytes).unwrap();
    assert_eq!(serde_json::to_value(&roundtrip).unwrap(), value, "native serde is lossless including task calls/results");
    assert_eq!(value.as_object().unwrap().keys().collect::<Vec<_>>(), original_value.as_object().unwrap().keys().collect::<Vec<_>>(), "routing must not add global snapshot fields");
    for field in ["model_id", "requested_model_id", "resolved_registry_id", "selection_source", "effective_api_model", "task_model_routing"] {
        assert!(value.get(field).is_none());
        assert!(serde_json::to_value(manager.read_meta(id).unwrap()).unwrap().get(field).is_none());
    }
    // Bind the persisted assistant request to its persisted tool result; prose
    // or an unrelated route elsewhere in the snapshot cannot satisfy this proof.
    let call = persisted.messages.iter().flat_map(|m| &m.tool_calls)
        .find(|call| call.id == "resumed-task" && call.name == "task").unwrap();
    let args: serde_json::Value = serde_json::from_str(&call.arguments).unwrap();
    if explicit { assert_eq!(args["tasks"][0]["model_id"], "mock/capable"); }
    else { assert!(args["tasks"][0].get("model_id").is_none()); }
    let result = persisted.messages.iter().find(|m|
        m.role == jeikcode_kernel::message::Role::Tool && m.tool_call_id.as_deref() == Some(call.id.as_str())).unwrap();
    assert!(!result.is_error);
    let route_json = result.text.split_once("<route>").unwrap().1.split_once("</route>").unwrap().0;
    let route: serde_json::Value = serde_json::from_str(route_json).unwrap();
    assert_eq!(route["selection_source"], if explicit { "explicit_task" } else { "legacy_difficulty" });
    assert_eq!(route["status"], "provider_called");
    assert_eq!(route["effective_api_model"], "capable-api");
    assert_eq!(route["remote_serving_identity"], serde_json::Value::Null);
    if explicit {
        assert_eq!(route["requested_model_id"], "mock/capable");
        assert_eq!(route["resolved_registry_id"], "mock/capable");
        assert_eq!(route["provider_id"], "mock");
        assert_eq!(route["resolved_api_model"], "capable-api");
    } else {
        for key in ["requested_model_id", "resolved_registry_id", "provider_id", "resolved_api_model"] {
            assert!(route.get(key).is_none(), "omitted model must retain the legacy receipt: {key}");
        }
    }
    let after_meta = manager.read_meta(id).unwrap();
    assert_eq!((&after_meta.id, &after_meta.name, after_meta.user_renamed, &after_meta.preferred_model, &after_meta.working_dir, after_meta.owner),
        (&parent_meta.id, &parent_meta.name, parent_meta.user_renamed, &parent_meta.preferred_model, &parent_meta.working_dir, parent_meta.owner));
    // Reopen without submitting a new turn: the completed persisted messages,
    // including the last task receipt, must be authoritative on resume.
    let resumed = CodingRuntime::start(reopen).await.unwrap();
    let reopened = resumed.handle.snapshot().await.unwrap();
    let reopened_conversation: Vec<_> = reopened.messages.iter().filter(|m| m.role != jeikcode_kernel::message::Role::System).cloned().collect();
    assert_eq!(serde_json::to_vec(&reopened_conversation).unwrap(), serde_json::to_vec(&conversation).unwrap());
    resumed.handle.shutdown().await.unwrap();
    drop(resumed);
    let saved_again = manager.load_snapshot(id).unwrap();
    let saved_conversation: Vec<_> = saved_again.messages.iter().filter(|m| m.role != jeikcode_kernel::message::Role::System).cloned().collect();
    assert_eq!(serde_json::to_vec(&saved_conversation).unwrap(), serde_json::to_vec(&conversation).unwrap());
    assert!(!value.to_string().contains("synthetic-secret"));
    let calls = recording.calls.lock().unwrap();
    let children: Vec<_> = calls.iter().filter(|(m, _)| m == "capable-api").collect();
    assert_eq!(children.len(), 1);
    assert_eq!(children[0].1.max_tokens, if explicit { Some(1234) } else { ChatOptions::default().max_tokens });
    assert_eq!(children[0].1.temperature, ChatOptions::default().temperature);
    assert_eq!(calls.iter().filter(|(m, _)| m == "parent-api").count(), 2);
    for (_, options) in calls.iter().filter(|(m, _)| m == "parent-api") {
        assert_eq!(options.temperature, Some(0.7));
        assert_eq!(options.max_tokens, Some(4321));
    }
    let contexts = recording.contexts.lock().unwrap();
    let child_contexts: Vec<_> = contexts.iter().filter(|(m, _)| m == "capable-api").collect();
    assert_eq!(child_contexts.len(), 1);
    assert!(!serde_json::to_string(&child_contexts[0].1).unwrap().contains("saved-parent-provenance-marker"));
    assert!(contexts.iter().filter(|(m, _)| m == "parent-api").all(|(_, messages)| serde_json::to_string(messages).unwrap().contains("saved-parent-provenance-marker")));
    let builds = recording.builds.lock().unwrap();
    assert_eq!(builds.iter().filter(|(cfg, _)| cfg.model == "capable-api").count(), 1);
    for (cfg, bound) in builds.iter().filter(|(cfg, _)| cfg.model == "parent-api") {
        assert_eq!(cfg.provider_name, "stable-parent");
        assert_eq!(cfg.provider_type, "responses");
        assert_eq!(cfg.api_key, "parent-synthetic-secret");
        assert_eq!(cfg.chat_options.temperature, Some(0.7));
        assert_eq!(bound.as_deref(), Some(id));
    }
    let (child, bound) = builds.iter().find(|(cfg, _)| cfg.model == "capable-api").unwrap();
    assert_eq!(child.provider_type, "gemini");
    assert_eq!(child.api_key, "child-synthetic-secret");
    assert_eq!(bound.as_deref(), if explicit { Some(id) } else { None });
}

#[tokio::test]
#[serial_test::serial(jeikcode_home)]
async fn runtime_offline_native_resumed_explicit_task_schema_and_provenance() {
    assert_native_resumed_task_persistence(true).await;
}

#[tokio::test]
#[serial_test::serial(jeikcode_home)]
async fn runtime_offline_native_resumed_omitted_task_schema_and_provenance() {
    assert_native_resumed_task_persistence(false).await;
}

#[tokio::test]
#[serial_test::serial(jeikcode_home)]
async fn runtime_offline_mounted_cross_provider_reload_and_snapshot_invariants() {
    let dir = tempfile::tempdir().unwrap();
    let recording = Arc::new(Recording::default());
    let mut registry = jeikcode_config::config::Config::default();
    registry.provider_accounts.insert("local8045".into(), serde_json::from_value(serde_json::json!({"provider":"gemini-compatible", "base_url":"https://offline.invalid/v1", "api_key":"task-secret"})).unwrap());
    registry.models.insert("local8045/gemini".into(), serde_json::from_value(serde_json::json!({"account":"local8045", "model":"gemini-api", "context_window":32000, "max_tokens":1234})).unwrap());
    let mut start = native_start(false);
    start.agent.working_dir = dir.path().into();
    start.agent.model = "parent-api".into();
    start.agent.provider_type = "responses".into();
    start.agent.api_key = "parent-only-synthetic".into();
    start.agent.chat_options.temperature = Some(0.7);
    start.agent.subagent_config = Some(Arc::new(registry.clone()));
    let parent = start.agent.clone();
    start.provider_factory = Arc::new(RecordingFactory(recording.clone()));
    let mut runtime = CodingRuntime::start(start).await.unwrap();
    let mut previous = serde_json::to_value(runtime.handle.snapshot().await.unwrap().as_ref()).unwrap();
    for (id, expected) in [("local8045/gemini", Some("gemini-api")), ("missing/profile", None), ("local8045/gemini", Some("failed-api")), ("local8045/gemini", Some("reloaded-api"))] {
        if expected == Some("failed-api") || expected == Some("reloaded-api") {
            registry.models.get_mut("local8045/gemini").unwrap().model = expected.unwrap().into();
            let mut next = parent.clone(); next.subagent_config = Some(Arc::new(registry.clone()));
            runtime.handle.reassemble_provider(next).await.unwrap();
            let mut rejected = parent.clone(); rejected.model = "reject-parent".into();
            assert!(runtime.handle.reassemble_provider(rejected).await.is_err());
        }
        let before = recording.builds.lock().unwrap().len();
        let calls_before = recording.calls.lock().unwrap().len();
        *recording.next.lock().unwrap() = Some(id.into());
        runtime.handle.submit(UserInput::from("run offline explicit task")).await.unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(10), wait_for_turn_finished(&mut runtime)).await.unwrap();
        let current = serde_json::to_value(runtime.handle.snapshot().await.unwrap().as_ref()).unwrap();
        let old_messages = previous["messages"].as_array().unwrap();
        let messages = current["messages"].as_array().unwrap();
        assert_eq!(&messages[..old_messages.len()], old_messages, "preexisting serialized conversation must be unchanged");
        assert_eq!(current.as_object().unwrap().keys().collect::<Vec<_>>(), previous.as_object().unwrap().keys().collect::<Vec<_>>(), "snapshot schema unchanged");
        let text = serde_json::to_string(&current).unwrap();
        assert!(!text.contains("task-secret")); assert!(!text.contains("parent-only-synthetic"));
        let builds = recording.builds.lock().unwrap();
        assert_eq!(builds.len() - before, usize::from(expected.is_some()), "unknown ID must construct zero providers");
        let calls = recording.calls.lock().unwrap();
        let child_calls: Vec<_> = calls[calls_before..].iter().filter(|(m, _)| m != "parent-api").collect();
        if let Some(model) = expected {
            assert_eq!(child_calls.len(), 1); assert_eq!(child_calls[0].0, model);
            assert_eq!(child_calls[0].1.max_tokens, Some(1234)); assert_eq!(child_calls[0].1.temperature, None);
            let (cfg, session) = builds.last().unwrap();
            assert_eq!(cfg.provider_type, "gemini"); assert_eq!(cfg.model, model);
            assert_eq!(cfg.api_key, "task-secret"); assert_eq!(cfg.context_window, 32000);
            assert_eq!(session, &None, "disabled-session runtime must not fabricate a session");
            assert!(text.contains(model));
        } else { assert!(child_calls.is_empty()); assert!(text.contains("unresolved")); }
        for (model, options) in &calls[calls_before..] { if model == "parent-api" { assert_eq!(options.temperature, Some(0.7)); } }
        previous = current;
    }
    registry.models.get_mut("local8045/gemini").unwrap().model = "blocked-api".into();
    let mut next = parent.clone(); next.subagent_config = Some(Arc::new(registry));
    runtime.handle.reassemble_provider(next).await.unwrap();
    *recording.next.lock().unwrap() = Some("local8045/gemini".into());
    runtime.handle.submit(UserInput::from("cancel offline task")).await.unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(5), recording.entered.notified()).await.unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(5), runtime.handle.cancel()).await.unwrap().unwrap();
    let cancelled = serde_json::to_value(runtime.handle.snapshot().await.unwrap().as_ref()).unwrap();
    let old_messages = previous["messages"].as_array().unwrap();
    assert_eq!(&cancelled["messages"].as_array().unwrap()[..old_messages.len()], old_messages);
    assert_eq!(cancelled.as_object().unwrap().keys().collect::<Vec<_>>(), previous.as_object().unwrap().keys().collect::<Vec<_>>());
    assert!(!cancelled.to_string().contains("task-secret"));
    assert_eq!(parent.model, "parent-api"); assert_eq!(parent.provider_type, "responses");
    assert_eq!(parent.api_key, "parent-only-synthetic");
    assert_eq!(parent.subagent_config.as_ref().unwrap().models["local8045/gemini"].model, "gemini-api", "original registry snapshot immutable after reload");
    runtime.handle.shutdown().await.unwrap();
}

// The existing start/factory seam exercises preparation, mounting and both real
// runtime turns without constructing a network adapter or changing retry policy.
#[tokio::test]
#[serial_test::serial(jeikcode_home)]
async fn runtime_offline_persisted_two_provider_explicit_pins() {
    struct RestoreHome(Option<std::ffi::OsString>);
    impl Drop for RestoreHome {
        fn drop(&mut self) {
            match &self.0 { Some(value) => std::env::set_var("JEIKCODE_HOME", value), None => std::env::remove_var("JEIKCODE_HOME") }
        }
    }
    let dir = tempfile::tempdir().unwrap();
    let home = dir.path().join("home");
    let project = dir.path().join("project");
    std::fs::create_dir_all(&project).unwrap();
    let _restore = RestoreHome(std::env::var_os("JEIKCODE_HOME"));
    std::env::set_var("JEIKCODE_HOME", &home);
    let recording = Arc::new(Recording::default());
    let mut registry = jeikcode_config::config::Config::default();
    for (account, protocol, api) in [("gemini_mock", "gemini", "gemini-api"), ("claude_mock", "claude", "claude-api")] {
        registry.provider_accounts.insert(account.into(), serde_json::from_value(serde_json::json!({"provider":protocol, "base_url":"https://offline.invalid/v1", "api_key":format!("{account}-synthetic-secret")})).unwrap());
        registry.models.insert(format!("{account}/pin"), serde_json::from_value(serde_json::json!({"account":account, "model":api, "context_window":32000, "max_tokens":1234})).unwrap());
    }
    let mut start = native_start(false);
    start.agent.working_dir = project.clone();
    start.agent.model = "gpt-5".into();
    start.agent.provider_type = "responses".into();
    start.agent.api_key = "coordinator-synthetic-secret".into();
    start.agent.chat_options.temperature = Some(0.7);
    start.agent.subagent_config = Some(Arc::new(registry));
    start.prepare.session = crate::SessionMode::Fresh;
    start.provider_factory = Arc::new(RecordingFactory(recording.clone()));
    let mut runtime = CodingRuntime::start(start).await.unwrap();
    let session = recording.builds.lock().unwrap().iter().find(|(cfg, _)| cfg.model == "gpt-5").unwrap().1.clone().expect("prepared runtime has persisted session");
    let manager = jeikcode_capabilities::session::SessionManager::for_project(&project);
    let mut previous = serde_json::to_value(runtime.handle.snapshot().await.unwrap().as_ref()).unwrap();
    for (account, protocol, api) in [("gemini_mock", "gemini", "gemini-api"), ("claude_mock", "claude", "claude-api")] {
        let pin = format!("{account}/pin");
        let before = recording.calls.lock().unwrap().len();
        *recording.next.lock().unwrap() = Some(pin.clone());
        runtime.handle.submit(UserInput::from("coordinator-only-history-marker; run pinned task")).await.unwrap();
        tokio::time::timeout(std::time::Duration::from_secs(10), wait_for_turn_finished(&mut runtime)).await.unwrap();
        let current = serde_json::to_value(runtime.handle.snapshot().await.unwrap().as_ref()).unwrap();
        let prefix = previous["messages"].as_array().unwrap();
        assert_eq!(&current["messages"].as_array().unwrap()[..prefix.len()], prefix);
        assert_eq!(current.as_object().unwrap().keys().collect::<Vec<_>>(), previous.as_object().unwrap().keys().collect::<Vec<_>>());
        let persisted = serde_json::to_value(manager.load_snapshot(&session).unwrap()).unwrap();
        assert_eq!(persisted["messages"], current["messages"], "actual native file must retain the parent conversation");
        let text = current.to_string();
        assert!(!text.contains("synthetic-secret"));
        // Receipts are embedded in parent tool results, not guessed from prose.
        let receipts = current["messages"].as_array().unwrap()[prefix.len()..].iter().map(|m| m.to_string()).collect::<Vec<_>>().join("\n");
        let unescaped = receipts.replace("\\\"", "\"");
        assert!(unescaped.contains(&format!("\"requested_model_id\":\"{pin}\"")));
        assert!(unescaped.contains(&format!("\"resolved_api_model\":\"{api}\"")));
        assert!(unescaped.contains(&format!("\"effective_api_model\":\"{api}\"")));
        assert!(unescaped.contains("\"selection_source\":\"explicit_task\""));
        assert!(unescaped.contains("\"remote_serving_identity\":null"));
        let builds = recording.builds.lock().unwrap();
        let child = builds.iter().find(|(cfg, _)| cfg.model == api).unwrap();
        assert_eq!(child.0.provider_type, if protocol == "claude" { "anthropic" } else { protocol });
        assert_eq!(child.0.api_key, format!("{account}-synthetic-secret"));
        assert_eq!(child.0.context_window, 32000);
        assert_eq!(child.1.as_deref(), Some(session.as_str()));
        for (cfg, bound) in builds.iter().filter(|(cfg, _)| cfg.model == "gpt-5") {
            assert_eq!(cfg.provider_type, "responses");
            assert_eq!(cfg.api_key, "coordinator-synthetic-secret");
            assert_eq!(cfg.chat_options.temperature, Some(0.7));
            assert_eq!(bound.as_deref(), Some(session.as_str()));
        }
        let calls = recording.calls.lock().unwrap();
        let child_calls: Vec<_> = calls[before..].iter().filter(|(model, _)| model != "gpt-5").collect();
        assert_eq!(child_calls.len(), 1);
        assert_eq!(child_calls[0].0, api);
        assert_eq!(child_calls[0].1.max_tokens, Some(1234));
        assert_eq!(child_calls[0].1.temperature, None);
        for (_, opts) in calls[before..].iter().filter(|(model, _)| model == "gpt-5") { assert_eq!(opts.temperature, Some(0.7)); }
        let contexts = recording.contexts.lock().unwrap();
        let child_context = contexts.iter().find(|(model, _)| model == api).unwrap();
        let context = serde_json::to_string(&child_context.1).unwrap();
        assert!(context.contains("answer without tools"));
        assert!(!context.contains("coordinator-only-history-marker"), "child must not inherit parent conversation");
        assert!(!context.contains("synthetic-secret"));
        previous = current;
    }
    assert!(recording.builds.lock().unwrap().iter().all(|(cfg, _)| ["gpt-5", "gemini-api", "claude-api"].contains(&cfg.model.as_str())), "no unrequested provider builds; auxiliary title builds may reuse GPT");
    runtime.handle.shutdown().await.unwrap();
    assert_eq!(serde_json::to_value(manager.load_snapshot(&session).unwrap()).unwrap()["messages"], previous["messages"]);
}

// Reload intentionally stops the old agent: surviving queue execution is tested
// against the live resolver refresh, then actual reload's cancellation contract.
#[tokio::test]
#[serial_test::serial(jeikcode_home)]
async fn runtime_offline_persisted_queue_refresh_and_inflight_parent_reload() {
    struct RestoreHome(Option<std::ffi::OsString>);
    impl Drop for RestoreHome {
        fn drop(&mut self) {
            match &self.0 { Some(v) => std::env::set_var("JEIKCODE_HOME", v), None => std::env::remove_var("JEIKCODE_HOME") }
        }
    }
    let dir = tempfile::Builder::new().prefix("persisted-route-").tempdir_in("C:/Work/JeikCode/target").unwrap();
    let project = dir.path().join("project");
    std::fs::create_dir_all(&project).unwrap();
    let _restore = RestoreHome(std::env::var_os("JEIKCODE_HOME"));
    std::env::set_var("JEIKCODE_HOME", dir.path().join("home"));
    let recording = Arc::new(Recording::default());
    let factory = Arc::new(RecordingFactory(recording.clone()));
    let mut registry = jeikcode_config::config::Config::default();
    registry.subagent.max_concurrent = 1;
    registry.provider_accounts.insert("mock".into(), serde_json::from_value(serde_json::json!({"provider":"gemini", "base_url":"https://offline.invalid/v1", "api_key":"old-task-synthetic-secret"})).unwrap());
    for (id, api) in [("running", "held-api"), ("queued", "queued-api")] {
        registry.models.insert(format!("mock/{id}"), serde_json::from_value(serde_json::json!({"account":"mock", "model":api,"max_tokens":1234})).unwrap());
    }
    let mut start = native_start(false);
    start.agent.working_dir = project.clone();
    start.agent.model = "parent-api".into();
    start.agent.provider_name = "parent-account".into();
    start.agent.provider_type = "responses".into();
    start.agent.api_key = "parent-synthetic-secret".into();
    start.agent.chat_options.temperature = Some(0.7);
    start.agent.subagent_config = Some(Arc::new(registry.clone()));
    start.prepare.session = crate::SessionMode::Fresh;
    start.provider_factory = factory.clone();
    let mut config = start.agent.clone();
    let mut runtime = CodingRuntime::start(start).await.unwrap();
    let session = recording.builds.lock().unwrap()[0].1.clone().unwrap();
    assert!(!session.is_empty());
    // Capture the actual runtime-installed resolver from the parent build, not
    // an independently assembled task tool or invented session ID.
    config.task_model_routing = recording.builds.lock().unwrap()[0].0.task_model_routing.clone();
    assert!(config.task_model_routing.is_some());
    let manager = jeikcode_capabilities::session::SessionManager::for_project(&project);
    runtime.handle.submit(UserInput::from("nonempty-parent-history-marker")).await.unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(10), wait_for_turn_finished(&mut runtime)).await.unwrap();
    let baseline = serde_json::to_value(runtime.handle.snapshot().await.unwrap().as_ref()).unwrap();
    *recording.batch.lock().unwrap() = Some(vec!["mock/running".into(), "mock/queued".into()]);
    runtime.handle.submit(UserInput::from("run both pinned routes")).await.unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(5), recording.entered.notified()).await.unwrap();
    {
        let builds = recording.builds.lock().unwrap();
        for api in ["held-api", "queued-api"] {
            let (cfg, bound) = builds.iter().find(|(cfg, _)| cfg.model == api).unwrap();
            assert_eq!(bound.as_deref(), Some(session.as_str()));
            assert_eq!(cfg.api_key, "old-task-synthetic-secret");
        }
        assert!(!recording.calls.lock().unwrap().iter().any(|(m, _)| m == "queued-api"), "second bound child really waits behind running child");
    }
    for model in registry.models.values_mut() { model.model = "updated-api".into(); }
    registry.provider_accounts.get_mut("mock").unwrap().api_key = Some("new-task-synthetic-secret".into());
    crate::provider_factory::refresh_subagent_tiers(factory.clone(), &config, &registry);
    recording.release.notify_one();
    tokio::time::timeout(std::time::Duration::from_secs(10), wait_for_turn_finished(&mut runtime)).await.unwrap();
    let completed = serde_json::to_value(runtime.handle.snapshot().await.unwrap().as_ref()).unwrap();
    assert_eq!(&completed["messages"].as_array().unwrap()[..baseline["messages"].as_array().unwrap().len()], baseline["messages"].as_array().unwrap());
    for api in ["held-api", "queued-api"] {
        let contexts = recording.contexts.lock().unwrap();
        let (_, messages) = contexts.iter().find(|(m, _)| m == api).unwrap();
        assert!(!serde_json::to_string(messages).unwrap().contains("nonempty-parent-history-marker"));
        assert!(completed.to_string().replace("\\\"", "\"").contains(&format!("\"effective_api_model\":\"{api}\"")));
    }
    assert!(!recording.calls.lock().unwrap().iter().any(|(m, _)| m == "updated-api"));
    assert_eq!(serde_json::to_value(manager.load_snapshot(&session).unwrap()).unwrap()["messages"], completed["messages"]);
    // Actual provider reload stops running/queued children. It must not cause
    // a queued old binding to issue a request against the new generation.
    let mut blocked_registry = registry.clone();
    blocked_registry.models.get_mut("mock/running").unwrap().model = "held-api".into();
    blocked_registry.models.get_mut("mock/queued").unwrap().model = "never-issued-api".into();
    config.subagent_config = Some(Arc::new(blocked_registry));
    runtime.handle.reassemble_provider(config.clone()).await.unwrap();
    while runtime.events.try_recv().is_ok() {}
    *recording.batch.lock().unwrap() = Some(vec!["mock/running".into(), "mock/queued".into()]);
    runtime.handle.submit(UserInput::from("reload with running and queued child")).await.unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(5), recording.entered.notified()).await.unwrap();
    assert!(recording.builds.lock().unwrap().iter().any(|(cfg, bound)| cfg.model == "never-issued-api" && bound.as_deref() == Some(session.as_str())));
    assert!(!recording.calls.lock().unwrap().iter().any(|(m, _)| m == "never-issued-api"));
    config.model = "held-parent".into();
    config.subagent_config = Some(Arc::new(registry.clone()));
    tokio::time::timeout(std::time::Duration::from_secs(10), runtime.handle.reassemble_provider(config.clone())).await.unwrap().unwrap();
    assert!(!recording.calls.lock().unwrap().iter().any(|(m, _)| m == "never-issued-api"), "reload cancels queue, never reroutes its admitted binding");
    while runtime.events.try_recv().is_ok() {}
    runtime.handle.submit(UserInput::from("inflight-parent-marker")).await.unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(5), recording.entered.notified()).await.unwrap();
    let held_request = recording.contexts.lock().unwrap().iter().rev().find(|(m, _)| m == "held-parent").unwrap().1.clone();
    assert!(serde_json::to_string(&held_request).unwrap().contains("nonempty-parent-history-marker"));
    assert!(serde_json::to_string(&held_request).unwrap().contains("inflight-parent-marker"));
    // The real reload cancels this blocked request rather than mutating it.
    config.model = "next-parent".into();
    config.provider_name = "next-parent-account".into();
    config.chat_options.temperature = Some(0.2);
    tokio::time::timeout(std::time::Duration::from_secs(10), runtime.handle.reassemble_provider(config.clone())).await.unwrap().unwrap();
    let restored = serde_json::to_value(runtime.handle.snapshot().await.unwrap().as_ref()).unwrap();
    // Provider reload deliberately refreshes model-specific System persona;
    // real user/assistant/tool conversation, including nonempty history, is immutable.
    let conversation = |v: &serde_json::Value| v["messages"].as_array().unwrap().iter().filter(|m| m["role"] != "System").cloned().collect::<Vec<_>>();
    let old_conversation = conversation(&completed);
    assert_eq!(&conversation(&restored)[..old_conversation.len()], &old_conversation);
    assert_eq!(recording.contexts.lock().unwrap().iter().rev().find(|(m, _)| m == "held-parent").unwrap().1, held_request);
    assert_eq!(conversation(&serde_json::to_value(manager.load_snapshot(&session).unwrap()).unwrap()), conversation(&restored));
    // Discard the cancellation terminal already generated by actual reload.
    while runtime.events.try_recv().is_ok() {}
    *recording.next.lock().unwrap() = Some("mock/queued".into());
    runtime.handle.submit(UserInput::from("new generation pinned task")).await.unwrap();
    tokio::time::timeout(std::time::Duration::from_secs(10), wait_for_turn_finished(&mut runtime)).await.unwrap();
    let final_snapshot = serde_json::to_value(runtime.handle.snapshot().await.unwrap().as_ref()).unwrap();
    assert!(final_snapshot.to_string().contains("updated-api"));
    assert!(!final_snapshot.to_string().contains("synthetic-secret"));
    assert!(!serde_json::to_string(&manager.read_meta(&session).unwrap()).unwrap().contains("synthetic-secret"));
    let builds = recording.builds.lock().unwrap();
    let (new_child, bound) = builds.iter().find(|(cfg, _)| cfg.model == "updated-api").unwrap();
    assert_eq!(new_child.api_key, "new-task-synthetic-secret");
    assert_eq!(bound.as_deref(), Some(session.as_str()));
    for (cfg, bound) in builds.iter().filter(|(cfg, _)| ["held-parent", "next-parent"].contains(&cfg.model.as_str())) {
        assert_eq!(cfg.provider_type, "responses");
        assert_eq!(cfg.api_key, "parent-synthetic-secret");
        assert_eq!(bound.as_deref(), Some(session.as_str()));
    }
    drop(builds);
    let calls = recording.calls.lock().unwrap();
    assert_eq!(calls.iter().find(|(m, _)| m == "held-parent").unwrap().1.temperature, Some(0.7));
    assert_eq!(calls.iter().find(|(m, _)| m == "next-parent").unwrap().1.temperature, Some(0.2));
    drop(calls);
    runtime.handle.shutdown().await.unwrap();
    assert_eq!(serde_json::to_value(manager.load_snapshot(&session).unwrap()).unwrap()["messages"], final_snapshot["messages"]);
}
