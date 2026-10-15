import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  mcpAutoTrustSignature,
  mcpEnableNeedsTrust,
  mcpTrustGateBlocks,
} from './mcpTrust.ts';

const untrusted = (blocked: string[]) => ({ servers: [], trusted: false, blocked });

test('trusted and unknown-trust daemons never trigger auto-trust', () => {
  // 已信任：无事可做。
  assert.equal(mcpAutoTrustSignature({ servers: [], trusted: true, blocked: [] }, '/p'), null);
  // 老版 daemon 不返回 `trusted`/`blocked`：无从判断，保持现状。
  assert.equal(mcpAutoTrustSignature({ servers: [] }, '/p'), null);
  assert.equal(mcpAutoTrustSignature(null, '/p'), null);
  assert.equal(mcpAutoTrustSignature(undefined, '/p'), null);
});

test('untrusted project without blocked servers stays untouched', () => {
  // 没有任何项目级（被拦截的）server：写信任记录没有意义。
  assert.equal(mcpAutoTrustSignature({ servers: [], trusted: false, blocked: [] }, '/p'), null);
  assert.equal(mcpAutoTrustSignature({ servers: [], trusted: false }, '/p'), null);
});

test('untrusted project with blocked servers yields a project+set signature', () => {
  const sig = mcpAutoTrustSignature(
    { servers: [], trusted: false, blocked: ['brave-search'] },
    'E:/code/jeikcode',
  );
  assert.equal(sig, 'E:/code/jeikcode|brave-search');
  // 同一状态重复判定得到同一签名 —— 组件据此「只尝试一次」，失败不循环重试。
  assert.equal(
    mcpAutoTrustSignature({ servers: [], trusted: false, blocked: ['brave-search'] }, 'E:/code/jeikcode'),
    sig,
  );
});

test('signature separates projects and blocked sets', () => {
  const one = mcpAutoTrustSignature({ servers: [], trusted: false, blocked: ['a'] }, '/p1');
  const other = mcpAutoTrustSignature({ servers: [], trusted: false, blocked: ['a'] }, '/p2');
  const both = mcpAutoTrustSignature({ servers: [], trusted: false, blocked: ['a', 'b'] }, '/p1');
  assert.notEqual(one, other, '不同项目必须各自尝试');
  assert.notEqual(one, both, '拦截集合变化后允许重新尝试');
  assert.equal(
    mcpAutoTrustSignature({ servers: [], trusted: false, blocked: ['a', 'b'] }, '/p1'),
    both,
  );
});

// 铁律：开关是唯一权威 —— 打开就得加载，关闭就得关。信任门只管「能不能被加载」。
test('gate blocks only when an enabled project server is withheld', () => {
  assert.equal(mcpTrustGateBlocks(untrusted(['a'])), true);
  assert.equal(mcpTrustGateBlocks(untrusted([])), false);
  assert.equal(mcpTrustGateBlocks({ servers: [], trusted: true, blocked: [] }), false);
  assert.equal(mcpTrustGateBlocks({ servers: [] }), false);
  assert.equal(mcpTrustGateBlocks(null), false);
});

test('turning a switch ON must clear the gate first; turning it OFF never touches trust', () => {
  // 开启：门禁正在拦截 ⇒ 先补信任，开关一落地就是已连接。
  assert.equal(mcpEnableNeedsTrust(untrusted(['a']), 'mcp', true), true);
  // 关闭：server 被 union-disabled 过滤，既不连接也不进上下文 ⇒ 永远不需要信任动作。
  assert.equal(mcpEnableNeedsTrust(untrusted(['a']), 'mcp', false), false);
  // 已信任 / 没有拦截对象：无需动作。
  assert.equal(mcpEnableNeedsTrust({ servers: [], trusted: true, blocked: [] }, 'mcp', true), false);
  assert.equal(mcpEnableNeedsTrust(untrusted([]), 'mcp', true), false);
  // 技能开关与信任门无关。
  assert.equal(mcpEnableNeedsTrust(untrusted(['a']), 'skill', true), false);
});
