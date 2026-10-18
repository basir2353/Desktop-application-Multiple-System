export const POS_HEADER_VISIBLE_EVENT = "pops-pos-header-visible";
export const POS_HEADER_VISIBLE_KEY = "pops-pos-header-visible";

/**
 * HistoryNavBar ← Back asks POS to consume the gesture (close full-screen menu,
 * or restore the hidden top bar) before leaving `/pops/pos`.
 * Listeners call `preventDefault()` when handled.
 */
export const POS_CONSUME_BACK_EVENT = "pops-pos-consume-back";
export const POS_FULLSCREEN_OPEN_EVENT = "pops-pos-fullscreen-open";

/** True when POS is in an immersive mode that should own the Back button. */
let posImmersiveOpen = false;

export function isPosFullscreenOpen(): boolean {
  return posImmersiveOpen;
}

/** @param open full-screen menu open OR top shell header hidden on POS */
export function setPosFullscreenOpenFlag(open: boolean): void {
  if (posImmersiveOpen === open) return;
  posImmersiveOpen = open;
  window.dispatchEvent(
    new CustomEvent(POS_FULLSCREEN_OPEN_EVENT, { detail: { open } }),
  );
}

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

/** @returns true when a POS listener handled Back (do not navigate away). */
export function requestPosConsumeBack(): boolean {
  const event = new CustomEvent(POS_CONSUME_BACK_EVENT, { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}
