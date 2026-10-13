import test from 'node:test';
import assert from 'node:assert/strict';
import { applyConfirmedHistoryDelete, applyConfirmedHistoryPatch, isInternalHistoryUserMessage, patchUserHistoryBySourceIndex, removeAssistantHistoryBySourceIndex, sessionMessagesToMarkdownLines, stripInjectedRemindersForDisplay, stripSteerEnvelopeForDisplay } from './historyMessages.ts';
import type { SessionMessage } from '../api.ts';

test('stripInjectedRemindersForDisplay keeps only the user question', () => {
  const raw = '帮我看下端口\n\n<system-reminder>\nCurrent date: 2026-09-01 (Tue)\n</system-reminder>';
  assert.equal(stripInjectedRemindersForDisplay(raw), '帮我看下端口');
  assert.equal(stripInjectedRemindersForDisplay('plain'), 'plain');
});

test('stripSteerEnvelopeForDisplay keeps the user instruction and drops the note', () => {
  const raw = '改用 sqlite\n\n[jeikcode-steer]\nOn your next step, adjust direction.';
  assert.equal(stripSteerEnvelopeForDisplay(raw), '改用 sqlite');
  assert.equal(stripSteerEnvelopeForDisplay('plain'), 'plain');
  const xmlRaw = '<user-query>\nuse sqlite instead of json\n</user-query>\n\n[jeikcode-steer]\nYou are currently in the middle of executing a task...';
  assert.equal(stripSteerEnvelopeForDisplay(xmlRaw), 'use sqlite instead of json');
  const unclosed = '<user-query> 跨平台都只需要声音通知就可以\n\n[jeikcode-steer]\nnotes';
  assert.equal(stripSteerEnvelopeForDisplay(unclosed), '跨平台都只需要声音通知就可以');
  const imageOnlyRaw = '<user-query>\n(The user attached image(s))\n</user-query>\n\n[jeikcode-steer]\n...';
  assert.equal(stripSteerEnvelopeForDisplay(imageOnlyRaw), '');
});

test('isInternalHistoryUserMessage hides synthetic and legacy internal users', () => {
  assert.equal(isInternalHistoryUserMessage('real prompt'), false);
  assert.equal(isInternalHistoryUserMessage('real prompt', true), true);
  assert.equal(
    isInternalHistoryUserMessage('You made code edits but have not verified them. Run cargo check.'),
    true,
  );
  assert.equal(
    isInternalHistoryUserMessage('Output limit hit when running pytest; how do I debug it?'),
    false,
  );
});

test('sessionMessagesToMarkdownLines skips internal user messages', () => {
  const messages: SessionMessage[] = [
    { role: 'user', content: 'real prompt' },
    { role: 'user', content: 'You made code edits but have not verified them.', synthetic: true },
    { role: 'user', content: '[Auto-read from error: src/main.rs]\nfn main() {}' },
    { role: 'assistant', content: 'reply' },
  ];

  const markdown = sessionMessagesToMarkdownLines(messages, 'Session').join('\n');

  assert.match(markdown, /## User\n\nreal prompt/);
  assert.match(markdown, /## Assistant\n\nreply/);
  assert.doesNotMatch(markdown, /not verified/);
  assert.doesNotMatch(markdown, /Auto-read/);
});

test('sessionMessagesToMarkdownLines skips verify cadence assistant messages', () => {
  const messages: SessionMessage[] = [
    { role: 'user', content: 'create f.txt' },
    { role: 'assistant', content: 'No verification is needed.', internal_origin: 'verify_cadence' },
    { role: 'assistant', content: 'I am JeikCode.' },
  ];

  const markdown = sessionMessagesToMarkdownLines(messages, 'Session').join('\n');

  assert.doesNotMatch(markdown, /No verification is needed/);
  assert.match(markdown, /I am JeikCode/);
});

test('sessionMessagesToMarkdownLines skips camel case verify cadence assistant messages', () => {
  const messages: SessionMessage[] = [
    { role: 'assistant', content: 'No verification is needed.', internalOrigin: 'verify_cadence' },
    { role: 'assistant', content: 'I am JeikCode.' },
  ];

  const markdown = sessionMessagesToMarkdownLines(messages, 'Session').join('\n');

  assert.doesNotMatch(markdown, /No verification is needed/);
  assert.match(markdown, /I am JeikCode/);
});

test('sessionMessagesToMarkdownLines keeps verify cadence assistants with tool calls', () => {
  const messages: SessionMessage[] = [
    {
      role: 'assistant',
      content: 'Running verification',
      internal_origin: 'verify_cadence',
      tool_calls: [{ id: 'b1', name: 'bash', arguments: '{"command":"true"}' }],
    },
  ];

  const markdown = sessionMessagesToMarkdownLines(messages, 'Session').join('\n');

  assert.match(markdown, /Running verification/);
  assert.match(markdown, /### Tool: bash/);
});

test('confirmed history delete applies local state only after a true remote acknowledgement', async () => {
  const trace: string[] = [];
  const applied = await applyConfirmedHistoryDelete(
    async () => {
      trace.push('remote');
      return { success: true, revision: 7, source_index: 2 };
    },
    () => true,
    () => trace.push('local'),
  );
  assert.equal(applied, true);
  assert.deepEqual(trace, ['remote', 'local']);
});

test('history delete HTTP 200 notFound or success false cannot change the local transcript', async () => {
  for (const receipt of [
    { success: true, notFound: true },
    { success: false, notFound: false },
    { success: false },
  ]) {
    let localChanges = 0;
    await assert.rejects(
      applyConfirmedHistoryDelete(
        async () => receipt,
        () => true,
        () => { localChanges += 1; },
      ),
      /not applied/i,
    );
    assert.equal(localChanges, 0);
  }
});

test('network error never deletes locally, even when the view is still current', async () => {
  let localChanges = 0;
  await assert.rejects(
    applyConfirmedHistoryDelete(
      async () => { throw new Error('network disconnected'); },
      () => true,
      () => { localChanges += 1; },
    ),
    /network disconnected/,
  );
  assert.equal(localChanges, 0);
});

test('a stale confirmation cannot delete or mutate the new session view', async () => {
  let current = true;
  let requests = 0;
  let localChanges = 0;
  const deleteRemote = async () => {
    requests += 1;
    current = false; // The user switched sessions while the DELETE was in flight.
    return { success: true, revision: 9 };
  };
  const first = await applyConfirmedHistoryDelete(
    deleteRemote,
    () => current,
    () => { localChanges += 1; },
  );
  assert.equal(first, false);
  assert.equal(requests, 1);
  assert.equal(localChanges, 0);

  const second = await applyConfirmedHistoryDelete(
    deleteRemote,
    () => current,
    () => { localChanges += 1; },
  );
  assert.equal(second, false);
  assert.equal(requests, 1, 'confirmation after session switch must not initiate a new DELETE');
  assert.equal(localChanges, 0);
});

test('returning to the same session id after A→B→A still rejects its earlier delete result', async () => {
  let activeSession = 'A';
  let generation = 1;
  const originalGeneration = generation;
  const isOriginalView = () => activeSession === 'A' && generation === originalGeneration;
  let applied = 0;

  const result = await applyConfirmedHistoryDelete(
    async () => {
      activeSession = 'B';
      generation += 1;
      activeSession = 'A';
      generation += 1;
      return { success: true, revision: 12 };
    },
    isOriginalView,
    () => { applied += 1; },
  );
  assert.equal(result, false);
  assert.equal(applied, 0);
});

test('SSE-first assistant deletion followed by HTTP ACK cannot remove the next row', async () => {
  const first = { role: 'assistant', sourceIndex: 3, text: 'deleted assistant' };
  const next = { role: 'assistant', sourceIndex: 5, text: 'keep next assistant' };
  let visible = [first, next];
  let localWrites = 0;
  const sourceIndex = first.sourceIndex;

  await applyConfirmedHistoryDelete(
    async () => {
      // The daemon broadcasts the successful mutation before HTTP resolves.
      visible = removeAssistantHistoryBySourceIndex(visible, sourceIndex, first) ?? visible;
      return { success: true, revision: 13, source_index: sourceIndex };
    },
    () => true,
    () => {
      const updated = removeAssistantHistoryBySourceIndex(visible, sourceIndex, first);
      if (!updated) return; // No second local/IDB commit after SSE already won.
      visible = updated;
      localWrites += 1;
    },
  );
  assert.deepEqual(visible, [next]);
  assert.equal(localWrites, 0);
});

test('assistant deletion by source identity refuses missing, duplicate and wrong-role rows', () => {
  const rows = [
    { role: 'user', sourceIndex: 3, id: 'u3', text: 'keep user' },
    { role: 'assistant', sourceIndex: 5, id: 'a5', text: 'target' },
    { role: 'assistant', sourceIndex: 7, id: 'a7', text: 'keep other' },
  ];
  assert.deepEqual(removeAssistantHistoryBySourceIndex(rows, 5, rows[1]), [rows[0], rows[2]]);
  assert.equal(removeAssistantHistoryBySourceIndex(rows, undefined, rows[1]), null);
  assert.equal(removeAssistantHistoryBySourceIndex(rows, 3, rows[0]), null);
  assert.equal(removeAssistantHistoryBySourceIndex(rows, 999, rows[1]), null);
  assert.equal(removeAssistantHistoryBySourceIndex(rows, 5, undefined), null);
  assert.equal(removeAssistantHistoryBySourceIndex([...rows, { role: 'assistant', sourceIndex: 5, id: 'other', text: 'duplicate' }], 5, rows[1]), null);
  assert.equal(removeAssistantHistoryBySourceIndex([
    { role: 'assistant', sourceIndex: 5, id: 'a6', text: 'new message occupying same index' },
  ], 5, rows[1]), null);

  const legacy = { role: 'assistant', sourceIndex: 8, text: 'legacy response without id' };
  assert.deepEqual(removeAssistantHistoryBySourceIndex([legacy], 8, legacy), []);
  assert.equal(removeAssistantHistoryBySourceIndex([{ ...legacy }], 8, legacy), null);
});

test('PATCH ACK applies a synchronous source-scoped canvas/cache snapshot', async () => {
  const target = { role: 'user', id: 'user-4', sourceIndex: 4, text: 'original' };
  const nextTurn = { role: 'user', id: 'user-7', sourceIndex: 7, text: 'leave alone' };
  let messages = [target, nextTurn];
  let cached = messages;
  let saves = 0;
  const events: string[] = [];
  const patched = await applyConfirmedHistoryPatch(
    async () => { events.push('remote'); return { success: true, revision: 8, source_index: 4 }; },
    () => true,
    () => {
      const next = patchUserHistoryBySourceIndex(messages, 4, target, (row) => ({ ...row, text: 'edited' }));
      if (!next) return false;
      messages = next;
      cached = next;
      saves++;
      events.push('cache');
      return true;
    },
  );
  assert.equal(patched, true);
  assert.deepEqual(events, ['remote', 'cache']);
  assert.equal(saves, 1);
  assert.equal(messages[0].text, 'edited');
  assert.equal(messages[1], nextTurn);
  assert.equal(cached, messages, 'one snapshot drives canvas and cache without async state-updater timing');
});

test('PATCH shifted applied receipt cannot paint another row or report a retryable HTTP failure', async () => {
  const requested = { role: 'user', id: 'u4', sourceIndex: 4, text: 'should stay' };
  // SSE may already have updated the actual row before HTTP ACK is observed.
  const actuallyPatched = { role: 'user', id: 'u5', sourceIndex: 5, text: 'updated by SSE' };
  let canvas = [requested, actuallyPatched];
  let cached = canvas;
  let writes = 0;
  const result = await applyConfirmedHistoryPatch(
    async () => ({ success: true, source_index: 5, revision: 7 }),
    () => true,
    (receipt) => {
      if (receipt.source_index !== 4) return false; // Already persisted elsewhere; not retryable.
      const next = patchUserHistoryBySourceIndex(canvas, 4, requested, (m) => ({ ...m, text: 'edited' }));
      if (next) { canvas = next; cached = next; writes++; }
      return next !== null;
    },
  );
  assert.equal(result, false, 'a real server mutation is not a successful local rewrite of the requested row');
  assert.equal(writes, 0);
  assert.equal(canvas[0], requested, 'do not paint the untouched originally requested row');
  assert.equal(canvas[1], actuallyPatched, 'do not overwrite the SSE-reconciled actual row');
  assert.equal(cached, canvas);
});

test('PATCH applied shifted receipt does not become retryable when its actual row is hidden or ambiguous', async () => {
  const requested = { role: 'user', id: 'u4', sourceIndex: 4, text: 'original' };
  let writes = 0;
  assert.equal(await applyConfirmedHistoryPatch(
    async () => ({ success: true, revision: 9, source_index: 5 }),
    () => true,
    (receipt) => {
      const next = patchUserHistoryBySourceIndex([requested], receipt.source_index ?? 4, requested, (m) => ({ ...m, text: 'edited' }));
      if (next) writes++;
      return next !== null;
    },
  ), false);
  assert.equal(writes, 0);
});

test('PATCH missing/not-applied receipt and network error cannot write local history', async () => {
  for (const receipt of [{ success: false }, { success: true, notFound: true }, null]) {
    let localWrites = 0;
    await assert.rejects(applyConfirmedHistoryPatch(
      async () => receipt as { success: boolean },
      () => true,
      () => { localWrites++; return true; },
    ), /not applied/i);
    assert.equal(localWrites, 0);
  }
  let localWrites = 0;
  await assert.rejects(applyConfirmedHistoryPatch(
    async () => { throw new Error('offline'); },
    () => true,
    () => { localWrites++; return true; },
  ), /offline/);
  assert.equal(localWrites, 0);
});

test('PATCH stale confirm before POST and A→B→A after ACK cannot mutate another view', async () => {
  let sid = 'A';
  let generation = 10;
  const captured = generation;
  let requested = 0;
  let applied = 0;
  assert.equal(await applyConfirmedHistoryPatch(
    async () => { requested++; return { success: true }; },
    () => sid === 'A' && generation === captured + 1,
    () => { applied++; return true; },
  ), false);
  assert.equal(requested, 0);

  assert.equal(await applyConfirmedHistoryPatch(
    async () => {
      requested++;
      sid = 'B';
      generation++;
      sid = 'A';
      generation++;
      return { success: true };
    },
    () => sid === 'A' && generation === captured,
    () => { applied++; return true; },
  ), false);
  assert.equal(requested, 1);
  assert.equal(applied, 0);
});

test('PATCH source resolver refuses stale, duplicate, wrong-role, reused-ID and replaced legacy row', () => {
  const target = { role: 'user', sourceIndex: 4, id: 'u4', text: 'before' };
  const assistant = { role: 'assistant', sourceIndex: 5, id: 'a5', text: 'answer' };
  assert.deepEqual(
    patchUserHistoryBySourceIndex([target, assistant], 4, target, (row) => ({ ...row, text: 'after' })),
    [{ ...target, text: 'after' }, assistant],
  );
  assert.equal(patchUserHistoryBySourceIndex([target], 99, target, (row) => row), null);
  assert.equal(patchUserHistoryBySourceIndex([assistant], 5, assistant, (row) => row), null);
  assert.equal(patchUserHistoryBySourceIndex([target, { ...target, id: 'other' }], 4, target, (row) => row), null);
  assert.equal(patchUserHistoryBySourceIndex([{ ...target, id: 'reused' }], 4, target, (row) => row), null);
  assert.equal(patchUserHistoryBySourceIndex([{ ...target, text: 'newer SSE' }], 4, target, (row) => row), null);
  const legacy = { role: 'user', sourceIndex: 6, text: 'legacy' };
  assert.deepEqual(patchUserHistoryBySourceIndex([legacy], 6, legacy, (row) => ({ ...row, text: 'changed' })), [{ ...legacy, text: 'changed' }]);
  assert.equal(patchUserHistoryBySourceIndex([{ ...legacy }], 6, legacy, (row) => row), null);
});
