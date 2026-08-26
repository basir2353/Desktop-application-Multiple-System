/**
 * Export / import / restore all branch-local POS settings (localStorage).
 * Use after app updates when printer, POS, or slip settings look wrong.
 */

import { THEME_STORAGE_KEY } from "../../lib/theme";

export const SETTINGS_BACKUP_FILE_VERSION = 1 as const;
export const AUTO_BACKUPS_STORAGE_KEY = "pops-settings-auto-backups-v1";
export const LAST_APP_VERSION_KEY = "pops-last-app-version-v1";

export type SettingsBackupSection =
  | "all"
  | "printer"
  | "pos"
  | "printSlips"
  | "business"
  | "terminals";

export type BranchSettingsBackupFile = {
  version: typeof SETTINGS_BACKUP_FILE_VERSION;
  exportedAt: string;
  appVersion: string;
  branchCode: string | null;
  label?: string;
  keys: Record<string, string>;
};

export type AutoSettingsBackupEntry = {
  id: string;
  exportedAt: string;
  appVersion: string;
  fromVersion: string;
  keys: Record<string, string>;
};

const SECTION_PATTERNS: Record<Exclude<SettingsBackupSection, "all">, RegExp[]> = {
  printer: [
    /^pops-printer-/,
    /^pops-branch-print-/,
    /^pops-thermal-print/,
    /^pops-waiter-printers/,
    /^pops-branch-print-preferred-server/,
    /^pops-org-users-print-cache/,
  ],
  pos: [
    /^pops-pos-/,
    /^pops-order-number/,
    /^pops-pos-order-mode/,
    /^pops-pos-customer-discount/,
    /^pops-pos-shift-team/,
    /^pops-pos-header-visible/,
    /^pops-pos-print-station/,
    /^pops-menu-item-options/,
  ],
  printSlips: [
    /^pops-bill-print/,
    /^pops-kot-print/,
    /^pops-cash-slip/,
    /^pops-receipt-branding/,
    /^pops-bill-receipt-template/,
    /^pops-bill-print-templates/,
  ],
  business: [
    /^pops-business-/,
    /^pops-delivery-/,
    /^pops-happy-hour/,
    /^pops-stock-alert/,
  ],
  terminals: [/^pops-authorized-terminals/, /^pops-terminal-id/, /^pops-user-pins/],
};

const EXTRA_SNAPSHOT_KEYS = [THEME_STORAGE_KEY];

export const SETTINGS_BACKUP_SECTION_LABELS: Record<SettingsBackupSection, string> = {
  all: "All local settings",
  printer: "Printers & routing",
  pos: "POS charges & order numbering",
  printSlips: "Bill / KOT / receipt layout",
  business: "Business day & delivery",
  terminals: "Terminals & PINs",
};

/** Collect every pops-* localStorage entry (+ theme). */
export function snapshotAllLocalSettings(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith("pops-") || EXTRA_SNAPSHOT_KEYS.includes(key)) {
        const value = localStorage.getItem(key);
        if (value != null) out[key] = value;
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

function keyMatchesSection(key: string, section: Exclude<SettingsBackupSection, "all">): boolean {
  return SECTION_PATTERNS[section].some((re) => re.test(key));
}

export function filterSnapshotBySection(
  keys: Record<string, string>,
  section: SettingsBackupSection,
): Record<string, string> {
  if (section === "all") return { ...keys };
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(keys)) {
    if (keyMatchesSection(key, section)) out[key] = value;
  }
  return out;
}

export function buildSettingsBackupFile(input: {
  branchCode?: string | null;
  appVersion: string;
  label?: string;
  section?: SettingsBackupSection;
}): BranchSettingsBackupFile {
  const section = input.section ?? "all";
  const keys = filterSnapshotBySection(snapshotAllLocalSettings(), section);
  return {
    version: SETTINGS_BACKUP_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: input.appVersion,
    branchCode: input.branchCode?.trim() || null,
    label: input.label,
    keys,
  };
}

export function parseSettingsBackupFile(json: string): BranchSettingsBackupFile {
  const parsed = JSON.parse(json) as Partial<BranchSettingsBackupFile>;
  if (parsed.version !== SETTINGS_BACKUP_FILE_VERSION) {
    throw new Error("Unsupported backup file version.");
  }
  if (!parsed.keys || typeof parsed.keys !== "object") {
    throw new Error("Invalid backup file (missing keys).");
  }
  return {
    version: SETTINGS_BACKUP_FILE_VERSION,
    exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    appVersion: typeof parsed.appVersion === "string" ? parsed.appVersion : "unknown",
    branchCode: typeof parsed.branchCode === "string" ? parsed.branchCode : null,
    label: typeof parsed.label === "string" ? parsed.label : undefined,
    keys: parsed.keys as Record<string, string>,
  };
}

/** Write snapshot keys back to localStorage. Returns count restored. */
export function restoreSettingsSnapshot(
  keys: Record<string, string>,
  section: SettingsBackupSection = "all",
): number {
  const slice = filterSnapshotBySection(keys, section);
  let count = 0;
  for (const [key, value] of Object.entries(slice)) {
    try {
      localStorage.setItem(key, value);
      count += 1;
    } catch {
      /* quota */
    }
  }
  return count;
}

export function downloadSettingsBackupFile(file: BranchSettingsBackupFile, filename?: string): void {
  const branch = file.branchCode?.replace(/[^\w-]+/g, "_") || "all";
  const section = file.label?.replace(/\s+/g, "-").toLowerCase() || "settings";
  const name =
    filename ??
    `pops-${section}-backup-${branch}-${file.exportedAt.slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function loadAutoBackups(): AutoSettingsBackupEntry[] {
  try {
    const raw = localStorage.getItem(AUTO_BACKUPS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AutoSettingsBackupEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveAutoBackups(entries: AutoSettingsBackupEntry[]): void {
  localStorage.setItem(AUTO_BACKUPS_STORAGE_KEY, JSON.stringify(entries.slice(0, 8)));
}

export function listAutoSettingsBackups(): AutoSettingsBackupEntry[] {
  return loadAutoBackups();
}

export function saveManualAutoBackup(appVersion: string, fromVersion: string): AutoSettingsBackupEntry {
  const entry: AutoSettingsBackupEntry = {
    id: `manual-${Date.now()}`,
    exportedAt: new Date().toISOString(),
    appVersion,
    fromVersion,
    keys: snapshotAllLocalSettings(),
  };
  saveAutoBackups([entry, ...loadAutoBackups()]);
  return entry;
}

/**
 * On app version change, keep a snapshot so user can restore after a bad update.
 * Returns true when a new auto-backup was created.
 */
export function maybeAutoBackupOnAppUpdate(currentVersion: string): boolean {
  try {
    const prev = localStorage.getItem(LAST_APP_VERSION_KEY);
    localStorage.setItem(LAST_APP_VERSION_KEY, currentVersion);
    if (!prev || prev === currentVersion) return false;

    const entry: AutoSettingsBackupEntry = {
      id: `update-${Date.now()}`,
      exportedAt: new Date().toISOString(),
      appVersion: currentVersion,
      fromVersion: prev,
      keys: snapshotAllLocalSettings(),
    };
    saveAutoBackups([entry, ...loadAutoBackups()]);
    return true;
  } catch {
    return false;
  }
}

export function restoreFromAutoBackup(
  backupId: string,
  section: SettingsBackupSection = "all",
): number {
  const entry = loadAutoBackups().find((b) => b.id === backupId);
  if (!entry) throw new Error("Auto-backup not found.");
  return restoreSettingsSnapshot(entry.keys, section);
}

export function formatBackupWhen(iso: string | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}
