import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyGuardedSessionPrefetch, mergePrefetchActiveSnapshot, recordPrefetchActivity } from './sessionPrefetch.ts';
import { clearAllSessionCache, getMemorySession, hasMemorySession, saveSessionCache } from './sessionCache.ts';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => { resolve = r; });
  return { promise, resolve };
}

function scenario() {
  let cancelled = false;
  let reconcilingActive = false;
  let busy = false;
  let activeCandidate = false;
  let cached = false;
  let viewGeneration = 3;
  let mutationEpoch = 8;
  let committed: string[] = [];
  const request = deferred<string | null>();
  const fence = {
    isCancelled: () => cancelled || reconcilingActive,
    isBusy: () => busy,
    isCandidateActive: () => activeCandidate,
    hasCachedSession: () => cached,
    currentViewGeneration: () => viewGeneration,
    currentMutationEpoch: () => mutationEpoch,
  };
  return {
    request,
    fence,
    get committed() { return committed; },
    setCancelled: () => { cancelled = true; },
    startActiveReconciliation: () => { reconcilingActive = true; },
    setBusy: () => { busy = true; },
    makeCandidateActive: () => { activeCandidate = true; },
    markCached: () => { cached = true; },
    switchAtoBtoA: () => { viewGeneration += 2; },
    receivePeerMutation: () => { mutationEpoch += 1; },
    run: () => applyGuardedSessionPrefetch(
      () => request.promise,
      fence,
      (value) => { committed.push(value); },
    ),
  };
}

test('idle unchanged candidate accepts the fetched snapshot exactly once', async () => {
  const s = scenario();
  const run = s.run();
  s.request.resolve('SERVER');
  assert.equal(await run, true);
  assert.deepEqual(s.committed, ['SERVER']);
});

test('cleanup during GET rejects a late result and never writes cache', async () => {
  const s = scenario();
  const run = s.run();
  s.setCancelled();
  s.request.resolve('OLD');
  assert.equal(await run, false);
  assert.deepEqual(s.committed, []);
});

test('in-flight active-session reconciliation rejects a GET before running hints become known', async () => {
  const s = scenario();
  const run = s.run();
  s.startActiveReconciliation();
  s.request.resolve('PRE-TURN DISK');
  assert.equal(await run, false);
  assert.deepEqual(s.committed, []);
});

test('failed initial active-list reconciliation stays fail-closed when no remote running hints were observed', async () => {
  const s = scenario();
  s.startActiveReconciliation();
  // Simulate a rejected /chat/active request: without a successful snapshot,
  // the initial empty observer Set cannot prove an offscreen session is idle.
  await Promise.reject(new Error('GET /chat/active failed')).catch(() => {});
  const result = await s.run();
  assert.equal(result, false);
  assert.deepEqual(s.committed, []);
});

test('A→B→A view generation change rejects a same-id late prefetch', async () => {
  const s = scenario();
  const run = s.run();
  s.switchAtoBtoA();
  s.request.resolve('OLD');
  assert.equal(await run, false);
  assert.deepEqual(s.committed, []);
});

test('session becoming active during GET never receives an offscreen cache overwrite', async () => {
  const s = scenario();
  const run = s.run();
  s.makeCandidateActive();
  s.request.resolve('OLD');
  assert.equal(await run, false);
  assert.deepEqual(s.committed, []);
});

test('newer L1 snapshot created during GET wins over stale prefetch', async () => {
  const s = scenario();
  const run = s.run();
  s.markCached();
  s.request.resolve('OLD');
  assert.equal(await run, false);
  assert.deepEqual(s.committed, []);
});

test('SSE mutation noticed while no L1 row exists invalidates the inflight GET', async () => {
  const s = scenario();
  const run = s.run();
  s.receivePeerMutation(); // no cached candidate, so L1 presence alone cannot detect it
  s.request.resolve('OLD');
  assert.equal(await run, false);
  assert.deepEqual(s.committed, []);
});

test('new busy turn during GET cancels background prefetch', async () => {
  const s = scenario();
  const run = s.run();
  s.setBusy();
  s.request.resolve('OLD');
  assert.equal(await run, false);
  assert.deepEqual(s.committed, []);
});

test('invalid or absent GET is never admitted', async () => {
  const s = scenario();
  const run = s.run();
  s.request.resolve(null);
  assert.equal(await run, false);
  assert.deepEqual(s.committed, []);
});

test('an ineligible candidate does not make the HTTP request', async () => {
  const s = scenario();
  s.setCancelled();
  let requested = false;
  const result = await applyGuardedSessionPrefetch(
    () => { requested = true; return Promise.resolve('SHOULD NOT FETCH'); },
    s.fence,
    () => { assert.fail('must not write'); },
  );
  assert.equal(result, false);
  assert.equal(requested, false);
});

test('late GET cannot replace an actual newer L1 cache entry', async () => {
  await clearAllSessionCache();
  const oldGet = deferred<string | null>();
  const projectHash = 'prefetch-proj';
  const sessionId = 'prefetch-sid';
  const state = {
    generation: 2,
    mutationEpoch: 10,
    active: false,
  };
  const action = applyGuardedSessionPrefetch(
    () => oldGet.promise,
    {
      isCancelled: () => false,
      isBusy: () => false,
      isCandidateActive: () => state.active,
      hasCachedSession: () => hasMemorySession(projectHash, sessionId),
      currentViewGeneration: () => state.generation,
      currentMutationEpoch: () => state.mutationEpoch,
    },
    async (body) => { await saveSessionCache(projectHash, sessionId, [{ content: body }]); },
  );
  await saveSessionCache(projectHash, sessionId, [{ content: 'NEW' }]);
  oldGet.resolve('OLD');
  assert.equal(await action, false);
  assert.equal(getMemorySession(projectHash, sessionId)?.messages[0]?.content, 'NEW');
  await clearAllSessionCache();
});

test('observed mutation with no existing L1 entry rejects an actual prefetch save', async () => {
  await clearAllSessionCache();
  const oldGet = deferred<string | null>();
  let mutationEpoch = 2;
  const action = applyGuardedSessionPrefetch(
    () => oldGet.promise,
    {
      isCancelled: () => false,
      isBusy: () => false,
      isCandidateActive: () => false,
      hasCachedSession: () => hasMemorySession('prefetch-proj', 'uncached-sid'),
      currentViewGeneration: () => 4,
      currentMutationEpoch: () => mutationEpoch,
    },
    async (body) => { await saveSessionCache('prefetch-proj', 'uncached-sid', [{ content: body }]); },
  );
  mutationEpoch += 1;
  oldGet.resolve('OLD');
  assert.equal(await action, false);
  assert.equal(getMemorySession('prefetch-proj', 'uncached-sid'), null);
  await clearAllSessionCache();
});

test('observed remote activity marks candidate running until a matching stop event', () => {
  const running = new Set<string>();
  recordPrefetchActivity(running, { session_id: 'B', running: true });
  assert.equal(running.has('B'), true);
  assert.equal(running.has('A'), false);
  recordPrefetchActivity(running, { session_id: 'A', running: true });
  recordPrefetchActivity(running, { session_id: 'B', running: false });
  assert.equal(running.has('B'), false);
  assert.equal(running.has('A'), true);
});

test('global sync replaces stale running IDs using a fresh active-session snapshot', () => {
  const stale = new Set(['B', 'C']);
  const snapshot = ['C'];
  assert.deepEqual([...mergePrefetchActiveSnapshot(snapshot, new Map())], ['C']);
  assert.equal(stale.has('B'), true, 'the original observer state is not mutated');
});

test('initial sync bootstraps an already-running offscreen session from an empty observer Set', () => {
  const beforeSync = new Set<string>();
  // A remote session can have started before this tab first subscribed to
  // /events. Its activity(true) frame was not seen, but /chat/active knows it.
  const activeAtSync = ['B'];
  const afterSync = mergePrefetchActiveSnapshot(activeAtSync, new Map());
  assert.equal(beforeSync.has('B'), false);
  assert.equal(afterSync.has('B'), true);
});

test('activity received during a sync query must win over the older active-session snapshot', () => {
  const updates = new Map<string, boolean>([
    ['B', false], // remote turn B settled after the query started
    ['C', true],  // new turn C started after the query started
  ]);
  const snapshot = ['A', 'B'];
  const merged = mergePrefetchActiveSnapshot(snapshot, updates);
  assert.deepEqual([...merged].sort(), ['A', 'C']);
});
