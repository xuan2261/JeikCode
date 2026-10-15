import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clearStreamCursor,
  readStreamCursor,
  resolveAfterSeq,
  writeStreamCursor,
  type CursorStorage,
} from './streamCursor.ts';

function fakeStorage(): CursorStorage & { dump: () => Record<string, string> } {
  const map = new Map<string, string>();
  return {
    getItem: (key) => (map.has(key) ? map.get(key)! : null),
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    dump: () => Object.fromEntries(map),
  };
}

test('游标只前进：重放/乱序帧不会把它往回拨', () => {
  const storage = fakeStorage();
  writeStreamCursor('s-1', 7, 'watch', storage);
  assert.deepEqual(readStreamCursor('s-1', 'watch', storage), { seq: 7 });
  writeStreamCursor('s-1', 5, 'watch', storage);
  assert.deepEqual(readStreamCursor('s-1', 'watch', storage), { seq: 7 });
  writeStreamCursor('s-1', 9, 'watch', storage);
  assert.deepEqual(readStreamCursor('s-1', 'watch', storage), { seq: 9 });
});

test('两条流各有自己的游标空间，互不覆盖', () => {
  const storage = fakeStorage();
  writeStreamCursor('s-1', 3, 'watch', storage);
  writeStreamCursor('s-1', 11, 'sync', storage);
  assert.deepEqual(readStreamCursor('s-1', 'watch', storage), { seq: 3 });
  assert.deepEqual(readStreamCursor('s-1', 'sync', storage), { seq: 11 });
});

test('回合结束清游标：旧序号不再有意义', () => {
  const storage = fakeStorage();
  writeStreamCursor('s-1', 4, 'watch', storage);
  clearStreamCursor('s-1', 'watch', storage);
  assert.equal(readStreamCursor('s-1', 'watch', storage), null);
});

test('连接游标：有游标就续传；新会话（空画布）带 -1；有历史无游标才请求全量', () => {
  // 有游标 → 续传（收到的全是新的）
  assert.equal(resolveAfterSeq({ seq: 12 }, false), 12);
  assert.equal(resolveAfterSeq({ seq: 12 }, true), 12);
  // 新会话（无游标 + 空画布）→ -1：服务器跳过补发，直接转实时
  assert.equal(resolveAfterSeq(null, true), -1);
  // 无游标但画布有历史（换设备/清缓存）→ 全量补发（幂等收敛兜底）
  assert.equal(resolveAfterSeq(null, false), undefined);
});

test('存储不可用（隐私模式）时退化为无游标，不抛异常', () => {
  assert.equal(readStreamCursor('s-1', 'watch', null), null);
  writeStreamCursor('s-1', 5, 'watch', null);
  clearStreamCursor('s-1', 'watch', null);
  assert.equal(readStreamCursor('s-1', 'watch', null), null);
});
