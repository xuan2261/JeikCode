import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldReloadUpgradedPage } from './upgradeReload.ts';

test('a newer build reloads only after health reports that version', () => {
  const base = { want: 'v7.2.4-beta.11', from: '7.2.4-beta.10' };
  assert.equal(
    shouldReloadUpgradedPage({ ...base, got: '7.2.4-beta.10', consecutiveMisses: 0 }),
    false,
  );
  assert.equal(
    shouldReloadUpgradedPage({ ...base, got: '7.2.4-beta.10', consecutiveMisses: 1 }),
    false,
  );
  assert.equal(
    shouldReloadUpgradedPage({ ...base, got: '7.2.4-beta.11', consecutiveMisses: 0 }),
    true,
  );
});

test('a same-version reinstall waits for the listen port to drop', () => {
  const base = { want: '7.2.4-beta.11', from: 'v7.2.4-beta.11', got: '7.2.4-beta.11' };
  assert.equal(shouldReloadUpgradedPage({ ...base, consecutiveMisses: 1 }), false);
  assert.equal(shouldReloadUpgradedPage({ ...base, consecutiveMisses: 2 }), true);
});
