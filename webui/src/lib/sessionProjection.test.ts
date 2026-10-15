import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  bindUserMessageIdentity,
  catchUpSession,
  ensureWorkingAssistant,
  foldLiveTodo,
  hydrateSession,
  identifiedAssistantIndex,
  paintAssistantReasoning,
  paintAssistantText,
  paintCachedAssistantDelta,
  paintUserMessage,
  withAssistantIdentity,
} from './sessionProjection.ts';

const plan = [
  { content: '写测试', status: 'completed' as const },
  { content: '修前端', status: 'in_progress' as const },
  { content: '发版', status: 'pending' as const },
  { content: '回归', status: 'pending' as const },
];

test('watch paints a new user with a Working placeholder, and repeats only after a settled answer', () => {
  const fresh = paintUserMessage([], '你好', 1, () => ({
    role: 'user',
    parts: [{ kind: 'text' as const, text: '你好' }],
  }));
  assert.equal(fresh.length, 2);
  assert.equal(fresh[1]?.role, 'assistant');
  assert.equal(fresh[1]?.parts.length, 0);

  const settled = [
    { role: 'user', parts: [{ kind: 'text' as const, text: 'OK啊 挺好的' }], ts: 1 },
    { role: 'assistant', parts: [{ kind: 'text' as const, text: '收到' }] },
  ];
  const replay = paintUserMessage(settled, 'OK啊 挺好的', 2, () => {
    throw new Error('replay of the open turn must not append');
  });
  assert.equal(replay, settled);

  const again = paintUserMessage(settled, 'OK啊 挺好的', 3, () => ({
    role: 'user',
    parts: [{ kind: 'text' as const, text: 'OK啊 挺好的' }],
    ts: 3,
  }), { repeatAfterSettled: true });
  assert.equal(again.filter((message) => message.role === 'user').length, 2);
  assert.equal(again[again.length - 1]?.role, 'assistant');
  assert.equal(again[again.length - 1]?.parts.length, 0);

  const open = [
    { role: 'user', parts: [{ kind: 'text' as const, text: 'OK啊 挺好的' }] },
    { role: 'assistant', parts: [] },
  ];
  const echo = paintUserMessage(open, 'OK啊 挺好的', 4, () => {
    throw new Error('echo of the open turn must not append');
  }, { repeatAfterSettled: true });
  assert.equal(echo.filter((message) => message.role === 'user').length, 1);
});

test('an open user turn gets one Working placeholder and keeps it', () => {
  const open = [
    { role: 'user', parts: [{ kind: 'text' as const, text: 'OK啊 挺好的' }] },
  ];
  const withPlaceholder = ensureWorkingAssistant(open);
  assert.equal(withPlaceholder.length, 2);
  assert.equal(withPlaceholder[1]?.role, 'assistant');
  assert.equal(withPlaceholder[1]?.parts.length, 0);
  assert.equal(ensureWorkingAssistant(withPlaceholder), withPlaceholder);
});

test('cold start paints the server checklist and ignores a replayed user and text', () => {
  const disk = [
    { role: 'user', parts: [{ kind: 'text' as const, text: '改用 sqlite' }] },
    {
      role: 'assistant',
      parts: [
        { kind: 'text' as const, text: '上一轮正文' },
        { kind: 'tool' as const, tool: { id: 't1', name: 'todowrite', args: '{}', status: 'done' as const } },
      ],
    },
  ];
  const surface = hydrateSession(disk, plan);
  assert.equal(surface.todos?.length, 4);
  assert.deepEqual(surface.appliedTodoIds, ['t1']);

  const afterUser = paintUserMessage(surface.messages, '改用 sqlite', 1, () => {
    throw new Error('user echo must not append');
  });
  assert.equal(afterUser.filter((message) => message.role === 'user').length, 1);
  assert.equal(afterUser[afterUser.length - 1]?.role, 'assistant');

  const afterText = paintAssistantText(afterUser, '上一轮正文', true);
  assert.equal(afterText, afterUser);
});

test('running disk catch-up keeps the steer tail and does not repaint an unchanged canvas', () => {
  const previous = { role: 'user', parts: [{ kind: 'text' as const, text: '上一问' }] };
  const done = {
    role: 'assistant',
    parts: [{ kind: 'text' as const, text: '上一轮正文' }],
  };
  const steer = { role: 'user', parts: [{ kind: 'text' as const, text: '继续' }] };
  const live = { role: 'assistant', parts: [{ kind: 'text' as const, text: '正在改' }] };
  const canvas = [previous, done, steer, live];
  const same = catchUpSession({
    messages: canvas,
    disk: [previous, done],
    running: true,
    adoptSettledDisk: false,
    serverTodos: plan,
  });
  assert.equal(same.messages, canvas);
  assert.equal(same.todos, undefined);

  const partial = { role: 'assistant', parts: [{ kind: 'tool' as const, tool: { id: 'b', name: 'bash', args: '', status: 'done' as const } }] };
  const behind = catchUpSession({
    messages: [previous, partial, steer, live],
    disk: [previous, done],
    running: true,
    adoptSettledDisk: false,
    serverTodos: plan,
  });
  assert.equal(behind.messages[1]?.parts.some((part) => part.kind === 'text' && part.text === '上一轮正文'), true);
  assert.equal(behind.messages[1]?.parts.some((part) => part.kind === 'tool' && part.tool?.id === 'b'), true);
  assert.equal(behind.messages[2], steer);
  assert.equal(behind.messages[3], live);
});

test('truncated disk thinking is extended in place instead of replayed as a second block', () => {
  const mark = '\n… [truncated for display]';
  const body = '先看目录';
  const full = `${body}，再读 read.rs，然后说明原因`;
  const messages = [{
    role: 'assistant',
    parts: [
      { kind: 'reasoning' as const, text: body + mark },
      { kind: 'text' as const, text: '正文开头' + mark },
      { kind: 'tool' as const, tool: { id: 'b', name: 'bash', args: '', status: 'done' as const } },
    ],
  }];
  const withThinking = paintAssistantReasoning(messages, full, true);
  assert.equal(withThinking[0]?.parts.filter((part) => part.kind === 'reasoning').length, 1);
  assert.equal(withThinking[0]?.parts[0]?.text, full);
  assert.equal(withThinking[0]?.parts[2]?.kind, 'tool');

  const withText = paintAssistantText(withThinking, '正文开头，以及后面的结论', true);
  assert.equal(withText[0]?.parts.filter((part) => part.kind === 'text').length, 1);
  assert.equal(withText[0]?.parts[1]?.text, '正文开头，以及后面的结论');
  assert.equal(withText[0]?.parts[2]?.kind, 'tool');
});

test('an incremental todo event keeps the hydrated plan', () => {
  const applied = new Set<string>(['t1']);
  const next = foldLiveTodo({
    state: null,
    remembered: plan,
    name: 'todowrite',
    args: JSON.stringify({ actions: [{ action: 'update', id: 2, status: 'completed' }] }),
    callId: 't2',
    appliedIds: applied,
  });
  assert.equal(next?.length, 4);
  assert.equal(next?.[1]?.status, 'completed');
});

test('paintAssistantReasoning dedupes replayed thinking blocks completely', () => {
  const messages = [{
    role: 'assistant',
    parts: [
      { kind: 'reasoning' as const, text: '这是第一段深度思考过程' },
      { kind: 'tool' as const, tool: { id: 'call_1', name: 'read', status: 'done' as const } },
      { kind: 'reasoning' as const, text: '这是第二段思考过程' },
    ],
  }];

  // 1. 重放完全相同的思考块，绝对不应增加新的 reasoning part
  const replayed1 = paintAssistantReasoning(messages, '这是第一段深度思考过程', true);
  assert.equal(replayed1[0]?.parts.filter((p) => p.kind === 'reasoning').length, 2);

  const replayed2 = paintAssistantReasoning(messages, '这是第二段思考过程', true);
  assert.equal(replayed2[0]?.parts.filter((p) => p.kind === 'reasoning').length, 2);

  // 2. 重放已有思考块的子集/前缀，也绝不应增加新的 reasoning part
  const replayedSub = paintAssistantReasoning(messages, '这是第二段思考', true);
  assert.equal(replayedSub[0]?.parts.filter((p) => p.kind === 'reasoning').length, 2);
});

test('paintUserMessage skips replayed original user prompt when turn has a steer', () => {
  const originalUser = {
    role: 'user',
    parts: [{ kind: 'text' as const, text: '修复 webui ipv6 缺失' }],
    ts: 1000,
  };
  const assistantTool = {
    role: 'assistant',
    parts: [{ kind: 'tool' as const, tool: { id: 'call_1', name: 'read', status: 'done' as const } }],
  };
  const steerUser = {
    role: 'user',
    parts: [{ kind: 'text' as const, text: '不要动 api_config.rs' }],
    ts: 2000,
  };
  const assistantPending = {
    role: 'assistant',
    parts: [],
  };
  const messages = [originalUser, assistantTool, steerUser, assistantPending];

  // 收到原始提问的 replay 事件时，因原始提问已在画布上，绝不能追加在 steerUser 下方
  const updated = paintUserMessage(
    messages,
    '修复 webui ipv6 缺失',
    1000,
    () => ({ role: 'user', parts: [{ kind: 'text', text: '修复 webui ipv6 缺失' }], ts: 1000 }),
  );
  assert.equal(updated.filter((m) => m.role === 'user').length, 2);
  assert.equal(updated[0], originalUser);
  assert.equal(updated[2], steerUser);
});

test('paintUserMessage never duplicates original user prompt even with mismatched ts and settled tool step after steer', () => {
  const originalUser = {
    role: 'user',
    parts: [{ kind: 'text' as const, text: '你好 请你对比一下各项目设计' }],
    ts: 1791403200000,
  };
  const step1 = {
    role: 'assistant',
    parts: [
      { kind: 'reasoning' as const, text: '深度思考中' },
      { kind: 'tool' as const, tool: { id: 'call_1', name: 'read', status: 'done' as const } },
      { kind: 'text' as const, text: '兄弟目录已确认' },
    ],
  };
  const steerUser = {
    role: 'user',
    parts: [{ kind: 'text' as const, text: 'OK啊' }],
    ts: 1791403260000,
  };
  const step2 = {
    role: 'assistant',
    parts: [
      { kind: 'reasoning' as const, text: '继续执行' },
      { kind: 'tool' as const, tool: { id: 'call_2', name: 'todowrite', status: 'done' as const } },
      { kind: 'tool' as const, tool: { id: 'call_3', name: 'glob', status: 'done' as const } },
    ],
  };
  const messages = [originalUser, step1, steerUser, step2];

  // 此时时间戳偏差达到 2 分钟，且 step2 里的工具都已经 done
  const result = paintUserMessage(
    messages,
    '你好 请你对比一下各项目设计',
    1791403320000, // 2分钟后的新时间戳
    () => {
      throw new Error('must not re-append original prompt below steer!');
    },
  );
  assert.equal(result.filter((m) => m.role === 'user').length, 2);
  assert.equal(result[0]?.parts[0]?.text, '你好 请你对比一下各项目设计');
  assert.equal(result[2]?.parts[0]?.text, 'OK啊');
});

test('paintUserMessage never duplicates original prompt on detached watch / live replay when no steer occurred and tools are done', () => {
  const originalUser = {
    role: 'user',
    parts: [{ kind: 'text' as const, text: '请你扫描我的setup命令 setup命令是啥？' }],
    ts: 1791423600000,
  };
  const assistant = {
    role: 'assistant',
    parts: [
      { kind: 'tool' as const, tool: { id: 'call_1', name: 'grep', status: 'done' as const } },
      { kind: 'tool' as const, tool: { id: 'call_2', name: 'grep', status: 'done' as const } },
    ],
  };
  const messages = [originalUser, assistant];

  // Replay of original prompt with slightly different timestamp or trailing newline
  const result = paintUserMessage(
    messages,
    '请你扫描我的setup命令 setup命令是啥？\n',
    1791423780000,
    () => {
      throw new Error('must not re-append prompt on detached replay!');
    },
  );
  assert.equal(result.filter((m) => m.role === 'user').length, 1);
  assert.equal(result[0]?.parts[0]?.text, '请你扫描我的setup命令 setup命令是啥？');
});

test('paintAssistantText streams text normally even if phrases occurred in prior assistant turns', () => {
  const user1 = { role: 'user', parts: [{ kind: 'text' as const, text: '你好' }] };
  const assistant1 = {
    role: 'assistant',
    parts: [{ kind: 'text' as const, text: '好的，请问有什么可以帮助您的？' }],
  };
  const user2 = { role: 'user', parts: [{ kind: 'text' as const, text: '帮我查一下当前项目' }] };
  const assistant2 = {
    role: 'assistant',
    parts: [],
  };
  const messages = [user1, assistant1, user2, assistant2];

  // Streaming text in turn 2 starts with "好的" which was present in assistant1
  const streamed = paintAssistantText(messages, '好的', false);
  assert.equal(streamed[3]?.parts.length, 1);
  assert.equal(streamed[3]?.parts[0]?.kind, 'text');
  assert.equal(streamed[3]?.parts[0]?.text, '好的');
});

test('paintAssistantText merges into existing text part without slicing around non-text parts', () => {
  const messages = [{
    role: 'assistant',
    parts: [
      { kind: 'reasoning' as const, text: '思考中...' },
      { kind: 'text' as const, text: '三、总结\n这次修复彻底解决了' },
    ],
  }];
  const next = paintAssistantText(messages, '以下两个关键问题：\n1. 终端环境异常', false);
  assert.equal(next[0]?.parts.length, 2);
  assert.equal(next[0]?.parts[0]?.kind, 'reasoning');
  assert.equal(next[0]?.parts[1]?.kind, 'text');
  assert.equal(next[0]?.parts[1]?.text, '三、总结\n这次修复彻底解决了以下两个关键问题：\n1. 终端环境异常');
});

test('paintUserMessage never duplicates multiline user prompt with Windows CRLF vs LF', () => {
  const multilineCRLF = '第一段：不要这个\r\n\r\n第二段：免建清单去掉\r\n- 条目1\r\n- 条目2';
  const multilineLF = '第一段：不要这个\n\n第二段：免建清单去掉\n- 条目1\n- 条目2';

  // Canvas has CRLF from Windows input
  const initial = [
    { role: 'user', parts: [{ kind: 'text' as const, text: multilineCRLF }], ts: 1000 },
    { role: 'assistant', parts: [] },
  ];

  // Incoming SSE echo has normalized LF from daemon
  const result = paintUserMessage(
    initial,
    multilineLF,
    2000,
    () => {
      throw new Error('Should not append duplicate user message');
    },
    { repeatAfterSettled: true },
  );

  assert.equal(result.filter((m) => m.role === 'user').length, 1);
});

test('paintUserMessage never duplicates user prompt while assistant is still reasoning or running tools without text answer', () => {
  const userText = '请帮我实现一个新功能';
  // Assistant is currently reasoning or running tools (turn in flight, no settled text answer)
  const inFlightMessages = [
    { role: 'user', parts: [{ kind: 'text' as const, text: userText }], ts: 1000 },
    {
      role: 'assistant',
      parts: [
        { kind: 'reasoning' as const, text: 'Thinking about the architecture...' },
        { kind: 'tool' as const, tool: { id: 'call_1', name: 'read_file', status: 'pending' as const } },
      ],
    },
  ];

  const result = paintUserMessage(
    inFlightMessages,
    userText,
    1500,
    () => {
      throw new Error('Should not append duplicate user prompt during in-flight reasoning/tools');
    },
    { repeatAfterSettled: true },
  );

  assert.equal(result.filter((m) => m.role === 'user').length, 1);
});

test('paintUserMessage accurately appends a mid-turn steer when agent is in-flight on tools/thinking without final answer', () => {
  const originalUser = { role: 'user', parts: [{ kind: 'text' as const, text: '帮我重构网络层' }], ts: 1000 };
  const inFlightAssistant = {
    role: 'assistant',
    parts: [
      { kind: 'reasoning' as const, text: '检查现存网络模块...' },
      { kind: 'tool' as const, tool: { id: 'c1', name: 'read_file', status: 'done' as const } },
    ],
  };
  const canvas = [originalUser, inFlightAssistant];

  // User sends a steer: "改用 reqwest，不要用 hyper"
  const steerText = '改用 reqwest，不要用 hyper';
  const withSteer = paintUserMessage(
    canvas,
    steerText,
    1500,
    () => ({
      role: 'user',
      parts: [{ kind: 'text' as const, text: steerText }],
      ts: 1500,
    }),
    { repeatAfterSettled: true },
  );

  // Steer must be cleanly appended after inFlightAssistant
  assert.equal(withSteer.filter((m) => m.role === 'user').length, 2);
  assert.equal(withSteer[0]?.parts[0]?.text, '帮我重构网络层');
  assert.equal(withSteer[2]?.parts[0]?.text, '改用 reqwest，不要用 hyper');
  assert.equal(withSteer[withSteer.length - 1]?.role, 'assistant');
});

test('paintUserMessage does not duplicate the steer itself when steer echo arrives while agent is still running steer tools', () => {
  const originalUser = { role: 'user', parts: [{ kind: 'text' as const, text: '帮我重构网络层' }], ts: 1000 };
  const step1 = {
    role: 'assistant',
    parts: [{ kind: 'tool' as const, tool: { id: 'c1', name: 'read_file', status: 'done' as const } }],
  };
  const steerUser = { role: 'user', parts: [{ kind: 'text' as const, text: '改用 reqwest' }], ts: 1500 };
  const step2 = {
    role: 'assistant',
    parts: [{ kind: 'tool' as const, tool: { id: 'c2', name: 'search_replace', status: 'pending' as const } }],
  };
  const canvas = [originalUser, step1, steerUser, step2];

  // SSE echo of the steer itself arrives while step2 is still running
  const result = paintUserMessage(
    canvas,
    '改用 reqwest',
    1500,
    () => {
      throw new Error('Must not duplicate steer during in-flight step2');
    },
    { repeatAfterSettled: true },
  );

  // Count of user messages must remain 2 (original + steer), not 3!
  assert.equal(result.filter((m) => m.role === 'user').length, 2);
  assert.equal(result[0]?.parts[0]?.text, '帮我重构网络层');
  assert.equal(result[2]?.parts[0]?.text, '改用 reqwest');
});
test('single event bus stream updates in-memory session cache correctly for background sessions', () => {
  const initial = [
    { role: 'user', parts: [{ kind: 'text' as const, text: '分析代码性能' }], ts: 1000 },
    { role: 'assistant', parts: [] },
  ];

  // Background stream delivers reasoning delta
  const r1 = paintAssistantReasoning(initial, '分析当前瓶颈...', false);
  assert.equal(r1[1]?.parts.length, 1);
  assert.equal(r1[1]?.parts[0]?.kind, 'reasoning');
  assert.equal(r1[1]?.parts[0]?.text, '分析当前瓶颈...');

  // Background stream delivers text delta
  const t1 = paintAssistantText(r1, '建议使用 SIMD 加速。', false);
  assert.equal(t1[1]?.parts.length, 2);
  assert.equal(t1[1]?.parts[1]?.kind, 'text');
  assert.equal(t1[1]?.parts[1]?.text, '建议使用 SIMD 加速。');

  // Background stream delivers second text delta
  const t2 = paintAssistantText(t1, '具体步骤如下：', false);
  assert.equal(t2[1]?.parts.length, 2);
  assert.equal(t2[1]?.parts[1]?.kind, 'text');
  assert.equal(t2[1]?.parts[1]?.text, '建议使用 SIMD 加速。具体步骤如下：');
});

test('bindUserMessageIdentity binds the stored id to the optimistic bubble once', () => {
  const local = {
    role: 'user',
    id: 'client-id-1',
    parts: [{ kind: 'text' as const, text: '你好' }],
  };
  const messages = [local, { role: 'assistant', id: 'm-a1', parts: [] }];
  const bound = bindUserMessageIdentity(messages, 'm-user-1');
  assert.equal(bound[0]?.id, 'm-user-1');
  assert.equal(bound[1], messages[1]);
  // 幂等：同一个 id 第二次到达不改变画布。
  assert.equal(bindUserMessageIdentity(bound, 'm-user-1'), bound);
  // 唯一性：已在画布上的 id 绝不再贴到另一条消息上。
  const other = [
    { role: 'user', id: 'm-user-9', parts: [{ kind: 'text' as const, text: '别人的提问' }] },
    { role: 'user', parts: [{ kind: 'text' as const, text: '我的提问' }] },
  ];
  assert.equal(bindUserMessageIdentity(other, 'm-user-9'), other);
  // 无用户气泡 / 无 id：原样返回（同一引用，避免无谓重绘）。
  const empty: Array<{ role: string; parts: Array<{ kind: 'text'; text: string }> }> = [];
  assert.equal(bindUserMessageIdentity(empty, 'm-x'), empty);
  assert.equal(bindUserMessageIdentity(other, undefined), other);
});

test('identifiedAssistantIndex resolves the owning round, never the steer bubble', () => {
  const round = { role: 'assistant', id: 'm-1', parts: [] };
  const steer = { role: 'user', id: 'client-1', parts: [{ kind: 'text' as const, text: '换个方向' }] };
  const messages = [round, steer];
  assert.equal(identifiedAssistantIndex(messages, 'm-1'), 0);
  // A user bubble carrying its own client id is not an assistant target.
  assert.equal(identifiedAssistantIndex(messages, 'client-1'), -1);
  assert.equal(identifiedAssistantIndex(messages, undefined), -1);
  assert.equal(identifiedAssistantIndex(messages, 'm-missing'), -1);
});

// 回合中途 steer 的回归防线：上一回合迟到的思考/正文/工具增量必须回到它所属的
// assistant 消息，绝不能渲染到 steer 气泡下方（错序 + 重复的根因）。
test('late deltas keep their owning round above a mid-turn steer bubble', () => {
  const round = {
    role: 'assistant',
    id: 'm-1',
    parts: [{ kind: 'text' as const, text: '前半段正文' }],
  };
  const steer = { role: 'user', parts: [{ kind: 'text' as const, text: '改个方向' }] };
  const canvas = [round, steer];

  const text = paintAssistantText(canvas, '后半段正文', false, 'm-1');
  assert.equal(text.length, 2, 'steer 气泡之后绝不能另起一条 assistant');
  assert.equal(text[1], steer);
  const mergedPart = text[0]?.parts[0];
  assert.equal(mergedPart?.kind, 'text');
  assert.equal(mergedPart?.text, '前半段正文后半段正文');

  const reasoning = paintAssistantReasoning(text, '补充思考', false, 'm-1');
  assert.equal(reasoning.length, 2);
  assert.equal(reasoning[1], steer);
  assert.equal(reasoning[0]?.parts.length, 2);
  assert.equal(reasoning[0]?.parts[0]?.text, '前半段正文后半段正文');
  assert.equal(reasoning[0]?.parts[1]?.kind, 'reasoning');
  assert.equal(reasoning[0]?.parts[1]?.text, '补充思考');

  // 未携带身份（旧 daemon）时保持原有尾随语义，不回归。
  const trailing = paintAssistantText(canvas, '新回合正文', false);
  assert.equal(trailing.length, 3);
  assert.equal(trailing[1], steer);
  assert.equal(trailing[2]?.role, 'assistant');
  assert.equal(trailing[2]?.parts[0]?.text, '新回合正文');
});

test('streamed markdown keeps paragraph breaks when whitespace arrives as its own delta', () => {
  // 真实流序：正文 → "\n\n"（独立 delta）→ 下一条列表项。
  // 空白 delta 被吞会让列表/段落粘连，就是“首帧乱排、刷新后正常”的根因。
  let canvas = paintAssistantText([], '一、顶层开关是活的语义', true);
  canvas = paintAssistantText(canvas, '\n\n', true);
  canvas = paintAssistantText(canvas, '1. 对外 schema 只暴露 hunk 级', true);
  canvas = paintAssistantText(canvas, '\n\n', true);
  canvas = paintAssistantText(canvas, '2. 但底层也接受顶层开关', true);
  const text = (canvas[0]?.parts ?? []).map((part) => part.text ?? '').join('');
  assert.equal(
    text,
    '一、顶层开关是活的语义\n\n1. 对外 schema 只暴露 hunk 级\n\n2. 但底层也接受顶层开关',
  );
  // 同一段空白重复到达（重放）不得叠加空行：
  // 画布末尾已是空白时不再追加（否则空行滚雪球）。
  const endsWithBreak = paintAssistantText([], '段落一\n\n', true);
  const replayed = paintAssistantText(endsWithBreak, '\n\n', true);
  assert.equal(
    (replayed[0]?.parts ?? []).map((part) => part.text ?? '').join(''),
    '段落一\n\n',
  );
});

test('a new round identity still opens its own bubble after the steer', () => {
  const round = { role: 'assistant', id: 'm-1', parts: [{ kind: 'text' as const, text: '旧回合' }] };
  const steer = { role: 'user', parts: [{ kind: 'text' as const, text: 'steer' }] };
  const canvas = [round, steer];

  const next = paintAssistantText(canvas, '新回合回答', false, 'm-2');
  assert.equal(next.length, 3);
  assert.equal(next[1], steer);
  assert.equal(next[2]?.role, 'assistant');
  assert.equal(next[2]?.parts[0]?.text, '新回合回答');
});

test('withAssistantIdentity keeps one wire id on exactly one row', () => {
  const first = { role: 'assistant', id: 'm-1', parts: [{ kind: 'text' as const, text: '一' }] };
  const second = { role: 'assistant', parts: [{ kind: 'text' as const, text: '二' }] };
  const msgs = [first, second];

  // 同一 message_id 不得再盖到第二条消息上（重复 key 会让 Preact 复用错 DOM，
  // 表现为“老回合的一部分回复渲染到新消息里”）。
  const stamped = withAssistantIdentity(msgs, 'm-1');
  assert.equal(stamped, msgs);
  assert.equal(msgs[1]?.id, undefined);
});

test('更早轮次的回放帧定向命中原助手气泡，绝不外溢涂写到 steer 后的最新气泡中', () => {
  const orig = { role: 'user', parts: [{ kind: 'text' as const, text: '重构网络层' }] };
  const roundA = {
    role: 'assistant',
    id: 'm-A',
    parts: [
      { kind: 'text' as const, text: '旧正文' },
      { kind: 'reasoning' as const, text: '旧思考' },
    ],
  };
  const steer = { role: 'user', parts: [{ kind: 'text' as const, text: '改用 reqwest' }] };
  const roundB = { role: 'assistant', id: 'm-B', parts: [{ kind: 'text' as const, text: '新正文' }] };
  const canvas = [orig, roundA, steer, roundB];

  // 身份 m-A 精准定位到 roundA 并幂等收敛，绝不追加到 roundB
  const replayed = paintAssistantText(canvas, '旧正文', true, 'm-A');
  assert.equal(replayed.length, 4);
  assert.equal((replayed[1]?.parts[0] as { text: string }).text, '旧正文');
  assert.equal((replayed[3]?.parts[0] as { text: string }).text, '新正文');
  assert.equal(replayed[3]?.parts.length, 1);
});

test('an unrouted delta still opens the placeholder round it belongs to', () => {
  const previous = { role: 'assistant', id: 'm-1', parts: [{ kind: 'text' as const, text: '上一轮' }] };
  const steer = { role: 'user', parts: [{ kind: 'text' as const, text: '继续' }] };
  const canvas = [previous, steer, { role: 'assistant', parts: [] }];

  // 本轮的占位行（未盖章）必须能接收它的首段增量——正常直播/首次落笔路径不变。
  const painted = paintAssistantText(canvas, '新回合正文', false, 'm-2');
  assert.equal(painted.length, 3);
  assert.equal(painted[2]?.parts[0]?.text, '新回合正文');
  const thought = paintAssistantReasoning(canvas, '新回合思考', false, 'm-2');
  assert.equal(thought[2]?.parts[0]?.text, '新回合思考');
});
test('background cache stamps every round so a replay can never leak old body into the newest bubble', () => {
  // 后台会话（用户正看着别的会话）的真实序列：本回合正文 → steer → 新回合正文。
  let canvas: Array<{ role: string; id?: string; parts: Array<{ kind: string; text?: string }> }> = [
    { role: 'user', parts: [{ kind: 'text', text: '重构网络层' }] },
    { role: 'assistant', parts: [] },
  ];
  canvas = paintCachedAssistantDelta(canvas, 'text', '旧正文', { messageId: 'm-A' });
  assert.equal(canvas[1]?.id, 'm-A', '后台缓存落笔必须盖上 message_id');

  canvas = paintUserMessage(canvas as never, '改用 reqwest', 2, () => ({
    role: 'user',
    parts: [{ kind: 'text', text: '改用 reqwest' }],
  } as never)) as never;
  canvas = paintCachedAssistantDelta(canvas, 'text', '新正文', { messageId: 'm-B' });

  assert.equal(canvas.length, 4, 'steer 气泡之后新回合另起一行');
  assert.equal(canvas[1]?.id, 'm-A');
  assert.equal(canvas[3]?.id, 'm-B');

  // 失焦重进后的 watch 整轮重放：旧回合的增量必须回到自己那一行，
  // 绝不能被当成新内容追加到最新 agent 消息里。
  const replayed = paintAssistantText(canvas as never, '旧正文（重放补充）', true, 'm-A') as typeof canvas;
  assert.equal(replayed.length, 4, '重放不得新增气泡');
  assert.equal(replayed[1]?.parts[0]?.text, '旧正文（重放补充）');
  assert.equal(replayed[3]?.parts[0]?.text, '新正文', '最新 agent 消息绝不能被旧正文污染');
});

test('live streaming of multi-round turn (tools in round 1, final text in round 2) is NEVER blocked', () => {
  // 模拟真实用户场景：
  // 1. 提问后，助手气泡最初为占位
  // 2. Round 1 执行工具调用（Read/Grep 等），被盖上 id: m-round-1
  const user = { role: 'user', parts: [{ kind: 'text' as const, text: '我问你挂载的工具' }] };
  const assistantRound1 = {
    role: 'assistant',
    id: 'm-round-1',
    parts: [
      { kind: 'tool' as const, tool: { id: 'call_1', name: 'read', status: 'done' as const } },
      { kind: 'tool' as const, tool: { id: 'call_2', name: 'grep', status: 'done' as const } },
    ],
  };
  const canvas = [user, assistantRound1];

  // 3. Round 2 开始实时吐字：文本增量携带全新的 round id: m-round-2，且 replay: false（实时流）
  // 核心断言：直播流绝不能被拦截，必须 0ms 立即实时合并进当前助手气泡，用户边看边吐字！
  const streamed = paintAssistantText(canvas, '以下是挂载的工具清单：', false, 'm-round-2');
  assert.equal(streamed.length, 2);
  assert.equal(streamed[1]?.parts.length, 3);
  assert.equal(streamed[1]?.parts[2]?.kind, 'text');
  assert.equal(streamed[1]?.parts[2]?.text, '以下是挂载的工具清单：');

  // 后续流式增量继续实时追加
  const streamed2 = paintAssistantText(streamed, '\n一、内置工具', false, 'm-round-2');
  assert.equal(streamed2[1]?.parts[2]?.text, '以下是挂载的工具清单：\n一、内置工具');
});

test('历史回合存在时，工具轮之后的实时正文与思考仍必须逐字上屏', () => {
  // 真实失败场景（修复前线上复现）：会话中已有历史回合，当前回合 Round 1（工具轮）
  // 已给助手气泡盖 message_id，Round 2 正文带着全新 message_id 到达——
  // 该帧未被路由到已知消息，旧逻辑的跨轮隔离守卫直接拒绝，思考与正文全部丢失。
  const canvas = [
    { role: 'user', parts: [{ kind: 'text' as const, text: '第一轮提问' }], id: 'm-old-user' },
    { role: 'assistant', id: 'm-old', parts: [{ kind: 'text' as const, text: '历史回答' }] },
    { role: 'user', parts: [{ kind: 'text' as const, text: '第二轮提问' }], id: 'm-cur-user' },
    {
      role: 'assistant',
      id: 'm-round-1',
      parts: [
        { kind: 'text' as const, text: '正文 1', id: 'm-round-1:2:text' },
        { kind: 'tool' as const, tool: { id: 'call_1', name: 'bash', args: '', status: 'done' as const } },
      ],
    },
  ];

  // 直播帧（线协议不带 replay 标记）必须并入当前助手气泡，绝不能被拦。
  const streamed = paintAssistantText(canvas, '正文 2', false, 'm-round-2');
  assert.equal(streamed.length, 4);
  assert.deepEqual(streamed[3]?.parts.map((p) => p.kind), ['text', 'tool', 'text']);
  assert.equal((streamed[3]?.parts[2] as { text: string }).text, '正文 2');

  const reasoned = paintAssistantReasoning(streamed, '第二轮思考', false, 'm-round-2');
  assert.deepEqual(reasoned[3]?.parts.map((p) => p.kind), ['text', 'tool', 'text', 'reasoning']);

  // 旧守卫已删除：未命中轮编号的帧一律视为「画布上还没有的内容」直接落笔。
  // （不重复的保证改由断点续传游标承担：续传只发客户端没收到过的帧。）
  const replayed = paintAssistantText(canvas, '正文 2', true, 'm-round-2');
  assert.equal(replayed.length, 4);
  assert.deepEqual(replayed[3]?.parts.map((p) => p.kind), ['text', 'tool', 'text']);
});

test('回放帧按 part 身份收敛：画布已领先时不得把中段再追加一遍', () => {
  // 刷新后从缓存恢复的在途 part（已画到「请求C」），回放却从更早的片段逐段重发。
  // 旧实现用「整条消息所有正文的拼接」做基线：重发的中段既非前缀也非后缀，
  // 于是被当成新内容再追加一遍 —— 整合在途回合被逐帧重打一遍的根因。
  const canvas = [
    {
      role: 'assistant',
      id: 'm-1',
      parts: [{ kind: 'text' as const, text: '请求A请求B请求C', id: 'm-1:2:text' }],
    },
  ];
  assert.equal(paintAssistantText(canvas, '请求A', true, 'm-1', 'm-1:2:text'), canvas);
  assert.equal(paintAssistantText(canvas, '请求B', true, 'm-1', 'm-1:2:text'), canvas);
  assert.equal(paintAssistantText(canvas, '请求C', true, 'm-1', 'm-1:2:text'), canvas);
  // 累积帧更长（迟到的尾段）：原地收敛，绝不新起部件
  const grown = paintAssistantText(canvas, '请求A请求B请求C请求D', true, 'm-1', 'm-1:2:text');
  assert.equal(grown[0]?.parts.length, 1);
  assert.equal((grown[0]?.parts[0] as { text: string }).text, '请求A请求B请求C请求D');
});

test('新部件写入即盖身份戳，后续重放才能按 part 定向收敛', () => {
  const canvas = [
    {
      role: 'assistant',
      id: 'm-1',
      parts: [{ kind: 'text' as const, text: '正文 1', id: 'm-1:2:text' }],
    },
  ];
  // 工具后的新正文轮：帧携带自己的 part id → 建新部件时立即盖章
  const next = paintAssistantText(canvas, '正文 2', true, 'm-1', 'm-1:4:text');
  assert.equal(next[0]?.parts.length, 2);
  assert.equal((next[0]?.parts[1] as { id?: string }).id, 'm-1:4:text');
  // 同一帧再次回放：命中 part → 幂等丢弃
  assert.equal(paintAssistantText(next, '正文 2', true, 'm-1', 'm-1:4:text'), next);
  // 思考同理：建部件时盖章，重放时幂等
  const withThinking = paintAssistantReasoning(next, '第二轮思考', true, 'm-1', 'm-1:5:reasoning');
  assert.equal((withThinking[0]?.parts[2] as { id?: string }).id, 'm-1:5:reasoning');
  assert.equal(
    paintAssistantReasoning(withThinking, '第二轮思考', true, 'm-1', 'm-1:5:reasoning'),
    withThinking,
  );
});

test('直播流式输出中的重复 URL、重复前缀与重复代码块内容绝不被吞字', () => {
  const canvas = [
    {
      role: 'assistant',
      id: 'm-1',
      parts: [],
    },
  ];

  // 模拟真实 LLM 流式输出：先输出第一条链接
  let res = paintAssistantText(canvas, '1. https://github.com/jeikl/JeikCode/tree/v7.2.2\n', false, 'm-1', 'm-1:1:text');
  // 再分 chunk 流式输出第二条完全相同的链接（测试前缀重复 token 绝不能被 includes 丢弃）
  res = paintAssistantText(res, '2. ', false, 'm-1', 'm-1:1:text');
  res = paintAssistantText(res, 'https://github.com', false, 'm-1', 'm-1:1:text');
  res = paintAssistantText(res, '/jeikl/JeikCode', false, 'm-1', 'm-1:1:text');
  res = paintAssistantText(res, '/tree/v7.2.2\n', false, 'm-1', 'm-1:1:text');

  // 第三条链接整块到达
  res = paintAssistantText(res, '3. https://github.com/jeikl/JeikCode/tree/v7.2.2\n', false, 'm-1', 'm-1:1:text');

  const textPart = res[0]?.parts[0] as { kind: 'text'; text: string };
  assert.equal(textPart.kind, 'text');
  assert.equal(
    textPart.text,
    '1. https://github.com/jeikl/JeikCode/tree/v7.2.2\n2. https://github.com/jeikl/JeikCode/tree/v7.2.2\n3. https://github.com/jeikl/JeikCode/tree/v7.2.2\n',
  );
});

test('直播思考流式输出中的重复词句绝不被误杀吞字', () => {
  const canvas = [
    {
      role: 'assistant',
      id: 'm-1',
      parts: [],
    },
  ];

  let res = paintAssistantReasoning(canvas, '首先检查缓存一致性问题。', false, 'm-1', 'm-1:1:reasoning');
  res = paintAssistantReasoning(res, '接着再次确认缓存一致性问题，', false, 'm-1', 'm-1:1:reasoning');
  res = paintAssistantReasoning(res, '问题已被彻底定位。', false, 'm-1', 'm-1:1:reasoning');

  const part = res[0]?.parts[0] as { kind: 'reasoning'; text: string };
  assert.equal(part.kind, 'reasoning');
  assert.equal(part.text, '首先检查缓存一致性问题。接着再次确认缓存一致性问题，问题已被彻底定位。');
});

test('工具调用之后的第二段思考流式输出必须开启独立思考部件，绝不能跨越工具合并进第一段思考部件', () => {
  const canvas = [
    {
      role: 'assistant',
      id: 'm-1',
      parts: [
        { kind: 'reasoning' as const, text: '第一阶段思考：需要读取配置文件。', id: 'm-1:1:reasoning' },
        { kind: 'tool' as const, tool: { id: 'call_1', name: 'read', status: 'done' as const } },
      ],
    },
  ];

  // 模拟第二轮思考流式到达（partId 为 m-1:2:reasoning，或者无 partId）
  let res = paintAssistantReasoning(canvas, '第二阶段思考：', false, 'm-1', 'm-1:2:reasoning');
  res = paintAssistantReasoning(res, '配置文件已经读取完毕，准备进行下一步。', false, 'm-1', 'm-1:2:reasoning');

  // 必须严格拥有两个独立的思考部件，中间夹着工具调用！
  const parts = res[0]?.parts ?? [];
  assert.equal(parts.length, 3);
  assert.equal(parts[0]?.kind, 'reasoning');
  assert.equal((parts[0] as any).text, '第一阶段思考：需要读取配置文件。');
  assert.equal(parts[1]?.kind, 'tool');
  assert.equal(parts[2]?.kind, 'reasoning');
  assert.equal((parts[2] as any).text, '第二阶段思考：配置文件已经读取完毕，准备进行下一步。');
});

test('正文后的思考块以及思考块后的正文：极限交替输出严禁任何倒流叠加', () => {
  let canvas = [
    {
      role: 'assistant',
      id: 'm-1',
      parts: [],
    },
  ];

  // 1. 思考 1
  canvas = paintAssistantReasoning(canvas, '思考1：分析需求', false, 'm-1', 'm-1:1:reasoning');
  // 2. 正文 1
  canvas = paintAssistantText(canvas, '正文1：开始处理', false, 'm-1', 'm-1:2:text');
  // 3. 思考 2（正文后的思考块！）
  canvas = paintAssistantReasoning(canvas, '思考2：检查函数依赖', false, 'm-1', 'm-1:3:reasoning');
  // 4. 正文 2（思考2后的正文！）
  canvas = paintAssistantText(canvas, '正文2：函数正常', false, 'm-1', 'm-1:4:text');

  const parts = canvas[0]?.parts ?? [];
  assert.equal(parts.length, 4, '必须严格交替形成 4 个独立部件');
  assert.equal(parts[0]?.kind, 'reasoning');
  assert.equal((parts[0] as any).text, '思考1：分析需求');
  assert.equal(parts[1]?.kind, 'text');
  assert.equal((parts[1] as any).text, '正文1：开始处理');
  assert.equal(parts[2]?.kind, 'reasoning');
  assert.equal((parts[2] as any).text, '思考2：检查函数依赖');
  assert.equal(parts[3]?.kind, 'text');
  assert.equal((parts[3] as any).text, '正文2：函数正常');
});

test('正文与思考无 partId 极端重放恢复：严格按顺序呈现，绝无倒流叠加', () => {
  let canvas = [
    {
      role: 'assistant',
      id: 'm-1',
      parts: [],
    },
  ];

  // 模拟没有 partId 的交替重放帧
  canvas = paintAssistantReasoning(canvas, '阶段1思考', true);
  canvas = paintAssistantText(canvas, '阶段1结论', true);
  canvas = paintAssistantReasoning(canvas, '阶段2思考', true);
  canvas = paintAssistantText(canvas, '阶段2结论', true);

  const parts = canvas[0]?.parts ?? [];
  assert.equal(parts.length, 4);
  assert.equal(parts[0]?.kind, 'reasoning');
  assert.equal((parts[0] as any).text, '阶段1思考');
  assert.equal(parts[1]?.kind, 'text');
  assert.equal((parts[1] as any).text, '阶段1结论');
  assert.equal(parts[2]?.kind, 'reasoning');
  assert.equal((parts[2] as any).text, '阶段2思考');
  assert.equal(parts[3]?.kind, 'text');
  assert.equal((parts[3] as any).text, '阶段2结论');
});

