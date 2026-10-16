import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acknowledgeLiveSteers, foldQueuedSteersOnce, pendingSteersToDraft } from './liveSteer.ts';

test('folded steer applies one queue update and retains a same-text follow-up', () => {
  const first = { id: 1, text: 'repeat', clientInputId: 'folded', images: [{ media_type: 'image/png', data: 'a' }] };
  const remaining = { id: 2, text: 'repeat', clientInputId: 'another', images: [{ media_type: 'image/png', data: 'b' }] };
  let queue = [first, remaining];
  let updates = 0;
  const matched = foldQueuedSteersOnce(
    (update) => {
      updates += 1;
      queue = update(queue);
    },
    [{ text: 'repeat' }],
    ['folded'],
  );

  assert.equal(updates, 1);
  assert.deepEqual(queue, [remaining]);
  assert.deepEqual(matched, [first]);
});

test('folded steer with a foreign correlation ID does not consume same-text cards', () => {
  const owned = { id: 3, text: 'repeat', clientInputId: 'this-client' };
  let queue = [owned];
  const matched = foldQueuedSteersOnce(
    (update) => { queue = update(queue); },
    [{ text: 'repeat' }],
    ['another-client'],
  );
  assert.deepEqual(queue, [owned]);
  assert.deepEqual(matched, [undefined]);
});

test('folded steers without IDs retain legacy text matching and fold multiple inputs in order', () => {
  const first = { id: 1, text: 'one' };
  const middle = { id: 2, text: 'keep' };
  const last = { id: 3, text: 'two' };
  let queue = [first, middle, last];
  const matched = foldQueuedSteersOnce(
    (update) => { queue = update(queue); },
    [{ text: 'one' }, { text: 'two' }],
  );
  assert.deepEqual(queue, [middle]);
  assert.deepEqual(matched, [first, last]);
});

test('acknowledgeLiveSteers consumes only matching FIFO inputs', () => {
  const pending = [
    { id: 'one-id', text: 'one', confirmed: true },
    { id: 'two-id', text: 'two', images: [{ media_type: 'image/png', data: 'abc' }], confirmed: true },
  ];

  assert.deepEqual(
    acknowledgeLiveSteers(pending, [{ text: 'peer input', images: [] }]),
    pending,
  );
  assert.deepEqual(
    acknowledgeLiveSteers(
      pending,
      [{ text: 'VL-preprocessed text', images: [] }],
      ['one-id'],
    ),
    [pending[1]],
  );
  assert.deepEqual(
    acknowledgeLiveSteers(pending, [{ text: 'one', images: [] }]),
    [pending[1]],
  );
  assert.deepEqual(
    acknowledgeLiveSteers(pending, [
      { text: 'one', images: [] },
      { text: 'two', images: [{ media_type: 'image/png', data: 'abc' }] },
    ]),
    [],
  );
});

test('pendingSteersToDraft preserves text and image order', () => {
  assert.deepEqual(
    pendingSteersToDraft([
      { id: 'first-id', text: 'first', confirmed: true },
      { id: 'second-id', text: 'second', images: [{ media_type: 'image/jpeg', data: 'xyz' }], confirmed: true },
    ]),
    {
      text: 'first\nsecond',
      images: [{ media_type: 'image/jpeg', data: 'xyz' }],
    },
  );
});
