//! MCP client trait and common utilities.

use anyhow::Result;
use async_trait::async_trait;

use super::types::{CallToolResult, InitializeResult, ListToolsResult, ServerStatus};

/// Information about an MCP tool.
#[derive(Debug, Clone)]
pub struct McpToolInfo {
    pub server_name: String,
    pub tool_name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
    /// From the server's `annotations.readOnlyHint` — true only when explicitly
    /// declared read-only. Lets plan mode allow read-only external queries.
    pub read_only: bool,
}

/// MCP client trait for communicating with an MCP server.
#[async_trait]
pub trait McpClient: Send + Sync {
    /// Initialize the connection to the MCP server.
    async fn initialize(&mut self) -> Result<InitializeResult>;

    /// List available tools from the server.
    async fn list_tools(&self) -> Result<ListToolsResult>;

    /// Call a tool on the server.
    async fn call_tool(
        &self,
        tool_name: &str,
        arguments: serde_json::Value,
    ) -> Result<CallToolResult>;

    /// Get the server name.
    fn server_name(&self) -> &str;

    /// Get the current server status.
    fn status(&self) -> ServerStatus;

    /// Tear down transport resources owned by this client.
    async fn shutdown(&self);

    /// Synchronous best-effort kill of the spawned process tree.
    ///
    /// `Drop` contexts have no runtime to await on, so the leak/deadlock backstop lives
    /// here: a host that tears its runtime down (tests, one-shot CLI, embedded SDK) cannot
    /// run the async idle reaper, so the LAST lease owner calls this instead of parking —
    /// otherwise the child survives AND `Runtime::drop` waits forever on the still-open
    /// stdout pipe. Default: nothing to kill (in-process / HTTP clients).
    fn kill_now(&self) {}
}
