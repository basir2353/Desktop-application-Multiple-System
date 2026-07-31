/** Global UI zoom (all ERP screens). Persisted in localStorage. */

export const UI_ZOOM_LEVELS = [0.6, 0.75, 0.85, 1, 1.15, 1.3, 1.5, 1.75, 2] as const;

export const UI_ZOOM_STORAGE_KEY = "pops-ui-zoom-index";
/** Legacy POS-only key — migrated once into the global key. */
const LEGACY_POS_ZOOM_STORAGE_KEY = "pops-pos-font-zoom-index";

export const UI_ZOOM_CHANGED_EVENT = "pops-ui-zoom-changed";

export const UI_ZOOM_DEFAULT_INDEX = 3; // 100%

export type UiZoomChangedDetail = { index: number; scale: number };

function clampIndex(index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= UI_ZOOM_LEVELS.length) {
    return UI_ZOOM_DEFAULT_INDEX;
  }
  return index;
}

export function loadUiZoomIndex(): number {
  try {
    const raw = localStorage.getItem(UI_ZOOM_STORAGE_KEY);
    if (raw != null) return clampIndex(Number(raw));

    const legacy = localStorage.getItem(LEGACY_POS_ZOOM_STORAGE_KEY);
    if (legacy != null) {
      const migrated = clampIndex(Number(legacy));
      localStorage.setItem(UI_ZOOM_STORAGE_KEY, String(migrated));
      return migrated;
    }
    return UI_ZOOM_DEFAULT_INDEX;
  } catch {
    return UI_ZOOM_DEFAULT_INDEX;
  }
}

export function uiZoomScale(index: number = loadUiZoomIndex()): number {
  return UI_ZOOM_LEVELS[clampIndex(index)] ?? 1;
}

export function setUiZoomIndex(next: number): number {
  const clamped = clampIndex(next);
  try {
    localStorage.setItem(UI_ZOOM_STORAGE_KEY, String(clamped));
  } catch {
    // ignore storage errors
  }
  const scale = uiZoomScale(clamped);
  window.dispatchEvent(
    new CustomEvent<UiZoomChangedDetail>(UI_ZOOM_CHANGED_EVENT, {
      detail: { index: clamped, scale },
    }),
  );
  return clamped;
}

export function stepUiZoom(delta: -1 | 1): number {
  return setUiZoomIndex(loadUiZoomIndex() + delta);
}
