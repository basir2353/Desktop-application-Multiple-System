/**
 * Loud kitchen alert tone (Web Audio — no asset file required).
 * Designed to cut through restaurant noise on an always-on kitchen screen.
 */

let sharedCtx: AudioContext | null = null;
let lastPlayAt = 0;
const MIN_GAP_MS = 400;

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
  gain.gain.exponentialRampToValueAtTime(gainPeak, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/**
 * Three sharp high beeps — loud enough for a kitchen floor screen.
 * Debounced so a burst of tickets does not stack into chaos.
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
  // Triple ding: high → higher → high (square wave cuts through ambient noise).
  tone(ctx, t0, 880, 0.18, 0.55);
  tone(ctx, t0 + 0.22, 1174, 0.2, 0.6);
  tone(ctx, t0 + 0.46, 988, 0.28, 0.5);
}

export function ticketAttentionFingerprint(ticket: {
  itemsSummary: string;
  stationLabel: string;
  priority: string;
  status: string;
  updatedByName?: string | null;
}): string {
  return [
    ticket.itemsSummary.trim(),
    ticket.stationLabel.trim(),
    ticket.priority,
    ticket.status,
    ticket.updatedByName?.trim() ?? "",
  ].join("|");
}
