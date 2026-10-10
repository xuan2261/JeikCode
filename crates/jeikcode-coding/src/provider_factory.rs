use std::sync::Arc;

use jeikcode_capabilities::provider::{
    AnthropicConfig, AnthropicProvider, GeminiConfig, GeminiProvider, OllamaConfig, OllamaProvider,
    OpenAiCompatConfig, OpenAiCompatProvider, ReasoningPolicy, RequestSigner, ResponsesConfig,
    ResponsesProvider,
};
use jeikcode_kernel::provider::LlmProvider;

use crate::CodingAgentConfig;
use crate::{SubagentProvider, TierProvider};

#[derive(Debug)]
pub enum ProviderBuildError {
    Adapter(String),
    Authentication(String),
    SourceBuildGatewayUnsupported { base_url: String },
}

impl std::fmt::Display for ProviderBuildError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Adapter(message) | Self::Authentication(message) => f.write_str(message),
            Self::SourceBuildGatewayUnsupported { base_url } => write!(
                f,
                "gateway authentication is unavailable in this build: {base_url}"
            ),
        }
    }
}

impl std::error::Error for ProviderBuildError {}

/// Host seam for endpoint-specific request authentication. Returning `None` means the endpoint
/// uses the configured static API key. The implementation owns gateway identification as well as
/// signer construction, keeping auth and stored-credential access out of the coding layer.
pub trait ProviderAuthenticator: Send + Sync {
    fn request_signer(
        &self,
        base_url: &str,
    ) -> Result<Option<Arc<dyn RequestSigner>>, ProviderBuildError>;
}

pub fn jeikcode_provider_factory(
    default_user_agent: impl Into<String>,
) -> Arc<dyn CodingProviderFactory> {
    Arc::new(DefaultCodingProviderFactory::new(default_user_agent))
}

pub trait CodingProviderFactory: Send + Sync {
    fn build(
        &self,
        config: &CodingAgentConfig,
        session_id: Option<&str>,
    ) -> Result<Arc<dyn LlmProvider>, ProviderBuildError>;
}

#[derive(Clone)]
pub struct DefaultCodingProviderFactory {
    default_user_agent: String,
    authenticator: Option<Arc<dyn ProviderAuthenticator>>,
}

impl DefaultCodingProviderFactory {
    pub fn new(default_user_agent: impl Into<String>) -> Self {
        Self {
            default_user_agent: default_user_agent.into(),
            authenticator: None,
        }
    }

    pub fn with_authenticator(mut self, authenticator: Arc<dyn ProviderAuthenticator>) -> Self {
        self.authenticator = Some(authenticator);
        self
    }
}

impl CodingProviderFactory for DefaultCodingProviderFactory {
    fn build(
        &self,
        cfg: &CodingAgentConfig,
        session_id: Option<&str>,
    ) -> Result<Arc<dyn LlmProvider>, ProviderBuildError> {
        let ua = cfg
            .user_agent
            .clone()
            .unwrap_or_else(|| self.default_user_agent.clone());
        let provider: Arc<dyn LlmProvider> = match cfg.provider_type.as_str() {
            "responses" | "openai-responses" => {
                let mut rc = ResponsesConfig::new(&cfg.api_key, &cfg.base_url, &cfg.model);
                rc.context_window = cfg.context_window;
                rc.idle_timeout = cfg.stream_timeout;
                rc.max_tokens = Some(cfg.chat_options.max_tokens.unwrap_or(65536));
                rc.supports_vision = cfg.supports_vision;
                rc.reasoning_model = cfg.reasoning_model;
                rc.reasoning_policy =
                    ReasoningPolicy::from_config(cfg.reasoning_history.as_deref())
                        .map_err(ProviderBuildError::Adapter)?;
                rc.thinking_budget = cfg.thinking_budget;
                rc.thinking_type = cfg.thinking_type.clone();
                rc.thinking_enabled = cfg.thinking_enabled;
                if cfg.chat_options.reasoning_effort.as_ref().is_some_and(|e| {
                    matches!(e, jeikcode_kernel::provider::ReasoningEffort::Off)
                        || e.as_str().eq_ignore_ascii_case("off")
                        || e.as_str().eq_ignore_ascii_case("none")
                }) {
                    rc.thinking_enabled = Some(false);
                    rc.thinking_type = Some("disabled".to_string());
                }
                rc.user_agent = Some(ua.clone());
                rc.skip_tls_verify = cfg.skip_tls_verify;
                if let Some(authenticator) = &self.authenticator {
                    rc.request_signer = authenticator.request_signer(&cfg.base_url)?;
                }
                Arc::new(
                    ResponsesProvider::new(rc)
                        .map_err(|e| ProviderBuildError::Adapter(e.message))?,
                )
            }
            "claude" | "anthropic" => {
                let mut ac = AnthropicConfig::new(&cfg.api_key, &cfg.base_url, &cfg.model);
                ac.context_window = cfg.context_window;
                ac.idle_timeout = cfg.stream_timeout;
                ac.max_tokens = cfg.chat_options.max_tokens.unwrap_or(65536);
                ac.thinking_enabled = cfg.thinking_enabled;
                ac.thinking = cfg
                    .thinking_enabled
                    .unwrap_or_else(|| cfg.reasoning_model.unwrap_or(false));
                ac.thinking_budget = cfg.thinking_budget;
                ac.thinking_type = cfg.thinking_type.clone();
                if cfg.chat_options.reasoning_effort.as_ref().is_some_and(|e| {
                    matches!(e, jeikcode_kernel::provider::ReasoningEffort::Off)
                        || e.as_str().eq_ignore_ascii_case("off")
                        || e.as_str().eq_ignore_ascii_case("none")
                }) {
                    ac.thinking_enabled = Some(false);
                    ac.thinking = false;
                    ac.thinking_type = Some("disabled".to_string());
                }
                ac.reasoning_model = cfg.reasoning_model;
                ac.reasoning_policy =
                    ReasoningPolicy::from_config(cfg.reasoning_history.as_deref())
                        .map_err(ProviderBuildError::Adapter)?;
                ac.user_agent = Some(ua.clone());
                ac.skip_tls_verify = cfg.skip_tls_verify;
                Arc::new(
                    AnthropicProvider::new(ac)
                        .map_err(|e| ProviderBuildError::Adapter(e.message))?,
                )
            }
            "ollama" => {
                let mut oc = OllamaConfig::new(&cfg.base_url, &cfg.model);
                oc.api_key = cfg.api_key.clone();
                oc.context_window = cfg.context_window;
                oc.idle_timeout = cfg.stream_timeout;
                oc.max_tokens = Some(cfg.chat_options.max_tokens.unwrap_or(65536));
                oc.think = cfg
                    .thinking_enabled
                    .unwrap_or_else(|| cfg.reasoning_model.unwrap_or(false));
                oc.user_agent = Some(ua.clone());
                oc.skip_tls_verify = cfg.skip_tls_verify;
                Arc::new(
                    OllamaProvider::new(oc).map_err(|e| ProviderBuildError::Adapter(e.message))?,
                )
            }
            "gemini" | "google-gemini" | "gemini-compatible" => {
                let mut gc = GeminiConfig::new(&cfg.api_key, &cfg.base_url, &cfg.model);
                gc.context_window = cfg.context_window;
                gc.idle_timeout = cfg.stream_timeout;
                gc.max_tokens = Some(cfg.chat_options.max_tokens.unwrap_or(65536));
                gc.thinking_enabled = cfg.thinking_enabled;
                if cfg.chat_options.reasoning_effort.as_ref().is_some_and(|e| {
                    matches!(e, jeikcode_kernel::provider::ReasoningEffort::Off)
                        || e.as_str().eq_ignore_ascii_case("off")
                        || e.as_str().eq_ignore_ascii_case("none")
                }) {
                    gc.thinking_enabled = Some(false);
                }
                gc.thinking_budget = cfg.thinking_budget;
                gc.reasoning_model = cfg.reasoning_model;
                gc.reasoning_policy =
                    ReasoningPolicy::from_config(cfg.reasoning_history.as_deref())
                        .map_err(ProviderBuildError::Adapter)?;
                gc.supports_vision = cfg.supports_vision;
                gc.user_agent = Some(ua.clone());
                gc.skip_tls_verify = cfg.skip_tls_verify;
                Arc::new(
                    GeminiProvider::new(gc).map_err(|e| ProviderBuildError::Adapter(e.message))?,
                )
            }
            _ => {
                let mut pc = OpenAiCompatConfig::new(&cfg.api_key, &cfg.base_url, &cfg.model);
                pc.context_window = cfg.context_window;
                pc.idle_timeout = cfg.stream_timeout;
                // Config/protocol flag — not a model-name whitelist. OpenAI
                // and Anthropic wire formats accept base64 when this is true.
                pc.supports_vision = cfg.supports_vision;
                pc.max_tokens = Some(cfg.chat_options.max_tokens.unwrap_or(65536));
                pc.reasoning_model = cfg.reasoning_model;
                pc.reasoning_policy =
                    ReasoningPolicy::from_config(cfg.reasoning_history.as_deref())
                        .map_err(ProviderBuildError::Adapter)?;
                pc.thinking_type = cfg.thinking_type.clone();
                pc.thinking_keep = cfg.thinking_keep.clone();
                pc.thinking_budget = cfg.thinking_budget;
                pc.user_agent = Some(ua);
                pc.skip_tls_verify = cfg.skip_tls_verify;
                if let Some(authenticator) = &self.authenticator {
                    pc.request_signer = authenticator.request_signer(&cfg.base_url)?;
                }
                Arc::new(
                    OpenAiCompatProvider::new(pc)
                        .map_err(|e| ProviderBuildError::Adapter(e.message))?,
                )
            }
        };
        if let Some(session_id) = session_id {
            provider.bind_session_id(session_id);
        }
        Ok(provider)
    }
}

pub fn default_max_tokens(context_window: u32) -> u32 {
    (context_window / 4).clamp(8_000, 64_000)
}

pub fn derive_tier_config(
    base: &CodingAgentConfig,
    provider_name: &str,
    provider: &jeikcode_config::config::provider::ProviderConfig,
) -> CodingAgentConfig {
    let mut tier = base.clone();
    tier.model = provider.model.clone();
    tier.provider_name = provider_name.to_string();
    tier.pricing = crate::resolve_provider_pricing(provider_name, provider);
    if let Some(base_url) = &provider.base_url {
        tier.base_url = base_url.clone();
    }
    if let Some(api_key) = provider.resolved_api_key() {
        tier.api_key = api_key;
    }
    tier.provider_type = provider.provider_type.clone();
    tier.context_window = provider.context_window as u32;
    tier.chat_options.max_tokens = provider.max_tokens.map(|value| value as u32);
    tier.thinking_type = provider.thinking_type.clone();
    tier.thinking_keep = provider.thinking_keep.clone();
    tier.reasoning_history = provider.reasoning_history.clone();
    tier.thinking_enabled = provider.thinking_enabled;
    tier.thinking_budget = provider.thinking_budget;
    tier.reasoning_model = provider.reasoning_model;
    tier.user_agent = provider.user_agent.clone();
    tier.skip_tls_verify = provider.skip_tls_verify;
    tier.supports_vision = provider.accepts_images();
    tier.subagent_fast_provider = None;
    tier.subagent_capable_provider = None;
    tier.subagent_config = None;
    tier.task_model_routing = None;
    tier
}

pub fn tier_provider_builder(
    factory: Arc<dyn CodingProviderFactory>,
    base: &CodingAgentConfig,
    host_model: &str,
    provider_name: &str,
    provider: &jeikcode_config::config::provider::ProviderConfig,
) -> Option<SubagentProvider> {
    if provider.model == host_model {
        return None;
    }
    let tier = derive_tier_config(base, provider_name, provider);
    Some(Arc::new(move || factory.build(&tier, None).ok()))
}

/// Build a tier [`CodingAgentConfig`] from an already-resolved model selection
/// (design §14.2). Mirrors [`derive_tier_config`] but reads the flattened
/// [`ResolvedModelConfig`], so a tier can be a model profile on any account.
pub fn derive_tier_config_from_resolved(
    base: &CodingAgentConfig,
    resolved: &jeikcode_config::config::provider::ResolvedModelConfig,
) -> CodingAgentConfig {
    let mut tier = base.clone();
    tier.model = resolved.model.clone();
    tier.provider_name = resolved.selection_id.clone();
    tier.pricing = crate::resolve_resolved_pricing(resolved);
    if let Some(base_url) = &resolved.base_url {
        tier.base_url = base_url.clone();
    }
    if let Some(api_key) = &resolved.api_key {
        tier.api_key = api_key.clone();
    }
    tier.provider_type = resolved.provider_type.clone();
    tier.context_window = resolved.context_window as u32;
    tier.chat_options.max_tokens = resolved.max_tokens.map(|value| value as u32);
    tier.thinking_type = resolved.thinking_type.clone();
    tier.thinking_keep = resolved.thinking_keep.clone();
    tier.reasoning_history = resolved.reasoning_history.clone();
    tier.thinking_enabled = resolved.thinking_enabled;
    tier.thinking_budget = resolved.thinking_budget;
    tier.reasoning_model = resolved.reasoning_model;
    tier.user_agent = resolved.user_agent.clone();
    tier.skip_tls_verify = resolved.skip_tls_verify;
    tier.supports_vision = resolved.accepts_images();
    tier.subagent_fast_provider = None;
    tier.subagent_capable_provider = None;
    tier.subagent_config = None;
    tier.task_model_routing = None;
    tier
}

/// [`tier_provider_builder`] for a resolved model selection.
pub fn tier_provider_builder_from_resolved(
    factory: Arc<dyn CodingProviderFactory>,
    base: &CodingAgentConfig,
    host_model: &str,
    resolved: &jeikcode_config::config::provider::ResolvedModelConfig,
) -> Option<SubagentProvider> {
    if resolved.model == host_model {
        return None;
    }
    let tier = derive_tier_config_from_resolved(base, resolved);
    Some(Arc::new(move || factory.build(&tier, None).ok()))
}

pub fn resolve_subagent_tier_thunks(
    factory: Arc<dyn CodingProviderFactory>,
    base: &CodingAgentConfig,
    host_model: &str,
    config: &jeikcode_config::config::Config,
) -> (SubagentProvider, SubagentProvider) {
    let none = || -> SubagentProvider { Arc::new(|| None) };
    let Some((fast_key, capable_key)) =
        crate::subagent_tiers::resolve_tier_keys(config, host_model)
    else {
        return (none(), none());
    };
    let thunk_for = |key: &str| -> SubagentProvider {
        config
            .resolve_model(Some(key))
            .ok()
            .and_then(|resolved| {
                tier_provider_builder_from_resolved(factory.clone(), base, host_model, &resolved)
            })
            .unwrap_or_else(none)
    };
    (thunk_for(&fast_key), thunk_for(&capable_key))
}

/// Shared admission resolver; each resolve clones one complete immutable generation.
/// Running tasks retain their constructed provider across subsequent resets.
pub struct TaskModelRouting {
    generation: std::sync::Mutex<(Arc<dyn CodingProviderFactory>, CodingAgentConfig, jeikcode_config::config::Config)>,
    session_id: std::sync::Mutex<Option<String>>,
}

impl TaskModelRouting {
    fn snapshot_base(base: &CodingAgentConfig) -> CodingAgentConfig {
        let mut base = base.clone();
        base.task_model_routing = None;
        base.subagent_fast_provider = None;
        base.subagent_capable_provider = None;
        base.subagent_config = None;
        base
    }

    pub fn set_session_id(&self, id: &str) {
        *self.session_id.lock().unwrap() = Some(id.to_string());
    }

    pub fn resolve(&self, id: &str) -> Result<jeikcode_capabilities::tools::TaskModelBinding, String> {
        let (factory, base, registry) = self.generation.lock().unwrap().clone();
        let (account_id, model_id) = id.split_once('/').ok_or("invalid qualified model ID")?;
        if !jeikcode_capabilities::tools::valid_task_model_id(id) || model_id.is_empty() {
            return Err("invalid qualified model ID".into());
        }
        // Exact catalog lookup only: never aliases, display names or default selection.
        let profile = registry.logical_models().get(id).cloned().ok_or("unknown model ID")?;
        if profile.account != account_id || !registry.logical_accounts().contains_key(account_id) {
            return Err("invalid model provider account".into());
        }
        let accounts = registry.logical_accounts();
        let account = accounts.get(account_id).ok_or("unknown provider account")?;
        let preset_id = jeikcode_config::config::provider_preset::canonical_preset_id(&account.provider);
        if jeikcode_config::config::provider_preset::preset(preset_id).is_none() {
            return Err("unknown provider protocol".into());
        }
        let resolved = registry.resolve_model(Some(id)).map_err(|_| "model resolution failed")?;
        if resolved.model.trim().is_empty() {
            return Err("empty API model".into());
        }
        let mut task = derive_tier_config_from_resolved(&base, &resolved);
        // Explicit cross-provider routes MUST NOT inherit parent auth or endpoint.
        task.base_url = resolved.base_url.clone().ok_or("provider endpoint unavailable")?;
        task.api_key = resolved.api_key.clone().unwrap_or_default();
        // Do not carry coordinator sampling/tool-choice overrides across models.
        task.chat_options = jeikcode_kernel::provider::ChatOptions {
            max_tokens: resolved.max_tokens.map(|n| n as u32),
            reasoning_effort: jeikcode_kernel::provider::ReasoningEffort::from_config(resolved.reasoning_effort.as_deref()),
            ..Default::default()
        };
        let session_id = self.session_id.lock().unwrap().clone();
        let provider = factory.build(&task, session_id.as_deref()).map_err(|_| "task provider construction failed")?;
        if provider.model_name() != resolved.model {
            return Err("task provider model binding mismatch".into());
        }
        Ok(jeikcode_capabilities::tools::TaskModelBinding {
            registry_id: resolved.selection_id,
            provider_id: resolved.account_id,
            api_model: resolved.model,
            provider,
            chat_options: task.chat_options,
        })
    }
}

pub fn refresh_subagent_tiers(
    factory: Arc<dyn CodingProviderFactory>,
    coding: &CodingAgentConfig,
    config: &jeikcode_config::config::Config,
) {
    if let Some(routing) = &coding.task_model_routing {
        *routing.generation.lock().unwrap() = (factory.clone(), TaskModelRouting::snapshot_base(coding), config.clone());
    }
    if coding.subagent_fast_provider.is_none() && coding.subagent_capable_provider.is_none() {
        return;
    }
    let (fast, capable) = resolve_subagent_tier_thunks(factory, coding, &coding.model, config);
    if let Some(cell) = &coding.subagent_fast_provider {
        cell.reset(fast);
    }
    if let Some(cell) = &coding.subagent_capable_provider {
        cell.reset(capable);
    }
}

pub fn install_subagent_tiers(
    factory: Arc<dyn CodingProviderFactory>,
    coding: &mut CodingAgentConfig,
    config: &jeikcode_config::config::Config,
) {
    coding.task_model_routing = Some(Arc::new(TaskModelRouting {
        generation: std::sync::Mutex::new((factory.clone(), TaskModelRouting::snapshot_base(coding), config.clone())),
        session_id: std::sync::Mutex::new(None),
    }));
    let (fast, capable) = resolve_subagent_tier_thunks(factory, coding, &coding.model, config);
    coding.subagent_fast_provider = Some(TierProvider::new(fast));
    coding.subagent_capable_provider = Some(TierProvider::new(capable));
}

#[cfg(test)]
#[path = "provider_factory_offline_acceptance.rs"]
mod offline_acceptance;

#[cfg(test)]
#[path = "provider_factory_offline_transport.rs"]
mod offline_transport;

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    pub(super) fn config(provider_type: &str) -> CodingAgentConfig {
        let mut cfg = CodingAgentConfig::new(
            "key",
            "http://localhost:11434/v1",
            "model",
            PathBuf::from("."),
        );
        cfg.provider_type = provider_type.to_string();
        cfg.context_window = 64_000;
        cfg.user_agent = Some("test-agent".into());
        cfg
    }

    #[test]
    fn dispatches_all_supported_provider_types() {
        let factory = DefaultCodingProviderFactory::new("fallback-agent");
        for kind in ["openai", "claude", "ollama", "responses", "gemini"] {
            assert!(
                factory.build(&config(kind), None).is_ok(),
                "provider type {kind}"
            );
        }
    }

    pub(super) struct RecordingFactory(pub(super) std::sync::Mutex<Vec<CodingAgentConfig>>);

    struct NamedMock(String);
    #[async_trait::async_trait]
    impl LlmProvider for NamedMock {
        fn model_name(&self) -> &str { &self.0 }
        async fn chat_stream(&self, _: &[jeikcode_kernel::message::Message], _: &[jeikcode_kernel::tool::ToolDef], _: &jeikcode_kernel::provider::ChatOptions) -> Result<futures::stream::BoxStream<'static, jeikcode_kernel::stream::StreamEvent>, jeikcode_kernel::stream::ProviderError> {
            use futures::StreamExt;
            Ok(futures::stream::iter(vec![
                jeikcode_kernel::stream::StreamEvent::TextDelta("offline fake runner response".into()),
                jeikcode_kernel::stream::StreamEvent::Done { truncated: false },
            ]).boxed())
        }
    }
    impl CodingProviderFactory for RecordingFactory {
        fn build(&self, cfg: &CodingAgentConfig, _: Option<&str>) -> Result<Arc<dyn LlmProvider>, ProviderBuildError> {
            self.0.lock().unwrap().push(cfg.clone());
            Ok(Arc::new(NamedMock(cfg.model.clone())))
        }
    }

    pub(super) fn task_registry() -> jeikcode_config::config::Config {
        let mut registry = jeikcode_config::config::Config::default();
        registry.provider_accounts.insert("local8045".into(), serde_json::from_value(serde_json::json!({
            "provider": "gemini-compatible", "base_url": "https://offline.invalid/v1", "api_key": "task-secret"
        })).unwrap());
        registry.models.insert("local8045/gemini".into(), serde_json::from_value(serde_json::json!({
            "account": "local8045", "model": "gemini-api", "context_window": 32000, "max_tokens": 1234
        })).unwrap());
        registry
    }

    #[test]
    fn per_task_model_binds_cross_provider_and_survives_refresh() {
        let factory = Arc::new(RecordingFactory(std::sync::Mutex::new(Vec::new())));
        let mut parent = config("responses");
        let mut registry = task_registry();
        install_subagent_tiers(factory.clone(), &mut parent, &registry);
        let routing = parent.task_model_routing.clone().unwrap();
        let bound = routing.resolve("local8045/gemini").unwrap();
        assert_eq!(bound.provider_id, "local8045");
        assert_eq!(bound.api_model, "gemini-api");
        assert_eq!(bound.chat_options.max_tokens, Some(1234));
        assert_eq!(parent.model, "model");
        assert_eq!(parent.api_key, "key");
        {
            let calls = factory.0.lock().unwrap();
            assert_eq!(calls[0].provider_type, "gemini");
            assert_eq!(calls[0].api_key, "task-secret");
            assert_eq!(calls[0].base_url, "https://offline.invalid/v1");
            assert_eq!(calls[0].context_window, 32000);
        }
        registry.models.get_mut("local8045/gemini").unwrap().model = "changed-api".into();
        refresh_subagent_tiers(factory.clone(), &parent, &registry);
        assert_eq!(bound.provider.model_name(), "gemini-api");
        assert_eq!(routing.resolve("local8045/gemini").unwrap().api_model, "changed-api");
    }

    #[test]
    fn explicit_model_id_invalid_registry_never_constructs_provider() {
        let factory = Arc::new(RecordingFactory(std::sync::Mutex::new(Vec::new())));
        let mut parent = config("responses");
        let mut registry = task_registry();
        registry.models.get_mut("local8045/gemini").unwrap().account = "missing".into();
        install_subagent_tiers(factory.clone(), &mut parent, &registry);
        let routing = parent.task_model_routing.as_ref().unwrap();
        for id in ["", " ", "gemini", "unknown/model", "local8045/gemini", "https://user:secret@host/model?key=x"] {
            assert!(routing.resolve(id).is_err(), "{id}");
        }
        registry.models.get_mut("local8045/gemini").unwrap().account = "local8045".into();
        registry.provider_accounts.get_mut("local8045").unwrap().provider = "bogus".into();
        refresh_subagent_tiers(factory.clone(), &parent, &registry);
        assert!(routing.resolve("local8045/gemini").is_err());
        assert!(factory.0.lock().unwrap().is_empty());
    }

    #[tokio::test]
    async fn per_task_model_registry_to_fake_runner_receipts_and_parent_invariance() {
        use jeikcode_kernel::tool::{Tool, ToolContext, ToolRegistry, ProgressSink};
        let factory = Arc::new(RecordingFactory(std::sync::Mutex::new(Vec::new())));
        let mut parent = config("responses");
        let mut registry = task_registry();
        registry.provider_accounts.insert("gpt".into(), serde_json::from_value(serde_json::json!({
            "provider": "openai", "base_url": "https://gpt.offline.invalid/v1", "api_key": "gpt-secret"
        })).unwrap());
        registry.models.insert("gpt/profile".into(), serde_json::from_value(serde_json::json!({
            "account": "gpt", "model": "gpt-api"
        })).unwrap());
        parent.chat_options.temperature = Some(0.9);
        install_subagent_tiers(factory.clone(), &mut parent, &registry);
        let routing = parent.task_model_routing.clone().unwrap();
        let tools = Arc::new(ToolRegistry::new());
        let worker_tools = tools.clone();
        let tool = jeikcode_capabilities::tools::TaskTool::new(
            || panic!("explicit route must not select fast"),
            || panic!("explicit route must not select capable"),
            move || tools.mount(&[]), move || worker_tools.mount(&[]),
        ).with_model_resolver(Some(Arc::new(move |id| routing.resolve(id))));
        let dir = tempfile::tempdir().unwrap();
        let context = ToolContext {
            working_dir: dir.path().to_path_buf(), cancel: tokio_util::sync::CancellationToken::new(),
            progress: ProgressSink::noop(), requester: None,
        };
        let result = tool.execute(r#"{"tasks":[
            {"description":"Gemini","prompt":"offline","difficulty":"hard","model_id":"local8045/gemini"},
            {"description":"GPT","prompt":"offline","model_id":"gpt/profile"},
            {"description":"invalid","prompt":"offline","model_id":"unknown/model"}
        ]}"#, &context).await;
        assert!(!result.is_error, "{}", result.content);
        for value in [r#""effective_api_model":"gemini-api""#, r#""provider_id":"local8045""#,
            r#""effective_api_model":"gpt-api""#, r#""status":"unresolved""#] {
            assert!(result.content.contains(value), "{}", result.content);
        }
        assert!(!result.content.contains("secret"));
        assert!(!result.content.contains("offline.invalid"));
        let calls = factory.0.lock().unwrap();
        assert_eq!(calls.len(), 2);
        assert_eq!(calls[0].provider_type, "gemini");
        assert_eq!(calls[0].api_key, "task-secret");
        assert_eq!(calls[1].api_key, "gpt-secret");
        assert_eq!(calls[0].chat_options.temperature, None);
        assert_eq!(parent.api_key, "key");
        assert_eq!(parent.model, "model");
        assert_eq!(parent.provider_type, "responses");
        assert_eq!(parent.chat_options.temperature, Some(0.9));
    }

    #[test]
    fn default_output_cap_matches_legacy_bounds() {
        assert_eq!(default_max_tokens(16_000), 8_000);
        assert_eq!(default_max_tokens(64_000), 16_000);
        assert_eq!(default_max_tokens(200_000), 50_000);
    }
}
