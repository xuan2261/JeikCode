/** 比较更新对话框里的版本和 `/health` 返回的运行版本。 */
export function normalizeUpgradeVersion(value?: string | null): string {
  return (value || '').trim().replace(/^v/i, '').toLowerCase();
}

/**
 * 只有新进程已经在提供目标版本时才刷新页面。
 * 旧进程在退出前仍会应答；一次超时后又回到旧版本，不能把页面刷回旧界面。
 * `consecutiveMisses` 是这次成功应答之前连续失败的次数。
 */
export function shouldReloadUpgradedPage(input: {
  want: string;
  from: string;
  got: string;
  consecutiveMisses: number;
}): boolean {
  const want = normalizeUpgradeVersion(input.want);
  const from = normalizeUpgradeVersion(input.from);
  const got = normalizeUpgradeVersion(input.got);
  if (!got) return false;
  const sameTarget = want.length > 0 && want === from;
  if (!sameTarget && want && got === want) return true;
  // 同版本重装没有新版本号。端口要先真正断过，再连上，才说明进程换过。
  if (sameTarget && input.consecutiveMisses >= 2) return true;
  // 目标版本字符串和健康检查不一致时，连续失败后版本相对起点变了，也算换过进程。
  if (!sameTarget && input.consecutiveMisses >= 2 && got !== from) return true;
  return false;
}
