import { useEffect } from "react";
import type { RestaurantTable, SeatingSection } from "@platform/contracts";
import { modalBackdropClass } from "../lib/themeClasses";

type Props = {
  sections: SeatingSection[];
  tables: RestaurantTable[];
  selectedSectionId: string | null;
  selectedTableId: string | null;
  isLoading: boolean;
  onSelectSection: (sectionId: string | null) => void;
  onSelectTable: (tableId: string) => void;
  onClose: () => void;
};

export function PosSeatingModal({
  sections,
  tables,
  selectedSectionId,
  selectedTableId,
  isLoading,
  onSelectSection,
  onSelectTable,
  onClose,
}: Props): JSX.Element {
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activeSections = sections.filter((s) => s.isActive);
  const selectedSection = activeSections.find((s) => s.id === selectedSectionId) ?? null;
  const sectionTables = selectedSectionId
    ? tables.filter((t) => t.sectionId === selectedSectionId && t.isActive)
    : [];

  function handleTablePick(tableId: string): void {
    onSelectTable(tableId);
    onClose();
  }

  return (
    <div className={modalBackdropClass} onClick={onClose} role="presentation">
      <div
        data-ui="floor-modal"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pos-seating-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="floor-modal-header flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <h2 id="pos-seating-title" className="floor-modal-title">
              {selectedSection ? selectedSection.name : "Select seating section"}
            </h2>
            <p className="floor-modal-subtitle">
              {selectedSection
                ? "Choose a table for this dine-in order."
                : "Pick a section, then select a table."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="floor-modal-close shrink-0" aria-label="Close">
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="floor-modal-body-text">Loading floor plan…</p>
          ) : activeSections.length === 0 ? (
            <p className="floor-modal-body-text">No seating sections yet. Add them under Tables.</p>
          ) : !selectedSection ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {activeSections.map((section) => {
                const count = tables.filter((t) => t.sectionId === section.id && t.isActive).length;
                const empty = count === 0;
                return (
                  <button
                    key={section.id}
                    type="button"
                    disabled={empty}
                    onClick={() => onSelectSection(section.id)}
                    className={`floor-modal-section-card ${empty ? "is-disabled" : ""}`}
                  >
                    <div className="floor-modal-section-title">{section.name}</div>
                    <div className="floor-modal-section-meta">
                      {empty ? "No tables" : `${count} table${count === 1 ? "" : "s"}`}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <button type="button" onClick={() => onSelectSection(null)} className="floor-modal-back">
                ← All sections
              </button>
              {sectionTables.length === 0 ? (
                <p className="floor-modal-body-text">No tables in this section.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {sectionTables.map((t) => {
                    const selected = selectedTableId === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleTablePick(t.id)}
                        className={`floor-modal-table-btn ${selected ? "is-selected" : ""}`}
                      >
                        <div className="floor-modal-table-label">{t.tableNumber}</div>
                        <div className="floor-modal-table-meta">{t.seats} seats</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
