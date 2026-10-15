//! Apply [`TimeoutPolicy`] onto every L1 adapter config.

use jeikcode_kernel::timeouts::TimeoutPolicy;

use super::{AnthropicConfig, GeminiConfig, OllamaConfig, OpenAiCompatConfig, ResponsesConfig};

pub trait ApplyTimeouts {
    fn apply_timeouts(&mut self, policy: &TimeoutPolicy);
}

impl ApplyTimeouts for OpenAiCompatConfig {
    fn apply_timeouts(&mut self, policy: &TimeoutPolicy) {
        self.connect_timeout = policy.connect;
        self.open_timeout = policy.open;
        self.idle_timeout = policy.idle_watchdog();
    }
}

impl ApplyTimeouts for AnthropicConfig {
    fn apply_timeouts(&mut self, policy: &TimeoutPolicy) {
        self.connect_timeout = policy.connect;
        self.open_timeout = policy.open;
        self.idle_timeout = policy.idle_watchdog();
    }
}

impl ApplyTimeouts for GeminiConfig {
    fn apply_timeouts(&mut self, policy: &TimeoutPolicy) {
        self.connect_timeout = policy.connect;
        self.open_timeout = policy.open;
        self.idle_timeout = policy.idle_watchdog();
    }
}

impl ApplyTimeouts for OllamaConfig {
    fn apply_timeouts(&mut self, policy: &TimeoutPolicy) {
        self.connect_timeout = policy.connect;
        self.open_timeout = policy.open;
        self.idle_timeout = policy.idle_watchdog();
    }
}

impl ApplyTimeouts for ResponsesConfig {
    fn apply_timeouts(&mut self, policy: &TimeoutPolicy) {
        self.connect_timeout = policy.connect;
        self.open_timeout = policy.open;
        self.idle_timeout = policy.idle_watchdog();
    }
}
