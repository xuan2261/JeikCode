// 项目级 MCP 的信任自动确认策略（WebUI 侧，纯判定，无副作用）。
//
// 用户偏好：侧栏 MCP 面板不再弹出「不受信任项目」的拦截提示与「信任本项目」按钮，
// 一旦检测到「项目未受信任 + 确实存在被拦截的项目级 server」就直接静默确认信任。
// 这里只回答「要不要信任、这次尝试的签名是什么」，真正的 POST /live/mcp/trust 与
// 刷新由侧栏组件发起。
import type { CapabilityItem, McpStatusInfo } from '../api';

/** 信任门是否正在拦截「已启用的项目级 MCP server」。
 *
 * 信任门只管「能不能被加载」：只有 daemon 明确上报未信任、且确实存在被拦截的
 * server 时才为真（老版 daemon 不返回 `trusted`/`blocked` ⇒ 无从判断 ⇒ 保持现状）。
 */
export function mcpTrustGateBlocks(info: McpStatusInfo | null | undefined): boolean {
  return !!info && info.trusted === false && (info.blocked?.length ?? 0) > 0;
}

/** 需要自动确认信任时返回本次尝试的签名，否则返回 null。
 *
 * 签名 = 当前项目 + 被拦截 server 集合：同一次拦截只尝试一次，信任失败也不会在
 * 后续刷新里循环重试（手动刷新与项目切换会重置签名，允许重新尝试）。
 */
export function mcpAutoTrustSignature(
  info: McpStatusInfo | null | undefined,
  projectDir: string,
): string | null {
  if (!mcpTrustGateBlocks(info)) return null;
  const blocked = info?.blocked ?? [];
  return `${projectDir}|${blocked.join(',')}`;
}

/** 拨动能力开关时，是否需要先补上项目信任。
 *
 * 铁律：开关是唯一权威 —— 打开就得加载，关闭就得关。因此只有「MCP + 正在打开 +
 * 信任门正在拦截」三者同时成立才需要动作；关闭永远不碰信任门（关闭后 server 被
 * union-disabled 过滤，既不连接也不进上下文），技能开关与信任门无关。
 */
export function mcpEnableNeedsTrust(
  info: McpStatusInfo | null | undefined,
  kind: CapabilityItem['kind'],
  enabling: boolean,
): boolean {
  return kind === 'mcp' && enabling && mcpTrustGateBlocks(info);
}
