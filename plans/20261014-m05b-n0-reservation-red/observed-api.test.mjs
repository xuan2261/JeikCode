// JC-14 / M05b N0: runnable observations against the real beta WebUI API module.
// Only global fetch is mocked. This never calls a daemon or reads the user home.
import { test } from 'node:test';
import assert from 'node:assert/strict';

Object.defineProperty(globalThis, 'location', {
  configurable: true,
  value: new URL('http://localhost/?token=isolated-diagnostic'),
});

const { postChatPrompt } = await import('../../webui/src/api.ts');
const prompt = {
  session_id: 'n0-isolated-session',
  request_id: 'n0-client-request-1',
  message: 'queued original text',
};

async function withFetch(handler, run) {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return handler(url, init);
  };
  try {
    return await run(calls);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('OBSERVED: real postChatPrompt forwards a 202 reservation labeled admitted', async () => {
  await withFetch(
    () => new Response(
      JSON.stringify({ status: 'admitted', session_id: prompt.session_id, operation_id: 'op-1' }),
      { status: 202, headers: { 'Content-Type': 'application/json' } },
    ),
    async (calls) => {
      const receipt = await postChatPrompt(prompt);
      assert.equal(receipt.status, 'admitted');
      assert.equal(receipt.operation_id, 'op-1');
      assert.equal(calls.length, 1);
      assert.equal(calls[0].url, '/chat');
      assert.equal(calls[0].init.method, 'POST');
      const headers = calls[0].init.headers;
      const accept = headers instanceof Headers ? headers.get('Accept') : headers?.Accept;
      assert.equal(accept, 'application/json');
      assert.equal(JSON.parse(calls[0].init.body).request_id, prompt.request_id);
      // No emitted user event or canonical history was observed in this test.
    },
  );
});

test('OBSERVED: malformed HTTP 202 JSON is synthesized as admitted without an operation ID', async () => {
  await withFetch(
    () => new Response('', { status: 202 }),
    async (calls) => {
      const receipt = await postChatPrompt(prompt);
      assert.deepEqual(receipt, {
        status: 'admitted', operation_id: '', session_id: prompt.session_id,
      });
      assert.equal(calls.length, 1);
    },
  );
});

test('CONTROL: a definite HTTP 409 still has typed session_busy rejection evidence', async () => {
  await withFetch(
    () => new Response(JSON.stringify({
      code: 'session_busy', error: 'This session is already running',
    }), { status: 409, headers: { 'Content-Type': 'application/json' } }),
    async () => {
      await assert.rejects(
        () => postChatPrompt(prompt),
        (error) => error instanceof Error
          && error.status === 409 && error.code === 'session_busy',
      );
    },
  );
});

test('CONTROL: a transport failure does not provide a definite negative admission receipt', async () => {
  await withFetch(
    async () => { throw new TypeError('simulated lost HTTP response'); },
    async () => {
      await assert.rejects(
        () => postChatPrompt(prompt),
        /simulated lost HTTP response/,
      );
    },
  );
});
