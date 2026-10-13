import { test } from 'node:test';
import assert from 'node:assert/strict';

// The application enqueues one request per transaction; this simulator models
// the IndexedDB rule that overlapping readwrite transactions commit in creation
// order. It is a deterministic transaction-order contract test, not a browser.
type CacheRow = { key: string; messages: Array<{ content: string }> };
type Transaction = { label: string; commit: () => void };
let fixtureId = 0;

async function withDeferredCommit(run: (ctx: {
  cache: typeof import('./sessionCache.ts');
  open: () => void;
  commitAll: () => void;
  queued: Transaction[];
  disk: Map<string, CacheRow>;
}) => Promise<void>): Promise<void> {
  const priorWindow = (globalThis as any).window;
  const queued: Transaction[] = [];
  const disk = new Map<string, CacheRow>();
  const db = {
    transaction: (storeName: string, mode: string) => {
      assert.equal(storeName, 'sessions');
      assert.equal(mode, 'readwrite');
      const schedule = (label: string, commit: () => void) => {
        queued.push({ label, commit });
        return {};
      };
      return {
        objectStore: () => ({
          put: (row: CacheRow) => schedule(`put:${row.key}:${row.messages[0]?.content}`, () => disk.set(row.key, row)),
          delete: (key: string) => schedule(`delete:${key}`, () => { disk.delete(key); }),
          clear: () => schedule('clear', () => { disk.clear(); }),
        }),
      };
    },
  };
  const openRequest: { result: typeof db; onsuccess?: () => void } = { result: db };
  (globalThis as any).window = { indexedDB: { open: () => openRequest } };
  try {
    const cache = await import(`./sessionCache.ts?commit=${++fixtureId}`) as typeof import('./sessionCache.ts');
    await run({
      cache,
      open: () => openRequest.onsuccess?.(),
      queued,
      disk,
      commitAll: () => {
        // Apply transactions only after the cache API promises have resolved.
        for (const tx of queued.splice(0)) tx.commit();
      },
    });
  } finally {
    (globalThis as any).window = priorWindow;
  }
}

test('already-enqueued save then delete commits in the same order and ends absent', async () => {
  await withDeferredCommit(async ({ cache, open, queued, disk, commitAll }) => {
    const save = cache.saveSessionCache('p', 's', [{ content: 'OLD' }]);
    open();
    await save;
    await cache.deleteSessionCache('p', 's');
    assert.deepEqual(queued.map((tx) => tx.label), ['put:p:s:OLD', 'delete:p:s']);
    assert.equal(disk.size, 0, 'cache API resolution does not prove IDB commit');
    commitAll();
    assert.equal(disk.has('p:s'), false);
    assert.equal(cache.hasMemorySession('p', 's'), false);
  });
});

test('already-enqueued delete then save ends with the newer snapshot', async () => {
  await withDeferredCommit(async ({ cache, open, queued, disk, commitAll }) => {
    const deletion = cache.deleteSessionCache('p', 's');
    open();
    await deletion;
    await cache.saveSessionCache('p', 's', [{ content: 'NEW' }]);
    assert.deepEqual(queued.map((tx) => tx.label), ['delete:p:s', 'put:p:s:NEW']);
    commitAll();
    assert.equal(disk.get('p:s')?.messages[0]?.content, 'NEW');
  });
});

test('clear, save, clear ends empty when each transaction was already enqueued', async () => {
  await withDeferredCommit(async ({ cache, open, queued, disk, commitAll }) => {
    const firstClear = cache.clearAllSessionCache();
    open();
    await firstClear;
    await cache.saveSessionCache('p', 's', [{ content: 'NEW' }]);
    await cache.clearAllSessionCache();
    assert.deepEqual(queued.map((tx) => tx.label), ['clear', 'put:p:s:NEW', 'clear']);
    commitAll();
    assert.equal(disk.has('p:s'), false);
  });
});

test('clear, clear, save keeps only the save that follows both enqueued clears', async () => {
  await withDeferredCommit(async ({ cache, open, queued, disk, commitAll }) => {
    const firstClear = cache.clearAllSessionCache();
    open();
    await firstClear;
    await cache.clearAllSessionCache();
    await cache.saveSessionCache('p', 's', [{ content: 'NEW' }]);
    assert.deepEqual(queued.map((tx) => tx.label), ['clear', 'clear', 'put:p:s:NEW']);
    commitAll();
    assert.equal(disk.get('p:s')?.messages[0]?.content, 'NEW');
  });
});
