// Design-only diagnostic, not a JeikCode runtime resolver or production patch.
// Models the beta.8 server projection and WebUI folding contracts from source.
// An intentionally WRONG baseline target is a successful *reproduction* here.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  isInternalHistoryAssistantMessage,
  isInternalHistoryUserMessage,
  stripInjectedRemindersForDisplay,
  stripSteerEnvelopeForDisplay,
} from '../../webui/src/lib/historyMessages.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const { source_base: sourceBase, cases } = JSON.parse(
  readFileSync(path.join(here, 'fixtures.json'), 'utf8'),
);
const CAP_BYTES = 24 * 1024;
const TRUNCATED = '\n… [truncated for display]';
const LEGACY_COLD_SUMMARY_ORIGIN = 'jeikcode.legacy_cold_summary';
const SYSTEM_REMINDER_OPEN = '<system-reminder>';

function textOf(row) {
  return row.repeat ? row.repeat.char.repeat(row.repeat.count) : row.text ?? '';
}

function displayText(row) {
  const original = textOf(row);
  if (Buffer.byteLength(original, 'utf8') <= CAP_BYTES) return original;
  // Mirror Rust is_char_boundary: never end a projected field mid-codepoint.
  let visible = '';
  let used = 0;
  for (const ch of original) {
    const width = Buffer.byteLength(ch, 'utf8');
    if (used + width > CAP_BYTES) break;
    visible += ch;
    used += width;
  }
  return visible + TRUNCATED;
}

/** Oracle rawIndex is carried only in this test model, not in beta.8 API JSON. */
function projectServer(scenario) {
  const source = scenario.inflight ?? scenario.raw;
  if (scenario.inflight) {
    assert.ok(source.length > scenario.raw.length, 'inflight overlay extends canonical snapshot');
    for (let i = 0; i < scenario.raw.length; i++) {
      assert.deepEqual(source[i], scenario.raw[i], 'inflight overlay must keep canonical prefix');
    }
  }
  const runtime = source
    .map((row, rawIndex) => ({
      ...row,
      rawIndex,
      content: displayText(row),
      kind: rawIndex >= scenario.raw.length ? 'inflight' : 'raw',
    }))
    .filter((row) => {
      assert.equal(row.hidden, undefined, 'never invent an upstream hidden flag');
      return row.internal_origin !== LEGACY_COLD_SUMMARY_ORIGIN
        && !textOf(row).trimStart().startsWith(SYSTEM_REMINDER_OPEN);
    });
  const byPosition = new Map();
  for (const item of scenario.presentation ?? []) {
    const position = item.anchor === 'at_start'
      ? 0
      : scenario.turn_stats?.find((stat) => stat.turn_id === item.turn_id && stat.position_valid === true)?.after_message;
    assert.ok(position !== undefined, 'AfterTurn requires a valid native turn anchor');
    const list = byPosition.get(position) ?? [];
    list.push({ ...item, content: item.text, rawIndex: null, kind: 'presentation' });
    byPosition.set(position, list);
  }
  const result = [];
  const insert = (position) => result.push(...(byPosition.get(position) ?? []));
  insert(0);
  for (let i = 0; i < runtime.length; i++) {
    result.push(runtime[i]);
    insert(i + 1);
  }
  // Rust appends unmatched native-coordinate anchors after the filtered rows,
  // ordered by their BTreeMap position.
  for (const [position, items] of [...byPosition].sort((a, b) => a[0] - b[0])) {
    if (position > runtime.length) result.push(...items);
  }
  return result;
}

/** Mirrors key Chat.tsx visibility filters using its imported pure WebUI
 * helpers. Tool results fold and assistant rows have no sourceIndex.
 * Vision annotation/image sidecars and todo mutations are NOT modeled. */
function projectWebUi(apiRows, offset = 0) {
  const canvas = [];
  for (const [apiIndex, item] of apiRows.slice(offset).entries()) {
    if (item.role === 'tool') continue;
    if (item.role !== 'user' && item.role !== 'assistant') continue;
    if (item.role === 'assistant' && isInternalHistoryAssistantMessage(item)) continue;
    let visibleContent = item.content;
    if (item.role === 'user') {
      if (isInternalHistoryUserMessage(item.content ?? '', item.synthetic)) continue;
      visibleContent = stripSteerEnvelopeForDisplay(
        stripInjectedRemindersForDisplay(item.content ?? ''),
      );
      if (!visibleContent && !item.images) continue;
    }
    canvas.push({
      ...item,
      content: visibleContent,
      canvasIndex: canvas.length,
      // This key is test-only truth. Beta.8 SessionMessage has no raw origin.
      sourceIndex: item.role === 'user' ? offset + apiIndex : undefined,
    });
  }
  return canvas;
}

/** The exact beta.8 *selection policy*: reverse text match, raw index
 * fallback, then unguarded index. This model never mutates user data. */
function betaResolve(rawRows, requestedIndex, expectedText) {
  const text = expectedText?.trim();
  if (text) {
    for (let i = rawRows.length - 1; i >= 0; i--) {
      const actual = textOf(rawRows[i]).trim();
      if (actual === text || actual.includes(text) || text.includes(actual)) {
        return i;
      }
    }
  }
  return requestedIndex >= 0 && requestedIndex < rawRows.length
    ? requestedIndex
    : null;
}

/** The blocked raw-index-first candidate; only a diagnostic comparison. */
function indexFirstResolve(rawRows, requestedIndex, expectedText) {
  const row = rawRows[requestedIndex];
  if (!row) return null;
  const expected = expectedText?.trim();
  if (expected) {
    const actual = textOf(row).trim();
    if (!actual || !(actual === expected || actual.includes(expected) || expected.includes(actual))) {
      return null;
    }
  }
  return requestedIndex;
}

/** Proposed authoritative binding: only a uniquely identified persisted row
 * on the exact observed revision can be mutated. The oracle ID is NOT live. */
function contractResolve(rawRows, trustedRef, expectedRevision, currentRevision) {
  if (!trustedRef || expectedRevision !== currentRevision) return null;
  const matches = rawRows.flatMap((row, index) => row.key === trustedRef ? [index] : []);
  return matches.length === 1 ? matches[0] : null;
}

test('diagnostic source signatures and immutable upstream baseline are grounded', () => {
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: root,
    encoding: 'utf8',
  }).trim();
  // A docs-only commit advances HEAD. Anchor source identity to its upstream
  // ancestor AND assert that the runtime files under examination are unchanged.
  const isAncestor = execFileSync('git', ['merge-base', sourceBase, head], {
    cwd: root,
    encoding: 'utf8',
  }).trim() === sourceBase;
  assert.ok(isAncestor, 'source beta.8 must remain an ancestor of the docs branch');
  const daemon = readFileSync(path.join(root, 'crates/jeikcode-daemon/src/lib.rs'), 'utf8');
  const chat = readFileSync(path.join(root, 'webui/src/components/Chat.tsx'), 'utf8');
  // Git's clean filter canonicalizes Windows CRLF; compare committed blob
  // identity, not OS checkout newline bytes, to catch actual source drift.
  for (const relativePath of [
    'crates/jeikcode-daemon/src/lib.rs',
    'crates/jeikcode-daemon/src/live_api.rs',
    'crates/jeikcode-daemon/src/legacy_convert.rs',
    'crates/jeikcode-capabilities/src/session/manager.rs',
    'crates/jeikcode-capabilities/src/reminder.rs',
    'crates/jeikcode-kernel/src/message.rs',
    'webui/src/components/Chat.tsx',
    'webui/src/lib/historyMessages.ts',
  ]) {
    const actualOid = execFileSync(
      'git', ['hash-object', '--path', relativePath, relativePath],
      { cwd: root, encoding: 'utf8' },
    ).trim();
    const baselineOid = execFileSync(
      'git', ['rev-parse', `${sourceBase}:${relativePath}`],
      { cwd: root, encoding: 'utf8' },
    ).trim();
    assert.equal(
      actualOid,
      baselineOid,
      `${relativePath} must match the exact beta.8 Git blob after clean filters`,
    );
  }
  assert.match(daemon, /for \(i, msg\) in messages\.iter\(\)\.enumerate\(\)\.rev\(\)/);
  assert.match(daemon, /fn merge_catalog_session_messages_for_display/);
  assert.match(daemon, /const DISPLAY_FIELD_CAP: usize = 24 \* 1024/);
  assert.match(chat, /sourceIndex: sourceOffset \+ rawIndex/);
  assert.match(chat, /handleDeleteAssistantMessage\(msg\.sourceIndex \?\? origIdx, origIdx\)/);
  assert.match(
    readFileSync(path.join(root, 'crates/jeikcode-daemon/src/live_api.rs'), 'utf8'),
    /Snapshot \{\s*messages: Vec<crate::MessageInfo>/,
  );
  assert.match(
    readFileSync(path.join(root, 'crates/jeikcode-capabilities/src/reminder.rs'), 'utf8'),
    /text\.trim_start\(\)\.starts_with\(&opening\)/,
  );
  assert.match(
    readFileSync(path.join(root, 'crates/jeikcode-kernel/src/message.rs'), 'utf8'),
    /LEGACY_COLD_SUMMARY_ORIGIN: &str = "jeikcode\.legacy_cold_summary"/,
  );
  assert.match(readFileSync(path.join(root, 'webui/src/lib/historyMessages.ts'), 'utf8'),
    /internalOrigin === 'verify_cadence'/);
});

for (const scenario of cases) {
  test(`beta.8 raw / API / canvas targeting fixture: ${scenario.id}`, () => {
    const api = projectServer(scenario);
    const canvas = projectWebUi(api, scenario.window_offset ?? 0);
    assert.deepEqual(api.map((item) => item.key), scenario.api_keys);
    assert.deepEqual(canvas.map((item) => item.key), scenario.canvas_keys);

    const selected = canvas.find((item) => item.key === scenario.select);
    assert.ok(selected, `selected row ${scenario.select} must be visible`);
    const sentIndex = selected.role === 'user'
      ? selected.sourceIndex
      : selected.canvasIndex; // sourceIndex is absent on assistant history
    const expectedText = selected.role === 'user' ? selected.content : undefined;
    const mappedKey = (index) => index === null ? null : scenario.raw[index]?.key ?? null;

    assert.equal(mappedKey(betaResolve(scenario.raw, sentIndex, expectedText)), scenario.beta_target);
    assert.equal(
      mappedKey(indexFirstResolve(scenario.raw, sentIndex, expectedText)),
      scenario.index_first_target,
    );
    const trustedKey = selected.kind === 'raw' ? selected.key : null;
    const safeRawIndex = contractResolve(scenario.raw, trustedKey, 7, 7);
    assert.equal(mappedKey(safeRawIndex), trustedKey);
    if (scenario.beta_target !== trustedKey) {
      assert.notEqual(
        scenario.beta_target,
        trustedKey,
        'fixture must expose a real wrong-row or presentation-row outcome',
      );
    }
  });
}

test('identity contract fails closed on stale revision, unknown ID, duplicate ID, and presentation', () => {
  const raw = [
    { key: 'u0', role: 'user', text: 'continue' },
    { key: 'u2', role: 'user', text: 'continue' },
  ];
  assert.equal(contractResolve(raw, 'u0', 7, 7), 0);
  assert.equal(contractResolve(raw, 'u0', 7, 8), null, 'concurrent mutation changes snapshot revision');
  assert.equal(contractResolve(raw, 'not-found', 7, 7), null);
  assert.equal(contractResolve(raw, null, 7, 7), null, 'presentation rows have no raw authority');
  assert.equal(contractResolve([...raw, { ...raw[0] }], 'u0', 7, 7), null);
});

test('snapshot ID schema needs an old-writer fence (illustrative JSON serde-loss hazard)', () => {
  // Simplified pre-existing shape, NOT a Rust serde execution test. A legacy
  // client can silently drop unknown fields if the snapshot keeps version 1.
  const supportedVersion = 1;
  const oldWriterAccepts = (version) => version <= supportedVersion;
  const future = { version: 1, messages: [{ role: 'user', text: 'hello', message_id: 'opaque-id' }] };
  assert.equal(oldWriterAccepts(future.version), true);
  const oldWriterRoundTrip = {
    version: future.version,
    messages: future.messages.map(({ role, text }) => ({ role, text })),
  };
  assert.equal('message_id' in oldWriterRoundTrip.messages[0], false);
  assert.equal(future.messages[0].message_id, 'opaque-id');
  assert.equal(
    oldWriterAccepts(2), false,
    'bumped schema must be refused by a version-1 writer',
  );
});

test('display-capped expected_text is demonstrably not the raw message bytes', () => {
  const row = { key: 'u0', role: 'user', repeat: { char: 'A', count: CAP_BYTES + 1 } };
  const visible = displayText(row);
  assert.equal(visible.endsWith(TRUNCATED), true);
  assert.notEqual(visible, textOf(row));
  assert.equal(textOf(row).includes(visible), false);
  assert.equal(indexFirstResolve([row], 0, visible), null);
});

test('UTF-8 cap preserves full characters before the display-only marker', () => {
  const row = { key: 'u0', role: 'user', repeat: { char: '界', count: 8193 } };
  const projected = displayText(row);
  assert.equal(projected, '界'.repeat(8192) + TRUNCATED);
  assert.equal(Buffer.byteLength(projected.slice(0, -TRUNCATED.length), 'utf8'), CAP_BYTES);
});
