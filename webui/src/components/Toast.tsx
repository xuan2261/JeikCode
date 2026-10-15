import { useEffect, useState } from 'preact/hooks';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type ToastListener = (item: ToastItem) => void;
let toastSubscriber: ToastListener | null = null;

/**
 * 现代轻量全局 Toast 提示器（替代 window.alert，自适应亮色与暗色模式）
 */
export function showToast(message: string, type: ToastType = 'info') {
  if (toastSubscriber) {
    const id = Math.random().toString(36).slice(2, 9);
    toastSubscriber({ id, message, type });
  } else {
    console.log(`[Toast ${type}] ${message}`);
  }
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    toastSubscriber = (item) => {
      setToasts((prev) => [...prev.slice(-3), item]); // 最多同时显示 4 个
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== item.id));
      }, 3400);
    };
    return () => {
      toastSubscriber = null;
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div class="webui-toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} class={`webui-toast webui-toast-${t.type}`}>
          <span class="webui-toast-icon">
            {t.type === 'success' && '✓'}
            {t.type === 'error' && '✕'}
            {t.type === 'warning' && '⚠️'}
            {t.type === 'info' && 'ℹ️'}
          </span>
          <span class="webui-toast-msg">{t.message}</span>
          <button
            type="button"
            class="webui-toast-close"
            onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
