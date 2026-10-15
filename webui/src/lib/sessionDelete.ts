/** Parallelism for bulk session DELETE. High enough to keep the list moving,
 *  low enough that 40 deletes do not stampede the daemon. */
export const SESSION_DELETE_CONCURRENCY = 4;

export interface SessionDeleteTarget {
  project_hash: string;
  id: string;
  name?: string;
}

export interface SessionDeleteFailure {
  id: string;
  name: string;
  cause: unknown;
}

/** 服务端“会话不存在”错误码（DeleteSessionError.code）——表示目标状态已达成。 */
const SESSION_NOT_FOUND_CODE = 'SESSION_NOT_FOUND';

/**
 * 错误是否表示“该会话已不存在”（鸭式判定，避免 lib → api 的模块依赖，
 * 保证 node 单测环境下可加载）。
 */
export function isSessionAlreadyGone(cause: unknown): boolean {
  return (
    typeof cause === 'object' &&
    cause !== null &&
    (cause as { code?: unknown }).code === SESSION_NOT_FOUND_CODE
  );
}

/**
 * Delete sessions with a bounded worker pool. `onDeleted` fires as soon as each
 * HTTP DELETE succeeds so the sidebar can remove that row without waiting for
 * the rest of the batch (or for MCP process teardown on the server).
 */
export async function deleteSessionsStreaming(
  sessions: SessionDeleteTarget[],
  deleteOne: (projectHash: string, sessionId: string) => Promise<void>,
  onDeleted: (id: string) => void,
  concurrency: number = SESSION_DELETE_CONCURRENCY,
  onSettled?: () => void,
): Promise<{ failed: SessionDeleteFailure[] }> {
  const failed: SessionDeleteFailure[] = [];
  if (sessions.length === 0) return { failed };

  let cursor = 0;
  const workerCount = Math.max(1, Math.min(concurrency, sessions.length));
  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (true) {
        const index = cursor;
        cursor += 1;
        if (index >= sessions.length) return;
        const session = sessions[index];
        try {
          await deleteOne(session.project_hash, session.id);
          onDeleted(session.id);
        } catch (cause) {
          // 服务端已无此会话 = 目标状态已达成（例如别的实例/TUI 先删了）。
          // 必须按“已删”处理并剔除本地行，否则陈旧行会残留到下一次重拉。
          if (isSessionAlreadyGone(cause)) {
            onDeleted(session.id);
          } else {
            failed.push({
              id: session.id,
              name: session.name || session.id.slice(0, 8),
              cause,
            });
          }
        } finally {
          onSettled?.();
        }
      }
    }),
  );
  return { failed };
}
