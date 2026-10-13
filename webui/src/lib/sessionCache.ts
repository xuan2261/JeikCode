/**
 * 工业级双层会话缓存引擎 (L1 内存 LRU + L2 原生 IndexedDB)
 * 彻底打破 sessionStorage 5MB 配额瓶颈，支持几十 GB 异步非阻塞持久化，
 * 解决切换与刷新白屏冷启动延迟。
 */

export interface CachedSessionData {
  sessionId: string;
  projectHash: string;
  messages: any[];
  todos?: any[] | null;
  turns?: any[] | null;
  tokenUsage?: any | null;
  timestamp: number;
  mtime_ms?: number;
}

const DB_NAME = 'jeikcode_cache';
const DB_VERSION = 1;
const STORE_SESSIONS = 'sessions';
const MAX_MEMORY_ENTRIES = 30;

// L1 内存 LRU 缓存 (0.00ms 极速响应)
const memoryCache = new Map<string, CachedSessionData>();

// Only in-flight operations need a fence. Keeping these tokens scoped to pending
// requests avoids an unbounded per-session version map for long-lived clients.
type CacheOperation = { kind: 'read' | 'write' | 'delete' | 'clear'; invalidated: boolean };
const pendingByKey = new Map<string, Set<CacheOperation>>();
const pendingClears = new Set<CacheOperation>();

function trackKeyOperation(key: string, kind: CacheOperation['kind']): CacheOperation {
  const op: CacheOperation = { kind, invalidated: false };
  let pending = pendingByKey.get(key);
  if (!pending) {
    pending = new Set();
    pendingByKey.set(key, pending);
  }
  pending.add(op);
  return op;
}

function finishKeyOperation(key: string, op: CacheOperation): void {
  const pending = pendingByKey.get(key);
  pending?.delete(op);
  if (pending?.size === 0) pendingByKey.delete(key);
}

function invalidateKeyOperations(key: string): void {
  for (const op of pendingByKey.get(key) ?? []) op.invalidated = true;
}

function hasPendingRemoval(key: string): boolean {
  for (const op of pendingClears) {
    if (!op.invalidated) return true;
  }
  for (const op of pendingByKey.get(key) ?? []) {
    if (op.kind === 'delete' && !op.invalidated) return true;
  }
  return false;
}

function makeKey(projectHash: string, sessionId: string): string {
  return `${projectHash}:${sessionId}`;
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function getDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      try {
        const req = window.indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (e) => {
          const db = (e.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
            db.createObjectStore(STORE_SESSIONS, { keyPath: 'key' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('[SessionCache] IndexedDB open failed, falling back to memory only');
          resolve(null);
        };
      } catch {
        resolve(null);
      }
    });
  }
  return dbPromise;
}

/**
 * 同步快速检查 L1 内存中是否已存在该会话 (0.00ms)
 */
export function hasMemorySession(projectHash: string, sessionId: string): boolean {
  const key = makeKey(projectHash, sessionId);
  return memoryCache.has(key);
}

/**
 * 同步从 L1 内存获取该会话 (0.00ms)
 */
export function getMemorySession(projectHash: string, sessionId: string): CachedSessionData | null {
  const key = makeKey(projectHash, sessionId);
  const data = memoryCache.get(key);
  if (data) {
    // LRU: 刷新访问顺序
    memoryCache.delete(key);
    memoryCache.set(key, data);
    return data;
  }
  return null;
}

/**
 * 异步获取会话缓存：优先 L1 内存，次选 L2 IndexedDB (1~3ms)
 */
export async function getSessionCache(
  projectHash: string,
  sessionId: string,
): Promise<CachedSessionData | null> {
  const mem = getMemorySession(projectHash, sessionId);
  if (mem) return mem;

  const key = makeKey(projectHash, sessionId);
  // A removal awaiting IndexedDB.open must not trigger a read of the old row.
  if (hasPendingRemoval(key)) return null;
  const op = trackKeyOperation(key, 'read');
  try {
    const db = await getDB();
    if (op.invalidated || hasPendingRemoval(key)) return getMemorySession(projectHash, sessionId);
    if (!db) return null;

    const disk = await new Promise<CachedSessionData | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_SESSIONS, 'readonly');
        const req = tx.objectStore(STORE_SESSIONS).get(key);
        req.onsuccess = () => {
          const result = req.result as CachedSessionData | undefined;
          resolve(result && Array.isArray(result.messages) ? result : null);
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    // Any newer save/delete/clear wins, even when the old IDB read was already
    // dispatched. Return the latest L1 snapshot instead of resurrecting L2.
    if (op.invalidated || hasPendingRemoval(key)) return getMemorySession(projectHash, sessionId);
    const newerMemory = getMemorySession(projectHash, sessionId);
    if (newerMemory) return newerMemory;
    if (disk) setMemorySession(projectHash, sessionId, disk);
    return disk;
  } finally {
    finishKeyOperation(key, op);
  }
}

function setMemorySession(projectHash: string, sessionId: string, data: CachedSessionData): void {
  const key = makeKey(projectHash, sessionId);
  if (memoryCache.has(key)) {
    memoryCache.delete(key);
  } else if (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    // 淘汰最久未访问的首个 entry
    const oldestKey = memoryCache.keys().next().value;
    if (oldestKey) memoryCache.delete(oldestKey);
  }
  memoryCache.set(key, data);
}

/**
 * 写入会话缓存：同步更新 L1 内存，并异步持久化至 L2 IndexedDB (不阻塞主线程)
 */
export async function saveSessionCache(
  projectHash: string,
  sessionId: string,
  messages: any[],
  todos?: any[] | null,
  mtime_ms?: number,
  turns?: any[] | null,
  tokenUsage?: any | null,
): Promise<void> {
  const data: CachedSessionData = {
    sessionId,
    projectHash,
    messages,
    todos: todos ?? undefined,
    turns: turns ?? undefined,
    tokenUsage: tokenUsage ?? undefined,
    timestamp: Date.now(),
    mtime_ms,
  };

  const key = makeKey(projectHash, sessionId);
  invalidateKeyOperations(key);
  const op = trackKeyOperation(key, 'write');

  // 1. 同步更新 L1 内存
  setMemorySession(projectHash, sessionId, data);

  // 2. Async writes that have not entered an IDB transaction can be superseded.
  // Once a transaction is enqueued, IndexedDB orders overlapping readwrite
  // transactions; do not attempt to cancel transactions already dispatched.
  try {
    const db = await getDB();
    if (!db || op.invalidated) return;
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    store.put({
      key,
      ...data,
    });
  } catch (err) {
    console.warn('[SessionCache] Failed to write to IndexedDB:', err);
  } finally {
    finishKeyOperation(key, op);
  }
}

/**
 * 删除某会话的本地缓存（L1 内存 + L2 IndexedDB）。
 *
 * 会话被删除（本端操作或跨实例推送）后必须立即失效：否则侧栏/正文一旦
 * 再次读到旧缓存，幽灵会话就会复活到下一次冷启动重拉为止。
 */
export async function deleteSessionCache(
  projectHash: string,
  sessionId: string,
): Promise<void> {
  const key = makeKey(projectHash, sessionId);
  invalidateKeyOperations(key);
  const op = trackKeyOperation(key, 'delete');
  memoryCache.delete(key);
  try {
    const db = await getDB();
    if (!db || op.invalidated) return;
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).delete(key);
  } catch (err) {
    console.warn('[SessionCache] Failed to delete from IndexedDB:', err);
  } finally {
    finishKeyOperation(key, op);
  }
}

/**
 * 实时向缓存中追加新消息 (反向增量注入，保证后台和异地实例状态时刻新鲜)
 */
export function appendMessageToSessionCache(
  projectHash: string,
  sessionId: string,
  message: any,
  turns?: any[],
  tokenUsage?: any,
): void {
  const current = getMemorySession(projectHash, sessionId);
  if (current) {
    current.messages.push(message);
    if (turns) current.turns = turns;
    if (tokenUsage) current.tokenUsage = tokenUsage;
    current.timestamp = Date.now();
    // 异步排队更新 IndexedDB
    void saveSessionCache(projectHash, sessionId, current.messages, current.todos, current.mtime_ms, current.turns, current.tokenUsage);
  }
}

/**
 * Ctrl + F5 强制清理：一网打尽清空所有 L1 内存与 L2 IndexedDB 缓存
 */
export async function clearAllSessionCache(): Promise<void> {
  for (const pending of pendingByKey.values()) {
    for (const op of pending) op.invalidated = true;
  }
  for (const op of pendingClears) op.invalidated = true;
  const op: CacheOperation = { kind: 'clear', invalidated: false };
  pendingClears.add(op);
  memoryCache.clear();
  try {
    const db = await getDB();
    if (!db || op.invalidated) return;
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    tx.objectStore(STORE_SESSIONS).clear();
  } catch {
    // 忽略清空错误
  } finally {
    pendingClears.delete(op);
  }
}
