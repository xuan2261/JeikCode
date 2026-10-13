/**
 * Admission for a local, opportunistic history prefetch. This fences only
 * changes this WebUI instance has actually observed; it is NOT an authoritative
 * cross-tab transcript revision or a substitute for a versioned GET.
 */
export interface SessionPrefetchFence {
  isCancelled(): boolean;
  isBusy(): boolean;
  isCandidateActive(): boolean;
  hasCachedSession(): boolean;
  currentViewGeneration(): number;
  currentMutationEpoch(): number;
}

export function recordPrefetchActivity(
  runningSessions: Set<string>,
  activity: { session_id: string; running: boolean },
): void {
  // This set is only for prefetch admission. Do not claim chat-runtime
  // ownership or alter the active-turn lifecycle in response to an observer.
  if (activity.running) runningSessions.add(activity.session_id);
  else runningSessions.delete(activity.session_id);
}

export function mergePrefetchActiveSnapshot(
  activeSessionIds: Iterable<string>,
  newerActivities: ReadonlyMap<string, boolean>,
): Set<string> {
  // An authoritative active-check can be older than incremental events
  // observed while its HTTP request was outstanding. Apply those last.
  const running = new Set(activeSessionIds);
  for (const [sessionId, isRunning] of newerActivities) {
    if (isRunning) running.add(sessionId);
    else running.delete(sessionId);
  }
  return running;
}

export async function applyGuardedSessionPrefetch<T>(
  fetch: () => Promise<T | null>,
  fence: SessionPrefetchFence,
  commit: (value: T) => void | Promise<void>,
): Promise<boolean> {
  const viewGeneration = fence.currentViewGeneration();
  const mutationEpoch = fence.currentMutationEpoch();
  const isAdmissible = () =>
    !fence.isCancelled() &&
    !fence.isBusy() &&
    !fence.isCandidateActive() &&
    !fence.hasCachedSession() &&
    fence.currentViewGeneration() === viewGeneration &&
    fence.currentMutationEpoch() === mutationEpoch;

  if (!isAdmissible()) return false;
  const result = await fetch();
  // No await between this second guard and commit's synchronous L1 update.
  // Changes observed while GET was pending can no longer publish stale data.
  if (result == null || !isAdmissible()) return false;
  await commit(result);
  return true;
}
