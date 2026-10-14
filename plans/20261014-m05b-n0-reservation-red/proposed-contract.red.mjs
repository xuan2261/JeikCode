// Intentionally failing prospective D8 acceptance tests. The .red.mjs suffix
// avoids accidental discovery by an unscoped repository-root node --test.
// Keep OUTSIDE the
// production suite until the maintainer chooses the HTTP admission contract.
// Every network call is a controlled fetch replacement. This proves only the
// actual WebUI API behavior, not a running daemon or persisted user history.
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

async function withMockResponse(response, run) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => response;
  try {
    return await run();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('RED N0-01: a bare registry-reservation 202 must not be final user admission', async () => {
  await withMockResponse(new Response(JSON.stringify({
    status: 'admitted',
    session_id: prompt.session_id,
    operation_id: 'reserved-only',
  }), { status: 202 }), async () => {
    const receipt = await postChatPrompt(prompt);
    // D8's proposed conservative contract: there is no exact user event,
    // canonical history identity, or stronger persisted-user receipt here.
    // A reservation-only response must stay provisional/UNKNOWN.
    assert.notEqual(receipt.status, 'admitted',
      'bare reservation-only HTTP 202 cannot certify canonical user acceptance');
  });
});

test('RED N0-04: invalid 202 response body must not invent final admission', async () => {
  await withMockResponse(new Response('', { status: 202 }), async () => {
    let result;
    try {
      result = { kind: 'receipt', receipt: await postChatPrompt(prompt) };
    } catch (error) {
      result = { kind: 'error', error };
    }
    // A structured error or a non-final/provisional receipt is acceptable.
    // Beta currently fabricates {status:'admitted',operation_id:''}.
    assert.notEqual(result.kind === 'receipt' ? result.receipt.status : 'error',
      'admitted',
      'invalid 202 body must not manufacture a positive admission proof');
  });
});

test('CONTROL N0: HTTP 409 is a definite rejection, not ambiguous receipt', async () => {
  await withMockResponse(
    new Response(JSON.stringify({ code: 'session_busy' }), { status: 409 }),
    async () => {
      await assert.rejects(
        () => postChatPrompt(prompt),
        (error) => error instanceof Error
          && error.status === 409 && error.code === 'session_busy',
      );
    },
  );
});
