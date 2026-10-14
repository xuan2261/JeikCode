// Verifier: control tests must PASS; only the two named behavioral RED tests
// may fail. Exit zero means the expected RED was reproduced, NOT that N0 is fixed.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';

const dir = dirname(fileURLToPath(import.meta.url));
const repo = join(dir, '..', '..');
const pinnedBase = '76116587564ff376351f4cb8927cafa346f7af5c';

function git(args) {
  const result = spawnSync('git', args,
    { cwd: repo, encoding: 'utf8', windowsHide: true, timeout: 5000 });
  assert.equal(result.status, 0, `Git read failed for ${args.join(' ')}: ${result.stderr}`);
  return String(result.stdout ?? '').trim();
}

// A standalone diagnostic may be committed on top of the frozen beta.11
// source. Require the exact beta.11 commit as ancestor AND zero committed
// changes outside this diagnostic, instead of pinning HEAD to the pre-commit
// SHA (which would break the verifier as soon as this file is committed).
const currentHead = git(['rev-parse', 'HEAD']);
assert.equal(git(['merge-base', pinnedBase, currentHead]), pinnedBase,
  'The diagnostic is not descended from its verified beta.11 baseline');
const committedDelta = git(['diff', '--name-only', pinnedBase, currentHead]);
const committedPaths = committedDelta ? committedDelta.split(/\r?\n/) : [];
assert.ok(committedPaths.every((path) =>
  path.startsWith('plans/20261014-m05b-n0-reservation-red/')),
  `Non-diagnostic commits changed the pinned baseline: ${committedPaths.join(', ')}`);

function sourceAtPinnedBlob(path, expectedBlob) {
  const blob = git(['hash-object', path]);
  assert.equal(blob, expectedBlob,
    `The product source ${path} changed; re-scout N0 before interpreting RED`);
  return readFileSync(join(repo, path), 'utf8');
}

// These are STATIC source order guards, not a running-daemon reproduction.
// They stop the diagnostic from reporting a mock-only RED against changed
// or no-longer-matching production sources.
const api = sourceAtPinnedBlob('webui/src/api.ts',
  'bd0d75ef223f59d140883d756995fba103d997ca');
const daemon = sourceAtPinnedBlob('crates/jeikcode-daemon/src/lib.rs',
  '34adb5c17afc1f7dd79caec387f4d2cf268c3392');
const chatStart = daemon.indexOf('async fn chat_stream(');
const chatEnd = daemon.indexOf('/// Process a chat request', chatStart);
const processStart = daemon.indexOf('async fn process_chat_request(');
assert.ok(chatStart >= 0 && chatEnd > chatStart && processStart > chatEnd,
  'Cannot locate exact beta.11 chat_stream and process_chat_request boundaries');
const chatStream = daemon.slice(chatStart, chatEnd);
const processRequest = daemon.slice(processStart);

function requireOrder(source, anchors, label) {
  let last = -1;
  for (const anchor of anchors) {
    const next = source.indexOf(anchor, last + 1);
    assert.ok(next > last, `${label}: missing or reordered: ${anchor}`);
    last = next;
  }
}

requireOrder(chatStream, [
  '.admit(req.session_id.as_deref(), req.request_id.as_deref())',
  'tokio::spawn(async move {',
  'StatusCode::ACCEPTED',
  '"status": "admitted"',
], 'chat_stream reservation/spawn/202 source');
requireOrder(processRequest, [
  'ConfigStore::default_store().read()?.config',
  'resolve_chat_provider(&config, req.provider)?',
  'conv.push(user_msg)',
], 'process_chat_request pre-user failure source');
assert.match(api, /return \{ status: 'admitted', operation_id: '', session_id: body\.session_id \|\| '' \};/,
  'Expected admitted-on-malformed-202 fallback no longer exists');

function run(file) {
  const result = spawnSync(process.execPath,
    ['--test', join(dir, file)],
    { cwd: dir, encoding: 'utf8', windowsHide: true, timeout: 20_000 });
  const output = String(result.stdout ?? '') + String(result.stderr ?? '');
  assert.equal(result.error, undefined, `${file} process error: ${result.error}`);
  assert.equal(result.signal, null, `${file} timed out or terminated`);
  assert.doesNotMatch(output, /ERR_MODULE_NOT_FOUND|ERR_UNKNOWN_FILE_EXTENSION|SyntaxError|Cannot find module/,
    `${file} had a module/setup failure, not behavioral RED`);
  return { code: result.status, output };
}

const control = run('observed-api.test.mjs');
assert.equal(control.code, 0, `Observed controls failed:\n${control.output}`);
assert.match(control.output, /^# pass 4\s*$/m);
assert.match(control.output, /^# fail 0\s*$/m);

const red = run('proposed-contract.red.mjs');
const failedNames = [...red.output.matchAll(/^not ok \d+ - (.*)$/gm)]
  .map((match) => match[1]);
assert.equal(red.code, 1, `Contract tests unexpectedly non-RED:\n${red.output}`);
assert.deepEqual(failedNames, [
  'RED N0-01: a bare registry-reservation 202 must not be final user admission',
  'RED N0-04: invalid 202 response body must not invent final admission',
]);
assert.match(red.output, /^# pass 1\s*$/m);
assert.match(red.output, /^# fail 2\s*$/m);
assert.match(red.output,
  /^ok \d+ - CONTROL N0: HTTP 409 is a definite rejection, not ambiguous receipt\s*$/m);
const failureSections = red.output.split(/^not ok \d+ - /m).slice(1);
assert.equal(failureSections.length, 2, 'Exactly two behavioral RED failures are required');
for (const section of failureSections) {
  assert.match(section, /failureType: 'testCodeFailure'/);
  assert.match(section, /code: 'ERR_ASSERTION'/);
  assert.match(section, /expected: 'admitted'/);
  assert.match(section, /actual: 'admitted'/);
  assert.match(section, /operator: 'notStrictEqual'/);
}

console.log('OBSERVED_API=4/4 PASS');
console.log('EXPECTED_CONTRACT_RED=2 ASSERTION FAILURES, 1 CONTROL PASS');
console.log('SOURCE_PROVENANCE=BETA11_BASE_ANCESTRY_AND_DIAGNOSTIC_ONLY_COMMITS');
console.log('NATIVE_ORDER=STATIC_SOURCE_GUARD_PASS; NOT A DAEMON TEST');
console.log('VERDICT=REPRODUCED_WEBUI_API_GAP_ONLY; NATIVE_N0_NOT_EXECUTED');
