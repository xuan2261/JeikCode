import type { SessionMessage } from '../api';

/**
 * A history DELETE uses a 200 + notFound receipt for stale targets.
 * Neither that no-op nor a failed request authorizes an optimistic canvas or
 * cache removal. The caller's view generation also must remain unchanged:
 * a response for session A can arrive after the user switches to B (or A→B→A).
 *
 * Returning false means nothing was changed locally. The caller is responsible
 * for any later authoritative reload of a session successfully changed offscreen.
 */
export async function applyConfirmedHistoryDelete(
  deleteRemote: () => Promise<{ success: boolean; notFound?: boolean }>,
  isCurrentView: () => boolean,
  applyLocal: () => void,
): Promise<boolean> {
  if (!isCurrentView()) return false;
  const receipt = await deleteRemote();
  if (receipt.success !== true || receipt.notFound === true) {
    throw new Error('History deletion was not applied');
  }
  if (!isCurrentView()) return false;
  applyLocal();
  return true;
}

/**
 * A PATCH acknowledgement can arrive after the user switches sessions (even
 * A→B→A). It never authorizes mutation of a different/current view. HTTP
 * failures already reject in the API, while a malformed/unsuccessful 200 must
 * not write into the canvas or cache.
 *
 * A persisted acknowledgement received offscreen cannot project onto the
 * newer view or its caches. Authoritative source-session refresh across
 * A→B→A and multi-client writes needs a separate revision/GET contract.
 */
export interface HistoryPatchReceipt {
  success: boolean;
  notFound?: boolean;
  source_index?: number;
  revision?: number;
}

export async function applyConfirmedHistoryPatch(
  patchRemote: () => Promise<HistoryPatchReceipt | null>,
  isCurrentView: () => boolean,
  applyLocal: (receipt: HistoryPatchReceipt) => boolean,
): Promise<boolean> {
  if (!isCurrentView()) return false;
  const receipt = await patchRemote();
  if (!receipt || receipt.success !== true || receipt.notFound === true) {
    throw new Error('History patch was not applied');
  }
  if (!isCurrentView()) return false;
  return applyLocal(receipt);
}

/** Resolve one original user row against the live transcript, not a captured
 * render index. This is a pure/synchronous snapshot builder: the same returned
 * array must be installed in messagesRef, the canvas and both cache layers.
 *
 * Even with a stable ID, a new object may be an SSE-first update from this
 * PATCH or a newer peer PATCH. Never overwrite that replacement with a stale
 * ACK. Refuse ambiguous/reused indexes and non-user rows.
 */
export function patchUserHistoryBySourceIndex<
  T extends { sourceIndex?: number; role: string; id?: string }
>(
  messages: readonly T[],
  sourceIndex: number,
  expectedUser: T | undefined,
  update: (message: T) => T,
): T[] | null {
  if (!Number.isSafeInteger(sourceIndex) || sourceIndex < 0
    || !expectedUser || expectedUser.role !== 'user'
    || expectedUser.sourceIndex !== sourceIndex) return null;
  let position = -1;
  for (let i = 0; i < messages.length; i += 1) {
    const current = messages[i];
    if (current.sourceIndex !== sourceIndex) continue;
    // Any second row with this raw index is ambiguous, including a non-user.
    if (position !== -1 || current.role !== 'user' || current !== expectedUser) return null;
    position = i;
  }
  if (position < 0) return null;
  const next = messages.slice();
  next[position] = update(messages[position]);
  return next;
}

/**
 * The daemon can broadcast session_mutation before the initiating DELETE HTTP
 * response resolves. If SSE already removed the assistant, a captured render
 * index now points at the following row. Only remove the original source row;
 * never fall back to the old display position or remove an ambiguous match.
 */
export function removeAssistantHistoryBySourceIndex<T extends { sourceIndex?: number; role: string; id?: string }>(
  messages: readonly T[],
  sourceIndex: number | undefined,
  expectedMessage: T | undefined,
): T[] | null {
  if (sourceIndex == null || !expectedMessage || expectedMessage.role !== 'assistant') return null;
  let found = -1;
  for (let i = 0; i < messages.length; i += 1) {
    if (messages[i]?.sourceIndex === sourceIndex && messages[i]?.role === 'assistant') {
      if (found !== -1) return null;
      // After SSE or canonical reload, a *different* assistant may inherit an
      // old source index. Stable message IDs win; legacy ID-less rows must
      // still be the original in-memory object, never a new same-index row.
      if (expectedMessage.id != null
        ? messages[i]?.id !== expectedMessage.id
        : messages[i] !== expectedMessage) return null;
      found = i;
    }
  }
  if (found === -1) return null;
  return [...messages.slice(0, found), ...messages.slice(found + 1)];
}

const INTERNAL_USER_PREFIXES = [
  '<system-reminder>',
  'You made code edits but have not verified them.',
  'Output limit hit — your last response was cut off',
  'Output limit hit. If the task is already complete',
  '[PLAN MODE',
  '[Context was compressed',
  '[Additional context from user]:',
  '[SYNTAX CHECK:',
  '[DEV SERVER ERROR',
  '[Auto-read from error:',
  '[Images returned by the tool calls above',
];

export function isInternalHistoryUserMessage(text: string, synthetic?: boolean): boolean {
  if (synthetic === true) return true;
  const trimmed = text.trimStart();
  return INTERNAL_USER_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/** Marker written by the daemon ahead of a mid-turn steer note. */
const STEER_MARKER = '[jeikcode-steer]';

/** UI-only: the steer note is for the model. The bubble keeps the user's words. */
export function stripSteerEnvelopeForDisplay(text: string): string {
  const match = text.match(/<user-query>\s*([\s\S]*?)\s*<\/user-query>/i);
  if (match) {
    const inner = match[1].trim();
    if (inner === '(The user attached image(s))' || inner === '（用户附加了新的图片）') {
      return '';
    }
    return inner;
  }
  let clean = text;
  const idx = clean.indexOf(STEER_MARKER);
  if (idx >= 0) {
    clean = clean.slice(0, idx).trim();
  }
  clean = clean.replace(/<\/?user-query>/gi, '').trim();
  if (clean === '(The user attached image(s))' || clean === '（用户附加了新的图片）') {
    return '';
  }
  return clean;
}

/** UI-only: drop appended `<system-reminder>` tails. Protocol context keeps them. */
export function stripInjectedRemindersForDisplay(text: string): string {
  const open = '<system-reminder>';
  const close = '</system-reminder>';
  let rest = text;
  let out = '';
  while (true) {
    const start = rest.indexOf(open);
    if (start < 0) {
      out += rest;
      break;
    }
    out += rest.slice(0, start);
    const end = rest.indexOf(close, start + open.length);
    if (end < 0) {
      out += rest.slice(start);
      break;
    }
    rest = rest.slice(end + close.length);
  }
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function isInternalHistoryAssistantMessage(msg: SessionMessage): boolean {
  const internalOrigin = msg.internal_origin ?? msg.internalOrigin;
  return msg.role === 'assistant'
    && internalOrigin === 'verify_cadence'
    && !(msg.tool_calls?.length);
}

export function sessionMessagesToMarkdownLines(
  messages: SessionMessage[],
  title: string,
): string[] {
  const lines: string[] = [`# ${title}`, ''];
  for (const msg of messages) {
    if (msg.role === 'system') continue;
    if (msg.role === 'user') {
      if (isInternalHistoryUserMessage(msg.content || '', msg.synthetic)) continue;
      const visible = stripSteerEnvelopeForDisplay(stripInjectedRemindersForDisplay(msg.content || ''));
      if (!visible) continue;
      lines.push('## User', '', visible, '');
    } else if (msg.role === 'assistant') {
      if (isInternalHistoryAssistantMessage(msg)) continue;
      lines.push('## Assistant', '');
      if (msg.content) {
        lines.push(msg.content, '');
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const tc of msg.tool_calls) {
          lines.push(`### Tool: ${tc.name}`, '');
          if (tc.arguments) {
            lines.push('```json', tc.arguments, '```', '');
          }
        }
      }
    } else if (msg.role === 'tool' && msg.tool_result) {
      const tr = msg.tool_result;
      lines.push(`### Tool Result (${tr.success ? '✓' : '✗'})`, '');
      if (tr.summary) {
        lines.push(tr.summary, '');
      }
    }
  }
  return lines;
}
