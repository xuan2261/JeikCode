import type { ApprovalMode, ImageData, QueuedMessageApiItem, SessionDetail } from '../api';

export interface QueuedDraftItem {
  text: string;
  images?: ImageData[];
}

// /chat/queue already persists id as a JSON number OR string. A rejected
// request identity survives local and server storage without a new wire field
// or guessing delivery from repeated user text.
const REJECTED_CHAT_RETRY_PREFIX = 'rejected-chat:';
// A queued retry can also carry an ordinary steer client-input ID. That is
// NOT evidence of an UNKNOWN /chat admission. Namespace only the latter in
// the existing string field; decode it before exact transcript correlation.
const UNKNOWN_CHAT_ADMISSION_PREFIX = 'chat-unknown:';

export function rejectedChatRetryId(requestId: string): string {
  return REJECTED_CHAT_RETRY_PREFIX + requestId;
}

export function isUnacceptedChatRetry(item: { id: number | string; kind?: string }): boolean {
  // A steering HTTP request is not accepted until postChatSteer completes.
  // A sidebar switch during this in-flight interval cannot use an older user
  // bubble with matching text as proof this retry was already delivered.
  return (item.kind === 'queue' || item.kind === 'steering')
    && typeof item.id === 'string'
    && item.id.startsWith(REJECTED_CHAT_RETRY_PREFIX);
}

export function appendRejectedChatRetry<T extends { id: number | string }>(
  queued: T[],
  rejected: T,
): T[] {
  return queued.some((item) => item.id === rejected.id) ? queued : [...queued, rejected];
}

/** After a failed server-clear receipt keep the retry ahead of later queued
 * prompts, without adding a duplicate after another view restored the ID. */
export function restoreRejectedChatRetry<T extends { id: number | string }>(
  queued: T[], retry: T, refreshExisting = false,
): T[] {
  const index = queued.findIndex((item) => item.id === retry.id);
  if (index < 0) return [retry, ...queued];
  if (!refreshExisting || queued[index] === retry) return queued;
  const refreshed = [...queued];
  refreshed[index] = retry;
  return refreshed;
}

/** A GET issued before a confirmed queue-clear may resolve afterward with an
 * obsolete snapshot. It must not resurrect that exact cleared request ID. */
export function shouldHydrateServerQueuedItem(
  item: { id: number | string }, clearingOrClearedIds: ReadonlySet<string> | undefined,
): boolean {
  return !clearingOrClearedIds?.has(String(item.id));
}

/** A pending Send Now must not use its old A-render closure after a sidebar
 * switch to B or after a replacement view generation of A. */
export function queuedSendStillOwnsView(input: {
  mounted: boolean;
  intendedSession: string | null;
  viewedSession: string | null;
  startingGeneration: number;
  currentGeneration: number;
}): boolean {
  return input.mounted
    && input.viewedSession === input.intendedSession
    && input.startingGeneration === input.currentGeneration;
}

export function queuedItemAlreadyDelivered<T extends { id: number | string; kind?: string; clientInputId?: string }>(
  item: T,
  identityAppearsInTranscript: (id: string) => boolean,
): boolean {
  // Unaccepted inputs cannot be consumed by an older identical prompt. Only
  // a user's exact echoed client identity proves admission of a steer or an
  // unacknowledged rejected-chat retry.
  if (!item.clientInputId) return false;
  if (item.kind === 'steer') return identityAppearsInTranscript(item.clientInputId);
  const requestId = unresolvedChatAdmissionRequestId(item);
  return !!requestId && identityAppearsInTranscript(requestId);
}

/** A POST with no admission receipt may already have been accepted. Its exact
 * client input ID survives queue storage and prohibits blind re-admission. */
export function rejectedRetryNeedsReconciliation(item: { id: number | string; kind?: string; clientInputId?: string }): boolean {
  return isUnacceptedChatRetry(item) && item.kind === 'queue'
    && !!item.clientInputId && item.clientInputId.startsWith(UNKNOWN_CHAT_ADMISSION_PREFIX);
}

export function unresolvedChatAdmissionRequestId(item: { id: number | string; kind?: string; clientInputId?: string }): string | null {
  if (!rejectedRetryNeedsReconciliation(item)) return null;
  const id = item.clientInputId!.slice(UNKNOWN_CHAT_ADMISSION_PREFIX.length);
  return id.startsWith('unresolved:') ? null : id;
}

export function hasUnresolvedChatAdmission<T extends { id: number | string; kind?: string; clientInputId?: string }>(items: T[]): boolean {
  return items.some(rejectedRetryNeedsReconciliation);
}

/** Reconcile a server queue snapshot without downgrading an already-observed
 * UNKNOWN admission to an older same-ID plain queue item. An authoritative
 * unknown marker also upgrades stale local storage when its write failed.
 * Preserve the user's existing payload and relative order for matching IDs. */
export function mergeQueueAdmissionHints<T extends {
  id: number | string;
  kind?: string;
  clientInputId?: string;
}>(local: T[], server: T[], failClosedMissingRetries = false): T[] {
  let merged = local;
  if (failClosedMissingRetries) {
    const serverIds = new Set(server.map((item) => String(item.id)));
    for (const [index, item] of local.entries()) {
      // A stale local R absent from the authoritative queue might already
      // have passed queue-clear and been admitted while storage was down.
      // With no attempt ID, it must never be resubmitted automatically.
      if (isUnacceptedChatRetry(item) && item.kind === 'queue'
        && !rejectedRetryNeedsReconciliation(item) && !serverIds.has(String(item.id))) {
        if (merged === local) merged = [...local];
        merged[index] = retryAfterChatAdmission(item, { status: 'unknown' });
      }
    }
  }
  for (const item of server) {
    const index = merged.findIndex((existing) => String(existing.id) === String(item.id));
    if (index < 0) {
      if (merged === local) merged = [...local];
      merged.push(item);
    } else if (merged[index]!.kind === 'queue'
      && rejectedRetryNeedsReconciliation(item)
      && (!rejectedRetryNeedsReconciliation(merged[index]!)
        || (!unresolvedChatAdmissionRequestId(merged[index]!)
          && !!unresolvedChatAdmissionRequestId(item)))) {
      if (merged === local) merged = [...local];
      merged[index] = { ...merged[index]!, clientInputId: item.clientInputId };
    }
  }
  return merged;
}

/** Resolve a stale local R against a newer server UNKNOWN hint *before*
 * consulting canonical admitted-user IDs. Filtering the server hint first
 * would leave the local row without its request identity and strand it. */
export function reconcileQueuedAdmissionSnapshot<T extends {
  id: number | string;
  kind?: string;
  clientInputId?: string;
}>(local: T[], server: T[], hasAdmittedIdentity: (id: string) => boolean): T[] {
  const merged = mergeQueueAdmissionHints(local, server, true);
  const remaining = merged.filter((item) => !queuedItemAlreadyDelivered(item, hasAdmittedIdentity));
  return remaining.length === merged.length ? merged : remaining;
}

/** A→B→A may leave two strict queue GETs in flight. Only the current
 * view generation may release A's admission-blocking hydration barrier;
 * an older successful response has no authority over the replacement A. */
export function releaseOwnedQueueHydration(
  owners: Map<string, number>,
  sid: string,
  generation: number,
  succeeded: boolean,
): boolean {
  if (!succeeded || owners.get(sid) !== generation) return false;
  owners.delete(sid);
  return true;
}

/** Never POST a stale local queue vector while its same-session authoritative
 * GET may still supply a stronger UNKNOWN admission marker. Independent
 * sessions continue writing normally. */
export function queuedWriteDisposition(
  pending: ReadonlyMap<string, number>,
  sid: string,
  skipServerWrite: boolean,
): 'skip' | 'defer' | 'write' {
  if (skipServerWrite) return 'skip';
  return pending.has(sid) ? 'defer' : 'write';
}

/** Queued image-only submissions are valid even without any visible text. */
export function queuedPayloadHasContent(text: string, images?: ImageData[]): boolean {
  return text.trim().length > 0 || (images?.length ?? 0) > 0;
}

export type QueuedChatAdmission =
  | { status: 'admitted' }
  | { status: 'rejected' }
  | { status: 'unknown'; requestId?: string };

/** A successful queue clear must remain fenced through admission confirmation.
 * Only a definite failure/defer may intentionally allow the original queued
 * row to be hydrated again from a pre-clear GET. */
export function preserveClearedRetryBarrier(
  outcome: Exclude<QueuedChatAdmission, { status: 'admitted' }>,
): boolean {
  return outcome.status === 'unknown';
}

/** An unacknowledged `/chat` may have finished before its watcher connected.
 * Query the small first-paint tail in the common case; fall back to exactly one
 * full GET only when the target might sit beyond that window (e.g. a long tool
 * turn). Never interpret absence in either snapshot as rejection. */
export async function findConfirmedChatAdmission(
  requestId: string,
  readTail: () => Promise<Pick<SessionDetail, 'offset' | 'messages'>>,
  readFull: () => Promise<Pick<SessionDetail, 'offset' | 'messages'>>,
): Promise<boolean> {
  if (!requestId) return false;
  const hasExactUser = (snapshot: Pick<SessionDetail, 'messages'>) =>
    snapshot.messages.some((message) => message.role === 'user'
      && message.client_input_id === requestId);
  const tail = await readTail();
  if (hasExactUser(tail)) return true;
  return (tail.offset ?? 0) > 0 && hasExactUser(await readFull());
}

export function retryAfterChatAdmission<T extends { id: number | string; clientInputId?: string }>(
  item: T,
  outcome: Exclude<QueuedChatAdmission, { status: 'admitted' }>,
): T & { clientInputId?: string } {
  if (outcome.status === 'rejected') return item;
  // If the HTTP call itself failed before revealing an attempt identity, a
  // sentinel prevents unsafe resubmission. It is NOT an authoritative ID and
  // will never match a different user's confirmed transcript event.
  return { ...item, clientInputId: UNKNOWN_CHAT_ADMISSION_PREFIX
    + (outcome.requestId ?? `unresolved:${String(item.id)}`) };
}

/** Clear ACK and chat admission are separate receipts. An unknown HTTP outcome
 * is not a safe negative receipt and must be reconciled by exact user identity. */
export async function dispatchRejectedChatRetryAfterQueueClear(
  clearQueue: () => Promise<void>,
  stillOwnedAndIdle: () => boolean,
  deliver: () => Promise<QueuedChatAdmission>,
  restore: (outcome: Exclude<QueuedChatAdmission, { status: 'admitted' }>) => void,
): Promise<boolean> {
  try {
    await clearQueue();
  } catch {
    restore({ status: 'rejected' });
    return false;
  }
  if (!stillOwnedAndIdle()) {
    restore({ status: 'rejected' });
    return false;
  }
  let outcome: QueuedChatAdmission;
  try {
    outcome = await deliver();
  } catch {
    // A thrown delivery callback cannot prove that POST was never admitted.
    outcome = { status: 'unknown' };
  }
  if (outcome.status === 'admitted') return true;
  restore(outcome);
  return false;
}

/** Preserve this tab's per-session queue write order across async POSTs.
 * A failed earlier write cannot prevent a subsequent authoritative clear. */
export function serializeSessionQueueWrite(
  tails: Map<string, Promise<void>>,
  sid: string,
  write: () => Promise<void>,
): Promise<void> {
  const previous = tails.get(sid) ?? Promise.resolve();
  const request = previous.catch(() => {}).then(write);
  tails.set(sid, request);
  void request.finally(() => {
    if (tails.get(sid) === request) tails.delete(sid);
  }).catch(() => {});
  return request;
}

/** Use the server's existing snake_case approval_mode field. Casting a local
 * item previously lost its requested mode after cross-device queue refresh. */
export function serializeQueuedForServer<T extends {
  id: number | string;
  text: string;
  images?: ImageData[];
  kind: QueuedMessageApiItem['kind'];
  approvalMode?: ApprovalMode;
  clientInputId?: string;
}>(items: T[]): QueuedMessageApiItem[] {
  return items.map((item) => ({
    id: item.id,
    text: item.text,
    images: item.images,
    kind: item.kind,
    approval_mode: item.approvalMode,
    client_input_id: item.clientInputId,
  }));
}

export function restoreQueuedFromServer(
  item: QueuedMessageApiItem,
  fallbackMode: ApprovalMode,
): QueuedMessageApiItem & { approvalMode: ApprovalMode; clientInputId?: string } {
  return { ...item, approvalMode: item.approval_mode ?? fallbackMode, clientInputId: item.client_input_id };
}

export const STORAGE_KEY_QUEUED_MESSAGES = 'jeikcode_queued_messages_v2';
export const LEGACY_STORAGE_KEY_QUEUED_MESSAGES = 'jeikcode_queued_messages';

/**
 * Load queued/steer items map from persistent localStorage across page refreshes.
 * Fallback to sessionStorage for backward compatibility.
 */
export function loadQueuedFromStorage<T>(): Map<string, T[]> {
  const map = new Map<string, T[]>();
  if (typeof window === 'undefined') return map;
  try {
    const raw = window.localStorage?.getItem(STORAGE_KEY_QUEUED_MESSAGES)
      || window.sessionStorage?.getItem(LEGACY_STORAGE_KEY_QUEUED_MESSAGES);
    if (!raw) return map;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (Array.isArray(v) && v.length > 0) {
          map.set(k, v as T[]);
        }
      }
    }
  } catch {
    // Ignore storage parse error
  }
  return map;
}

/**
 * Persist queued/steer items map into localStorage so page refreshes and
 * session switches never lose queued or steered follow-up cards until actually sent.
 */
export function saveQueuedToStorage<T>(stash: Map<string, T[]>): void {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, T[]> = {};
    for (const [k, v] of stash.entries()) {
      if (v && v.length > 0) {
        obj[k] = v;
      }
    }
    const serialized = JSON.stringify(obj);
    if (Object.keys(obj).length > 0) {
      window.localStorage?.setItem(STORAGE_KEY_QUEUED_MESSAGES, serialized);
      window.sessionStorage?.setItem(LEGACY_STORAGE_KEY_QUEUED_MESSAGES, serialized);
    } else {
      window.localStorage?.removeItem(STORAGE_KEY_QUEUED_MESSAGES);
      window.sessionStorage?.removeItem(LEGACY_STORAGE_KEY_QUEUED_MESSAGES);
    }
  } catch {
    // Ignore storage quota / access error
  }
}

/**
 * Stash a session's in-flight queued/steer items when switching away.
 */
export function stashSessionQueued<T>(
  stash: Map<string, T[]>,
  sessionId: string | null | undefined,
  items: T[],
): void {
  if (!sessionId) return;
  if (items.length > 0) {
    stash.set(sessionId, [...items]);
  } else {
    stash.delete(sessionId);
  }
  saveQueuedToStorage(stash);
}

/**
 * Restore a session's stashed queued/steer items when switching back or refreshing.
 */
export function restoreSessionQueued<T>(
  stash: Map<string, T[]>,
  sessionId: string | null | undefined,
): T[] {
  if (!sessionId) return [];
  let found = stash.get(sessionId);
  // Always query storage so any cross-tab or refreshed items are thoroughly restored
  if (typeof window !== 'undefined') {
    const stored = loadQueuedFromStorage<T>();
    const loaded = stored.get(sessionId);
    if (loaded && loaded.length > 0) {
      if (!found || found.length === 0) {
        stash.set(sessionId, loaded);
        found = loaded;
      } else {
        // Merge without duplicating IDs
        const existingIds = new Set(found.map((item: any) => String(item?.id ?? '')));
        const merged = [...found];
        for (const it of loaded) {
          if (!existingIds.has(String((it as any)?.id ?? ''))) {
            merged.push(it);
          }
        }
        stash.set(sessionId, merged);
        found = merged;
      }
    }
  }
  return found && found.length > 0 ? [...found] : [];
}

/**
 * Keep this tab's follow-up queue when `/chat/active` says the session is
 * still running. Clearing it hid queued and steered chrome after a sidebar
 * switch even though `postChatSteer` continued to apply at the next step.
 */
export function queueAfterSessionActiveCheck<T>(input: {
  restored: T[];
  sessionActive: boolean;
}): T[] {
  return input.restored;
}

/**
 * Put queued follow-ups back into the composer.
 * Text stays in queue order and is placed before whatever the user has since typed.
 * Images already in the composer stay first; queued images follow them.
 */
export function mergeQueuedIntoDraft(
  queued: QueuedDraftItem[],
  draftText: string,
  draftImages: ImageData[],
): { text: string; images: ImageData[] } {
  const queuedText = queued
    .map((item) => item.text)
    .filter((text) => text.trim().length > 0)
    .join('\n');
  const text = draftText.trim()
    ? (queuedText ? `${queuedText}\n${draftText}` : draftText)
    : queuedText;
  return {
    text,
    images: [
      ...draftImages,
      ...queued.flatMap((item) => item.images ?? []),
    ],
  };
}
