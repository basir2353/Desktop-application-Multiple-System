import { Button } from "@platform/ui";
import { useMemo, useState } from "react";
import launcherPkg from "../../../package.json";
import { fieldInputClass, panelClass } from "../lib/themeClasses";
import {
  buildSettingsBackupFile,
  downloadSettingsBackupFile,
  formatBackupWhen,
  listAutoSettingsBackups,
  parseSettingsBackupFile,
  restoreFromAutoBackup,
  restoreSettingsSnapshot,
  saveManualAutoBackup,
  SETTINGS_BACKUP_SECTION_LABELS,
  type SettingsBackupSection,
} from "../lib/branchSettingsBackup";

const APP_VERSION = launcherPkg.version;

type Props = {
  branchCode?: string | null;
  onNotice: (message: string) => void;
  onError: (message: string) => void;
  /** Compact: only restore buttons (for Printer page). */
  compact?: boolean;
};

const RESTORE_SECTIONS: SettingsBackupSection[] = [
  "all",
  "printer",
  "pos",
  "printSlips",
  "business",
  "terminals",
];

export function BranchSettingsBackupPanel({
  branchCode,
  onNotice,
  onError,
  compact = false,
}: Props): JSX.Element {
  const [selectedBackupId, setSelectedBackupId] = useState<string>("");
  const autoBackups = useMemo(() => listAutoSettingsBackups(), [selectedBackupId]);

  const latestBackup = autoBackups[0] ?? null;

  function confirmRestore(section: SettingsBackupSection, source: string): boolean {
    const label = SETTINGS_BACKUP_SECTION_LABELS[section];
    return window.confirm(
      `Restore "${label}" from ${source}?\n\nCurrent ${label.toLowerCase()} on this PC will be overwritten. PRA/FBR credentials on the server are not changed.`,
    );
  }

  function restoreSection(section: SettingsBackupSection, backupId?: string): void {
    try {
      const id = backupId ?? (selectedBackupId || latestBackup?.id);
      if (!id) {
        onError("No auto-backup found. Export settings now, or restore from a backup file.");
        return;
      }
      if (!confirmRestore(section, `auto-backup (${id.slice(0, 12)}…)`)) return;
      const count = restoreFromAutoBackup(id, section);
      onNotice(
        `${SETTINGS_BACKUP_SECTION_LABELS[section]} restored (${count} entries). Reload the page if printers or POS look stale.`,
      );
      window.setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Restore failed.");
    }
  }

  async function importFromFile(file: File, section: SettingsBackupSection): Promise<void> {
    try {
      const parsed = parseSettingsBackupFile(await file.text());
      if (!confirmRestore(section, `file ${file.name}`)) return;
      const count = restoreSettingsSnapshot(parsed.keys, section);
      onNotice(
        `${SETTINGS_BACKUP_SECTION_LABELS[section]} restored from file (${count} entries). Reloading…`,
      );
      window.setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Import failed.");
    }
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          className="text-xs"
          onClick={() => restoreSection("printer")}
        >
          Restore printers
        </Button>
        <label className="cursor-pointer rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 hover:border-slate-500">
          Import printer backup
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importFromFile(file, "printer");
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <section className={`${panelClass} max-w-xl space-y-4`}>
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Backup & restore settings
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Save printer, POS, bill/KOT layout, business day, and terminal settings on this PC.
          After an app update, use <span className="font-medium">Restore</span> if something looks
          wrong. FBR / Real PRA credentials stay on the server (Tax → PRA Integration).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="text-xs"
          onClick={() => {
            const file = buildSettingsBackupFile({
              branchCode,
              appVersion: APP_VERSION,
              label: "all-settings",
            });
            downloadSettingsBackupFile(file);
            onNotice("Settings exported — keep this file safe.");
          }}
        >
          Export all settings
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-xs"
          onClick={() => {
            saveManualAutoBackup(APP_VERSION, "manual");
            setSelectedBackupId("");
            onNotice("Snapshot saved on this PC (auto-backup list updated).");
          }}
        >
          Save snapshot now
        </Button>
        <label className="cursor-pointer rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-700 hover:border-slate-500 dark:text-slate-200">
          Import from file
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void importFromFile(file, "all");
            }}
          />
        </label>
      </div>

      {autoBackups.length > 0 ? (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-950/40">
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            Auto-backups (before updates)
          </div>
          <label className="block text-xs text-slate-500">
            Pick backup
            <select
              className={`mt-1 w-full ${fieldInputClass}`}
              value={selectedBackupId || latestBackup?.id || ""}
              onChange={(e) => setSelectedBackupId(e.target.value)}
            >
              {autoBackups.map((b) => (
                <option key={b.id} value={b.id}>
                  {formatBackupWhen(b.exportedAt)} · v{b.fromVersion} → v{b.appVersion}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 pt-1">
            {RESTORE_SECTIONS.map((section) => (
              <Button
                key={section}
                type="button"
                variant={section === "all" ? "default" : "ghost"}
                className="text-xs"
                onClick={() => restoreSection(section)}
              >
                Restore {section === "all" ? "everything" : SETTINGS_BACKUP_SECTION_LABELS[section]}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          No auto-backup yet — it is created automatically when the desktop app version changes,
          or tap <span className="font-medium">Save snapshot now</span>.
        </p>
      )}

      <div className="border-t border-slate-200 pt-3 dark:border-slate-700">
        <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Quick export by area
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {RESTORE_SECTIONS.filter((s) => s !== "all").map((section) => (
            <Button
              key={section}
              type="button"
              variant="ghost"
              className="text-xs"
              onClick={() => {
                const file = buildSettingsBackupFile({
                  branchCode,
                  appVersion: APP_VERSION,
                  section,
                  label: section,
                });
                downloadSettingsBackupFile(file, `pops-${section}-backup.json`);
                onNotice(`${SETTINGS_BACKUP_SECTION_LABELS[section]} exported.`);
              }}
            >
              Export {SETTINGS_BACKUP_SECTION_LABELS[section]}
            </Button>
          ))}
        </div>
      </div>
    </section>
  );
}
