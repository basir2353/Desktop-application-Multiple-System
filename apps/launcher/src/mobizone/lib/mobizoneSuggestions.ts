import type { MobizoneDb } from "./mobizoneStore";

export type SuggestKind =
  | "brand"
  | "model"
  | "colour"
  | "storage"
  | "etc"
  | "personName"
  | "phone"
  | "address"
  | "cnic";

const MAX_PER_KIND = 200;

function storageKey(branchCode: string, kind: SuggestKind): string {
  return `mobizone-suggest-v1:${branchCode}:${kind}`;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function uniqueKeepOrder(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const v = normalize(raw);
    if (!v) continue;
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
    if (out.length >= MAX_PER_KIND) break;
  }
  return out;
}

function loadSaved(branchCode: string, kind: SuggestKind): string[] {
  try {
    const raw = localStorage.getItem(storageKey(branchCode, kind));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return uniqueKeepOrder(parsed.filter((x): x is string => typeof x === "string"));
  } catch {
    return [];
  }
}

export function rememberSuggestion(
  branchCode: string,
  kind: SuggestKind,
  value: string | null | undefined,
): void {
  const v = value ? normalize(value) : "";
  if (!branchCode || !v) return;
  const next = uniqueKeepOrder([v, ...loadSaved(branchCode, kind)]);
  localStorage.setItem(storageKey(branchCode, kind), JSON.stringify(next));
}

export function rememberSuggestions(
  branchCode: string,
  entries: Partial<Record<SuggestKind, string | null | undefined>>,
): void {
  for (const [kind, value] of Object.entries(entries) as Array<
    [SuggestKind, string | null | undefined]
  >) {
    rememberSuggestion(branchCode, kind, value);
  }
}

/** Merge persisted + history from local MobiZone DB for autocomplete. */
export function listSuggestions(
  branchCode: string | null,
  db: MobizoneDb,
  kind: SuggestKind,
): string[] {
  const fromDb: string[] = [];
  if (kind === "brand") {
    for (const d of db.devices) fromDb.push(d.brand);
    for (const p of db.purchases) fromDb.push(p.brand);
    for (const s of db.sales) fromDb.push(s.brand);
  } else if (kind === "model") {
    for (const d of db.devices) fromDb.push(d.model);
    for (const p of db.purchases) fromDb.push(p.model);
    for (const s of db.sales) fromDb.push(s.model);
  } else if (kind === "colour") {
    for (const d of db.devices) if (d.colour) fromDb.push(d.colour);
    for (const p of db.purchases) if (p.colour) fromDb.push(p.colour);
  } else if (kind === "storage") {
    for (const d of db.devices) if (d.storage) fromDb.push(d.storage);
    for (const p of db.purchases) if (p.storage) fromDb.push(p.storage);
  } else if (kind === "etc") {
    for (const d of db.devices) if (d.etc) fromDb.push(d.etc);
    for (const p of db.purchases) if (p.etc) fromDb.push(p.etc);
    for (const s of db.sales) if (s.etc) fromDb.push(s.etc);
  } else if (kind === "personName") {
    for (const c of db.customers) fromDb.push(c.name);
    for (const p of db.purchases) fromDb.push(p.sellerName);
    for (const s of db.sales) fromDb.push(s.customerName);
  } else if (kind === "phone") {
    for (const c of db.customers) if (c.phone) fromDb.push(c.phone);
    for (const p of db.purchases) if (p.sellerPhone) fromDb.push(p.sellerPhone);
    for (const s of db.sales) if (s.customerPhone) fromDb.push(s.customerPhone);
  } else if (kind === "address") {
    for (const c of db.customers) if (c.address) fromDb.push(c.address);
    for (const p of db.purchases) if (p.sellerAddress) fromDb.push(p.sellerAddress);
    for (const s of db.sales) if (s.customerAddress) fromDb.push(s.customerAddress);
  } else if (kind === "cnic") {
    for (const c of db.customers) if (c.cnic) fromDb.push(c.cnic);
    for (const p of db.purchases) if (p.sellerCnic) fromDb.push(p.sellerCnic);
    for (const s of db.sales) if (s.customerCnic) fromDb.push(s.customerCnic);
  }
  const saved = branchCode ? loadSaved(branchCode, kind) : [];
  return uniqueKeepOrder([...saved, ...fromDb]);
}
