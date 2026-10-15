import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  consumesProgrammaticStopMark,
  runningTurnStopAliases,
} from './turnStop.ts';

test('runningTurnStopAliases falls back to the session id after requestIdRef was cleared', () => {
  // 回归防线：本端回合被 /chat admit 之后 requestIdRef 已清空（null），
  // 此时仍必须能停止运行中的回合——否则「立即发送」会整体跳过停止并撞上 409 session_busy。
  assert.deepEqual(
    runningTurnStopAliases({ requestAlias: null, sessionId: 'session-1' }),
    ['session-1'],
  );
});

test('runningTurnStopAliases sends request alias first and dedupes a bound session', () => {
  assert.deepEqual(
    runningTurnStopAliases({ requestAlias: 'req-1', sessionId: 'session-1' }),
    ['req-1', 'session-1'],
  );
  assert.deepEqual(
    runningTurnStopAliases({ requestAlias: 'session-1', sessionId: 'session-1' }),
    ['session-1'],
  );
});

test('runningTurnStopAliases ignores blanks and stays empty when idle', () => {
  assert.deepEqual(runningTurnStopAliases({}), []);
  assert.deepEqual(runningTurnStopAliases({ requestAlias: '  ', sessionId: null }), []);
  assert.deepEqual(
    runningTurnStopAliases({ requestAlias: ' req-1 ', sessionId: undefined }),
    ['req-1'],
  );
});

test('consumesProgrammaticStopMark only matches the same session inside the window', () => {
  const mark = { sessionId: 'session-1', expiresAt: 1000 };
  assert.equal(consumesProgrammaticStopMark(mark, 'session-1', 999), true);
  assert.equal(consumesProgrammaticStopMark(mark, 'session-1', 1000), true);
  assert.equal(consumesProgrammaticStopMark(mark, 'session-1', 1001), false);
  assert.equal(consumesProgrammaticStopMark(mark, 'session-2', 500), false);
  assert.equal(consumesProgrammaticStopMark(mark, null, 500), false);
  assert.equal(consumesProgrammaticStopMark(null, 'session-1', 500), false);
});
