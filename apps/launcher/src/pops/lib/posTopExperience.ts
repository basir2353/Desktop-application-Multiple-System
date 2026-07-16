export const POS_HEADER_VISIBLE_EVENT = "pops-pos-header-visible";
export const POS_HEADER_VISIBLE_KEY = "pops-pos-header-visible";

/** Default: top navigation bar is visible. */
export function loadPosHeaderVisible(): boolean {
  try {
    const raw = localStorage.getItem(POS_HEADER_VISIBLE_KEY);
    if (raw == null) return true;
    return raw !== "false";
  } catch {
    return true;
  }
}

export function setPosHeaderVisible(visible: boolean): void {
  try {
    localStorage.setItem(POS_HEADER_VISIBLE_KEY, String(visible));
  } catch {
    // ignore storage errors
  }
  window.dispatchEvent(
    new CustomEvent(POS_HEADER_VISIBLE_EVENT, { detail: { visible } }),
  );
}
