// Generic confirmation modal. Replaces native window.confirm/alert/prompt so every
// confirmation shares the webui modal style (adaptive to light & dark themes).

import { createPortal } from 'preact/compat';
import { useEffect, useState, useRef } from 'preact/hooks';

export interface ConfirmDialogProps {
  title: string;
  /** Already-translated body text. */
  body: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Header glyph. Defaults to the trash icon. */
  icon?: string;
  /** Style the confirm button as destructive (red). Defaults to true. */
  danger?: boolean;
  /** When true, only show the confirm button (alert modal). */
  alertOnly?: boolean;
  /** Optional input field (replaces window.prompt). */
  input?: {
    defaultValue?: string;
    placeholder?: string;
    type?: string;
    autoFocus?: boolean;
  };
  /** Runs on confirm. Receives the optional input value. If it throws, the message
   *  is shown inline and the dialog stays open; on success the dialog closes. */
  onConfirm: (inputValue?: string) => Promise<void> | void;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel = '确定',
  cancelLabel = '取消',
  icon = '🗑',
  danger = true,
  alertOnly = false,
  input,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(input?.defaultValue ?? '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  useEffect(() => {
    if (input && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [input]);

  async function handleConfirm() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm(input ? inputValue : undefined);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  const overlay = (
    <div
      class="modal-overlay confirm-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div class="modal-card modal-card-sm" role="dialog" aria-modal="true">
        <div class="modal-header">
          <span style="font-size: 16px;">{icon}</span>
          <h3>{title}</h3>
          <button class="ghost-btn modal-close" onClick={onClose} aria-label={cancelLabel}>
            ×
          </button>
        </div>
        <div class="modal-body">
          {body ? <p class="field-hint" style="margin: 0; line-height: 1.5;">{body}</p> : null}
          {input && (
            <div class="modal-input-wrap">
              <input
                ref={inputRef}
                type={input.type || 'text'}
                class="input modal-input"
                value={inputValue}
                placeholder={input.placeholder}
                onInput={(e) => setInputValue((e.target as HTMLInputElement).value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleConfirm();
                  }
                }}
                disabled={busy}
              />
            </div>
          )}
          {error && <div class="modal-error">{error}</div>}
        </div>
        <div class="modal-footer">
          {!alertOnly && (
            <button class="btn btn-secondary" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </button>
          )}
          <button
            class={'btn ' + (danger ? 'btn-danger' : 'btn-primary')}
            onClick={handleConfirm}
            disabled={busy}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  // 挂到 body，避免被 SettingsModal（z-index: 99999）等已 portal 的窗口盖住。
  return typeof document !== 'undefined' ? createPortal(overlay, document.body) : overlay;
}

// ─────────────────────────────────────────────────────────────────────────────
// 全局命令式 Promise API (无侵入式替代 window.confirm / prompt / alert)
// ─────────────────────────────────────────────────────────────────────────────

type ModalHostState = {
  props: ConfirmDialogProps;
} | null;

let setGlobalModalState: ((state: ModalHostState) => void) | null = null;

export function ConfirmModalHost() {
  const [modal, setModal] = useState<ModalHostState>(null);

  useEffect(() => {
    setGlobalModalState = setModal;
    return () => {
      setGlobalModalState = null;
    };
  }, []);

  if (!modal) return null;
  return <ConfirmDialog {...modal.props} />;
}

export function modalConfirm(options: {
  title?: string;
  body: string;
  icon?: string;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!setGlobalModalState) {
      resolve(window.confirm(options.body));
      return;
    }
    setGlobalModalState({
      props: {
        title: options.title || '确认操作',
        body: options.body,
        icon: options.icon || (options.danger ? '⚠️' : '❓'),
        danger: options.danger ?? true,
        confirmLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel,
        onConfirm: () => {
          resolve(true);
        },
        onClose: () => {
          resolve(false);
          setGlobalModalState?.(null);
        },
      },
    });
  });
}

export function modalPrompt(options: {
  title?: string;
  body?: string;
  defaultValue?: string;
  placeholder?: string;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}): Promise<string | null> {
  return new Promise((resolve) => {
    if (!setGlobalModalState) {
      resolve(window.prompt(options.body || options.title || '', options.defaultValue));
      return;
    }
    setGlobalModalState({
      props: {
        title: options.title || '请输入',
        body: options.body || '',
        icon: options.icon || '✏️',
        danger: false,
        confirmLabel: options.confirmLabel,
        cancelLabel: options.cancelLabel,
        input: {
          defaultValue: options.defaultValue,
          placeholder: options.placeholder,
        },
        onConfirm: (val) => {
          resolve(val ?? '');
        },
        onClose: () => {
          resolve(null);
          setGlobalModalState?.(null);
        },
      },
    });
  });
}

export function modalAlert(options: {
  title?: string;
  body: string;
  icon?: string;
  confirmLabel?: string;
}): Promise<void> {
  return new Promise((resolve) => {
    if (!setGlobalModalState) {
      window.alert(options.body);
      resolve();
      return;
    }
    setGlobalModalState({
      props: {
        title: options.title || '提示',
        body: options.body,
        icon: options.icon || 'ℹ️',
        danger: false,
        alertOnly: true,
        confirmLabel: options.confirmLabel,
        onConfirm: () => {
          resolve();
        },
        onClose: () => {
          resolve();
          setGlobalModalState?.(null);
        },
      },
    });
  });
}
