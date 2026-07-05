import { useEffect } from "react";
import type { ChangeTableTicket } from "./ChangeOrderTableModal";
import type { PosRecentOrder } from "../lib/recentOrders";
import { modalBackdropRaisedClass } from "../lib/themeClasses";

type Props = {
  orders: PosRecentOrder[];
  onPick: (ticket: ChangeTableTicket) => void;
  onClose: () => void;
};

export function PosTableTransferPickerModal({ orders, onPick, onClose }: Props): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={modalBackdropRaisedClass} onClick={onClose} role="presentation">
      <div
        className="flex max-h-[70vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-transfer-picker-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 id="table-transfer-picker-title" className="text-sm font-semibold text-slate-900 dark:text-white">
              Table transfer
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">Select a dine-in order to move to another table.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-1 text-slate-500 hover:text-slate-900 dark:hover:text-white"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {orders.map((order) => {
            const ticket = order.pendingTicket;
            if (!ticket) return null;
            return (
              <li key={order.id}>
                <button
                  type="button"
                  onClick={() => onPick(ticket)}
                  className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                    {order.ref}
                  </span>
                  <span className="text-xs text-slate-500">{order.stationLabel}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
