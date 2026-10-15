/** Typed presentation boundary for the native, local-only repair workflow. */
export const REPAIR_PACKET_FILES = [
  'repair.json',
  'source.diff',
  'reproduction.md',
  'verification.json',
  'report.md',
] as const;

export type RepairPacketFile = typeof REPAIR_PACKET_FILES[number];

export interface RepairCapability {
  status: 'available' | 'unavailable';
  protocol: 1;
  reason: string | null;
}

export interface RepairBuildInfo {
  schema_version: number;
  repair_protocol: number;
  skill_shell_expansion_opt_out: boolean;
  package_name: string;
  package_version: string;
  target: string;
  source_commit: string | null;
  source_tree: string | null;
  source_dirty: boolean | null;
  source_artifact_relation: string;
}

export interface RepairInfoResponse {
  source_root: string;
  source: { repository: string; commit: string; tree: string; dirty: boolean };
  observer: RepairBuildInfo;
  observer_binary_sha256: string | null;
  installed_runtime_match: 'unknown';
  note: string;
}

export interface FrozenRepairPacket {
  schema_version: 1;
  sha256: string;
  files: Record<RepairPacketFile, string>;
}

export interface RepairPreviewResponse {
  source_root: string;
  run_root: string;
  packet: FrozenRepairPacket;
}

export interface RepairExportResponse {
  status: 'exported_local';
  output: string;
  sha256: string;
}

export type RepairCheckStatus =
  | 'checks_passed' | 'not_run' | 'failed' | 'blocked'
  | 'timeout' | 'stale_or_invalid' | 'unknown';

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

const sha256 = /^[0-9a-f]{64}$/;
const gitObject = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/** Repair paths must be absolute and local, not Windows network/device paths. */
export function isAbsoluteRepairPath(path: string): boolean {
  // Reject UNC, forward-slash UNC and verbatim/device namespaces before any
  // repair picker can send a filesystem request (which could contact SMB).
  if (/[\x00-\x1f\x7f]/.test(path) ||
      path.startsWith('\\\\') || path.startsWith('//') || path.startsWith('/?/')) {
    return false;
  }
  return (
    path.startsWith('/') ||
    /^[A-Za-z]:[\\/]/.test(path)
  );
}

/** Normalize only host-returned canonical Windows *disk* paths. Rust's
 * canonicalize() may return `\\?\C:\...` on Windows, which is valid local
 * output but is deliberately not an accepted user/picker input. Never remove
 * UNC, device or other namespace prefixes to manufacture a local path.
 */
function trustedRepairResponsePath(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const localDisk = /^\\\\\?\\([A-Za-z]:[\\/].*)$/.exec(value);
  const path = localDisk ? localDisk[1] : value;
  return isAbsoluteRepairPath(path) ? path : null;
}

export function parseRepairCapability(value: unknown): RepairCapability {
  if (!record(value) || value.protocol !== 1 ||
      (value.status !== 'available' && value.status !== 'unavailable') ||
      !nullableString(value.reason)) {
    throw new Error('Unsupported repair capability response');
  }
  return value as unknown as RepairCapability;
}

export function parseRepairInfo(value: unknown): RepairInfoResponse {
  const sourceRoot = record(value) ? trustedRepairResponsePath(value.source_root) : null;
  if (!record(value) || sourceRoot === null || !record(value.source) ||
      typeof value.source.repository !== 'string' ||
      typeof value.source.commit !== 'string' || !gitObject.test(value.source.commit) ||
      typeof value.source.tree !== 'string' || !gitObject.test(value.source.tree) ||
      typeof value.source.dirty !== 'boolean' || !record(value.observer) ||
      value.installed_runtime_match !== 'unknown' || typeof value.note !== 'string' ||
      !(value.observer_binary_sha256 === null ||
        (typeof value.observer_binary_sha256 === 'string' && sha256.test(value.observer_binary_sha256)))) {
    throw new Error('Invalid repair source identity response');
  }
  const build = value.observer;
  if (build.schema_version !== 1 || typeof build.repair_protocol !== 'number' || !Number.isInteger(build.repair_protocol) ||
      typeof build.skill_shell_expansion_opt_out !== 'boolean' ||
      !['package_name', 'package_version', 'target', 'source_artifact_relation']
        .every((key) => typeof build[key] === 'string') ||
      !nullableString(build.source_commit) || !nullableString(build.source_tree) ||
      !(build.source_dirty === null || typeof build.source_dirty === 'boolean')) {
    throw new Error('Invalid repair build observation response');
  }
  return { ...value, source_root: sourceRoot } as unknown as RepairInfoResponse;
}

export function parseRepairPreview(value: unknown, expectedSource: string): RepairPreviewResponse {
  const sourceRoot = record(value) ? trustedRepairResponsePath(value.source_root) : null;
  const runRoot = record(value) ? trustedRepairResponsePath(value.run_root) : null;
  if (!record(value) || sourceRoot !== expectedSource ||
      runRoot === null ||
      !record(value.packet) || value.packet.schema_version !== 1 ||
      typeof value.packet.sha256 !== 'string' || !sha256.test(value.packet.sha256) ||
      !record(value.packet.files)) {
    throw new Error('Invalid or differently bound repair preview');
  }
  const files = value.packet.files;
  if (Object.keys(files).length !== REPAIR_PACKET_FILES.length ||
      !REPAIR_PACKET_FILES.every((name) => Object.prototype.hasOwnProperty.call(files, name) && typeof files[name] === 'string')) {
    throw new Error('Repair preview must contain exactly the five frozen text files');
  }
  // Keep the original strings: parsing the display metadata must never rewrite payload bytes.
  return { ...value, source_root: sourceRoot, run_root: runRoot } as unknown as RepairPreviewResponse;
}

function jsonRecord(text: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(text);
    return record(value) ? value : {};
  } catch {
    return {};
  }
}

export function repairCheckStatus(value: unknown): RepairCheckStatus {
  if (typeof value !== 'string') return 'unknown';
  return ['checks_passed', 'not_run', 'failed', 'blocked', 'timeout', 'stale_or_invalid']
    .includes(value) ? value as RepairCheckStatus : 'unknown';
}

/** Summaries are explicitly fallible; the complete frozen strings remain authoritative. */
export function repairPacketSummary(packet: FrozenRepairPacket) {
  const repair = jsonRecord(packet.files['repair.json']);
  const verification = jsonRecord(packet.files['verification.json']);
  const baseline = record(verification.baseline) ? verification.baseline : {};
  const candidate = record(verification.candidate) ? verification.candidate : {};
  return {
    runId: typeof repair.run_id === 'string' ? repair.run_id : null,
    baseCommit: typeof repair.base_commit === 'string' && gitObject.test(repair.base_commit) ? repair.base_commit : null,
    baseTree: typeof repair.base_tree === 'string' && gitObject.test(repair.base_tree) ? repair.base_tree : null,
    candidateStatus: repair.candidate_status === 'proposed' || repair.candidate_status === 'diagnostic_only'
      ? repair.candidate_status : 'unknown',
    baseline: repairCheckStatus(baseline.status),
    candidate: repairCheckStatus(candidate.status),
    installedRuntime: verification.installed_runtime === 'not_tested' ? 'not_tested' : 'unknown',
  };
}

export function makeRepairExportRequest(
  preview: RepairPreviewResponse,
  acceptedDigest: string | null,
  output: string,
) {
  if (!acceptedDigest || acceptedDigest !== preview.packet.sha256 || !sha256.test(acceptedDigest)) {
    throw new Error('Review and accept the currently displayed packet digest before exporting');
  }
  if (!isAbsoluteRepairPath(output)) {
    throw new Error('Select a new absolute directory on the JeikCode host');
  }
  return {
    source: preview.source_root,
    run: preview.run_root,
    accept: acceptedDigest,
    output,
  };
}

export function parseRepairExport(value: unknown, expectedDigest: string): RepairExportResponse {
  const output = record(value) ? trustedRepairResponsePath(value.output) : null;
  if (!record(value) || value.status !== 'exported_local' ||
      value.sha256 !== expectedDigest || output === null) {
    throw new Error('Invalid repair export result; no confirmed export is available');
  }
  return { ...value, output } as unknown as RepairExportResponse;
}
