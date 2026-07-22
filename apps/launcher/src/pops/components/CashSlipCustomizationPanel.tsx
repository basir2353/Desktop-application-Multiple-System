import { Button } from "@platform/ui";
import { useEffect, useState } from "react";
import {
  DEFAULT_CASH_SLIP_PRINT_SETTINGS,
  loadCashSlipPrintSettings,
  normalizeCashSlipPrintSettings,
  saveCashSlipPrintSettings,
  type CashSlipPrintSettings,
} from "../lib/cashSlipPrintSettings";
import { fieldInputClass } from "../lib/themeClasses";

type Props = {
  branchCode: string;
  onNotice?: (message: string) => void;
};

function newLineId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function CashSlipCustomizationPanel({ branchCode, onNotice }: Props): JSX.Element {
  const [draft, setDraft] = useState<CashSlipPrintSettings>(() =>
    loadCashSlipPrintSettings(branchCode),
  );
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => {
    setDraft(loadCashSlipPrintSettings(branchCode));
  }, [branchCode]);

  function patch(partial: Partial<CashSlipPrintSettings>): void {
    setDraft(normalizeCashSlipPrintSettings({ ...draft, ...partial }));
  }

  function save(): void {
    saveCashSlipPrintSettings(branchCode, draft);
    onNotice?.("Pay in / Pay out slip layout saved.");
  }

  function reset(): void {
    const next = normalizeCashSlipPrintSettings(DEFAULT_CASH_SLIP_PRINT_SETTINGS);
    setDraft(next);
  }

  function updateLine(
    id: string,
    partial: Partial<CashSlipPrintSettings["customLines"][number]>,
  ): void {
    patch({
      customLines: draft.customLines.map((line) => (line.id === id ? { ...line, ...partial } : line)),
    });
  }

  function addLine(): void {
    if (draft.customLines.length >= 12) {
      onNotice?.("Maximum 12 custom lines on cash slips.");
      return;
    }
    patch({
      customLines: [
        ...draft.customLines,
        { id: newLineId(), text: "Signature: ____________", bold: false, enabled: true },
      ],
    });
  }

  function removeLine(id: string): void {
    patch({ customLines: draft.customLines.filter((line) => line.id !== id) });
  }

  function moveLine(fromId: string, toId: string): void {
    if (fromId === toId) return;
    const list = [...draft.customLines];
    const fromIndex = list.findIndex((line) => line.id === fromId);
    const toIndex = list.findIndex((line) => line.id === toId);
    if (fromIndex < 0 || toIndex < 0) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    patch({ customLines: list });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/40">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
          Pay out / Pay in slip
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Customize cash drawer slips: titles, direction labels, soft bold, and extra lines (signature, notes).
        </p>
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-slate-500">
            Pay out title
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={draft.titlePayOut}
              onChange={(e) => patch({ titlePayOut: e.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Pay in title
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={draft.titlePayIn}
              onChange={(e) => patch({ titlePayIn: e.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Pay out direction line
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={draft.directionPayOut}
              onChange={(e) => patch({ directionPayOut: e.target.value })}
            />
          </label>
          <label className="block text-xs text-slate-500">
            Pay in direction line
            <input
              className={`mt-1 w-full ${fieldInputClass}`}
              value={draft.directionPayIn}
              onChange={(e) => patch({ directionPayIn: e.target.value })}
            />
          </label>
        </div>

        <label className="block text-xs text-slate-500">
          Footer message
          <input
            className={`mt-1 w-full ${fieldInputClass}`}
            value={draft.footerText}
            onChange={(e) => patch({ footerText: e.target.value })}
          />
        </label>

        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              className="accent-amber-500"
              checked={draft.softBold}
              onChange={(e) => patch({ softBold: e.target.checked })}
            />
            Soft typography (less bold)
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              className="accent-amber-500"
              checked={draft.showSession}
              onChange={(e) => patch({ showSession: e.target.checked })}
            />
            Show session
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              className="accent-amber-500"
              checked={draft.showTime}
              onChange={(e) => patch({ showTime: e.target.checked })}
            />
            Show time
          </label>
        </div>

        <section className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Extra lines
            </div>
            <Button type="button" variant="ghost" className="text-[10px]" onClick={addLine}>
              + Add line
            </Button>
          </div>
          {draft.customLines.length === 0 ? (
            <p className="text-xs text-slate-400">Optional signature or note lines for the slip.</p>
          ) : (
            <ul className="space-y-2">
              {draft.customLines.map((line) => (
                <li
                  key={line.id}
                  draggable
                  onDragStart={() => setDragId(line.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragId) moveLine(dragId, line.id);
                    setDragId(null);
                  }}
                  onDragEnd={() => setDragId(null)}
                  className="rounded-md border border-slate-200 bg-slate-50/80 p-2 dark:border-slate-700 dark:bg-slate-900/50"
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className="cursor-grab select-none text-slate-400">⋮⋮</span>
                    <label className="flex items-center gap-1 text-[10px] text-slate-500">
                      <input
                        type="checkbox"
                        className="accent-amber-500"
                        checked={line.enabled}
                        onChange={(e) => updateLine(line.id, { enabled: e.target.checked })}
                      />
                      On
                    </label>
                    <label className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                      <input
                        type="checkbox"
                        className="accent-amber-500"
                        checked={line.bold}
                        onChange={(e) => updateLine(line.id, { bold: e.target.checked })}
                      />
                      Bold
                    </label>
                    <button
                      type="button"
                      className="ml-auto text-[10px] text-rose-600"
                      onClick={() => removeLine(line.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    className={`w-full ${fieldInputClass} ${line.bold ? "font-semibold" : ""}`}
                    value={line.text}
                    onChange={(e) => updateLine(line.id, { text: e.target.value })}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="text-xs" onClick={save}>
            Save pay-out slip
          </Button>
          <Button type="button" variant="ghost" className="text-xs" onClick={reset}>
            Reset defaults
          </Button>
        </div>
      </div>
    </div>
  );
}
