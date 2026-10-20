import { authFetch } from "../lib/authFetch";
import {
  loadMobizoneReceiptSettings,
  normalizeMobizoneReceiptSettings,
  saveMobizoneReceiptSettings,
  type MobizoneReceiptSettings,
} from "./receiptSettings";

/** Pull desktop-published shop / receipt / WhatsApp control onto this device. */
export async function pullDesktopShopControl(branchCode: string): Promise<MobizoneReceiptSettings> {
  const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
  let res: Response;
  try {
    res = await authFetch("/v1/operations/mobizone-shop-control", ctrl ? { signal: ctrl.signal } : undefined);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (!res.ok) {
    return loadMobizoneReceiptSettings(branchCode);
  }
  const data = (await res.json()) as Partial<MobizoneReceiptSettings>;
  const next = normalizeMobizoneReceiptSettings({
    ...data,
    controlledByDesktop: true,
  });
  saveMobizoneReceiptSettings(branchCode, next);
  return next;
}
