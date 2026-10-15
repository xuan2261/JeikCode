/**
 * 「停止当前运行中回合」的共享判定：WebUI 的「停止」按钮、排队卡片的「立即发送」，
 * 以及程序化停止后的终态收尾都依赖这里的规则。
 *
 * 历史教训：本端回合被 `/chat` admit（202 Accepted）之后 `requestIdRef` 即被清空，
 * 会话 id 才是长期有效的停止别名。若停止只认 request id 别名，停止会被整体跳过，
 * 紧接着的投递必然撞上后端 409 `session_busy`，消息被退回收件箱式的排队卡片。
 */

/** 「立即发送」发起的程序化停止标记：旧回合的 `stopped` 终态到达时按此一次性识别。 */
export interface ProgrammaticStopMark {
  sessionId: string;
  expiresAt: number;
}

/**
 * 解析停止运行中回合应投递的别名集合（按序去重，忽略空白）。
 *
 * 后端对未知别名是幂等空操作（返回 `was not running`），因此可以安全地全量投递：
 * 全新会话首轮尚未绑定 id 之前用 request id 别名，绑定之后会话 id 别名长期有效。
 */
export function runningTurnStopAliases(input: {
  requestAlias?: string | null;
  sessionId?: string | null;
}): string[] {
  const aliases: string[] = [];
  for (const candidate of [input.requestAlias, input.sessionId]) {
    const alias = candidate?.trim();
    if (alias && !aliases.includes(alias)) aliases.push(alias);
  }
  return aliases;
}

/**
 * 该 `stopped` 终态是否属于「立即发送」发起的程序化停止（一次性抑制标记）。
 *
 * 命中时必须跳过 `restoreQueuedToComposer()`：用户只要求立刻发出这一条，
 * 其余排队卡片与已投递的转向必须原地保留，绝不能整段回吐到输入框或被顺带撤回。
 * 会话 id 不匹配或标记已过期时一律回退到用户主动停止的既有语义。
 */
export function consumesProgrammaticStopMark(
  mark: ProgrammaticStopMark | null | undefined,
  sessionId: string | null | undefined,
  now: number,
): boolean {
  if (!mark) return false;
  const sid = sessionId?.trim();
  if (!sid || sid !== mark.sessionId) return false;
  return now <= mark.expiresAt;
}
