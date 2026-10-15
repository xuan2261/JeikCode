import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  isAbsoluteRepairPath, makeRepairExportRequest, parseRepairCapability, parseRepairExport,
  parseRepairInfo, parseRepairPreview, REPAIR_PACKET_FILES, repairPacketSummary,
} from './repairEvidence.ts';
import {
  exportRepairPacket, getRepairCapability, getRepairInfo, getRepairPreview,
  listDir, listLocalRepairDir,
} from '../api.ts';

const source = '/work/JeikCode';
const run = '/work/repair-run';
const digest = 'a'.repeat(64);
const commit = 'b'.repeat(40);
const tree = 'c'.repeat(40);

function sourceInfo() {
  return {
    source_root: source,
    source: { repository: 'https://github.com/jeikl/JeikCode', commit, tree, dirty: false },
    observer: {
      schema_version: 1,
      repair_protocol: 1,
      skill_shell_expansion_opt_out: true,
      package_name: 'jeikcode',
      package_version: 'test',
      target: 'test-target',
      source_commit: null,
      source_tree: null,
      source_dirty: null,
      source_artifact_relation: 'unknown',
    },
    observer_binary_sha256: null,
    installed_runtime_match: 'unknown',
    note: 'Build metadata is self-reported.',
  };
}

function previewResponse() {
  return {
    source_root: source,
    run_root: run,
    packet: {
      schema_version: 1,
      sha256: digest,
      files: {
        'repair.json': JSON.stringify({
          run_id: 'run-1', base_commit: commit, base_tree: tree, candidate_status: 'proposed',
        }) + '\n',
        'source.diff': 'diff --git a/file b/file\r\n+Tiếng Việt <script>\u001b[31m\n',
        'reproduction.md': 'Reproduce exactly.\r\n',
        'verification.json': JSON.stringify({
          baseline: { status: 'failed' }, candidate: { status: 'checks_passed' },
          installed_runtime: 'not_tested',
        }),
        'report.md': 'Quoted text: "\\n" and trailing space \n',
      },
    },
  };
}

test('repair capability requires the supported protocol and a concrete status', () => {
  assert.equal(parseRepairCapability({ status: 'available', protocol: 1, reason: null }).status, 'available');
  assert.equal(parseRepairCapability({ status: 'unavailable', protocol: 1, reason: 'no backend' }).status, 'unavailable');
  for (const value of [
    { status: 'available', protocol: 2, reason: null },
    { status: true, protocol: 1, reason: null },
    { status: 'available', protocol: 1 },
  ]) assert.throws(() => parseRepairCapability(value));
});

test('source identity requires a full revision while unknown build fields remain unknown', () => {
  const value = parseRepairInfo(sourceInfo());
  assert.equal(value.source.commit, commit);
  assert.equal(value.source.dirty, false);
  assert.equal(value.observer.source_dirty, null);
  assert.equal(value.installed_runtime_match, 'unknown');
  assert.throws(() => parseRepairInfo({ ...sourceInfo(), source: { ...sourceInfo().source, commit: 'b123456' } }));
  assert.throws(() => parseRepairInfo({ ...sourceInfo(), installed_runtime_match: 'matched' }));
});

test('trusted Windows canonical disk responses normalize without admitting UNC or device paths', () => {
  const sourceRoot = 'C:\\Work\\JeikCode';
  const runRoot = 'D:\\Repair\\run-1';
  const exported = 'E:\\Repair\\packet';
  const canonical = (path: string) => '\\\\?\\' + path;
  const info = parseRepairInfo({ ...sourceInfo(), source_root: canonical(sourceRoot) });
  assert.equal(info.source_root, sourceRoot);

  const rawPreview = {
    ...previewResponse(),
    source_root: canonical(sourceRoot),
    run_root: canonical(runRoot),
  };
  const preview = parseRepairPreview(rawPreview, info.source_root);
  assert.equal(preview.source_root, sourceRoot);
  assert.equal(preview.run_root, runRoot);
  assert.equal(preview.packet.sha256, digest);
  assert.deepEqual(makeRepairExportRequest(preview, digest, exported), {
    source: sourceRoot, run: runRoot, accept: digest, output: exported,
  });
  assert.equal(parseRepairExport({
    status: 'exported_local', output: canonical(exported), sha256: digest,
  }, digest).output, exported);

  for (const unsafe of [
    '\\\\?\\UNC\\server\\share\\repair', '\\\\.\\pipe\\repair',
    '\\\\?\\GLOBALROOT\\Device\\HarddiskVolumeShadowCopy1\\repair',
  ]) {
    assert.throws(() => parseRepairInfo({ ...sourceInfo(), source_root: unsafe }));
    assert.throws(() => parseRepairPreview({
      ...rawPreview, run_root: unsafe,
    }, sourceRoot));
    assert.throws(() => parseRepairExport({
      status: 'exported_local', output: unsafe, sha256: digest,
    }, digest));
  }
  // Raw user input stays disallowed even though equivalent host-returned
  // canonical disk paths are accepted solely after a trusted response.
  assert.equal(isAbsoluteRepairPath(canonical(sourceRoot)), false);
});

test('preview retains all five exact original strings including CRLF, Unicode and controls', () => {
  const original = previewResponse();
  const parsed = parseRepairPreview(original, source);
  for (const file of REPAIR_PACKET_FILES) assert.equal(parsed.packet.files[file], original.packet.files[file]);
  assert.equal(parsed.packet.sha256, digest);
  assert.equal(parsed.run_root, run);
  assert.equal(parsed.packet.files['source.diff'].includes('\r\n'), true);
  assert.equal(parsed.packet.files['source.diff'].includes('\u001b'), true);
});

test('preview rejects a different source root, a relative run or an incomplete digest', () => {
  assert.throws(() => parseRepairPreview(previewResponse(), '/work/another-source'));
  assert.throws(() => parseRepairPreview({ ...previewResponse(), run_root: '../run' }, source));
  const response = previewResponse();
  response.packet.sha256 = 'a123456';
  assert.throws(() => parseRepairPreview(response, source));
});

test('preview rejects missing, additional, inherited and non-string packet files', () => {
  const original = previewResponse();
  const base = original.packet.files;
  const cases: unknown[] = [
    { ...base, '.env': 'secret' },
    Object.fromEntries(Object.entries(base).filter(([name]) => name !== 'report.md')),
    { ...base, 'report.md': null },
    Object.create(base),
  ];
  for (const files of cases) {
    assert.throws(() => parseRepairPreview({
      ...original, packet: { ...original.packet, files },
    }, source));
  }
});

test('frozen base revision remains separate from a later inspected source revision', () => {
  const info = sourceInfo();
  info.source.commit = 'd'.repeat(40);
  const preview = parseRepairPreview(previewResponse(), source);
  const summary = repairPacketSummary(preview.packet);
  assert.equal(parseRepairInfo(info).source.commit, 'd'.repeat(40));
  assert.equal(summary.baseCommit, commit);
  assert.equal(summary.baseline, 'failed');
  assert.equal(summary.candidate, 'checks_passed');
  assert.equal(summary.installedRuntime, 'not_tested');
});

test('unknown or malformed recorded metadata never produces a successful check label', () => {
  const original = previewResponse();
  original.packet.files['repair.json'] = '{invalid JSON';
  original.packet.files['verification.json'] = JSON.stringify({
    baseline: { status: true }, candidate: { status: 'PASS' }, installed_runtime: 'checks_passed',
  });
  const parsed = parseRepairPreview(original, source);
  assert.deepEqual(repairPacketSummary(parsed.packet), {
    runId: null, baseCommit: null, baseTree: null, candidateStatus: 'unknown',
    baseline: 'unknown', candidate: 'unknown', installedRuntime: 'unknown',
  });
  assert.equal(parsed.packet.files['repair.json'], '{invalid JSON');
});

test('all native probe gap statuses remain distinct in the summary', () => {
  for (const status of ['not_run', 'failed', 'blocked', 'timeout', 'stale_or_invalid']) {
    const value = previewResponse();
    value.packet.files['verification.json'] = JSON.stringify({ baseline: { status }, candidate: { status } });
    const summary = repairPacketSummary(parseRepairPreview(value, source).packet);
    assert.equal(summary.baseline, status);
    assert.equal(summary.candidate, status);
  }
});

test('export requires acknowledgment of exactly this preview and uses its bound canonical paths', () => {
  const preview = parseRepairPreview(previewResponse(), source);
  assert.throws(() => makeRepairExportRequest(preview, null, '/work/export'));
  assert.throws(() => makeRepairExportRequest(preview, 'd'.repeat(64), '/work/export'));
  assert.throws(() => makeRepairExportRequest(preview, digest, '../export'));
  assert.deepEqual(makeRepairExportRequest(preview, digest, '/work/new export'), {
    source, run, accept: digest, output: '/work/new export',
  });
});

test('explicit absolute host paths accept supported forms and reject drive-relative input', () => {
  for (const path of ['/work/source', 'C:\\Work\\JeikCode', 'D:/Work/JeikCode']) {
    assert.equal(isAbsoluteRepairPath(path), true, path);
  }
  // Windows UNC, device and extended-length namespaces must not reach any
  // repair picker filesystem lookup (which can otherwise contact SMB hosts).
  for (const path of [
    '', '.', '../repo', '~', 'C:repo', 'C:', '/work/\0source',
    '\\\\server\\share\\repo', '//server/share/repo',
    '\\\\?\\UNC\\server\\share', '\\\\?\\C:\\Work\\JeikCode',
    '\\\\.\\pipe\\repair', '//?/UNC/server/share', '/?/UNC/server/share',
  ]) {
    assert.equal(isAbsoluteRepairPath(path), false, path);
  }
});

test('local-only repair picker blocks network/device paths before issuing HTTP requests', async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return new Response(JSON.stringify({ path: '/local/home', dirs: [] }), { status: 200 });
  }) as typeof fetch;
  try {
    for (const path of [
      '\\\\server\\share\\repo', '//server/share/repo', '\\\\?\\C:\\Work',
    '\\\\.\\pipe\\repair', '//?/UNC/server/share', '../relative', '~',
    ]) {
      await assert.rejects(() => listLocalRepairDir(path), /local absolute directory/);
    }
    assert.deepEqual(requests, [], 'rejected paths must not reach generic /fs/list');
    // An explicit absolute local path is required before any listing.
    const local = await listLocalRepairDir('/local/home');
    assert.equal(local.path, '/local/home');
    assert.deepEqual(requests, ['/fs/list?path=%2Flocal%2Fhome']);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('repair picker refuses a host listing redirected to a network or device namespace', async () => {
  const previousFetch = globalThis.fetch;
  const requests: string[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    requests.push(String(input));
    return new Response(JSON.stringify({
      path: '\\\\?\\UNC\\server.invalid\\share\\repo', dirs: [],
    }), { status: 200 });
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => listLocalRepairDir('/local/source'),
      /nonlocal directory/,
    );
    assert.deepEqual(requests, ['/fs/list?path=%2Flocal%2Fsource']);
  } finally {
    globalThis.fetch = previousFetch;
  }
});

test('export response must confirm the accepted digest and an absolute host output', () => {
  assert.equal(parseRepairExport({ status: 'exported_local', output: '/work/export', sha256: digest }, digest).sha256, digest);
  assert.throws(() => parseRepairExport({ status: 'exported_local', output: '/work/export', sha256: 'e'.repeat(64) }, digest));
  assert.throws(() => parseRepairExport({ status: 'exported_local', output: 'relative', sha256: digest }, digest));
});

test('repair HTTP calls preserve authentication, explicit request fields and exact preview digest', async () => {
  const previousFetch = globalThis.fetch;
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  const calls: { input: string; init: RequestInit }[] = [];
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true, value: { getItem: () => 'repair-test-token' },
  });
  globalThis.fetch = async (input, init = {}) => {
    calls.push({ input: String(input), init });
    let result: unknown;
    if (input === '/repair/capability') result = { status: 'available', protocol: 1, reason: null };
    else if (input === '/repair/info') result = sourceInfo();
    else if (input === '/repair/preview') result = previewResponse();
    else result = { status: 'exported_local', output: '/work/export', sha256: digest };
    return new Response(JSON.stringify(result), { status: 200 });
  };
  try {
    await getRepairCapability();
    await getRepairInfo(source);
    await getRepairPreview(source, run);
    await exportRepairPacket({ source, run, accept: digest, output: '/work/export' });
    assert.deepEqual(calls.map((call) => call.input), [
      '/repair/capability', '/repair/info', '/repair/preview', '/repair/export',
    ]);
    for (const call of calls) {
      assert.equal(call.init.credentials, 'include');
      assert.equal(new Headers(call.init.headers).get('Authorization'), 'Bearer repair-test-token');
      assert.equal(call.init.cache, 'no-store');
    }
    assert.deepEqual(JSON.parse(String(calls[2].init.body)), { source, run });
    assert.deepEqual(JSON.parse(String(calls[3].init.body)), { source, run, accept: digest, output: '/work/export' });
  } finally {
    globalThis.fetch = previousFetch;
    if (previousStorage) Object.defineProperty(globalThis, 'sessionStorage', previousStorage);
    else Reflect.deleteProperty(globalThis, 'sessionStorage');
  }
});

test('directory and repair errors do not become successful empty selections or previews', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: false, error: 'Explicit host access is required', code: 'unauthorized',
  }), { status: 401 });
  try {
    await assert.rejects(listDir(source), /Explicit host access is required/);
    await assert.rejects(getRepairPreview(source, run), /Explicit host access is required/);
  } finally {
    globalThis.fetch = previousFetch;
  }
});
