import { useEffect, useMemo, useState } from "react";
import {
  getPrintersForUser,
  listPrintersByType,
  loadPrinterRouting,
  PRINTER_ROUTING_CHANGED_EVENT,
  PRINTER_TYPE_LABELS,
  resolveReceiptPrinter,
  setUserPrinterForType,
  type PrinterProfile,
  type PrinterType,
} from "../lib/printerRouting";

type Props = {
  branchCode: string;
  userId: string;
  userLabel?: string;
  onClose: () => void;
};

const ASSIGNABLE_TYPES: PrinterType[] = ["receipt", "kitchen", "bar"];

function profileLabel(p: PrinterProfile): string {
  const os = p.systemPrinterName?.trim();
  const counter = p.assignedCounter?.trim();
  const bits = [p.name];
  if (counter) bits.push(counter);
  if (os) bits.push(os);
  return bits.join(" · ");
}

export function PosMyPrintersModal({ branchCode, userId, userLabel, onClose }: Props): JSX.Element {
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    function onChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!detail?.branchCode || detail.branchCode === branchCode) {
        setRevision((n) => n + 1);
      }
    }
    window.addEventListener(PRINTER_ROUTING_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(PRINTER_ROUTING_CHANGED_EVENT, onChanged);
  }, [branchCode]);

  const routing = useMemo(() => {
    void revision;
    return loadPrinterRouting(branchCode);
  }, [branchCode, revision]);

  const mine = useMemo(() => {
    void revision;
    return getPrintersForUser(branchCode, userId);
  }, [branchCode, userId, revision]);

  const activeReceipt = useMemo(() => {
    void revision;
    return resolveReceiptPrinter(branchCode, userId);
  }, [branchCode, userId, revision]);

  function selectedIdForType(type: PrinterType): string {
    return mine.find((p) => p.printerType === type)?.id ?? "";
  }

  function onPick(type: PrinterType, printerId: string): void {
    setUserPrinterForType(branchCode, userId, type, printerId || null);
    setNotice(
      printerId
        ? `${PRINTER_TYPE_LABELS[type]} printer saved for you.`
        : `${PRINTER_TYPE_LABELS[type]} cleared — branch default will be used.`,
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 dark:bg-black/60">
      <div
        className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-5 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-my-printers-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pos-my-printers-title" className="text-lg font-semibold text-white">
              My printers
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              Assign printers for this login
              {userLabel ? (
                <>
                  {" "}
                  (<span className="text-slate-300">{userLabel}</span>)
                </>
              ) : null}
              . Each cashier / waiter can pick their own — no shared default needed.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-white"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="mt-4 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Now printing bills with:{" "}
          <span className="font-semibold">
            {activeReceipt ? profileLabel(activeReceipt) : "No receipt printer (set below or in Printer page)"}
          </span>
        </div>

        <div className="mt-4 space-y-3">
          {ASSIGNABLE_TYPES.map((type) => {
            const options = listPrintersByType(branchCode, type);
            const value = selectedIdForType(type);
            return (
              <label key={type} className="block text-xs text-slate-400">
                <span className="font-medium text-slate-300">{PRINTER_TYPE_LABELS[type]} printer</span>
                <select
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                  value={value}
                  onChange={(e) => onPick(type, e.target.value)}
                >
                  <option value="">
                    {type === "receipt" ? "Branch default receipt" : `No personal ${PRINTER_TYPE_LABELS[type]}`}
                  </option>
                  {options.map((p) => (
                    <option key={p.id} value={p.id}>
                      {profileLabel(p)}
                      {p.status === "offline" ? " (offline)" : ""}
                    </option>
                  ))}
                </select>
                {options.length === 0 ? (
                  <span className="mt-1 block text-[10px] text-slate-500">
                    No {PRINTER_TYPE_LABELS[type].toLowerCase()} profiles yet — add them under Printer → Printer
                    Profiles.
                  </span>
                ) : null}
              </label>
            );
          })}
        </div>

        {routing.printers.length === 0 ? (
          <p className="mt-3 text-xs text-rose-300">
            No printer profiles configured. Open Printer page, add profiles, link OS printers, then come back here.
          </p>
        ) : null}

        {notice ? <p className="mt-3 text-xs text-emerald-400">{notice}</p> : null}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-amber-400"
            onClick={onClose}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
