import { authFetch } from "../../lib/authFetch";
import {
  normalizeMobizoneReceiptSettings,
  saveMobizoneReceiptSettings,
  type MobizoneReceiptSettings,
} from "./mobizoneReceiptSettings";

/** Publish desktop shop/receipt/WhatsApp settings so mobile apps pull them. */
export async function publishMobizoneShopControl(
  branchCode: string,
  settings: MobizoneReceiptSettings,
): Promise<void> {
  const payload = normalizeMobizoneReceiptSettings(settings);
  saveMobizoneReceiptSettings(branchCode, payload);
  const res = await authFetch("/v1/operations/mobizone-shop-control", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Could not publish shop control (${res.status})`);
  }
}

export async function fetchMobizoneShopControl(): Promise<MobizoneReceiptSettings | null> {
  const res = await authFetch("/v1/operations/mobizone-shop-control");
  if (!res.ok) return null;
  const data = (await res.json()) as Partial<MobizoneReceiptSettings>;
  if (!data.shopName && !data.shopPhone && !data.whatsappNumber) return null;
  return normalizeMobizoneReceiptSettings(data);
}
