import DOMPurify from 'dompurify';
import { useState, useEffect, useRef } from 'preact/hooks';
import { checkUpdate, executeUpdate, getUpdateStatus, UpdateCheckResponse, UpdateStatus, UpdateVersionEntry } from '../api';
import { copyTextToClipboard } from '../lib/clipboard';
import { shouldReloadUpgradedPage } from '../lib/upgradeReload';
import { Markdown } from './Markdown';
import { useT } from '../settings';

/** 边缘 Atom 的公告是 HTML；GitHub REST 兜底时仍是 Markdown。 */
function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][^>]*>/i.test(text);
}

function sanitizeNotesHtml(text: string): string {
  return DOMPurify.sanitize(text, { ADD_ATTR: ['target', 'rel'] });
}

function notesPlainText(text: string): string {
  if (!looksLikeHtml(text)) return text;
  const doc = new DOMParser().parseFromString(sanitizeNotesHtml(text), 'text/html');
  return (doc.body.textContent || text).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const STORAGE_KEY_CHANNEL = 'jeikcode_update_channel';

interface UpdateDialogProps {
  info: UpdateCheckResponse | null;
  onClose: () => void;
  onUpdateInfoChange?: (info: UpdateCheckResponse) => void;
}

export function UpdateDialog({ info: initialInfo, onClose, onUpdateInfoChange }: UpdateDialogProps) {
  const t = useT();

  // 读取已保存的通道偏好；若无则根据版本判断默认通道（含 '-' 为 beta，否则为 stable）
  const getInitialChannel = (): 'stable' | 'beta' => {
    const saved = localStorage.getItem(STORAGE_KEY_CHANNEL);
    if (saved === 'beta' || saved === 'stable') return saved;
    if (initialInfo?.channel === 'beta' || initialInfo?.channel === 'stable') return initialInfo.channel;
    if (initialInfo?.current_version?.includes('-')) return 'beta';
    return 'stable';
  };

  const [channel, setChannel] = useState<'stable' | 'beta'>(getInitialChannel);
  const [info, setInfo] = useState<UpdateCheckResponse | null>(initialInfo);
  const [selectedVersion, setSelectedVersion] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesCopied, setNotesCopied] = useState<'idle' | 'ok' | 'fail'>('idle');
  const [isChecking, setIsChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const [updating, setUpdating] = useState(false);
  const [status, setStatus] = useState<UpdateStatus | null>(null);

  const isDesktop = false;
  const isMounted = useRef(true);
  const reloadStarted = useRef(false);
  const sawInstallProgress = useRef(false);
  const targetVersionRef = useRef('');
  const currentVersionRef = useRef('');
  const reloadAfterRestartRef = useRef<() => void>(() => {});

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // 检查更新
  const doCheckUpdate = async (targetChannel: 'stable' | 'beta') => {
    setIsChecking(true);
    setCheckError(null);
    try {
      const res = await checkUpdate(targetChannel);
      if (isMounted.current) {
        setInfo(res);
        setSelectedVersion('');
        setNotesOpen(false);
        if (onUpdateInfoChange) {
          onUpdateInfoChange(res);
        }
      }
    } catch (err: any) {
      if (isMounted.current) {
        setCheckError(err?.message || String(err));
      }
    } finally {
      if (isMounted.current) {
        setIsChecking(false);
      }
    }
  };

  // 切换更新通道
  const handleSelectChannel = (newChannel: 'stable' | 'beta') => {
    if (newChannel === channel && info) return;
    setChannel(newChannel);
    localStorage.setItem(STORAGE_KEY_CHANNEL, newChannel);
    doCheckUpdate(newChannel);
  };

  // 弹窗打开时立即无条件执行一次最新版本探测，彻底消除历史缓存滞后，确保拉取到绝对最新的跨版本数据
  useEffect(() => {
    doCheckUpdate(channel);
  }, []);

  // 轮询更新进度。进度变化不能拆掉这次轮询。
  // 安装开始后，状态变为完成或服务重启，都走和「完成」按钮同一条刷新。
  useEffect(() => {
    if (!updating) return;
    let stopped = false;
    let misses = 0;
    const timer = window.setInterval(async () => {
      if (stopped || reloadStarted.current) return;
      try {
        const s = await getUpdateStatus();
        if (!isMounted.current || stopped) return;
        misses = 0;
        setStatus(s);
        const progressed =
          s.status === 'installing' ||
          s.status === 'done' ||
          (s.status === 'downloading' && (s.progress ?? 0) >= 90);
        if (progressed) sawInstallProgress.current = true;
        const restarted =
          s.status === 'done' ||
          (sawInstallProgress.current && (s.status === 'idle' || s.status === 'ready'));
        if (!restarted) return;
        stopped = true;
        window.clearInterval(timer);
        reloadAfterRestartRef.current();
      } catch {
        misses += 1;
        if (!sawInstallProgress.current || misses < 3 || stopped) return;
        stopped = true;
        window.clearInterval(timer);
        reloadAfterRestartRef.current();
      }
    }, 500);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [updating]);

  const sameVersion = (a?: string, b?: string) => {
    const n = (v?: string) => (v || '').trim().replace(/^v/i, '').toLowerCase();
    const x = n(a);
    const y = n(b);
    return x.length > 0 && x === y;
  };
  const versionEntries: UpdateVersionEntry[] =
    info?.versions && info.versions.length > 0
      ? info.versions
      : info?.latest_version
        ? [{ version: info.latest_version, notes: info.release_notes, released_at: info.released_at }]
        : [];
  const versionOptions = versionEntries.map((entry) => entry.version);
  const targetVersion =
    selectedVersion && versionOptions.some((v) => sameVersion(v, selectedVersion))
      ? versionOptions.find((v) => sameVersion(v, selectedVersion)) || versionOptions[0] || ''
      : versionOptions[0] || '';
  const selectedEntry = versionEntries.find((entry) => sameVersion(entry.version, targetVersion));
  const isLatestPick = !targetVersion || sameVersion(targetVersion, info?.latest_version || versionOptions[0]);
  const forceReinstall = isLatestPick && sameVersion(info?.current_version, targetVersion);
  targetVersionRef.current = targetVersion;
  currentVersionRef.current = info?.current_version || '';
  // 点「完成」和进度到完成后的自动等待是同一次刷新：确认 /health 已是目标版本再重载。
  // 旧进程退出前仍会应答，不能在那一次应答上把页面刷回去。
  reloadAfterRestartRef.current = () => {
    if (reloadStarted.current) return;
    reloadStarted.current = true;
    const want = targetVersionRef.current;
    const from = currentVersionRef.current;
    void (async () => {
      let misses = 0;
      const deadline = Date.now() + 60000;
      while (Date.now() < deadline) {
        try {
          const resp = await fetch('/health', {
            credentials: 'include',
            signal: AbortSignal.timeout(2000),
          });
          if (!resp.ok) throw new Error(String(resp.status));
          const body = await resp.json();
          const got = String(body?.version ?? '');
          if (shouldReloadUpgradedPage({ want, from, got, consecutiveMisses: misses })) {
            window.location.reload();
            return;
          }
          misses = 0;
        } catch {
          misses += 1;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 400));
      }
      reloadStarted.current = false;
    })();
  };

  const handleStartUpdate = async () => {
    if (isChecking || !targetVersion) return;
    reloadStarted.current = false;
    sawInstallProgress.current = false;
    setUpdating(true);
    try {
      await executeUpdate({
        channel,
        version: targetVersion,
        download_url: isLatestPick ? info?.download_url ?? undefined : undefined,
        force: forceReinstall || !isLatestPick,
      });
    } catch (err: any) {
      setStatus({
        status: 'error',
        progress: 0,
        bytes: 0,
        total: 0,
        error: err?.message || t('update.startFailed'),
      });
    }
  };

  useEffect(() => {
    if (!notesOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setNotesOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [notesOpen]);

  useEffect(() => {
    setNotesCopied('idle');
  }, [targetVersion, notesOpen]);

  const notesText = (selectedEntry?.notes || '').trim();
  const notesReleasedAt = (() => {
    const raw = selectedEntry?.released_at;
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return date.toLocaleString();
  })();

  const handleCopyNotes = async () => {
    if (!notesText) return;
    const ok = await copyTextToClipboard(notesPlainText(notesText));
    setNotesCopied(ok ? 'ok' : 'fail');
  };

  const hasUpdate = info?.has_update ?? false;
  const canInstall =
    !isChecking &&
    !checkError &&
    !!targetVersion &&
    (!isLatestPick || hasUpdate || forceReinstall);

  return (
    <>
    <div
      class="modal-overlay"
      onClick={(e) => {
        if (!updating && e.target === e.currentTarget) onClose();
      }}
    >
      <div class="modal-card update-modal-card" role="dialog" aria-labelledby="update-dialog-title">
        <div class="modal-header">
          <span style="font-size: 16px;">🚀</span>
          <h3 id="update-dialog-title">{t('update.modalTitle')}</h3>
          {!updating && (
            <button class="ghost-btn modal-close" onClick={onClose} aria-label={t('common.cancel')}>
              ×
            </button>
          )}
        </div>

        <div class="modal-body update-dialog-body">
          {/* 更新通道选择器（对标 Antigravity-Manager） */}
          <div class="update-channel-section">
            <div class="update-channel-header">
              <span class="update-channel-label">{t('update.channel')}:</span>
              <div class="update-channel-toggle-group">
                <button
                  type="button"
                  class={`update-channel-btn ${channel === 'stable' ? 'active' : ''}`}
                  onClick={() => handleSelectChannel('stable')}
                  disabled={updating || isChecking}
                >
                  {t('update.channelStable')}
                </button>
                <button
                  type="button"
                  class={`update-channel-btn beta ${channel === 'beta' ? 'active' : ''}`}
                  onClick={() => handleSelectChannel('beta')}
                  disabled={updating || isChecking}
                >
                  <span>{t('update.channelBeta')}</span>
                  <span class="update-channel-beta-dot" />
                </button>
              </div>
            </div>
            <p class={`update-channel-desc ${channel === 'beta' ? 'beta' : ''}`}>
              {channel === 'beta' ? t('update.channelBetaDesc') : t('update.channelStableDesc')}
            </p>
          </div>

          {/* 版本对比卡片 */}
          <div class="update-version-card">
            <div class="update-version-row">
              <span class="update-version-label">{t('update.currentVersion')}</span>
              <span class="update-version-val current">
                {info?.current_version || 'v' + (typeof window !== 'undefined' ? (window as any).__JEIKCODE_VERSION__ || '...' : '...')}
              </span>
            </div>
            <div class="update-version-arrow">➔</div>
            <div class="update-version-row">
              <span class="update-version-label">
                {isLatestPick ? t('update.latestVersion') : t('update.targetVersion')}
              </span>
              <span class={`update-version-val ${hasUpdate || !isLatestPick ? 'latest' : 'current'}`}>
                {isChecking ? '...' : (targetVersion || info?.latest_version || '...')}
              </span>
            </div>
          </div>

          {/* 状态展示与进度条 */}
          {!updating ? (
            <div class="update-status-display">
              {isChecking ? (
                <div class="update-status-row checking">
                  <div class="update-spinner" />
                  <span>{t('update.checking')}</span>
                </div>
              ) : checkError ? (
                <div class="update-status-row error">
                  <span class="update-status-error-icon">⚠️</span>
                  <span>{t('update.failed', { error: checkError })}</span>
                </div>
              ) : !isLatestPick && targetVersion ? (
                <div class="update-status-row has-update">
                  <span class="update-status-sparkle">✨</span>
                  <span>{t('update.dialogDescTarget', { version: targetVersion })}</span>
                </div>
              ) : hasUpdate ? (
                <div class="update-status-row has-update">
                  <span class="update-status-sparkle">✨</span>
                  <span>{t('update.dialogDesc', { version: info?.latest_version || '' })}</span>
                </div>
              ) : forceReinstall ? (
                <div class="update-status-row has-update">
                  <span class="update-status-sparkle">🔁</span>
                  <span>{t('update.dialogDescForce', { version: info?.latest_version || '' })}</span>
                </div>
              ) : (
                <div class="update-status-row latest">
                  <span class="update-status-check-icon">✓</span>
                  <span>{t('update.statusLatest')} ({info?.current_version})</span>
                </div>
              )}
            </div>
          ) : (
            <div class="update-progress-section">
              <div class="update-progress-bar-bg">
                <div
                  class={`update-progress-bar-fill ${status?.status === 'error' ? 'error' : ''}`}
                  style={{ width: `${status?.progress ?? 0}%` }}
                />
              </div>
              <div class="update-progress-status-row">
                <span class="update-progress-text">
                  {status?.status === 'downloading'
                    ? isDesktop
                      ? t('update.downloadingSetup', { percent: status?.progress ?? 0 })
                      : t('update.downloadingCli', { percent: status?.progress ?? 0 })
                    : status?.status === 'ready' || status?.status === 'installing'
                      ? isDesktop
                        ? t('update.readyDesktop')
                        : t('update.downloadingCli', { percent: 100 })
                      : status?.status === 'done'
                        ? t('update.readyCli')
                        : status?.status === 'error'
                          ? t('update.failed', { error: status?.error || '' })
                          : t('update.downloading')}
                </span>
                <span class="update-progress-percent">
                  {status?.progress ?? 0}%
                </span>
              </div>
            </div>
          )}
        </div>

        <div class="modal-footer update-dialog-footer">
          <label class="update-version-picker">
            <span class="update-version-picker-label">{t('update.historyLabel')}</span>
            <select
              class="update-version-select"
              aria-label={t('update.historyLabel')}
              value={targetVersion}
              disabled={updating || isChecking || versionOptions.length === 0}
              onChange={(e) => setSelectedVersion((e.target as HTMLSelectElement).value)}
            >
              {versionOptions.map((version) => (
                <option key={version} value={version}>
                  {version}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            class="update-notes-btn"
            disabled={updating || isChecking || !targetVersion}
            onClick={() => setNotesOpen(true)}
          >
            {t('update.notesBtn')}
          </button>
          <div class="update-footer-actions">
          {!updating ? (
            <>
              {canInstall ? (
                <>
                  <button
                    type="button"
                    class="btn btn-secondary"
                    onClick={onClose}
                  >
                    {t('update.btnCancel')}
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary update-confirm-btn"
                    onClick={handleStartUpdate}
                  >
                    {forceReinstall ? t('update.btnForce') : t('update.btnUpdate')}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    class="btn btn-secondary"
                    onClick={() => doCheckUpdate(channel)}
                    disabled={isChecking}
                  >
                    {isChecking ? t('update.btnChecking') : t('update.btnCheck')}
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={onClose}
                  >
                    {t('update.btnClose')}
                  </button>
                </>
              )}
            </>
          ) : status?.status === 'error' ? (
            <>
              <button
                type="button"
                class="btn btn-secondary"
                onClick={onClose}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                class="btn btn-primary"
                onClick={handleStartUpdate}
              >
                {t('update.btnRetry')}
              </button>
            </>
          ) : status?.status === 'done' ? (
            <button
              type="button"
              class="btn btn-primary"
              onClick={() => reloadAfterRestartRef.current()}
            >
              {t('update.btnDone')}
            </button>
          ) : (
            <button
              type="button"
              class="btn btn-secondary"
              disabled
            >
              {isDesktop ? t('update.preparing') : t('update.installing')}
            </button>
          )}
          </div>
        </div>
      </div>
    </div>
    {notesOpen && (
      <div
        class="release-notes-overlay"
        onClick={(e) => {
          if (e.target === e.currentTarget) setNotesOpen(false);
        }}
      >
        <div
          class="release-notes-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="release-notes-title"
        >
          <div class="release-notes-accent" />
          <div class="release-notes-header">
            <div class="release-notes-heading">
              <span class="release-notes-kicker">{t('update.notesTitle')}</span>
              <h3 id="release-notes-title">{targetVersion}</h3>
              {notesReleasedAt && <time class="release-notes-time">{notesReleasedAt}</time>}
            </div>
            <div class="release-notes-header-actions">
              <button
                type="button"
                class="release-notes-copy"
                onClick={handleCopyNotes}
                disabled={!notesText}
              >
                {notesCopied === 'ok'
                  ? t('update.notesCopied')
                  : notesCopied === 'fail'
                    ? t('update.notesCopyFailed')
                    : t('update.notesCopy')}
              </button>
              <button
                type="button"
                class="ghost-btn modal-close"
                onClick={() => setNotesOpen(false)}
                aria-label={t('update.btnClose')}
              >
                ×
              </button>
            </div>
          </div>
          <div class="release-notes-body">
            {notesText && looksLikeHtml(notesText) ? (
              <div
                class="markdown-root assistant-message-content"
                dangerouslySetInnerHTML={{ __html: sanitizeNotesHtml(notesText) }}
              />
            ) : notesText ? (
              <Markdown content={notesText} />
            ) : (
              <p class="release-notes-empty">{t('update.notesEmpty')}</p>
            )}
          </div>
        </div>
      </div>
    )}
    </>
  );
}
