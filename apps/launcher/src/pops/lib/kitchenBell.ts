/**
 * Loud kitchen alert tone (Web Audio — no asset file required).
 * Designed to cut through restaurant noise on an always-on kitchen screen.
 */

let sharedCtx: AudioContext | null = null;
let lastPlayAt = 0;
/** One long alert per burst — ignore stacked polls. */
const MIN_GAP_MS = 2_500;

function getCtx(): AudioContext | null {
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new AC();
    }
    return sharedCtx;
  } catch {
    return null;
  }
}

/** Call once from a user gesture if autoplay was blocked. */
export async function unlockKitchenBell(): Promise<boolean> {
  const ctx = getCtx();
  if (!ctx) return false;
  try {
    if (ctx.state === "suspended") await ctx.resume();
    return ctx.state === "running";
  } catch {
    return false;
  }
}

function tone(
  ctx: AudioContext,
  startAt: number,
  freq: number,
  duration: number,
  gainPeak: number,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(freq, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainPeak, startAt + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.03);
}

/**
 * Longer multi-beep alert (~1.8s) so kitchen staff hear it over floor noise.
 * Debounced so refresh / multi-ticket bursts do not stack.
 */
export async function playKitchenBell(): Promise<void> {
  const now = Date.now();
  if (now - lastPlayAt < MIN_GAP_MS) return;
  lastPlayAt = now;

  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") await ctx.resume();
  } catch {
    return;
  }
  if (ctx.state !== "running") return;

  const t0 = ctx.currentTime + 0.02;
  // Longer sequence: ding-ding-ding-ding (~1.8s total).
  tone(ctx, t0, 880, 0.32, 0.58);
  tone(ctx, t0 + 0.38, 1046, 0.32, 0.62);
  tone(ctx, t0 + 0.76, 1174, 0.36, 0.65);
  tone(ctx, t0 + 1.18, 988, 0.45, 0.55);
}

/** Stable content key — must NOT include mins / wait time (those change every poll). */
export function ticketAttentionFingerprint(ticket: {
  id: string;
  itemsSummary: string;
  stationLabel: string;
  priority: string;
  status: string;
}): string {
  return [
    ticket.id,
    ticket.itemsSummary.trim(),
    ticket.stationLabel.trim(),
    ticket.priority,
    ticket.status,
  ].join("|");
}
