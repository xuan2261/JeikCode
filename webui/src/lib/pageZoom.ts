// Chrome-like zoom scaling (Ctrl + Mouse Wheel, Ctrl + +/-, Ctrl + 0).
// Preserves zoom ratio across sessions via localStorage and updates document.documentElement.style.zoom.

const ZOOM_STORAGE_KEY = 'jeikcode_page_zoom';
const ZOOM_STEPS = [
  0.5, 0.6, 0.7, 0.75, 0.8, 0.85, 0.9, 1.0, 1.1, 1.15, 1.25, 1.35, 1.5, 1.75, 2.0, 2.5, 3.0,
];

let currentZoom = 1.0;
let indicatorTimer: any = null;

function showZoomIndicator(zoom: number) {
  let indicator = document.getElementById('jeikcode-zoom-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'jeikcode-zoom-indicator';
    indicator.className = 'zoom-indicator';
    document.body.appendChild(indicator);
  }
  indicator.textContent = `${Math.round(zoom * 100)}%`;
  indicator.style.opacity = '1';

  if (indicatorTimer) clearTimeout(indicatorTimer);
  indicatorTimer = setTimeout(() => {
    if (indicator) {
      indicator.style.opacity = '0';
    }
  }, 1200);
}

export function setPageZoom(newZoom: number, showFeedback = true) {
  // 夹在最小 50% 和最大 300% 之间
  const clamped = Math.max(0.5, Math.min(3.0, Math.round(newZoom * 100) / 100));
  currentZoom = clamped;
  (document.documentElement.style as any).zoom = String(clamped);
  try {
    localStorage.setItem(ZOOM_STORAGE_KEY, String(clamped));
  } catch {}
  if (showFeedback) {
    showZoomIndicator(clamped);
  }
}

export function getPageZoom(): number {
  return currentZoom;
}

export function zoomIn() {
  const next = ZOOM_STEPS.find((step) => step > currentZoom + 0.01) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1];
  setPageZoom(next);
}

export function zoomOut() {
  const prev = [...ZOOM_STEPS].reverse().find((step) => step < currentZoom - 0.01) ?? ZOOM_STEPS[0];
  setPageZoom(prev);
}

export function resetZoom() {
  setPageZoom(1.0);
}

/**
 * 初始化全局缩放监听：
 * 1. Ctrl + 鼠标滚轮 -> 步进缩放
 * 2. Ctrl + '+' / '=' -> 放大
 * 3. Ctrl + '-' -> 缩小
 * 4. Ctrl + '0' -> 重置为 100%
 */
export function initPageZoom() {
  // 读取已保存的缩放比例
  try {
    const saved = localStorage.getItem(ZOOM_STORAGE_KEY);
    if (saved) {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed) && parsed >= 0.5 && parsed <= 3.0) {
        setPageZoom(parsed, false);
      }
    }
  } catch {}

  // 1. Ctrl + 鼠标滚轮
  window.addEventListener(
    'wheel',
    (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (e.deltaY < 0) {
          zoomIn();
        } else if (e.deltaY > 0) {
          zoomOut();
        }
      }
    },
    { passive: false }
  );

  // 2. 键盘快捷键 Ctrl + + / - / 0
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (!e.ctrlKey && !e.metaKey) return;

    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      zoomIn();
    } else if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomOut();
    } else if (e.key === '0') {
      e.preventDefault();
      resetZoom();
    }
  });
}
