import { useEffect } from "react";
import { modalBackdropRaisedClass } from "../lib/themeClasses";
import { StaffFoodPanel } from "./StaffFoodPanel";

type Props = {
  onClose: () => void;
};

export function PosStaffFoodModal({ onClose }: Props): JSX.Element {
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
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-staff-food-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="pos-staff-food-title" className="text-sm font-semibold text-slate-900 dark:text-white">
              Staff food
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Track staff meals and staff guests — what was ordered and the meal cost.
            </p>
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

        <div className="mt-4">
          <StaffFoodPanel />
        </div>
      </div>
    </div>
  );
}
