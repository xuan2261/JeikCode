import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyConfirmedHistoryDelete, applyConfirmedHistoryPatch } from './lib/historyMessages.ts';

Object.defineProperty(globalThis, 'location', {
  value: new URL('http://localhost/?token=test-token'),
  configurable: true,
});

test('history DELETE fetch receipts gate local history mutations across HTTP no-op, success and failure', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let response = new Response(JSON.stringify({ success: true, notFound: true }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return response.clone();
  }) as typeof fetch;

  try {
    const { deleteSessionMessage } = await import('./api.ts');
    let localRemovals = 0;
    const deleteHistory = () => applyConfirmedHistoryDelete(
      () => deleteSessionMessage('0123456789abcdef', 'test-session', 2, {
        delete_turn: true, expected_role: 'user', expected_text: 'same text',
      }),
      () => true,
      () => { localRemovals += 1; },
    );

    await assert.rejects(deleteHistory(), /not applied/i);
    assert.equal(localRemovals, 0, 'HTTP 200 notFound is not evidence of deletion');
    assert.equal(calls[0].init?.method, 'DELETE');
    assert.match(calls[0].url, /\/messages\/2\?/);
    assert.match(calls[0].url, /delete_turn=true/);

    response = new Response(JSON.stringify({ success: true, revision: 2, source_index: 2 }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
    assert.equal(await deleteHistory(), true);
    assert.equal(localRemovals, 1, 'only the applied receipt may update the client');

    response = new Response(JSON.stringify({ error: 'server error' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
    await assert.rejects(deleteHistory());
    assert.equal(localRemovals, 1, 'HTTP failure must not perform additional removal');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('TRUNCATE refuses definite no-op and unsuccessful receipts before caller side effects', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  let status = 200;
  let payload: unknown = { success: true, notFound: true };
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ url: String(url), init });
    return new Response(JSON.stringify(payload), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const { truncateSession } = await import('./api.ts');
    let postConfirmSideEffects = 0;
    const rollbackOrRegenerate = (inclusive = false) => truncateSession(
      '0123456789abcdef', 'test-session', {
        target_index: 4,
        expected_text: 'original prompt',
        expected_role: 'user',
        inclusive,
      },
    ).then((receipt) => { postConfirmSideEffects++; return receipt; });

    for (const rejected of [
      { success: true, notFound: true },
      { success: true, notFound: true, revision: 2, target_index: 4 },
      { success: false },
      { success: false, target_index: 4, revision: 2 },
      null,
    ]) {
      payload = rejected;
      await assert.rejects(rollbackOrRegenerate(), /not applied/i);
      assert.equal(postConfirmSideEffects, 0);
    }
    assert.match(requests[0].url, /\/truncate$/);
    assert.equal(requests[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(requests[0].init?.body)), {
      target_index: 4,
      expected_text: 'original prompt',
      expected_role: 'user',
      inclusive: false,
    });

    payload = { success: true, target_index: 4, revision: 3 };
    assert.deepEqual(await rollbackOrRegenerate(), payload);
    assert.equal(postConfirmSideEffects, 1);
    payload = { success: true, target_index: 5, revision: 4 };
    assert.deepEqual(await rollbackOrRegenerate(true), payload);
    assert.equal(postConfirmSideEffects, 2, 'inclusive=true uses the persisted keep-count boundary');

    // The current daemon may persist a re-resolved physical index before
    // reporting its actual boundary. It is unsafe to surface a retryable
    // failure after that definite applied receipt.
    payload = { success: true, target_index: 5, revision: 5 };
    assert.deepEqual(await rollbackOrRegenerate(), payload);
    assert.equal(postConfirmSideEffects, 3, 'applied shifted target keeps legacy Promise semantics');
    payload = { success: true };
    assert.deepEqual(await rollbackOrRegenerate(), payload);
    assert.equal(postConfirmSideEffects, 4, 'do not reject a potentially applied legacy success as retryable');

    status = 503;
    payload = { success: false, error: 'upstream failed' };
    await assert.rejects(rollbackOrRegenerate());
    assert.equal(postConfirmSideEffects, 4);
    globalThis.fetch = (async () => { throw new Error('connection lost'); }) as typeof fetch;
    await assert.rejects(rollbackOrRegenerate(), /connection lost/);
    assert.equal(postConfirmSideEffects, 4);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('PATCH real-fetch receipts do not authorize client cache writes on 404, HTTP failures or 200 unsuccessful', async () => {
  const previousFetch = globalThis.fetch;
  let status = 404;
  let body: unknown = { success: false, error: 'message not found' };
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify(body), {
      status, headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const { patchSessionMessage } = await import('./api.ts');
    let cacheWrites = 0;
    const acknowledgedIndices: Array<number | undefined> = [];
    const saveRewrite = () => applyConfirmedHistoryPatch(
      () => patchSessionMessage('0123456789abcdef', 'session-a', 4, {
        text: 'edited prompt', images: [], expected_text: 'original prompt', expected_role: 'user',
      }),
      () => true,
      (receipt) => {
        acknowledgedIndices.push(receipt.source_index);
        cacheWrites++;
        return true;
      },
    );
    await assert.rejects(saveRewrite(), /message not found/);
    assert.equal(cacheWrites, 0);
    assert.equal(calls[0].init?.method, 'PATCH');
    assert.match(calls[0].url, /\/messages\/4$/);
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      text: 'edited prompt', images: [], expected_text: 'original prompt', expected_role: 'user',
    });

    status = 200;
    body = { success: false };
    await assert.rejects(saveRewrite(), /not applied/i);
    assert.equal(cacheWrites, 0);

    body = { success: true, revision: 11, source_index: 4 };
    assert.equal(await saveRewrite(), true);
    assert.equal(cacheWrites, 1);

    // Native may have already PATCHed a re-resolved persisted physical row.
    // The view guard must not turn an applied response into a retryable error.
    body = { success: true, revision: 12, source_index: 5 };
    assert.equal(await saveRewrite(), true);
    assert.equal(cacheWrites, 2);
    assert.deepEqual(acknowledgedIndices, [4, 5], 'the applied source_index must reach WebUI reconciliation unchanged');

    status = 503;
    body = { error: 'server unavailable' };
    await assert.rejects(saveRewrite(), /server unavailable/);
    assert.equal(cacheWrites, 2);
    globalThis.fetch = (async () => { throw new Error('network lost'); }) as typeof fetch;
    await assert.rejects(saveRewrite(), /network lost/);
    assert.equal(cacheWrites, 2);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('postLiveMessage does not send approval_mode because live mode is global', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(
      '{"accepted":true,"disposition":"steered","generation":3,"turn_id":7}',
      { status: 200 },
    );
  }) as typeof fetch;

  try {
    const { postLiveMessage } = await import('./api.ts');

    const receipt = await postLiveMessage('hello', undefined, undefined, 'session-1', 'input-1');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/live/message');
    const body = JSON.parse(String(calls[0].init?.body));
    assert.deepEqual(body, {
      message: 'hello',
      session_id: 'session-1',
      client_input_id: 'input-1',
    });
    assert.deepEqual(receipt, { disposition: 'steered', generation: 3, turn_id: 7 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('postLiveMessage accepts the legacy accepted-only receipt without retrying', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{"accepted":true}', { status: 200 })) as typeof fetch;
  try {
    const { postLiveMessage } = await import('./api.ts');
    assert.deepEqual(await postLiveMessage('hello'), {
      disposition: 'started',
      generation: 0,
      turn_id: 0,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('postLiveProvider scopes the runtime switch to the active session', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response('{"ok":true}', { status: 200 });
  }) as typeof fetch;

  try {
    const { postLiveProvider } = await import('./api.ts');

    await postLiveProvider('provider-b', 'session-1');

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/live/provider');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      provider: 'provider-b',
      session_id: 'session-1',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live session switch returns a structured active-turn rejection', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ ok: false, active_turn: true, error: 'runtime is busy' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;

  try {
    const { postLiveSwitchSession } = await import('./api.ts');
    assert.deepEqual(await postLiveSwitchSession('session-2'), {
      ok: false,
      activeTurn: true,
      error: 'runtime is busy',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('live mode still rejects protocol-level failures', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ ok: false, error: 'runtime is busy' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;

  try {
    const { postLiveMode } = await import('./api.ts');
    await assert.rejects(
      () => postLiveMode('plan'),
      /rejected the mode switch/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('postLiveUserInput rejects an answer the runtime did not accept', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ accepted: false }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;

  try {
    const { postLiveUserInput } = await import('./api.ts');
    await assert.rejects(
      () => postLiveUserInput({
        request_id: 42,
        declined: false,
        selected: ['继续'],
        text: null,
      }),
      /did not accept/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('postLivePermission carries exact session and native request identity', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response('{"accepted":true}', { status: 200 });
  }) as typeof fetch;

  try {
    const { postLivePermission } = await import('./api.ts');
    await postLivePermission('allow', 'mcp__srv__query', 'session-1', 'runtime-1', 5, 73);

    assert.equal(calls[0].url, '/live/permission');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      decision: 'allow',
      tool_name: 'mcp__srv__query',
      session_id: 'session-1',
      runtime_instance_id: 'runtime-1',
      generation: 5,
      request_id: 73,
    });
    await assert.rejects(
      () => postLivePermission('allow', 'mcp__srv__query', null, 'runtime-1', 5, 73),
      /missing live approval identity/i,
    );
    await assert.rejects(
      () => postLivePermission('allow', 'mcp__srv__query', 'session-1'),
      /missing live approval identity/i,
    );
    await assert.rejects(
      () => postLivePermission('allow', 'mcp__srv__query', 'session-1', null, 5, 73),
      /missing live approval identity/i,
    );
    await assert.rejects(
      () => postLivePermission('allow', 'mcp__srv__query', 'session-1', 'runtime-1', undefined, 73),
      /missing live approval identity/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('postLivePermission rejects when the runtime did not consume the approval', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ accepted: false }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;

  try {
    const { postLivePermission } = await import('./api.ts');
    await assert.rejects(
      () => postLivePermission('allow', 'write_file', 'session-1', 'runtime-1', 5, 73),
      /did not accept permission/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('postChatUserInput correlates the answer by session and native request id', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response('{"accepted":true}', { status: 200 });
  }) as typeof fetch;

  try {
    const { postChatUserInput } = await import('./api.ts');
    await postChatUserInput('session-1', {
      request_id: 42,
      declined: false,
      selected: ['继续'],
      text: null,
    });

    assert.equal(calls[0].url, '/chat/user-input');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      session_id: 'session-1',
      request_id: 42,
      declined: false,
      selected: ['继续'],
      text: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('a one-question questions payload still uses the batch response protocol', async () => {
  const { isUserInputBatch } = await import('./api.ts');
  assert.equal(isUserInputBatch({
    type: 'user_input_request',
    request_id: 42,
    header: '',
    question: '',
    mode: 'single',
    options: [],
    questions: [{
      header: 'Pick',
      question: 'Red or blue?',
      mode: 'single',
      options: [{ label: 'Red' }, { label: 'Blue' }],
    }],
  }), true);
});

test('collection APIs reject server error payloads instead of returning non-arrays', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify('session metadata is missing'),
    { status: 500, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;

  try {
    const { getModels, getProjects } = await import('./api.ts');
    await assert.rejects(() => getModels(), /list models failed: 500/);
    await assert.rejects(() => getProjects(), /list projects failed: 500/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('deleteSession surfaces the daemon conflict reason', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    JSON.stringify({
      success: false,
      error: 'This session is active. Switch to or create another session, then try again.',
      code: 'SESSION_IN_USE',
      retryable: false,
    }),
    { status: 409, headers: { 'Content-Type': 'application/json' } },
  )) as typeof fetch;

  try {
    const { deleteSession, DeleteSessionError } = await import('./api.ts');
    const error = await deleteSession('0123456789abcdef', 's1').catch((cause) => cause);
    assert.ok(error instanceof DeleteSessionError);
    assert.equal(error.code, 'SESSION_IN_USE');
    assert.match(error.message, /session is active/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('streamChat rejects a clean EOF without an authoritative terminal', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response(
    'data: {"type":"text","content":"partial"}\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  )) as typeof fetch;

  try {
    const { streamChat } = await import('./api.ts');
    const events: unknown[] = [];
    await assert.rejects(
      () => streamChat({ message: 'hello' }, (event) => events.push(event)),
      /ended before an authoritative terminal/i,
    );
    assert.deepEqual(events, [{ type: 'text', content: 'partial' }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('streamChat accepts done, stopped, and error as authoritative terminals', async () => {
  const originalFetch = globalThis.fetch;
  const { streamChat } = await import('./api.ts');

  try {
    for (const terminal of [
      { type: 'done', tokens: null, tool_calls: null, session_id: 'session-1' },
      { type: 'stopped' },
      { type: 'error', message: 'provider failed' },
    ]) {
      globalThis.fetch = (async () => new Response(
        `data: ${JSON.stringify(terminal)}\n\n`,
        { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
      )) as typeof fetch;
      await streamChat({ message: 'hello' }, () => {});
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cancelDetachedChat aborts the local stream and uses the existing stop protocol', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  try {
    const { cancelDetachedChat } = await import('./api.ts');
    const controller = new AbortController();
    await cancelDetachedChat('request-1', controller);

    assert.equal(controller.signal.aborted, true);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/chat/stop');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
      session_id: 'request-1',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('watchChatSession standby-only watch skips live replay', async () => {
  const calls: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    calls.push(String(url));
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  try {
    const { watchChatSession } = await import('./api.ts');
    const controller = new AbortController();
    await watchChatSession('sess-idle', () => {}, controller.signal, {
      standbyOnly: true,
    }).catch(() => {});
    assert.equal(calls.length, 1);
    assert.ok(calls[0].includes('/chat/watch?'));
    assert.ok(calls[0].includes('session_id=sess-idle'));
    assert.ok(calls[0].includes('standby=true'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('postChatPrompt submits prompt via RPC and returns 202 prompt ack', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return new Response(
      JSON.stringify({
        status: 'admitted',
        operation_id: 'op-rpc-1',
        session_id: 'sess-rpc-1',
      }),
      {
        status: 202,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }) as typeof fetch;

  try {
    const { postChatPrompt } = await import('./api.ts');
    const ack = await postChatPrompt({
      message: 'hello single event bus',
      session_id: 'sess-rpc-1',
    });
    assert.equal(ack.status, 'admitted');
    assert.equal(ack.operation_id, 'op-rpc-1');
    assert.equal(ack.session_id, 'sess-rpc-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, '/chat');
    const headers = calls[0].init?.headers;
    const acceptHeader =
      headers instanceof Headers
        ? headers.get('Accept')
        : (headers as Record<string, string> | undefined)?.['Accept'];
    assert.equal(acceptHeader, 'application/json');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getActiveChatSessions reads the authoritative detached chat registry', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    assert.equal(String(url), '/chat/active');
    return new Response(JSON.stringify(['session-1', 'session-2']), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as typeof fetch;

  try {
    const { getActiveChatSessions } = await import('./api.ts');
    assert.deepEqual(await getActiveChatSessions(), ['session-1', 'session-2']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getHealth reads the running binary version from GET /health', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    assert.equal(String(url), '/health');
    return new Response(
      JSON.stringify({ status: 'ok', version: '7.0.13', service: 'jeikcode-daemon' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const { getHealth } = await import('./api.ts');
    const health = await getHealth();
    assert.equal(health.version, '7.0.13');
    assert.equal(health.service, 'jeikcode-daemon');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkUpdate requests /api/update/check and parses response', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    assert.equal(String(url), '/api/update/check');
    return new Response(
      JSON.stringify({
        current_version: 'v7.1.7',
        latest_version: 'v7.1.30',
        has_update: true,
        is_desktop: true,
        channel: 'stable',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const { checkUpdate } = await import('./api.ts');
    const res = await checkUpdate();
    assert.equal(res.has_update, true);
    assert.equal(res.latest_version, 'v7.1.30');
    assert.equal(res.is_desktop, true);
    assert.equal(res.channel, 'stable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('checkUpdate passes channel query parameter', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    assert.equal(String(url), '/api/update/check?channel=beta');
    return new Response(
      JSON.stringify({
        current_version: 'v7.1.49',
        latest_version: 'v7.1.50-beta.1',
        has_update: true,
        is_desktop: false,
        channel: 'beta',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const { checkUpdate } = await import('./api.ts');
    const res = await checkUpdate('beta');
    assert.equal(res.has_update, true);
    assert.equal(res.latest_version, 'v7.1.50-beta.1');
    assert.equal(res.channel, 'beta');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchUpgradeDiffs passes first_launch and force query parameters', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    assert.equal(String(url), '/api/config/upgrade-diffs?first_launch=true');
    return new Response(
      JSON.stringify({
        should_prompt: true,
        current_version: 'v7.1.30',
        diffs: [
          {
            relative_path: 'prompts/init.yaml',
            description: '提示词',
            target_path: '/home/.jeikcode/prompts/init.yaml',
            kind: 'modified',
            selected: true,
          },
        ],
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const { fetchUpgradeDiffs } = await import('./api.ts');
    const res = await fetchUpgradeDiffs(true, false);
    assert.equal(res.should_prompt, true);
    assert.equal(res.diffs.length, 1);
    assert.equal(res.diffs[0].relative_path, 'prompts/init.yaml');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('applyUpgradeDiffs posts selected_paths and returns applied_count', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    assert.equal(String(url), '/api/config/apply-diffs');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), {
      selected_paths: ['prompts/init.yaml'],
    });
    return new Response(
      JSON.stringify({ success: true, applied_count: 1 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;

  try {
    const { applyUpgradeDiffs } = await import('./api.ts');
    const res = await applyUpgradeDiffs(['prompts/init.yaml']);
    assert.equal(res.success, true);
    assert.equal(res.applied_count, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getConfig surfaces a 401 empty body as Unauthorized instead of JSON.parse crash', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('', { status: 401 })) as typeof fetch;
  try {
    const { getConfig } = await import('./api.ts');
    await assert.rejects(
      () => getConfig(),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /Unauthorized/);
        assert.doesNotMatch(err.message, /Unexpected end of JSON input/);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getConfig uses the JSON error field from a 401 body', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({ success: false, error: 'Unauthorized: missing or invalid access token' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    )) as typeof fetch;
  try {
    const { getConfig } = await import('./api.ts');
    await assert.rejects(
      () => getConfig(),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.equal(err.message, 'Unauthorized: missing or invalid access token');
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('getConfig parses a successful config payload', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    assert.equal(String(url), '/config');
    return new Response(
      JSON.stringify({
        path: '/home/.jeikcode/config.toml',
        default_provider: 'claude-opus-4-6',
        providers: [],
        accounts: [],
        language: 'zh-CN',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;
  try {
    const { getConfig } = await import('./api.ts');
    const cfg = await getConfig();
    assert.equal(cfg.default_provider, 'claude-opus-4-6');
    assert.equal(cfg.language, 'zh-CN');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
