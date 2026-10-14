import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  appendRejectedChatRetry,
  dispatchRejectedChatRetryAfterQueueClear,
  findConfirmedChatAdmission,
  hasUnresolvedChatAdmission,
  isUnacceptedChatRetry,
  mergeQueuedIntoDraft,
  mergeQueueAdmissionHints,
  queueAfterSessionActiveCheck,
  reconcileQueuedAdmissionSnapshot,
  releaseOwnedQueueHydration,
  queuedItemAlreadyDelivered,
  queuedPayloadHasContent,
  queuedWriteDisposition,
  preserveClearedRetryBarrier,
  rejectedRetryNeedsReconciliation,
  rejectedChatRetryId,
  retryAfterChatAdmission,
  restoreRejectedChatRetry,
  shouldHydrateServerQueuedItem,
  queuedSendStillOwnsView,
  restoreQueuedFromServer,
  serializeQueuedForServer,
  serializeSessionQueueWrite,
  stashSessionQueued,
  restoreSessionQueued,
  unresolvedChatAdmissionRequestId,
} from './queuedDraft.ts';

test('409 retry retains distinct repeated prompts, images and approval modes until submitted', () => {
  const olderUserText = (text: string) => text === 'continue';
  const first = {
    id: rejectedChatRetryId('request-a'),
    text: 'continue',
    kind: 'queue' as const,
    images: [{ media_type: 'image/png', data: 'image-a' }],
    approvalMode: 'build',
  };
  const second = {
    id: rejectedChatRetryId('request-b'),
    text: 'continue',
    kind: 'queue' as const,
    images: [{ media_type: 'image/png', data: 'image-b' }],
    approvalMode: 'plan',
  };
  const queuedOnce = appendRejectedChatRetry([], first);
  assert.equal(appendRejectedChatRetry(queuedOnce, first), queuedOnce,
    'the same rejected request may only be queued once');
  const queuedTwice = appendRejectedChatRetry(queuedOnce, second);
  assert.equal(queuedTwice.length, 2, 'distinct submissions do not dedupe by text');
  const restoredFirst = restoreRejectedChatRetry([second], first);
  assert.deepEqual(restoredFirst.map((item) => item.id), [first.id, second.id]);
  assert.strictEqual(restoreRejectedChatRetry(restoredFirst, first), restoredFirst);
  assert.deepEqual(queuedTwice.map((q) => q.images[0].data), ['image-a', 'image-b']);
  assert.deepEqual(queuedTwice.map((q) => q.approvalMode), ['build', 'plan']);
  assert.equal(queuedItemAlreadyDelivered(first, olderUserText), false);
  assert.equal(queuedItemAlreadyDelivered(second, olderUserText), false);
  assert.equal(queuedItemAlreadyDelivered({ id: 1, text: 'continue', kind: 'queue' }, olderUserText), false,
    'an ordinary unsent queue item cannot be consumed by an older identical prompt');
  assert.equal(isUnacceptedChatRetry({ ...first, kind: 'steer' }), false,
    'an explicitly steered retry is no longer an unsubmitted queue item');
  assert.equal(isUnacceptedChatRetry({ ...first, kind: 'steering' }), true,
    'a pending HTTP steer has not yet been accepted and cannot be history-deduped');
  assert.equal(queuedItemAlreadyDelivered({ ...first, kind: 'steering' }, olderUserText), false,
    'A→B→A while postChatSteer is pending must preserve the retry for a possible failure');
});

test('only an accepted steer with its echoed identity is consumed from restored queues', () => {
  const accepted = { id: 1, text: 'continue', kind: 'steer', clientInputId: 'client-a' };
  const transcriptHasIdentity = (id: string) => id === 'client-a';
  assert.equal(queuedItemAlreadyDelivered(accepted, transcriptHasIdentity), true);
  assert.equal(queuedItemAlreadyDelivered({ ...accepted, clientInputId: 'client-b' }, transcriptHasIdentity), false);
  assert.equal(queuedItemAlreadyDelivered({ ...accepted, clientInputId: undefined }, transcriptHasIdentity), false);
  assert.equal(queuedItemAlreadyDelivered({ ...accepted, kind: 'steering' }, transcriptHasIdentity), false);
  const wire = serializeQueuedForServer([{ ...accepted, kind: 'steer' as const, approvalMode: 'plan' as const }]);
  assert.equal(wire[0].client_input_id, 'client-a');
  const restored = restoreQueuedFromServer(JSON.parse(JSON.stringify(wire))[0], 'build');
  assert.equal(restored.clientInputId, 'client-a');
  assert.equal(restored.approvalMode, 'plan');
  assert.equal(queuedItemAlreadyDelivered(restored, transcriptHasIdentity), true);
});


test('409 retry identity survives existing local/server queue JSON shape', () => {
  const original = [{ id: rejectedChatRetryId('request-c'), text: 'repeat', kind: 'queue' as const }];
  const stored = JSON.parse(JSON.stringify(original));
  assert.equal(stored[0].id, original[0].id);
  assert.equal(queuedItemAlreadyDelivered(stored[0], () => true), false,
    'an old transcript cannot erase the unaccepted retry after refresh');
});

test('accepted rejected-chat retry is not sent before acknowledged server queue removal', async () => {
  let acceptClear: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => { acceptClear = resolve; });
  let sends = 0;
  let restored = 0;
  const dispatch = dispatchRejectedChatRetryAfterQueueClear(
    () => waiting, () => true, async () => { sends++; return { status: 'admitted' as const }; }, () => { restored++; },
  );
  assert.equal(sends, 0, 'admission must not race queue-clear receipt');
  acceptClear?.();
  assert.equal(await dispatch, true);
  assert.equal(sends, 1);
  assert.equal(restored, 0);

  const failed = await dispatchRejectedChatRetryAfterQueueClear(
    async () => { throw new Error('server unavailable'); },
    () => true, async () => { sends++; return { status: 'admitted' as const }; }, () => { restored++; },
  );
  assert.equal(failed, false);
  assert.equal(sends, 1, 'failed queue removal cannot produce an accepted/stale retry');
  assert.equal(restored, 1);
  const switched = await dispatchRejectedChatRetryAfterQueueClear(
    async () => {}, () => false, async () => { sends++; return { status: 'admitted' as const }; }, () => { restored++; },
  );
  assert.equal(switched, false, 'a queued retry cannot submit into another viewed session');
  assert.equal(sends, 1);
  assert.equal(restored, 2);
});

test('a queue-clear ACK alone cannot consume a rejected retry before chat admission', async () => {
  let acknowledgeAdmission: ((outcome: { status: 'admitted' | 'rejected' }) => void) | undefined;
  const admission = new Promise<{ status: 'admitted' | 'rejected' }>((resolve) => { acknowledgeAdmission = resolve; });
  let started = 0;
  let restored = 0;
  let settled = false;
  const dispatch = dispatchRejectedChatRetryAfterQueueClear(
    async () => {},
    () => true,
    async () => { started++; return admission; },
    () => { restored++; },
  );
  void dispatch.then(() => { settled = true; });
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(started, 1, 'chat submission must start after the clear receipt');
  assert.equal(settled, false, 'the retry is reserved until chat admission resolves');
  acknowledgeAdmission?.({ status: 'rejected' });
  assert.equal(await dispatch, false, 'a failed chat admission must not count as delivery');
  assert.equal(restored, 1, 'failed admission restores the exact retry once');
});

test('a thrown chat admission preserves its retry; a positive receipt consumes it once', async () => {
  let restored = 0;
  const rejected = await dispatchRejectedChatRetryAfterQueueClear(
    async () => {}, () => true,
    async () => { throw new Error('HTTP 409'); },
    () => { restored++; },
  );
  assert.equal(rejected, false);
  assert.equal(restored, 1);
  const accepted = await dispatchRejectedChatRetryAfterQueueClear(
    async () => {}, () => true,
    async () => ({ status: 'admitted' as const }),
    () => { restored++; },
  );
  assert.equal(accepted, true);
  assert.equal(restored, 1);
});

test('uncertain POST receipt is not a rejection and must retain exact admission identity', async () => {
  const outcomes: Array<{ status: string; requestId?: string }> = [];
  const result = await dispatchRejectedChatRetryAfterQueueClear(
    async () => {}, () => true,
    async () => ({ status: 'unknown' as const, requestId: 'attempt-42' }),
    (outcome) => { outcomes.push(outcome); },
  );
  assert.equal(result, false);
  assert.deepEqual(outcomes, [{ status: 'unknown', requestId: 'attempt-42' }]);

  const item = retryAfterChatAdmission(
    { id: rejectedChatRetryId('original-409'), kind: 'queue' },
    { status: 'unknown', requestId: 'attempt-42' },
  );
  assert.equal(queuedItemAlreadyDelivered(item, (id) => id === 'attempt-41'), false);
  assert.equal(queuedItemAlreadyDelivered(item, (id) => id === 'attempt-42'), true,
    'only the exact authoritative admitted user echo may consume a pending retry');
});

test('unknown admission retains the exact request in original queued payload across storage and blocks all drain', () => {
  const original = {
    id: rejectedChatRetryId('first-409'), text: 'continue', kind: 'queue' as const,
    images: [{ media_type: 'image/png', data: 'unique-image' }],
    approvalMode: 'plan' as const,
  };
  const uncertain = retryAfterChatAdmission(original, { status: 'unknown', requestId: 'attempt-42' });
  assert.equal(uncertain.id, original.id);
  assert.equal(uncertain.clientInputId, 'chat-unknown:attempt-42');
  assert.equal(unresolvedChatAdmissionRequestId(uncertain), 'attempt-42');
  assert.deepEqual(uncertain.images, original.images);
  assert.equal(uncertain.approvalMode, 'plan');
  assert.equal(rejectedRetryNeedsReconciliation(uncertain), true);
  assert.equal(hasUnresolvedChatAdmission([{
    id: 33, text: 'later', kind: 'queue' as const, approvalMode: 'build' as const,
  }, uncertain]), true, 'later queue items cannot bypass an unknown earlier admission');
  const serialized = JSON.parse(JSON.stringify(serializeQueuedForServer([uncertain])))[0];
  assert.equal(serialized.client_input_id, 'chat-unknown:attempt-42');
  const afterReload = restoreQueuedFromServer(serialized, 'build');
  assert.equal(afterReload.clientInputId, 'chat-unknown:attempt-42');
  assert.equal(rejectedRetryNeedsReconciliation(afterReload), true);
  const stale = { ...original, clientInputId: undefined };
  assert.equal(restoreRejectedChatRetry([stale], uncertain, true)[0].clientInputId, 'chat-unknown:attempt-42',
    'reconciliation identity must replace a same-ID stale in-memory item');
  assert.equal(queuedItemAlreadyDelivered(afterReload, (id) => id === 'different-request'), false);
  assert.equal(queuedItemAlreadyDelivered(afterReload, (id) => id === 'attempt-42'), true);
  const onceConfirmed = [afterReload].filter((item) => !queuedItemAlreadyDelivered(item, (id) => id === 'attempt-42'));
  assert.equal(hasUnresolvedChatAdmission(onceConfirmed), false);
  assert.strictEqual(retryAfterChatAdmission(original, { status: 'rejected' }), original,
    'a definite pre-admission rejection is safely retryable without a stale identity marker');
});

test('ambiguous callback error without a request ID fails closed rather than blindly retrying', async () => {
  const source = { id: rejectedChatRetryId('source'), kind: 'queue' as const, text: 'prompt' };
  let retained = source as typeof source & { clientInputId?: string };
  const result = await dispatchRejectedChatRetryAfterQueueClear(
    async () => {}, () => true,
    async () => { throw new Error('network died after potential admission'); },
    (outcome) => { retained = retryAfterChatAdmission(source, outcome); },
  );
  assert.equal(result, false);
  assert.equal(retained.clientInputId, `chat-unknown:unresolved:${source.id}`);
  assert.equal(unresolvedChatAdmissionRequestId(retained), null);
  assert.equal(rejectedRetryNeedsReconciliation(retained), true);
  assert.equal(queuedItemAlreadyDelivered(retained, (id) => id === 'unrelated'), false);
  assert.equal(queuedItemAlreadyDelivered(retained, (id) => id === 'attempt-after-failure'), false,
    'a real request ID cannot accidentally match the local fail-closed sentinel');
});

test('a rejected chat retry reverting from an ordinary steer is not an unknown chat admission', () => {
  const rid = rejectedChatRetryId('prior-chat-409');
  const definiteSteerFailure = { id: rid, kind: 'queue' as const, clientInputId: 'steer-attempt-17' };
  const unmergedSteerAfterTurn = { id: rid, kind: 'queue' as const, clientInputId: 'steer-attempt-18' };
  for (const item of [definiteSteerFailure, unmergedSteerAfterTurn]) {
    assert.equal(rejectedRetryNeedsReconciliation(item), false,
      'the Steer identity does not mean a /chat HTTP 202 was lost');
    assert.equal(unresolvedChatAdmissionRequestId(item), null);
    assert.equal(hasUnresolvedChatAdmission([item]), false);
    assert.equal(queuedItemAlreadyDelivered(item, (id) => id === item.clientInputId), false,
      'an ordinary queued item is not auto-consumed as an admitted /chat retry');
  }
  const afterUnknownChat = retryAfterChatAdmission(definiteSteerFailure,
    { status: 'unknown', requestId: 'chat-attempt-99' });
  assert.equal(rejectedRetryNeedsReconciliation(afterUnknownChat), true);
  assert.equal(unresolvedChatAdmissionRequestId(afterUnknownChat), 'chat-attempt-99');
  assert.equal(queuedItemAlreadyDelivered(afterUnknownChat, (id) => id === 'steer-attempt-17'), false);
  assert.equal(queuedItemAlreadyDelivered(afterUnknownChat, (id) => id === 'chat-attempt-99'), true);
});

test('an old queue GET cannot rehydrate R after unknown admission or its exact confirmation', () => {
  const id = rejectedChatRetryId('original-rejected-id');
  const oldGetSnapshot = [{ id, kind: 'queue' as const, text: 'original' }];
  const barriers = new Set<string>([id]); // strict clear was acknowledged
  const lostAck = { status: 'unknown' as const, requestId: 'admitted-request' };
  if (!preserveClearedRetryBarrier(lostAck)) barriers.delete(id);
  assert.equal(shouldHydrateServerQueuedItem(oldGetSnapshot[0], barriers), false,
    'old GET cannot overwrite unknown/admitting state');
  const retained = retryAfterChatAdmission(oldGetSnapshot[0], lostAck);
  const admitted = queuedItemAlreadyDelivered(retained, (candidate) => candidate === 'admitted-request');
  assert.equal(admitted, true);
  assert.equal(shouldHydrateServerQueuedItem(oldGetSnapshot[0], barriers), false,
    'once the exact user is admitted, an older GET still cannot resurrect the cleared ID');

  const definite409 = { status: 'rejected' as const };
  if (!preserveClearedRetryBarrier(definite409)) barriers.delete(id);
  assert.equal(shouldHydrateServerQueuedItem(oldGetSnapshot[0], barriers), true,
    'an explicitly rejected, never-admitted retry may intentionally reappear');
});

test('a same-ID server UNKNOWN upgrades stale localStorage instead of silently re-sending R', () => {
  const id = rejectedChatRetryId('original-409');
  const plain = { id, kind: 'queue' as const, text: 'repeat', approvalMode: 'plan' as const };
  const serverUnknown = retryAfterChatAdmission(plain, { status: 'unknown', requestId: 'accepted-42' });
  const another = { id: 77, kind: 'queue' as const, text: 'new prompt', approvalMode: 'build' as const };
  const merged = mergeQueueAdmissionHints([plain, another], [serverUnknown]);
  assert.deepEqual(merged.map((entry) => entry.id), [id, 77]);
  assert.equal(merged[0]?.clientInputId, 'chat-unknown:accepted-42');
  assert.equal(merged[0]?.text, plain.text);
  assert.equal(hasUnresolvedChatAdmission(merged), true);
  assert.equal(queuedItemAlreadyDelivered(merged[0]!, (attempt) => attempt === 'accepted-42'), true);
  assert.strictEqual(mergeQueueAdmissionHints(merged, [serverUnknown]), merged,
    'unchanged admission identity must not churn the queue or trigger a new POST');

  const staleServer = [plain];
  assert.strictEqual(mergeQueueAdmissionHints(merged, staleServer), merged,
    'a delayed older GET cannot downgrade a newer UNKNOWN local marker');
  const appended = mergeQueueAdmissionHints(merged, [{ ...another, id: 78 }]);
  assert.deepEqual(appended.map((item) => item.id), [id, 77, 78]);
});

test('canonical exact user consumes a same-ID stale local retry only after server UNKNOWN is merged', () => {
  const id = rejectedChatRetryId('original-409');
  const localPlain = { id, kind: 'queue' as const, text: 'same text', approvalMode: 'plan' as const };
  const serverUnknown = retryAfterChatAdmission(localPlain,
    { status: 'unknown', requestId: 'already-admitted-42' });
  const seen = (requestId: string) => requestId === 'already-admitted-42';
  const after = reconcileQueuedAdmissionSnapshot([localPlain], [serverUnknown], seen);
  assert.deepEqual(after, [], 'exact admitted user must remove the same original R, not strand it');
  const different = reconcileQueuedAdmissionSnapshot([localPlain], [serverUnknown],
    (requestId) => requestId === 'another-user');
  assert.equal(different.length, 1);
  assert.equal(different[0].clientInputId, 'chat-unknown:already-admitted-42');
  assert.equal(hasUnresolvedChatAdmission(different), true);
});

test('server queue missing a stale local rejected retry cannot silently authorize re-admission', () => {
  const old = {
    id: rejectedChatRetryId('earlier-409'),
    kind: 'queue' as const,
    text: 'original text',
    approvalMode: 'plan' as const,
    images: [{ media_type: 'image/png', data: 'original-image' }],
  };
  const other = { id: 123, kind: 'queue' as const, text: 'ordinary prompt', approvalMode: 'build' as const };
  const merged = mergeQueueAdmissionHints([old, other], [], true);
  assert.equal(merged.length, 2, 'missing server rows cannot discard locally retained content');
  assert.equal(merged[0].id, old.id);
  assert.equal(merged[0].text, old.text);
  assert.equal(merged[0].clientInputId, `chat-unknown:unresolved:${old.id}`);
  assert.equal(unresolvedChatAdmissionRequestId(merged[0]), null);
  assert.equal(hasUnresolvedChatAdmission(merged), true);
  assert.equal(merged[1], other, 'ordinary queued prompts keep their original payload');
  assert.strictEqual(mergeQueueAdmissionHints(merged, [], true), merged,
    'an already-unknown source must not churn state on repeated empty snapshots');
  const eventualServerReceipt = retryAfterChatAdmission(old,
    { status: 'unknown', requestId: 'eventually-persisted-attempt' });
  const upgraded = mergeQueueAdmissionHints(merged, [eventualServerReceipt], true);
  assert.equal(unresolvedChatAdmissionRequestId(upgraded[0]), 'eventually-persisted-attempt',
    'a real authoritative server identity upgrades an unmatchable local fail-closed sentinel');
});

test('A→B→A stale queue GET cannot clear a replacement A hydration fence', () => {
  const owners = new Map<string, number>();
  owners.set('A', 11); // first viewed A
  owners.set('B', 12);
  owners.set('A', 13); // A re-entered while GET(A, 11) is still pending
  assert.equal(releaseOwnedQueueHydration(owners, 'A', 11, true), false);
  assert.equal(owners.get('A'), 13);
  assert.equal(releaseOwnedQueueHydration(owners, 'B', 12, true), true);
  assert.equal(owners.has('B'), false);
  assert.equal(releaseOwnedQueueHydration(owners, 'A', 13, false), false,
    'a failed current queue GET must retain the admission barrier');
  assert.equal(owners.get('A'), 13);
  assert.equal(releaseOwnedQueueHydration(owners, 'A', 13, true), true);
  assert.equal(owners.has('A'), false);
});

test('queue writes are suspended until authoritative same-session queue hydration', () => {
  const pending = new Map<string, number>([['A', 13]]);
  assert.equal(queuedWriteDisposition(pending, 'A', true), 'skip',
    'restoring stale localStorage is never a server queue write');
  assert.equal(queuedWriteDisposition(pending, 'A', false), 'defer',
    'a queue mutation, Cancel, or Steer may not overwrite UNKNOWN on server while GET pending');
  assert.equal(queuedWriteDisposition(pending, 'B', false), 'write',
    'one pending session must not freeze another session queue');
  assert.equal(releaseOwnedQueueHydration(pending, 'A', 11, true), false,
    'a stale A1 success cannot release current A3');
  assert.equal(queuedWriteDisposition(pending, 'A', false), 'defer');
  assert.equal(releaseOwnedQueueHydration(pending, 'A', 13, false), false,
    'a failed GET cannot enable stale queued writes');
  assert.equal(queuedWriteDisposition(pending, 'A', false), 'defer');
  assert.equal(releaseOwnedQueueHydration(pending, 'A', 13, true), true);
  assert.equal(queuedWriteDisposition(pending, 'A', false), 'write',
    'only a successfully reconciled current GET releases the queue POST gate');
});

test('exact canonical admission lookup checks beyond a long first-paint history tail', async () => {
  const attemptId = 'attempt-42';
  const user = { role: 'user' as const, content: 'original', client_input_id: attemptId };
  const longTail = {
    offset: 100,
    messages: Array.from({ length: 48 }, () => ({ role: 'tool' as const, content: 'tool output' })),
  };
  let fullReads = 0;
  const accepted = await findConfirmedChatAdmission(attemptId,
    async () => longTail,
    async () => {
      fullReads++;
      return { offset: 0, messages: [user, ...longTail.messages] };
    },
  );
  assert.equal(accepted, true);
  assert.equal(fullReads, 1, 'one full read only for the uncommon long-turn case');

  fullReads = 0;
  assert.equal(await findConfirmedChatAdmission(attemptId,
    async () => ({ offset: 95, messages: [user] }),
    async () => { fullReads++; return longTail; },
  ), true);
  assert.equal(fullReads, 0, 'a matching tail never needs the full transcript');

  assert.equal(await findConfirmedChatAdmission(attemptId,
    async () => ({ offset: 0, messages: [{ role: 'user', content: 'same text', client_input_id: 'other' }] }),
    async () => { throw new Error('must not full-read a complete first page'); },
  ), false, 'neither text similarity nor a snapshot missing the exact identity proves admission');
});

test('definite 409 retry failure restores the original id, not another retry id', async () => {
  const retry = {
    id: rejectedChatRetryId('original-409'), text: 'same prompt', kind: 'queue',
    images: [{ media_type: 'image/png', data: 'original' }], approvalMode: 'plan',
  };
  let queue = [retry];
  const result = await dispatchRejectedChatRetryAfterQueueClear(
    async () => { queue = []; }, () => true,
    async () => ({ status: 'rejected' as const }),
    () => { queue = restoreRejectedChatRetry(queue, retry); },
  );
  assert.equal(result, false);
  assert.deepEqual(queue, [retry]);
  assert.strictEqual(restoreRejectedChatRetry(queue, retry), queue);
});

test('server queue writes stay ordered per session and clear follows a delayed enqueue', async () => {
  const tails = new Map<string, Promise<void>>();
  const timeline: string[] = [];
  let completeEnqueue: (() => void) | undefined;
  const waitEnqueue = new Promise<void>((resolve) => { completeEnqueue = resolve; });
  const first = serializeSessionQueueWrite(tails, 'A', async () => {
    timeline.push('enqueue:start');
    await waitEnqueue;
    timeline.push('enqueue:ack');
  });
  const clear = serializeSessionQueueWrite(tails, 'A', async () => { timeline.push('clear:ack'); });
  // Allow the promise-chained first writer to actually enter its async body.
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.deepEqual(timeline, ['enqueue:start']);
  completeEnqueue?.();
  await Promise.all([first, clear]);
  assert.deepEqual(timeline, ['enqueue:start', 'enqueue:ack', 'clear:ack']);
  await serializeSessionQueueWrite(tails, 'B', async () => { throw new Error('offline'); }).catch(() => {});
  await serializeSessionQueueWrite(tails, 'B', async () => { timeline.push('B:recovered'); });
  assert.equal(timeline.at(-1), 'B:recovered');
});

test('GET snapshot formed before confirmed queue-clear cannot resurrect that request ID', () => {
  const cleared = new Set([rejectedChatRetryId('request-a')]);
  assert.equal(shouldHydrateServerQueuedItem({ id: rejectedChatRetryId('request-a') }, cleared), false);
  assert.equal(shouldHydrateServerQueuedItem({ id: rejectedChatRetryId('request-b') }, cleared), true);
  cleared.delete(rejectedChatRetryId('request-a'));
  assert.equal(shouldHydrateServerQueuedItem({ id: rejectedChatRetryId('request-a') }, cleared), true,
    'a deferred retry may be explicitly restored after view switch');
});

test('Send Now cannot submit an A closure after A→B or an A generation rollover', () => {
  const original = {
    mounted: true, intendedSession: 'A', viewedSession: 'A',
    startingGeneration: 10, currentGeneration: 10,
  };
  assert.equal(queuedSendStillOwnsView(original), true);
  assert.equal(queuedSendStillOwnsView({ ...original, viewedSession: 'B' }), false);
  assert.equal(queuedSendStillOwnsView({ ...original, currentGeneration: 12 }), false);
  assert.equal(queuedSendStillOwnsView({ ...original, mounted: false }), false);
  assert.equal(queuedSendStillOwnsView({ ...original, intendedSession: null, viewedSession: null }), true,
    'an unsaved draft session with no assigned id may still send while its view is unchanged');
});

test('rejected retries preserve mode, images, and string id using existing server fields', () => {
  const original = {
    id: rejectedChatRetryId('request-d'),
    text: 'continue',
    images: [{ media_type: 'image/png', data: 'different-image' }],
    kind: 'queue' as const,
    approvalMode: 'plan' as const,
  };
  const wire = serializeQueuedForServer([original]);
  assert.equal(wire[0].id, original.id);
  assert.equal(wire[0].approval_mode, 'plan');
  assert.equal(wire[0].images?.[0].data, 'different-image');
  const fromServer = restoreQueuedFromServer(JSON.parse(JSON.stringify(wire))[0], 'build');
  assert.equal(fromServer.approvalMode, 'plan');
  assert.equal(fromServer.id, original.id);
  assert.equal(queuedItemAlreadyDelivered(fromServer, () => true), false);
  const imageOnlyWire = serializeQueuedForServer([{
    ...original,
    id: rejectedChatRetryId('request-image-only'),
    text: '',
  }]);
  const imageOnlyRestored = restoreQueuedFromServer(imageOnlyWire[0], 'build');
  assert.equal(imageOnlyRestored.text, '');
  assert.equal(imageOnlyRestored.images?.[0].data, 'different-image');
  assert.equal(queuedPayloadHasContent(imageOnlyRestored.text, imageOnlyRestored.images), true);
  assert.equal(queuedPayloadHasContent('', undefined), false);
  assert.equal(queuedItemAlreadyDelivered(imageOnlyRestored, () => true), false);
});

test('mergeQueuedIntoDraft keeps queue order ahead of the current draft', () => {
  const merged = mergeQueuedIntoDraft(
    [
      { text: 'first', images: [{ media_type: 'image/png', data: 'a' }] },
      { text: 'second', images: [{ media_type: 'image/png', data: 'b' }] },
    ],
    'draft',
    [{ media_type: 'image/jpeg', data: 'd' }],
  );
  assert.equal(merged.text, 'first\nsecond\ndraft');
  assert.deepEqual(merged.images.map((image) => image.data), ['d', 'a', 'b']);
});

test('mergeQueuedIntoDraft ignores blank queued text but keeps its images', () => {
  const merged = mergeQueuedIntoDraft(
    [{ text: '   ', images: [{ media_type: 'image/png', data: 'only' }] }],
    '',
    [],
  );
  assert.equal(merged.text, '');
  assert.equal(merged.images.length, 1);
});

test('stashSessionQueued and restoreSessionQueued isolate and restore queues across sessions', () => {
  const map = new Map<string, Array<{ text: string; kind: string }>>();

  // Session A has queued messages
  const queueA = [
    { text: 'session A message 1', kind: 'queue' },
    { text: 'session A steer message', kind: 'steer' },
  ];
  stashSessionQueued(map, 'session-A', queueA);

  // Switching to Session B: initially empty
  const restoredB = restoreSessionQueued(map, 'session-B');
  assert.deepEqual(restoredB, []);

  // Session B queues its own message
  const queueB = [{ text: 'session B follow-up', kind: 'queue' }];
  stashSessionQueued(map, 'session-B', queueB);

  // Switching back to Session A: Session A's queue and steer state are fully intact
  const restoredA = restoreSessionQueued(map, 'session-A');
  assert.equal(restoredA.length, 2);
  assert.equal(restoredA[0].text, 'session A message 1');
  assert.equal(restoredA[0].kind, 'queue');
  assert.equal(restoredA[1].text, 'session A steer message');
  assert.equal(restoredA[1].kind, 'steer');

  // Empty queue removes entry from map
  stashSessionQueued(map, 'session-A', []);
  assert.equal(map.has('session-A'), false);
  assert.deepEqual(restoreSessionQueued(map, 'session-A'), []);
});

test('loadQueuedFromStorage and saveQueuedToStorage round-trip across simulated refreshes', async () => {
  const store = new Map<string, string>();
  const mockSessionStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, String(v)),
    removeItem: (k: string) => store.delete(k),
  };
  const original = (globalThis as any).window;
  (globalThis as any).window = { sessionStorage: mockSessionStorage };

  try {
    const stash = new Map<string, Array<{ text: string; kind: string }>>();
    stash.set('session-1', [
      { text: 'queued 1', kind: 'queue' },
      { text: 'steered 1', kind: 'steer' },
    ]);
    const { saveQueuedToStorage, loadQueuedFromStorage, restoreSessionQueued } = await import('./queuedDraft.ts');
    saveQueuedToStorage(stash);

    // Simulate page refresh: memory map cleared
    const freshMemoryMap = new Map<string, Array<{ text: string; kind: string }>>();
    const loadedFromStorage = loadQueuedFromStorage();
    assert.equal(loadedFromStorage.has('session-1'), true);
    assert.equal(loadedFromStorage.get('session-1')?.length, 2);

    // restoreSessionQueued falls back to storage if fresh map was empty
    const restored = restoreSessionQueued(freshMemoryMap, 'session-1');
    assert.equal(restored.length, 2);
    assert.equal(restored[0].text, 'queued 1');
    assert.equal(restored[1].text, 'steered 1');
    assert.equal(restored[1].kind, 'steer');
  } finally {
    (globalThis as any).window = original;
  }
});


