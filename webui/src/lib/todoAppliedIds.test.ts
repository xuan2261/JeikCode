import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadAppliedTodoCallIds, saveAppliedTodoCallIds } from './todoAppliedIds.ts';

function withMockStorage(store: Map<string, string>) {
  const original = (globalThis as never as { window?: unknown }).window;
  (globalThis as never as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, String(v)),
      removeItem: (k: string) => store.delete(k),
    },
  };
  return () => {
    (globalThis as never as { window: unknown }).window = original;
  };
}

test('applied todo call ids survive a refresh so a replayed plan cannot revert the list', () => {
  const store = new Map<string, string>();
  const restore = withMockStorage(store);
  try {
    const stash = new Map<string, Set<string>>();
    stash.set('session-1', new Set(['call-plan', 'call-update-1', 'call-update-2']));
    saveAppliedTodoCallIds(stash);

    // 模拟刷新：内存集合清空，必须从 localStorage 原样恢复。
    const restored = loadAppliedTodoCallIds();
    assert.deepEqual([...(restored.get('session-1') ?? [])], [
      'call-plan',
      'call-update-1',
      'call-update-2',
    ]);
  } finally {
    restore();
  }
});

test('applied todo call ids ignore corrupted storage and empty sessions', () => {
  const store = new Map<string, string>();
  store.set('jeikcode_todo_applied_call_ids', '{not json');
  const restore = withMockStorage(store);
  try {
    assert.equal(loadAppliedTodoCallIds().size, 0);
  } finally {
    restore();
  }

  store.set('jeikcode_todo_applied_call_ids', JSON.stringify({ 's-1': [] }));
  const restore2 = withMockStorage(store);
  try {
    // 空集合不写入存储：没有已消费调用时不该留下任何条目。
    assert.equal(loadAppliedTodoCallIds().size, 0);
    saveAppliedTodoCallIds(new Map([['s-1', new Set()]]));
    assert.equal(loadAppliedTodoCallIds().size, 0);
  } finally {
    restore2();
  }
});
