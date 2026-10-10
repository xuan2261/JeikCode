import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createLanguageSaveQueue } from './languageSaveQueue.ts';

test('locale saves serialize, reject callers, and continue after a failure', async () => {
  const calls: string[] = [];
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let backend = 'en';
  const failure = new Error('save rejected');
  const queue = createLanguageSaveQueue(async (choice: string) => {
    calls.push(choice);
    if (calls.length === 1) {
      await held;
      throw failure;
    }
    backend = choice;
  });
  const first = queue.save('zh');
  const rejected = assert.rejects(first, (error) => error === failure);
  const second = queue.save('en');
  const last = queue.save('zh');
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(calls, ['zh']);
  release();
  await rejected;
  await second;
  await last;
  assert.deepEqual(calls, ['zh', 'en', 'zh']);
  assert.equal(backend, 'zh');
});

test('a pending or failed choice blocks stale initial config from replacing it', async () => {
  const queue = createLanguageSaveQueue(async (_choice: string) => {
    throw new Error('offline');
  });
  assert.equal(queue.hasSelection(), false);
  const save = queue.save('en');
  assert.equal(queue.hasSelection(), true);
  await assert.rejects(save, /offline/);
  assert.equal(queue.hasSelection(), true);
});

test('retrying the same locale persists it after rejection', async () => {
  let attempts = 0;
  let backend = 'zh';
  const queue = createLanguageSaveQueue(async (choice: string) => {
    if (++attempts === 1) throw new Error('offline');
    backend = choice;
  });
  await assert.rejects(queue.save('en'), /offline/);
  await queue.save('en');
  assert.equal(backend, 'en');
  assert.equal(attempts, 2);
});
