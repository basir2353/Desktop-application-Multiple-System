import { useEffect, useMemo, useState } from "react";
import { fieldInputClass } from "../lib/themeClasses";
import type { PosCartLine } from "../lib/posCart";

type Props = {
  open: boolean;
  kitchenNote: string;
  cartLines: PosCartLine[];
  selectedItemKey: string | null;
  onKitchenNoteChange: (note: string) => void;
  onItemNoteChange: (itemKey: string, note: string) => void;
  onSelectItemKey: (key: string) => void;
  onClose: () => void;
};

export function PosOrderNotesModal({
  open,
  kitchenNote,
  cartLines,
  selectedItemKey,
  onKitchenNoteChange,
  onItemNoteChange,
  onSelectItemKey,
  onClose,
}: Props): JSX.Element | null {
  const editableLines = useMemo(
    () => cartLines.filter((line) => !line.isComplimentary),
    [cartLines],
  );

  const activeKey =
    selectedItemKey && editableLines.some((line) => line.key === selectedItemKey)
      ? selectedItemKey
      : (editableLines[0]?.key ?? null);

  const activeLine = editableLines.find((line) => line.key === activeKey) ?? null;

  const [draftBillNote, setDraftBillNote] = useState(kitchenNote);
  const [draftItemNote, setDraftItemNote] = useState(activeLine?.lineNote ?? "");

  useEffect(() => {
    if (!open) return;
    setDraftBillNote(kitchenNote);
    setDraftItemNote(activeLine?.lineNote ?? "");
  }, [open, kitchenNote, activeLine?.lineNote, activeLine?.key]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  function saveAndClose(): void {
    onKitchenNoteChange(draftBillNote.slice(0, 200));
    if (activeKey) onItemNoteChange(activeKey, draftItemNote.slice(0, 80));
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/25 p-4 dark:bg-black/65"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-order-notes-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="pos-order-notes-title" className="text-sm font-semibold text-slate-900 dark:text-white">
          Order notes
        </h2>
        <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
          Bill note goes to kitchen; item note applies to one dish only.
        </p>

        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Bill note
        </label>
        <input
          type="text"
          value={draftBillNote}
          onChange={(e) => setDraftBillNote(e.target.value.slice(0, 200))}
          placeholder="Whole order — e.g. birthday table"
          maxLength={200}
          className={`mt-1 ${fieldInputClass} w-full text-xs`}
          autoFocus
        />

        <label className="mt-3 block text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Item note
        </label>
        {editableLines.length === 0 ? (
          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
            Add items to the cart first.
          </p>
        ) : (
          <>
            {editableLines.length > 1 ? (
              <select
                value={activeKey ?? ""}
                onChange={(e) => {
                  const key = e.target.value;
                  onSelectItemKey(key);
                  const line = editableLines.find((row) => row.key === key);
                  setDraftItemNote(line?.lineNote ?? "");
                }}
                className={`mt-1 ${fieldInputClass} w-full text-xs`}
              >
                {editableLines.map((line) => (
                  <option key={line.key} value={line.key}>
                    {line.lineLabel} ×{line.qty}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-[11px] font-medium text-slate-700 dark:text-slate-200">
                {activeLine?.lineLabel} ×{activeLine?.qty ?? 1}
              </p>
            )}
            <input
              type="text"
              value={draftItemNote}
              onChange={(e) => setDraftItemNote(e.target.value.slice(0, 80))}
              placeholder="e.g. بدون مرچ"
              maxLength={80}
              className={`mt-1.5 ${fieldInputClass} w-full text-xs`}
            />
          </>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={saveAndClose}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
