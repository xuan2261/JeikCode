//! Session-owned MCP registries for stateful servers such as browsers.
//!
//! Schema is shared via a short-lived probe cache. The per-session process is
//! spawned only on first tool call, kept while a runtime lease is held, parked
//! after the last lease drops once the sliding idle window from the last
//! `call_tool` expires, reaped when the session is deleted, and reaped with the
//! JeikCode process on host exit.
//!
//! PARKING IS HOST-DEPENDENT: park-on-idle needs the async reaper to actually run. A host
//! that tears its runtime down (tests / one-shot CLI / embedded SDK) dies before the first
//! TTL sweep, so its last lease owner tears the session's transports down SYNCHRONOUSLY
//! instead — parking there would leak the process tree and deadlock `Runtime::drop` on the
//! still-open stdout pipes. See `SessionMcpLease`'s `Drop`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::sync::{Arc, OnceLock, Weak};
use std::time::Duration;

use tokio::sync::{Mutex, RwLock};

use super::registry::McpRegistry;
use super::schema_cache::{
    cached_session_mcp_schema, ensure_session_mcp_schema, SessionMcpSchemaSnapshot,
};

#[derive(Clone, Debug, Hash, PartialEq, Eq)]
struct SessionMcpKey {
    project_dir: PathBuf,
    session_id: String,
}

struct SessionMcpEntry {
    generation: Arc<SessionMcpGeneration>,
}

struct SessionMcpGeneration {
    registry: Arc<McpRegistry>,
    owners: AtomicUsize,
    /// Back-reference for the LAST lease's `Drop`: it must consult the pool's reaper state
    /// (and retire the parked entry) WITHOUT an async runtime.
    pool: Weak<SessionMcpPool>,
}

/// Process-wide pool of isolated `scope=session` registries.
///
/// The project path is part of the key because imported/external session ids are
/// not guaranteed to be globally unique. Lifecycle transitions are serialized,
/// while MCP calls never take the lifecycle lock.
pub struct SessionMcpPool {
    entries: RwLock<HashMap<SessionMcpKey, SessionMcpEntry>>,
    lifecycle: Mutex<()>,
    /// Set once the async idle reaper has ACTUALLY parked something — proof that this host
    /// keeps a runtime alive long enough for the TTL sweep. Until then, the last-lease drop
    /// tears the session down synchronously instead of parking (see `SessionMcpLease`).
    reaper_proven: Arc<AtomicBool>,
}

static GLOBAL_SESSION_MCP_POOL: OnceLock<Arc<SessionMcpPool>> = OnceLock::new();

impl SessionMcpPool {
    pub fn new() -> Self {
        Self {
            entries: RwLock::new(HashMap::new()),
            lifecycle: Mutex::new(()),
            reaper_proven: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn global() -> Arc<Self> {
        GLOBAL_SESSION_MCP_POOL
            .get_or_init(|| {
                let pool = Arc::new(Self::new());
                spawn_idle_reaper(pool.clone());
                pool
            })
            .clone()
    }

    /// Reap unused session-scoped transports.
    ///
    /// Skips entries that still have a runtime lease (`owners > 0` — session has
    /// not been switched away). In-flight tool calls are skipped. Empty lazy
    /// registries (never spawned, or already parked) are no-ops.
    /// `ttl` is a sliding window from the last `call_tool`; catalog probes,
    /// `tools/list`, and connect do not refresh it.
    /// Returns how many registries were ACTUALLY parked — `0` means the reaper had nothing
    /// to reclaim, which is how [`SessionMcpPool::reaper_proven`] stays honest.
    pub async fn reap_idle(&self, ttl: Duration) -> usize {
        if ttl.is_zero() {
            return 0;
        }
        let _lifecycle = self.lifecycle.lock().await;
        let registries: Vec<_> = {
            let entries = self.entries.read().await;
            entries
                .values()
                .filter(|entry| entry.generation.owners.load(Ordering::Acquire) == 0)
                .map(|entry| entry.generation.registry.clone())
                .collect()
        };
        let mut parked = 0usize;
        for registry in registries {
            if registry.park_if_idle(ttl).await {
                parked += 1;
            }
        }
        parked
    }

    /// Acquire one owner lease. Concurrent prepares for the same session share
    /// exactly one isolated registry; different sessions never share transports.
    /// A zero-owner entry is reused until [`Self::retire_session`] so an already
    /// started process survives runtime handoff and host idle.
    /// Acquire one owner lease without blocking on initial schema probing if cached.
    /// When no cached schema exists, uses an empty snapshot so startup remains instantaneous;
    /// the background probe task will hydrate the registry once ready.
    pub async fn acquire(
        self: &Arc<Self>,
        project_dir: &Path,
        session_id: &str,
    ) -> SessionMcpLease {
        let cached = cached_session_mcp_schema(project_dir).await;
        let key = SessionMcpKey {
            project_dir: project_key(project_dir),
            session_id: session_id.to_string(),
        };
        let _lifecycle = self.lifecycle.lock().await;
        let generation = {
            let mut entries = self.entries.write().await;
            if let Some(entry) = entries.get(&key) {
                entry.generation.owners.fetch_add(1, Ordering::AcqRel);
                entry.generation.clone()
            } else {
                let registry = Arc::new(McpRegistry::from_config_lazy_session(
                    &key.project_dir,
                    Some(key.session_id.clone()),
                ));
                let generation = Arc::new(SessionMcpGeneration {
                    registry,
                    owners: AtomicUsize::new(1),
                    pool: Arc::downgrade(self),
                });
                entries.insert(
                    key.clone(),
                    SessionMcpEntry {
                        generation: generation.clone(),
                    },
                );
                generation
            }
        };
        drop(_lifecycle);
        if let Some(snapshot) = cached {
            generation
                .registry
                .apply_session_config_diff(&snapshot)
                .await;
        } else {
            // Trigger asynchronous background probe without blocking interactive boot
            let bg_dir = project_dir.to_path_buf();
            tokio::spawn(async move {
                let _ = ensure_session_mcp_schema(&bg_dir).await;
            });
        }
        SessionMcpLease {
            key: Some(key),
            generation,
        }
    }

    /// Apply a refreshed probe snapshot to every live session registry for this
    /// project. Unchanged transports stay running; identity-changed servers are
    /// recycled per-session.
    pub async fn hydrate_project(&self, project_dir: &Path, snapshot: &SessionMcpSchemaSnapshot) {
        let project_dir = project_key(project_dir);
        let registries: Vec<_> = {
            let entries = self.entries.read().await;
            entries
                .iter()
                .filter(|(key, _)| key.project_dir == project_dir)
                .map(|(_, entry)| entry.generation.registry.clone())
                .collect()
        };
        for registry in registries {
            registry.apply_session_config_diff(snapshot).await;
        }
    }

    /// Mark a tool auto-approved across all live session registries for this project.
    pub async fn mark_tool_auto_approved(&self, project_dir: &Path, full_name: &str) {
        let project_dir = project_key(project_dir);
        let registries: Vec<_> = {
            let entries = self.entries.read().await;
            entries
                .iter()
                .filter(|(key, _)| key.project_dir == project_dir)
                .map(|(_, entry)| entry.generation.registry.clone())
                .collect()
        };
        for registry in registries {
            registry.mark_tool_auto_approved(full_name);
        }
    }

    /// Shut down the isolated process for one session. Called on session delete.
    pub async fn retire_session(&self, project_dir: &Path, session_id: &str) {
        let key = SessionMcpKey {
            project_dir: project_key(project_dir),
            session_id: session_id.to_string(),
        };
        self.retire_key(key).await;
    }

    /// Session ids are UUIDs; delete paths that only have the id still reap.
    pub async fn retire_session_id(&self, session_id: &str) {
        let keys: Vec<_> = {
            let entries = self.entries.read().await;
            entries
                .keys()
                .filter(|key| key.session_id == session_id)
                .cloned()
                .collect()
        };
        for key in keys {
            self.retire_key(key).await;
        }
    }

    async fn retire_key(&self, key: SessionMcpKey) {
        let _lifecycle = self.lifecycle.lock().await;
        let generation = {
            let mut entries = self.entries.write().await;
            entries.remove(&key).map(|entry| entry.generation)
        };
        if let Some(generation) = generation {
            generation.registry.shutdown().await;
        }
    }

    /// Synchronous twin of [`Self::retire_key`] for `Drop` contexts (no runtime to await
    /// on): drops the parked entry so its registry/transports can go. Best-effort — a
    /// contended lock is fine, because the caller already issued the synchronous child kill
    /// and the reaper (or process exit) finishes the job.
    fn retire_key_now(&self, key: &SessionMcpKey) -> bool {
        match self.entries.try_write() {
            Ok(mut entries) => entries.remove(key).is_some(),
            Err(_) => false,
        }
    }

    /// Refresh the shared schema cache without killing unchanged live processes.
    pub async fn invalidate_project(&self, project_dir: &Path) {
        super::schema_cache::refresh_session_mcp_schema(project_dir).await;
    }

    pub async fn cached_registry(
        &self,
        project_dir: &Path,
        session_id: &str,
    ) -> Option<Arc<McpRegistry>> {
        let key = SessionMcpKey {
            project_dir: project_key(project_dir),
            session_id: session_id.to_string(),
        };
        self.entries
            .read()
            .await
            .get(&key)
            .map(|entry| entry.generation.registry.clone())
    }

    /// Host shutdown reaps every session-scoped process in this pool.
    pub async fn shutdown_all(&self) {
        let _lifecycle = self.lifecycle.lock().await;
        let stale: Vec<_> = {
            let mut entries = self.entries.write().await;
            entries.drain().map(|(_, entry)| entry.generation).collect()
        };
        for generation in stale {
            generation.registry.shutdown().await;
        }
    }

    #[cfg(test)]
    async fn owner_count(&self, project_dir: &Path, session_id: &str) -> usize {
        let key = SessionMcpKey {
            project_dir: project_key(project_dir),
            session_id: session_id.to_string(),
        };
        self.entries
            .read()
            .await
            .get(&key)
            .map(|entry| entry.generation.owners.load(Ordering::Acquire))
            .unwrap_or_default()
    }
}

impl Default for SessionMcpPool {
    fn default() -> Self {
        Self::new()
    }
}

fn spawn_idle_reaper(pool: Arc<SessionMcpPool>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            interval.tick().await;
            let ttl_secs = jeikcode_config::config::McpClientConfig::load_effective()
                .session
                .idle_ttl_secs;
            if ttl_secs == 0 {
                continue;
            }
            if pool.reap_idle(Duration::from_secs(ttl_secs)).await > 0 {
                // The reaper demonstrably works in THIS host ⇒ park-on-idle warm reuse is
                // safe here (the TTL sweep will reclaim parked sessions).
                pool.reaper_proven.store(true, Ordering::Release);
            }
        }
    });
}

/// RAII owner for a session registry. Provider-only reassembly reuses the same
/// CodingParts and therefore the same lease; overlapping handoffs are ref-counted.
///
/// Dropping the last lease PARKS the session process for warm reuse ONLY when this host's
/// idle reaper has demonstrably run at least once (`SessionMcpPool::reaper_proven`) — the
/// only case in which the TTL sweep can actually reclaim it, and only once `owners == 0`.
/// In a host that tears its runtime down (tests / one-shot CLI / embedded SDK) the reaper
/// task dies with the runtime and never runs, so leaving the process parked would leak the
/// whole npx/cmd/node tree AND deadlock `Runtime::drop` forever on the still-open stdout
/// pipes. That case instead tears the session's transports down synchronously (no runtime
/// needed) and retires the parked entry.
pub struct SessionMcpLease {
    key: Option<SessionMcpKey>,
    generation: Arc<SessionMcpGeneration>,
}

impl SessionMcpLease {
    pub fn registry(&self) -> Arc<McpRegistry> {
        self.generation.registry.clone()
    }
}

impl Drop for SessionMcpLease {
    fn drop(&mut self) {
        let Some(key) = self.key.take() else {
            return;
        };
        if self.generation.owners.fetch_sub(1, Ordering::AcqRel) != 1 {
            // Another owner (a concurrent CodingParts clone) still holds this session.
            return;
        }
        // LAST owner: the session is being switched away / torn down.
        let pool = self.generation.pool.upgrade();
        let host_has_reaper = pool
            .as_ref()
            .is_some_and(|pool| pool.reaper_proven.load(Ordering::Acquire));
        if host_has_reaper {
            // Long-lived host: park for warm reuse; the TTL sweep reclaims it later.
            return;
        }
        // No usable async reaper here: kill the children NOW (synchronously — we are inside
        // `Drop`). This closes their stdout pipes, unblocking any reader still parked on
        // them, and stops the process tree from leaking past this host.
        self.generation.registry.kill_all_children_now();
        // The session registry only knows its OWN clients. A session-less assembly (e.g.
        // `SessionMode::Disabled`, or the schema probe) spawns through the project pool /
        // probe path, so drain the process-global list too — that is the only way to reap a
        // child this lease never owned. Superset of the call above; both are idempotent.
        super::kill_all_mcp_children_now();
        if let Some(pool) = pool {
            pool.retire_key_now(&key);
        }
    }
}

fn project_key(project_dir: &Path) -> PathBuf {
    let path = crate::pathnorm::canonicalize(project_dir)
        .unwrap_or_else(|_| crate::pathnorm::strip_verbatim_path(project_dir));
    #[cfg(target_os = "windows")]
    {
        PathBuf::from(path.to_string_lossy().to_lowercase())
    }
    #[cfg(not(target_os = "windows"))]
    {
        path
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn leases_share_within_a_session_and_isolate_other_sessions() {
        let pool = Arc::new(SessionMcpPool::new());
        // Long-lived-host semantics: a proven idle reaper is what keeps parked entries
        // around after the last lease drops (the assertion at the end relies on that).
        pool.reaper_proven.store(true, Ordering::Release);
        let project = tempfile::tempdir().unwrap();
        let first = pool.acquire(project.path(), "a").await;
        let second = pool.acquire(project.path(), "a").await;
        let other = pool.acquire(project.path(), "b").await;

        assert!(Arc::ptr_eq(&first.registry(), &second.registry()));
        assert!(!Arc::ptr_eq(&first.registry(), &other.registry()));
        assert_eq!(pool.owner_count(project.path(), "a").await, 2);

        drop(first);
        tokio::task::yield_now().await;
        assert_eq!(pool.owner_count(project.path(), "a").await, 1);
        drop(second);
        drop(other);
        tokio::task::yield_now().await;
        assert_eq!(pool.owner_count(project.path(), "a").await, 0);
        assert_eq!(pool.entries.read().await.len(), 2);
    }

    #[tokio::test]
    async fn last_lease_drop_reuses_the_same_generation() {
        let pool = Arc::new(SessionMcpPool::new());
        // Warm reuse after the last lease drop is a LONG-LIVED-host behavior (see
        // `SessionMcpLease::drop`); a host without a working reaper retires instead.
        pool.reaper_proven.store(true, Ordering::Release);
        let project = tempfile::tempdir().unwrap();
        let first = pool.acquire(project.path(), "a").await;
        let old = first.registry();
        drop(first);
        tokio::task::yield_now().await;
        let again = pool.acquire(project.path(), "a").await;
        assert!(Arc::ptr_eq(&old, &again.registry()));
        drop(again);
    }

    #[tokio::test]
    async fn retire_session_removes_the_generation() {
        let pool = Arc::new(SessionMcpPool::new());
        let project = tempfile::tempdir().unwrap();
        let lease = pool.acquire(project.path(), "a").await;
        drop(lease);
        pool.retire_session(project.path(), "a").await;
        assert!(pool.cached_registry(project.path(), "a").await.is_none());
    }

    #[tokio::test]
    async fn shutdown_all_removes_every_generation() {
        let pool = Arc::new(SessionMcpPool::new());
        let project = tempfile::tempdir().unwrap();
        let first = pool.acquire(project.path(), "a").await;
        let other = pool.acquire(project.path(), "b").await;
        drop(first);
        drop(other);
        pool.shutdown_all().await;
        assert!(pool.cached_registry(project.path(), "a").await.is_none());
        assert!(pool.cached_registry(project.path(), "b").await.is_none());
        assert!(pool.entries.read().await.is_empty());
    }

    #[tokio::test]
    async fn reap_idle_skips_owned_entries_even_when_activity_is_stale() {
        let pool = Arc::new(SessionMcpPool::new());
        let project = tempfile::tempdir().unwrap();
        let lease = pool.acquire(project.path(), "a").await;
        lease
            .registry()
            .set_last_activity_for_test(Duration::from_secs(3600));
        pool.reap_idle(Duration::from_millis(1)).await;
        assert_eq!(pool.owner_count(project.path(), "a").await, 1);
        drop(lease);
    }

    /// SHORT-LIVED host (no working idle reaper — tests, one-shot CLI, embedded SDK): the
    /// LAST lease drop must retire the session entry and kill its transports synchronously.
    /// Parking here is what leaked the MCP process tree AND deadlocked `Runtime::drop` on
    /// the still-open stdout pipes (the `tests/full_assembly.rs` hang).
    #[tokio::test]
    async fn last_lease_drop_on_a_short_lived_host_retires_the_entry() {
        let pool = Arc::new(SessionMcpPool::new());
        let project = tempfile::tempdir().unwrap();
        let lease = pool.acquire(project.path(), "s").await;
        assert!(pool.cached_registry(project.path(), "s").await.is_some());

        drop(lease);

        assert!(
            pool.cached_registry(project.path(), "s").await.is_none(),
            "the last owner's drop must retire the entry when no reaper can run"
        );
    }

    /// A non-owner drop must NOT tear anything down: concurrent CodingParts clones share the
    /// same lease, so the session survives until the LAST owner goes away.
    #[tokio::test]
    async fn earlier_owner_drop_keeps_the_session_alive() {
        let pool = Arc::new(SessionMcpPool::new());
        let project = tempfile::tempdir().unwrap();
        let first = pool.acquire(project.path(), "s").await;
        let second = pool.acquire(project.path(), "s").await;

        drop(first);
        assert!(
            pool.cached_registry(project.path(), "s").await.is_some(),
            "a concurrent owner still holds the session"
        );
        drop(second);
        assert!(
            pool.cached_registry(project.path(), "s").await.is_none(),
            "the last owner retires it"
        );
    }
}
