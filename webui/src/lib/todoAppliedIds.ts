/**
 * 「已消费的 todo 工具调用 id」按会话持久化。
 *
 * 背景：`/chat/watch` 在挂载/重连时会重放整轮事件，而 todowrite 的**全量 plan / 批量 add
 * 是整表替换**（`todos.ts` 的 `foldTodoToolCall`）。同一条调用被折叠两次，就会把最新的
 * 清单打回这条调用当时的状态——典型表现：清单已全部打钩，刷新后先是正确的一帧，
 * 随即被重放覆盖成"模型之前某一次打钩状态"并定格。
 *
 * 唯一的幂等闸门是这些 callId 的集合（`applyLiveTodoToolCall` 命中即跳过）。它必须：
 *  - **跨刷新存活**（否则刷新后保护归零，重放必然重折）；
 *  - **同步可读**（首帧重放到达之前就要就位，localStorage 满足）；
 *  - **只增不减**（清单全完成时更不能清空——那正是最容易被覆盖的时刻）。
 */
const STORAGE_KEY = 'jeikcode_todo_applied_call_ids';

/** 单会话最多保留的调用 id 数：防止超长会话无限膨胀。 */
const MAX_IDS_PER_SESSION = 400;
/** 最多保留的会话数（LRU：最近写入的排在后）。 */
const MAX_SESSIONS = 60;

type StoredShape = Record<string, string[]>;

export function loadAppliedTodoCallIds(): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  if (typeof window === 'undefined') return map;
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return map;
    const parsed = JSON.parse(raw) as StoredShape;
    if (!parsed || typeof parsed !== 'object') return map;
    for (const [sid, ids] of Object.entries(parsed)) {
      if (!sid || !Array.isArray(ids)) continue;
      const clean = ids.filter((id) => typeof id === 'string' && id.length > 0);
      if (clean.length > 0) map.set(sid, new Set(clean));
    }
  } catch {
    // 损坏的存储不应拖垮会话加载：当作空集合处理。
  }
  return map;
}

export function saveAppliedTodoCallIds(stash: Map<string, Set<string>>): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: StoredShape = {};
    for (const [sid, ids] of stash.entries()) {
      if (!sid || !ids || ids.size === 0) continue;
      const list = [...ids].filter((id) => typeof id === 'string' && id.length > 0);
      if (list.length === 0) continue;
      // 只保留最近的若干条：老调用早已结算，重放窗口不会回溯那么远。
      obj[sid] = list.slice(-MAX_IDS_PER_SESSION);
    }
    const entries = Object.entries(obj);
    const trimmed: StoredShape = {};
    for (const [sid, ids] of entries.slice(-MAX_SESSIONS)) trimmed[sid] = ids;
    window.localStorage?.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // 配额/隐私模式：退化为仅内存幂等键，不影响会话可用性。
  }
}
