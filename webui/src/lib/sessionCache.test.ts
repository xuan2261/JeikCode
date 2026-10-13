import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getMemorySession,
  hasMemorySession,
  saveSessionCache,
  appendMessageToSessionCache,
  clearAllSessionCache,
} from './sessionCache.ts';

test('sessionCache manages L1 memory LRU correctly', async () => {
  const p = 'proj-1';
  const s = 'sess-1';
  await clearAllSessionCache();
  assert.equal(hasMemorySession(p, s), false);

  await saveSessionCache(p, s, [{ role: 'user', content: 'hello' }]);
  assert.equal(hasMemorySession(p, s), true);

  const mem = getMemorySession(p, s);
  assert.ok(mem);
  assert.equal(mem?.messages.length, 1);
  assert.equal(mem?.messages[0].content, 'hello');

  appendMessageToSessionCache(p, s, { role: 'assistant', content: 'world' });
  const updated = getMemorySession(p, s);
  assert.equal(updated?.messages.length, 2);

  await clearAllSessionCache();
  assert.equal(hasMemorySession(p, s), false);
});

test('sessionCache preserves turns outline', async () => {
  const p = 'proj-2';
  const s = 'sess-2';
  const turns = [{ index: 0, ordinal: 0, text: 'Q1' }, { index: 1, ordinal: 1, text: 'Q2' }];
  await saveSessionCache(p, s, [{ role: 'user', content: 'Q1' }], undefined, undefined, turns);
  const mem = getMemorySession(p, s);
  assert.ok(mem);
  assert.deepEqual(mem?.turns, turns);
  await clearAllSessionCache();
});

// Each test loads an independent cache module to isolate its singleton DB/L1 state.
// The manual IDB callbacks make otherwise timing-dependent races deterministic.
let caseNumber = 0;
async function withControlledIDB(run: (ctx: {
  cache: typeof import('./sessionCache.ts');
  open: () => void;
  reads: Array<{ key: string; resolve: (value: unknown) => void }>;
  operations: string[];
}) => Promise<void>): Promise<void> {
  const originalWindow = (globalThis as any).window;
  const reads: Array<{ key: string; resolve: (value: unknown) => void }> = [];
  const operations: string[] = [];
  const db = {
    transaction: () => ({
      objectStore: () => ({
        get: (key: string) => {
          const request: { result?: unknown; onsuccess?: () => void } = {};
          reads.push({ key, resolve: (value) => { request.result = value; request.onsuccess?.(); } });
          return request;
        },
        put: (value: { key: string; messages: Array<{ content: string }> }) => {
          operations.push(`put:${value.key}:${value.messages[0]?.content}`);
        },
        delete: (key: string) => { operations.push(`delete:${key}`); },
        clear: () => { operations.push('clear'); },
      }),
    }),
  };
  const openRequest: { result: typeof db; onsuccess?: () => void } = { result: db };
  (globalThis as any).window = { indexedDB: { open: () => openRequest } };
  try {
    const cache = await import(`./sessionCache.ts?race=${++caseNumber}`) as typeof import('./sessionCache.ts');
    await run({
      cache,
      open: () => openRequest.onsuccess?.(),
      reads,
      operations,
    });
  } finally {
    (globalThis as any).window = originalWindow;
  }
}

function diskValue(projectHash: string, sessionId: string, text: string) {
  return { projectHash, sessionId, messages: [{ content: text }], timestamp: 1 };
}

test('delayed IndexedDB read cannot roll back a newer synchronous L1 save', async () => {
  await withControlledIDB(async ({ cache, open, reads }) => {
    const read = cache.getSessionCache('p', 's');
    open();
    await Promise.resolve();
    assert.equal(reads.length, 1);
    const save = cache.saveSessionCache('p', 's', [{ content: 'NEW' }]);
    reads[0].resolve(diskValue('p', 's', 'OLD'));
    assert.equal((await read)?.messages[0].content, 'NEW');
    await save;
    assert.equal(cache.getMemorySession('p', 's')?.messages[0].content, 'NEW');
  });
});

test('delayed IndexedDB read cannot resurrect a deleted session', async () => {
  await withControlledIDB(async ({ cache, open, reads }) => {
    const read = cache.getSessionCache('p', 's');
    open();
    await Promise.resolve();
    assert.equal(reads.length, 1);
    const deletion = cache.deleteSessionCache('p', 's');
    reads[0].resolve(diskValue('p', 's', 'GHOST'));
    assert.equal(await read, null);
    await deletion;
    assert.equal(cache.hasMemorySession('p', 's'), false);
  });
});

test('delayed IndexedDB read cannot revive cache after clear', async () => {
  await withControlledIDB(async ({ cache, open, reads }) => {
    const read = cache.getSessionCache('p', 's');
    open();
    await Promise.resolve();
    assert.equal(reads.length, 1);
    const clearing = cache.clearAllSessionCache();
    reads[0].resolve(diskValue('p', 's', 'GHOST'));
    assert.equal(await read, null);
    await clearing;
    assert.equal(cache.hasMemorySession('p', 's'), false);
  });
});

test('delayed database open skips obsolete save and respects newest write', async () => {
  await withControlledIDB(async ({ cache, open, operations }) => {
    const first = cache.saveSessionCache('p', 's', [{ content: 'OLD' }]);
    const second = cache.saveSessionCache('p', 's', [{ content: 'NEW' }]);
    open();
    await Promise.all([first, second]);
    assert.deepEqual(operations, ['put:p:s:NEW']);
    assert.equal(cache.getMemorySession('p', 's')?.messages[0].content, 'NEW');
  });
});

test('delayed database open skips stale save when delete wins', async () => {
  await withControlledIDB(async ({ cache, open, operations, reads }) => {
    const save = cache.saveSessionCache('p', 's', [{ content: 'OLD' }]);
    const deletion = cache.deleteSessionCache('p', 's');
    const pendingRead = cache.getSessionCache('p', 's');
    open();
    await Promise.resolve();
    for (const request of reads) request.resolve(diskValue('p', 's', 'GHOST'));
    assert.equal(await pendingRead, null, 'an in-flight deletion blocks an old disk read');
    await Promise.all([save, deletion]);
    assert.deepEqual(operations, ['delete:p:s']);
    assert.equal(cache.hasMemorySession('p', 's'), false);
  });
});

test('delayed database open skips obsolete delete when newer save wins', async () => {
  await withControlledIDB(async ({ cache, open, operations }) => {
    const deletion = cache.deleteSessionCache('p', 's');
    const save = cache.saveSessionCache('p', 's', [{ content: 'NEW' }]);
    open();
    await Promise.all([deletion, save]);
    assert.deepEqual(operations, ['put:p:s:NEW']);
  });
});

test('global clear fences old pending writes and precedes fresh writes', async () => {
  await withControlledIDB(async ({ cache, open, operations, reads }) => {
    const oldSave = cache.saveSessionCache('p', 's', [{ content: 'OLD' }]);
    const clearing = cache.clearAllSessionCache();
    const pendingRead = cache.getSessionCache('p', 'other');
    const newSave = cache.saveSessionCache('p', 's', [{ content: 'NEW' }]);
    open();
    await Promise.resolve();
    for (const request of reads) request.resolve(diskValue('p', 'other', 'GHOST'));
    assert.equal(await pendingRead, null, 'an in-flight clear blocks stale disk reads');
    await Promise.all([oldSave, clearing, newSave]);
    assert.deepEqual(operations, ['clear', 'put:p:s:NEW']);
    assert.equal(cache.getMemorySession('p', 's')?.messages[0].content, 'NEW');
  });
});

test('mutation for another session does not invalidate an unrelated disk read', async () => {
  await withControlledIDB(async ({ cache, open, reads }) => {
    const read = cache.getSessionCache('p', 'A');
    open();
    await Promise.resolve();
    const otherSave = cache.saveSessionCache('p', 'B', [{ content: 'B' }]);
    reads[0].resolve(diskValue('p', 'A', 'A'));
    assert.equal((await read)?.messages[0].content, 'A');
    await otherSave;
  });
});

test('two overlapping disk reads cannot replace the first accepted L1 snapshot', async () => {
  await withControlledIDB(async ({ cache, open, reads }) => {
    const first = cache.getSessionCache('p', 's');
    const second = cache.getSessionCache('p', 's');
    open();
    await Promise.resolve();
    assert.equal(reads.length, 2);
    reads[0].resolve(diskValue('p', 's', 'FIRST'));
    assert.equal((await first)?.messages[0].content, 'FIRST');
    reads[1].resolve(diskValue('p', 's', 'STALE'));
    assert.equal((await second)?.messages[0].content, 'FIRST');
    assert.equal(cache.getMemorySession('p', 's')?.messages[0].content, 'FIRST');
  });
});

test('stale disk read returns newer full L1 metadata without reverting it', async () => {
  await withControlledIDB(async ({ cache, open, reads }) => {
    const read = cache.getSessionCache('p', 's');
    open();
    await Promise.resolve();
    const turns = [{ index: 0, text: 'NEW' }];
    const todos = [{ id: 't', status: 'pending' }];
    const tokens = { input: 15, output: 9 };
    const save = cache.saveSessionCache('p', 's', [{ content: 'NEW' }], todos, 123, turns, tokens);
    const saved = cache.getMemorySession('p', 's');
    reads[0].resolve(diskValue('p', 's', 'OLD'));
    assert.strictEqual(await read, saved);
    await save;
    assert.deepEqual(saved?.todos, todos);
    assert.deepEqual(saved?.turns, turns);
    assert.deepEqual(saved?.tokenUsage, tokens);
    assert.equal(saved?.mtime_ms, 123);
  });
});

test('two pending deletes preserve the removal barrier until the last delete', async () => {
  await withControlledIDB(async ({ cache, open, reads, operations }) => {
    const first = cache.deleteSessionCache('p', 's');
    const second = cache.deleteSessionCache('p', 's');
    const read = cache.getSessionCache('p', 's');
    open();
    await Promise.all([first, second]);
    assert.equal(await read, null);
    assert.equal(reads.length, 0);
    assert.deepEqual(operations, ['delete:p:s']);
  });
});

test('back-to-back clears do not schedule an older redundant clear', async () => {
  await withControlledIDB(async ({ cache, open, operations }) => {
    const first = cache.clearAllSessionCache();
    const second = cache.clearAllSessionCache();
    open();
    await Promise.all([first, second]);
    assert.deepEqual(operations, ['clear']);
  });
});

test('cache keeps the thirty-entry LRU budget with in-flight async writes', async () => {
  await withControlledIDB(async ({ cache, open }) => {
    const writes = [];
    for (let i = 0; i < 31; i += 1) {
      writes.push(cache.saveSessionCache('p', `s${i}`, [{ content: `${i}` }]));
    }
    assert.equal(cache.hasMemorySession('p', 's0'), false);
    assert.equal(cache.hasMemorySession('p', 's1'), true);
    cache.getMemorySession('p', 's1'); // move to most recently used
    writes.push(cache.saveSessionCache('p', 's31', [{ content: '31' }]));
    assert.equal(cache.hasMemorySession('p', 's1'), true);
    assert.equal(cache.hasMemorySession('p', 's2'), false);
    open();
    await Promise.all(writes);
  });
});
