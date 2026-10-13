// Intentionally RED: a causal model of Chat.tsx:2776-2782 and :2847-2850.
// It calls the real sessionCache module, but NOT the mounted Chat component.
// The browser GET/SSE integration remains NOT YET VERIFIED.
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('A→B→A current-generation GET must not cache a snapshot older than a peer SSE', async () => {
  const cache = await import('../../../webui/src/lib/sessionCache.ts?model=late-current-get');
  const view = { sessionId: 'A', generation: 1 };
  const originalHistory = [{ role: 'user', parts: [{ kind: 'text', text: 'AAAA' }] }];
  let deliverOldGet: ((messages: typeof originalHistory) => void) | undefined;
  const get = new Promise<typeof originalHistory>((resolve) => { deliverOldGet = resolve; });

  // A→B→A increments the view generation, correctly invalidating g1 work.
  view.sessionId = 'B'; view.generation += 1;
  view.sessionId = 'A'; view.generation += 1;
  const loadId = view.sessionId;
  const loadGeneration = view.generation;

  // The g3 GET starts before a peer mutation, with an older disk snapshot.
  const lateGet = get.then(async (loaded) => {
    if (view.sessionId !== loadId || view.generation !== loadGeneration) return;
    // Chat.tsx:2848-2849 currently saves a completed-turn GET to L2 before
    // doing its length/count-based disk-versus-canvas comparison.
    const serverActive = false;
    if (serverActive === false) {
      await cache.saveSessionCache('project', loadId, loaded);
    }
  });

  // A newer peer SSE is applied while that same g3 GET is outstanding.
  const newHistory = [{ role: 'user', parts: [{ kind: 'text', text: 'BBBB' }] }];
  await cache.saveSessionCache('project', 'A', newHistory);
  const canvas = newHistory;
  assert.equal(canvas[0].parts[0].text.length, originalHistory[0].parts[0].text.length);
  deliverOldGet?.(originalHistory);
  await lateGet;

  // A monotonic revision would reject the GET's earlier snapshot. Generation
  // and equal-length heuristics do not; the current cache ends up stale.
  assert.equal(
    cache.getMemorySession('project', 'A')?.messages[0].parts[0].text,
    'BBBB',
    'same-generation stale GET must not demote cached history after a newer peer SSE',
  );
});
