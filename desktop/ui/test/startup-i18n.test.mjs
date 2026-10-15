import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('desktop splash shows Jeikcode, a spinner, and Starting', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<h1>Jeikcode<\/h1>/);
  assert.match(html, /<p id="status">Starting<\/p>/);
  assert.match(html, /id="spinner"/);
  assert.match(html, /@keyframes boot-spin/);
  assert.doesNotMatch(html, /正在启动|Đang khởi động|Starting…/);
  assert.doesNotMatch(html, /startup-i18n/);
});
