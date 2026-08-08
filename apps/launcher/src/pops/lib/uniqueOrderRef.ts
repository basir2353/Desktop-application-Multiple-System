/**
 * Globally unique-enough order refs for waiter / multi-device (Option mix fix).
 * Avoids ORD-#### (4-digit time) collisions that mixed paid + new orders.
 */
export function allocateUniqueOrderRef(prefix = "ORD"): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const h = String(now.getHours()).padStart(2, "0");
  const mi = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  const ms = String(now.getMilliseconds()).padStart(3, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${y}${mo}${d}-${h}${mi}${s}${ms}-${rand}`;
}
