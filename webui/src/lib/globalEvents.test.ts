import assert from 'node:assert/strict';
import { test } from 'node:test';
import { emitGlobalEvent, mergeSessionRow, onGlobalEvent, removeSessionRows } from './globalEvents.ts';

test('mergeSessionRow upserts by id and keeps updated_at ordering', () => {
  const list = [
    { id: 'a', name: 'A', updated_at: 300 },
    { id: 'b', name: 'B', updated_at: 200 },
  ];
  // 已存在：覆盖该行（不新增、不丢其他行）。
  const updated = mergeSessionRow(list, { id: 'b', name: 'B2', updated_at: 500 });
  assert.equal(updated.length, 2);
  assert.deepEqual(updated.map((row) => row.id), ['b', 'a'], '最近活跃排最前');
  assert.equal(updated[0]?.name, 'B2');

  // 不存在：插入为新行。
  const inserted = mergeSessionRow(list, { id: 'c', name: 'C', updated_at: 400 });
  assert.deepEqual(inserted.map((row) => row.id), ['c', 'a', 'b']);
  // 输入不可被就地篡改（Preact 状态依赖不可变引用）。
  assert.deepEqual(list.map((row) => row.id), ['a', 'b']);
});

test('removeSessionRows removes by id and keeps the same array when nothing matches', () => {
  const list = [{ id: 'a' }, { id: 'b' }];
  const removed = removeSessionRows(list, new Set(['b']));
  assert.deepEqual(removed.map((row) => row.id), ['a']);
  // 无命中必须返回同一引用，避免无谓重绘。
  assert.equal(removeSessionRows(list, new Set(['zzz'])), list);
});

test('onGlobalEvent subscribers receive pushed deltas and can unsubscribe', () => {
  const seen: string[] = [];
  const unsubscribe = onGlobalEvent((event) => {
    seen.push(event.type);
  });
  emitGlobalEvent({ type: 'sync' });
  emitGlobalEvent({ type: 'activity', session_id: 's1', running: true });
  emitGlobalEvent({ type: 'activity', session_id: 's1', running: false, terminal: 'completed' });
  unsubscribe();
  emitGlobalEvent({ type: 'sync' });
  assert.deepEqual(seen, ['sync', 'activity', 'activity']);

  // 单个订阅者抛错不得影响其他订阅者（否则一处渲染 bug 会静默掉整条增量链）。
  const okAgain: string[] = [];
  const offBad = onGlobalEvent(() => {
    throw new Error('boom');
  });
  const offGood = onGlobalEvent((event) => {
    okAgain.push(event.type);
  });
  emitGlobalEvent({ type: 'session_deleted', session_id: 's2', project_hash: 'h' });
  assert.deepEqual(okAgain, ['session_deleted']);
  offBad();
  offGood();
});
