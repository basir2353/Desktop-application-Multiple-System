import { useEffect } from "react";
import { POS_ORDER_MODES, type PosOrderMode } from "../lib/posOrderMode";
import { modalBackdropClass } from "../lib/themeClasses";

const ORDER_TYPE_HINTS: Record<PosOrderMode, string> = {
  "dine-in": "Table service · choose seating next",
  takeaway: "Counter pickup · no table needed",
  delivery: "Customer delivery · assign rider",
  online: "Web or app orders",
  foodpanda: "Foodpanda aggregator orders",
};

type Props = {
  selectedMode: PosOrderMode;
  onSelect: (mode: PosOrderMode) => void;
  onClose: () => void;
};

export function PosOrderTypeModal({ selectedMode, onSelect, onClose }: Props): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className={modalBackdropClass} onClick={onClose} role="presentation">
      <div
        data-ui="floor-modal"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-order-type-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="floor-modal-header flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <h2 id="pos-order-type-title" className="floor-modal-title">
              Select order type
            </h2>
            <p className="floor-modal-subtitle">
              Choose how this order will be served before continuing.
            </p>
          </div>
          <button type="button" onClick={onClose} className="floor-modal-close shrink-0" aria-label="Close">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {POS_ORDER_MODES.map(({ id, label }) => {
              const selected = selectedMode === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => onSelect(id)}
                  className={`floor-modal-section-card text-left ${
                    selected ? "border-amber-500/40 bg-amber-500/10" : ""
                  }`}
                >
                  <div className="floor-modal-section-title">{label}</div>
                  <div className="floor-modal-section-meta">{ORDER_TYPE_HINTS[id]}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
