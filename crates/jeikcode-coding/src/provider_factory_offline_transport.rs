use super::*;
use jeikcode_kernel::{message::Message, provider::ReasoningEffort};
use std::io::{Read, Write};
use futures::StreamExt;

// Adapter construction/metadata only: no chat_stream and no HTTP calls.
#[test]
fn runtime_offline_adapter_metadata_without_http() {
    for protocol in ["openai", "responses", "claude", "gemini", "ollama"] {
        let mut parent = tests::config("responses");
        let mut registry = jeikcode_config::config::Config::default();
        registry.provider_accounts.insert("mock".into(), serde_json::from_value(serde_json::json!({"provider":protocol, "base_url":"https://offline.invalid/v1", "api_key":"task-synthetic-only"})).unwrap());
        registry.models.insert("mock/pin".into(), serde_json::from_value(serde_json::json!({"account":"mock", "model":"task-api", "context_window":32000, "max_tokens":1234, "reasoning_effort":"high"})).unwrap());
        install_subagent_tiers(Arc::new(DefaultCodingProviderFactory::new("offline-metadata")), &mut parent, &registry);
        let binding = parent.task_model_routing.as_ref().unwrap().resolve("mock/pin").unwrap();
        assert_eq!(binding.registry_id, "mock/pin");
        assert_eq!(binding.provider.model_name(), "task-api");
        assert_eq!(binding.api_model, "task-api");
        assert_eq!(binding.provider.context_window(), 32000);
        assert_eq!(binding.chat_options.max_tokens, Some(1234));
        assert_eq!(binding.chat_options.reasoning_effort, Some(ReasoningEffort::High));
        assert_eq!(parent.provider_type, "responses");
        assert_eq!(parent.model, "model");
        assert_eq!(parent.api_key, "key");
    }
}

// Real adapters, loopback-only HTTP recorder, synthetic keys; a terminal 400 avoids retries.
#[tokio::test]
async fn runtime_offline_adapter_boundary_all_protocols() {
    for (protocol, path) in [("openai", "/chat/completions"), ("responses", "/responses"), ("claude", "/messages"), ("gemini", "/models/task-api:streamGenerateContent"), ("ollama", "/api/chat")] {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        listener.set_nonblocking(true).unwrap();
        let address = listener.local_addr().unwrap();
        let server = std::thread::spawn(move || {
            let deadline = std::time::Instant::now() + std::time::Duration::from_secs(10);
            let mut socket = loop {
                match listener.accept() {
                    Ok((socket, _)) => break socket,
                    Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => { assert!(std::time::Instant::now() < deadline, "adapter did not reach loopback"); std::thread::sleep(std::time::Duration::from_millis(5)); }
                    Err(e) => panic!("loopback accept: {e}"),
                }
            };
            socket.set_nonblocking(false).unwrap();
            socket.set_read_timeout(Some(std::time::Duration::from_secs(5))).unwrap();
            let mut bytes = Vec::new(); let mut buf = [0; 4096];
            let header_end = loop { let n = socket.read(&mut buf).unwrap(); assert!(n > 0); bytes.extend_from_slice(&buf[..n]); if let Some(i) = bytes.windows(4).position(|w| w == b"\r\n\r\n") { break i + 4; } };
            let headers = String::from_utf8(bytes[..header_end].to_vec()).unwrap();
            let length: usize = headers.lines().find_map(|line| line.to_ascii_lowercase().strip_prefix("content-length:").map(|s| s.trim().parse().unwrap())).unwrap();
            while bytes.len() < header_end + length { let n = socket.read(&mut buf).unwrap(); assert!(n > 0); bytes.extend_from_slice(&buf[..n]); }
            let body: serde_json::Value = serde_json::from_slice(&bytes[header_end..header_end + length]).unwrap();
            let response = r#"{"error":{"message":"offline terminal rejection","type":"invalid_request_error"}}"#;
            write!(socket, "HTTP/1.1 400 Bad Request\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", response.len(), response).unwrap();
            (headers, body)
        });
        let mut parent = tests::config("responses");
        parent.api_key = "parent-synthetic-do-not-send".into();
        let mut registry = jeikcode_config::config::Config::default();
        registry.provider_accounts.insert("mock".into(), serde_json::from_value(serde_json::json!({"provider":protocol, "base_url":format!("http://{address}"), "api_key":"task-synthetic-only"})).unwrap());
        registry.models.insert("mock/profile".into(), serde_json::from_value(serde_json::json!({"account":"mock", "model":"task-api", "context_window":32000, "max_tokens":1234, "thinking_enabled":true, "thinking_budget":256, "reasoning_effort":"high"})).unwrap());
        install_subagent_tiers(Arc::new(DefaultCodingProviderFactory::new("offline-recorder")), &mut parent, &registry);
        let binding = parent.task_model_routing.as_ref().unwrap().resolve("mock/profile").unwrap();
        assert_eq!(binding.chat_options.max_tokens, Some(1234));
        assert_eq!(binding.chat_options.reasoning_effort, Some(ReasoningEffort::High));
        assert_eq!(binding.provider.context_window(), 32000);
        let error = match tokio::time::timeout(std::time::Duration::from_secs(8), binding.provider.chat_stream(&[Message::user("offline")], &[], &binding.chat_options)).await.unwrap() {
            Err(e) => e,
            Ok(mut stream) => tokio::time::timeout(std::time::Duration::from_secs(8), async {
                while let Some(event) = stream.next().await { if let jeikcode_kernel::stream::StreamEvent::Error(e) = event { return e; } }
                panic!("mock 400 must surface an error for {protocol}");
            }).await.unwrap(),
        };
        assert!(!error.message.contains("task-synthetic-only")); assert!(!error.message.contains("parent-synthetic-do-not-send"));
        let (headers, body) = server.join().unwrap();
        assert!(headers.lines().next().unwrap().contains(path), "wrong protocol path for {protocol}");
        assert!(!headers.contains("parent-synthetic-do-not-send"));
        assert!(headers.contains("task-synthetic-only"), "task auth must reach only loopback");
        assert!(!body.to_string().contains("synthetic"), "credentials must not enter payload");
        match protocol {
            "gemini" => { assert_eq!(body["generationConfig"]["maxOutputTokens"], 1234); assert!(body["generationConfig"]["thinkingConfig"].is_object()); }
            "ollama" => { assert_eq!(body["model"], "task-api"); assert_eq!(body["options"]["num_predict"], 1234); assert!(!body["think"].is_null()); }
            "responses" => { assert_eq!(body["model"], "task-api"); assert_eq!(body["max_output_tokens"], 1234); assert_eq!(body["reasoning"]["effort"], "high"); }
            "claude" => { assert_eq!(body["model"], "task-api"); assert_eq!(body["max_tokens"], 1234); assert!(body["thinking"].is_object()); }
            _ => { assert_eq!(body["model"], "task-api"); assert_eq!(body["max_tokens"], 1234); assert_eq!(body["reasoning_effort"], "high"); }
        }
        assert_eq!(parent.api_key, "parent-synthetic-do-not-send"); assert_eq!(parent.model, "model"); assert_eq!(parent.provider_type, "responses");
    }
}
