use super::*;
use futures::{stream, StreamExt};
use jeikcode_kernel::{message::Message, provider::ChatOptions, stream::{ProviderError, StreamEvent}, tool::{ToolDef, ToolRegistry}};
use std::sync::atomic::{AtomicUsize, Ordering};
struct Writer { calls: AtomicUsize, definitions: Arc<Mutex<Vec<Vec<String>>>> }
#[async_trait]
impl LlmProvider for Writer {
    fn model_name(&self) -> &str { "api" }
    async fn chat_stream(&self, _: &[Message], tools: &[ToolDef], _: &ChatOptions) -> Result<futures::stream::BoxStream<'static, StreamEvent>, ProviderError> {
        self.definitions.lock().unwrap().push(tools.iter().map(|t| t.name.clone()).collect());
        let n = self.calls.fetch_add(1, Ordering::SeqCst);
        let events = if n == 0 { vec![StreamEvent::ToolCall(ToolCall { id: "write".into(), name: "write_file".into(), arguments: json!({"file_path":"outside.txt","content":"must not write"}).to_string() }), StreamEvent::Done { truncated: false }] }
        else { vec![StreamEvent::TextDelta("finished".into()), StreamEvent::Done { truncated: false }] };
        Ok(stream::iter(events).boxed())
    }
}
#[tokio::test]
async fn per_task_model_worker_scope_and_explore_mount_enforced_in_child_loop() {
    for kind in ["worker", "explore"] {
        let mut reg = ToolRegistry::new();
        reg.register(Arc::new(super::super::WriteFileTool));
        let reg = Arc::new(reg);
        let other = reg.clone();
        let definitions = Arc::new(Mutex::new(Vec::new()));
        let provider = Arc::new(Writer { calls: AtomicUsize::new(0), definitions: definitions.clone() });
        let tool = TaskTool::new(|| panic!("no legacy"), || panic!("no legacy"), move || reg.mount(&[]), move || other.mount(&["write_file"]))
            .with_model_resolver(Some(Arc::new(move |id| Ok(TaskModelBinding { registry_id: id.into(), provider_id: "account".into(), api_model: "api".into(), provider: provider.clone(), chat_options: ChatOptions::default() }))));
        let dir = tempfile::tempdir().unwrap();
        let ctx = ToolContext { working_dir: dir.path().into(), cancel: tokio_util::sync::CancellationToken::new(), progress: jeikcode_kernel::tool::ProgressSink::noop(), requester: None };
        let args = json!({"tasks":[{"description":"scope","prompt":"offline","subagent_type":kind,"scope":["allowed.txt"],"model_id":"account/profile"}]}).to_string();
        let out = tool.execute(&args, &ctx).await;
        assert!(!dir.path().join("outside.txt").exists(), "{kind}: {}", out.content);
        let defs = definitions.lock().unwrap();
        assert!(!defs.is_empty());
        assert_eq!(defs[0].contains(&"write_file".to_string()), kind == "worker");
        assert!(out.content.contains("\"effective_api_model\":\"api\""));
        assert!(out.content.contains("\"remote_serving_identity\":null"));
    }
}
