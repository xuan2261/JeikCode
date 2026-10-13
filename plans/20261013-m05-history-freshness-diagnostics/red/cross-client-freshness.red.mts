// Intentionally RED diagnostic. Must be invoked explicitly; no *.test.* suffix.
// This uses two real sessionCache module instances with a shared simulated IDB
// store, representing independent tabs. It does NOT mount the Chat component.
import { test } from 'node:test';
import assert from 'node:assert/strict';

type Row = { key: string; messages: Array<{ content: string }> };

test('a stale client cannot overwrite a newer persisted transcript (unmet cross-tab contract)', async () => {
  const priorWindow = (globalThis as any).window;
  const disk = new Map<string, Row>();
  const operations: Array<() => void> = [];
  const openRequests: Array<{ result: unknown; onsuccess?: () => void }> = [];
  const db = {
    transaction: (storeName: string, mode: string) => {
      assert.equal(storeName, 'sessions');
      assert.ok(mode === 'readonly' || mode === 'readwrite');
      return {
        objectStore: () => ({
          get: (key: string) => {
            const req: { result?: Row; onsuccess?: () => void } = {};
            operations.push(() => {
              req.result = disk.get(key);
              req.onsuccess?.();
            });
            return req;
          },
          put: (row: Row) => { operations.push(() => { disk.set(row.key, row); }); },
          delete: (key: string) => { operations.push(() => { disk.delete(key); }); },
          clear: () => { operations.push(() => { disk.clear(); }); },
        }),
      };
    },
  };
  (globalThis as any).window = {
    indexedDB: {
      open: () => {
        const req: { result: typeof db; onsuccess?: () => void } = { result: db };
        openRequests.push(req);
        return req;
      },
    },
  };

  try {
    const clientA = await import('../../../webui/src/lib/sessionCache.ts?independent=tab-A');
    const clientB = await import('../../../webui/src/lib/sessionCache.ts?independent=tab-B');
    const drain = () => { for (const operation of operations.splice(0)) operation(); };

    // Both tabs saw the original transcript.
    const seed = clientA.saveSessionCache('p', 's', [{ content: 'OLD' }]);
    openRequests[0].onsuccess?.();
    await seed;
    drain();
    const oldRead = clientB.getSessionCache('p', 's');
    openRequests[1].onsuccess?.();
    await Promise.resolve();
    assert.equal(operations.length, 1);
    drain();
    assert.equal((await oldRead)?.messages[0].content, 'OLD');

    // Tab A confirms a later mutation and commits the new local cache row.
    await clientA.saveSessionCache('p', 's', [{ content: 'NEW' }]);
    drain();
    assert.equal(disk.get('p:s')?.messages[0].content, 'NEW');

    // Tab B later writes the stale transcript it had retained. The in-module
    // operation fences cannot see tab A's mutation; no durable revision/CAS exists.
    await clientB.saveSessionCache('p', 's', [{ content: 'OLD' }]);
    drain();
    const actual = disk.get('p:s')?.messages[0].content;
    assert.equal(actual, 'NEW', 'the older independent tab must not overwrite a newer committed revision');
  } finally {
    (globalThis as any).window = priorWindow;
  }
});
