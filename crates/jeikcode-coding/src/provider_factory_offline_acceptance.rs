use super::*;
use jeikcode_kernel::{message::Message, provider::ChatOptions, stream::{ProviderError, StreamEvent}, tool::{Tool, ToolContext, ToolRegistry, ProgressSink, ToolDef}};
use futures::StreamExt;
use std::sync::Mutex;

struct BlockingFactory {
    entered: Arc<tokio::sync::Notify>, release: Arc<tokio::sync::Notify>,
    built: Mutex<Vec<(CodingAgentConfig, Option<String>)>>, calls: Arc<Mutex<Vec<String>>>,
}
struct BlockingProvider { model: String, entered: Arc<tokio::sync::Notify>, release: Arc<tokio::sync::Notify>, calls: Arc<Mutex<Vec<String>>> }
#[async_trait::async_trait]
impl LlmProvider for BlockingProvider {
    fn model_name(&self) -> &str { &self.model }
    async fn chat_stream(&self, _: &[Message], _: &[ToolDef], _: &ChatOptions) -> Result<futures::stream::BoxStream<'static, StreamEvent>, ProviderError> {
        self.calls.lock().unwrap().push(self.model.clone());
        self.entered.notify_one();
        self.release.notified().await;
        Ok(futures::stream::iter(vec![StreamEvent::TextDelta("I am unrelated remote model".into()), StreamEvent::Done { truncated: false }]).boxed())
    }
}
impl CodingProviderFactory for BlockingFactory {
    fn build(&self, cfg: &CodingAgentConfig, session: Option<&str>) -> Result<Arc<dyn LlmProvider>, ProviderBuildError> {
        self.built.lock().unwrap().push((cfg.clone(), session.map(str::to_owned)));
        Ok(Arc::new(BlockingProvider { model: cfg.model.clone(), entered: self.entered.clone(), release: self.release.clone(), calls: self.calls.clone() }))
    }
}
#[tokio::test]
async fn per_task_model_running_and_queued_bindings_survive_refresh_and_session_change() {
    let factory = Arc::new(BlockingFactory { entered: Arc::new(tokio::sync::Notify::new()), release: Arc::new(tokio::sync::Notify::new()), built: Mutex::new(Vec::new()), calls: Arc::new(Mutex::new(Vec::new())) });
    let mut parent = super::tests::config("responses");
    let mut registry = super::tests::task_registry();
    install_subagent_tiers(factory.clone(), &mut parent, &registry);
    let routing = parent.task_model_routing.clone().unwrap();
    routing.set_session_id("old-session");
    let reg = Arc::new(ToolRegistry::new());
    let other = reg.clone();
    let tool = jeikcode_capabilities::tools::TaskTool::new(|| panic!("no legacy"), || panic!("no legacy"), move || reg.mount(&[]), move || other.mount(&[]))
        .with_max_concurrent(1).with_model_resolver(Some(Arc::new({ let routing = routing.clone(); move |id| routing.resolve(id) })));
    let dir = tempfile::tempdir().unwrap();
    let ctx = ToolContext { working_dir: dir.path().into(), cancel: tokio_util::sync::CancellationToken::new(), progress: ProgressSink::noop(), requester: None };
    let run = tokio::spawn(async move { tool.execute(r#"{"tasks":[{"description":"running","prompt":"p","model_id":"local8045/gemini"},{"description":"queued","prompt":"p","model_id":"local8045/gemini"}]}"#, &ctx).await });
    tokio::time::timeout(std::time::Duration::from_secs(3), factory.entered.notified()).await.unwrap();
    assert_eq!(factory.built.lock().unwrap().len(), 2, "both bindings captured before queue wait");
    registry.models.get_mut("local8045/gemini").unwrap().model = "new-api".into();
    registry.provider_accounts.get_mut("local8045").unwrap().api_key = Some("new-secret".into());
    refresh_subagent_tiers(factory.clone(), &parent, &registry);
    routing.set_session_id("new-session");
    factory.release.notify_one();
    tokio::time::timeout(std::time::Duration::from_secs(3), factory.entered.notified()).await.unwrap();
    factory.release.notify_one();
    let result = tokio::time::timeout(std::time::Duration::from_secs(3), run).await.unwrap().unwrap();
    assert!(!result.is_error, "{}", result.content);
    assert_eq!(*factory.calls.lock().unwrap(), vec!["gemini-api", "gemini-api"]);
    assert_eq!(result.content.matches("\"effective_api_model\":\"gemini-api\"").count(), 2);
    assert_eq!(result.content.matches("\"remote_serving_identity\":null").count(), 2);
    assert!(!result.content.contains("secret"));
    let new = routing.resolve("local8045/gemini").unwrap();
    assert_eq!(new.api_model, "new-api");
    let built = factory.built.lock().unwrap();
    for (cfg, session) in &built[..2] { assert_eq!(cfg.api_key, "task-secret"); assert_eq!(session.as_deref(), Some("old-session")); }
    assert_eq!(built[2].0.api_key, "new-secret");
    assert_eq!(built[2].1.as_deref(), Some("new-session"));
    assert_eq!(parent.model, "model"); assert_eq!(parent.api_key, "key"); assert_eq!(parent.provider_type, "responses");
}

struct RejectFactory;
impl CodingProviderFactory for RejectFactory {
    fn build(&self, _: &CodingAgentConfig, _: Option<&str>) -> Result<Arc<dyn LlmProvider>, ProviderBuildError> { Err(ProviderBuildError::Authentication("https://user:secret@offline.invalid?key=secret".into())) }
}
#[test]
fn explicit_model_id_empty_api_and_factory_auth_failure_are_safe() {
    let mut parent = super::tests::config("responses");
    let mut registry = super::tests::task_registry();
    let factory = Arc::new(super::tests::RecordingFactory(Mutex::new(Vec::new())));
    registry.models.get_mut("local8045/gemini").unwrap().model = " ".into();
    install_subagent_tiers(factory.clone(), &mut parent, &registry);
    assert!(parent.task_model_routing.as_ref().unwrap().resolve("local8045/gemini").is_err());
    assert!(factory.0.lock().unwrap().is_empty());
    registry.models.get_mut("local8045/gemini").unwrap().model = "gemini-api".into();
    refresh_subagent_tiers(Arc::new(RejectFactory), &parent, &registry);
    let error = parent.task_model_routing.as_ref().unwrap().resolve("local8045/gemini").err().unwrap();
    assert_eq!(error, "task provider construction failed"); assert!(!error.contains("secret"));
}
