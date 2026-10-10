//! Runtime mock acceptance: real child Agent, no transport or credentials.
use super::*;
use futures::{stream, StreamExt};
use jeikcode_kernel::{message::Message, provider::ChatOptions, stream::{ProviderError, StreamEvent}, tool::{ProgressSink, ToolDef, ToolRegistry}};
use std::sync::atomic::{AtomicUsize, Ordering};

fn context() -> ToolContext {
    ToolContext { working_dir: tempfile::tempdir().unwrap().keep(), cancel: tokio_util::sync::CancellationToken::new(), progress: ProgressSink::noop(), requester: None }
}
fn tool(provider: Arc<dyn LlmProvider>) -> TaskTool {
    let reg = Arc::new(ToolRegistry::new());
    let other = reg.clone();
    TaskTool::new(|| panic!("no legacy fast"), || panic!("no legacy capable"), move || reg.mount(&[]), move || other.mount(&[]))
        .with_model_resolver(Some(Arc::new(move |id| Ok(TaskModelBinding { registry_id: id.into(), provider_id: "account".into(), api_model: "api".into(), provider: provider.clone(), chat_options: ChatOptions::default() }))))
}
fn routes(text: &str, open: &str, close: &str) -> Vec<serde_json::Value> {
    text.split(open).skip(1).map(|s| serde_json::from_str(s.split(close).next().unwrap()).unwrap()).collect()
}
struct Failure { calls: Arc<AtomicUsize>, kind: &'static str }
#[async_trait]
impl LlmProvider for Failure {
    fn model_name(&self) -> &str { "api" }
    async fn chat_stream(&self, _: &[Message], _: &[ToolDef], _: &ChatOptions) -> Result<futures::stream::BoxStream<'static, StreamEvent>, ProviderError> {
        let n = self.calls.fetch_add(1, Ordering::SeqCst);
        let error = ProviderError { message: "https://user:secret@offline.invalid?api_key=secret".into(), retryable: self.kind == "retry", http_status: if self.kind == "429" { Some(429) } else { None }, retry_after_secs: if self.kind == "429" { Some(0) } else { None }, ..Default::default() };
        if self.kind == "mid" { return Ok(stream::iter(vec![StreamEvent::TextDelta("partial".into()), StreamEvent::Error(error)]).boxed()); }
        if self.kind == "retry" && n > 0 { return Ok(stream::iter(vec![StreamEvent::TextDelta("I am other-model".into()), StreamEvent::Done { truncated: false }]).boxed()); }
        Err(error)
    }
}
#[tokio::test]
async fn per_task_model_open_midstream_and_429_receipts_are_local_not_remote() {
    for kind in ["open", "mid", "429"] {
        let calls = Arc::new(AtomicUsize::new(0));
        let events = Arc::new(Mutex::new(Vec::new()));
        let mut ctx = context();
        ctx.progress = ProgressSink::new(Arc::new({ let events = events.clone(); move |s| events.lock().unwrap().push(s) }));
        let out = tool(Arc::new(Failure { calls: calls.clone(), kind })).execute(r#"{"tasks":[{"description":"failure","prompt":"offline","model_id":"account/profile"}]}"#, &ctx).await;
        assert!(out.is_error, "{kind}: {}", out.content);
        // Retry-After 0 exercises the unchanged 429 livelock fuse (MAX_RATE_LIMIT_WAITS = 5 in kernel agent.rs + final open).
        assert_eq!(calls.load(Ordering::SeqCst), if kind == "429" { 6 } else { 1 }, "{kind}");
        let final_routes = routes(&out.content, "<route>", "</route>");
        assert_eq!(final_routes.len(), 1);
        let r = &final_routes[0];
        assert_eq!(r["requested_model_id"], "account/profile");
        assert_eq!(r["provider_id"], "account");
        assert_eq!(r["resolved_api_model"], "api");
        assert_eq!(r["effective_api_model"], "api");
        assert_eq!(r["status"], "provider_called");
        assert!(r["remote_serving_identity"].is_null());
        let events = events.lock().unwrap();
        let receipts: Vec<_> = events.iter().filter(|s| s.starts_with("<task_route")).collect();
        assert_eq!(receipts.len(), 2);
        assert!(receipts[0].contains("\"effective_api_model\":null"));
        assert!(receipts[1].contains("\"effective_api_model\":\"api\""));
        assert!(!out.content.contains("secret"));
        assert!(!events.join("\n").contains("secret"));
    }
}
#[tokio::test]
async fn per_task_model_same_provider_retry_keeps_binding_and_policy() {
    let calls = Arc::new(AtomicUsize::new(0));
    let out = tool(Arc::new(Failure { calls: calls.clone(), kind: "retry" })).execute(r#"{"tasks":[{"description":"retry","prompt":"offline","model_id":"account/profile"}]}"#, &context()).await;
    assert!(!out.is_error, "{}", out.content);
    assert_eq!(calls.load(Ordering::SeqCst), 2);
    let r = routes(&out.content, "<route>", "</route>");
    assert_eq!(r.len(), 1);
    assert_eq!(r[0]["effective_api_model"], "api");
    assert!(r[0]["remote_serving_identity"].is_null());
}
struct Pending { entered: Arc<tokio::sync::Notify>, calls: Arc<AtomicUsize> }
#[async_trait]
impl LlmProvider for Pending {
    fn model_name(&self) -> &str { "api" }
    async fn chat_stream(&self, _: &[Message], _: &[ToolDef], _: &ChatOptions) -> Result<futures::stream::BoxStream<'static, StreamEvent>, ProviderError> {
        self.calls.fetch_add(1, Ordering::SeqCst);
        self.entered.notify_one();
        Ok(stream::pending().boxed())
    }
}
#[tokio::test]
async fn per_task_model_cancel_during_stream_retains_attempted_binding() {
    let entered = Arc::new(tokio::sync::Notify::new());
    let calls = Arc::new(AtomicUsize::new(0));
    let provider = Arc::new(Pending { entered: entered.clone(), calls: calls.clone() });
    let ctx = context();
    let cancel = ctx.cancel.clone();
    let run = tokio::spawn(async move { tool(provider).execute(r#"{"tasks":[{"description":"cancel","prompt":"p","model_id":"account/profile"}]}"#, &ctx).await });
    tokio::time::timeout(std::time::Duration::from_secs(3), entered.notified()).await.unwrap();
    cancel.cancel();
    let out = tokio::time::timeout(std::time::Duration::from_secs(3), run).await.unwrap().unwrap();
    assert!(out.is_error);
    assert!(out.content.contains("Cancelled"));
    assert_eq!(calls.load(Ordering::SeqCst), 1);
    let r = routes(&out.content, "<route>", "</route>");
    assert_eq!(r.len(), 1);
    assert_eq!(r[0]["requested_model_id"], "account/profile");
    assert_eq!(r[0]["effective_api_model"], "api");
    assert!(r[0]["remote_serving_identity"].is_null());
}
#[tokio::test]
async fn explicit_model_id_null_and_nonstrings_reject_mixed_batch_before_resolution() {
    let reg = Arc::new(ToolRegistry::new());
    let other = reg.clone();
    let tool = TaskTool::new(|| panic!("no provider"), || panic!("no provider"), move || reg.mount(&[]), move || other.mount(&[]))
        .with_model_resolver(Some(Arc::new(|_| panic!("no resolution"))));
    for value in [json!(null), json!(42), json!(true), json!({}), json!([])] {
        let args = json!({"tasks":[{"description":"valid","prompt":"p","model_id":"account/profile"},{"description":"invalid","prompt":"p","model_id":value}]}).to_string();
        let out = tool.execute(&args, &context()).await;
        assert!(out.is_error);
        assert!(!out.content.contains("provider_called"));
    }
}
