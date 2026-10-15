/**
 * globalEvents.ts — 跨实例增量事件的客户端分发枢纽。
 *
 * 每个实例只维持一条 `/events` 连接（App 启动时挂载），各组件按需订阅：
 * 侧栏（会话行/活动转圈）、通知 dock（待交互卡片/终态通知）、Chat（待交互清除）。
 *
 * 事件自带 payload → 订阅方**就地**改自己的缓存（upsert/remove），不做整表重拉；
 * 刷新后仍以同一份缓存恢复，与后端保持最终一致（对齐编辑/删除/回溯那套
 * “增量 + 回写缓存 + 刷新不丢”的既有语义）。
 */
import type { GlobalWireEvent } from '../api';

export type GlobalEventListener = (event: GlobalWireEvent) => void;

const listeners = new Set<GlobalEventListener>();

/** 订阅增量事件；返回取消订阅函数。 */
export function onGlobalEvent(listener: GlobalEventListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** 分发一条事件。单个订阅者抛错不得影响其他订阅者与连接存活。 */
export function emitGlobalEvent(event: GlobalWireEvent): void {
  if (event.type === 'config_reloaded') {
    try {
      window.dispatchEvent(new CustomEvent('jeikcode:config-reloaded'));
    } catch {}
  }
  for (const listener of [...listeners]) {
    try {
      listener(event);
    } catch {
      /* isolate subscriber failures */
    }
  }
}

/** 启动唯一的全局增量流（自动重连）。返回停止函数。 */
export function startGlobalEventStream(): () => void {
  const abort = new AbortController();
  let stopped = false;
  void (async () => {
    let attempt = 0;
    while (!stopped) {
      try {
        // 动态导入：hub 保持零运行时依赖（node 单测可直接加载），
        // 同时避免 api 模块在非浏览器环境被静态拉起。
        const { streamGlobalEvents } = await import('../api');
        await streamGlobalEvents(emitGlobalEvent, abort.signal);
        attempt = 0;
      } catch {
        if (stopped || abort.signal.aborted) return;
      }
      if (stopped) return;
      attempt = Math.min(attempt + 1, 6);
      await new Promise((resolve) => window.setTimeout(resolve, 400 * attempt));
    }
  })();
  return () => {
    stopped = true;
    abort.abort();
  };
}

/**
 * 把一条增量会话行并入列表：按 `id` 覆盖或插入，并按 `updated_at` 倒序保持
 * 侧栏顺序（“最近活跃在最上”），不触发任何列表拉取。
 */
export function mergeSessionRow<T extends { id: string; updated_at?: number }>(
  list: T[],
  row: T,
): T[] {
  const merged = list.some((item) => item.id === row.id)
    ? list.map((item) => (item.id === row.id ? row : item))
    : [row, ...list];
  return merged.sort((a, b) => (b.updated_at ?? 0) - (a.updated_at ?? 0));
}

/** 删除若干会话行（侧栏列表 / 每个已展开项目的列表）。 */
export function removeSessionRows<T extends { id: string }>(
  list: T[],
  removed: Set<string>,
): T[] {
  const next = list.filter((item) => !removed.has(item.id));
  return next.length === list.length ? list : next;
}
