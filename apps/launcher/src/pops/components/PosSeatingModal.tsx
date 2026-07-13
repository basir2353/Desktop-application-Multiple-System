import { useEffect, useRef, useState } from "react";
import type { RestaurantTable, SeatingSection } from "@platform/contracts";
import { modalBackdropClass } from "../lib/themeClasses";

type Props = {
  sections: SeatingSection[];
  tables: RestaurantTable[];
  selectedSectionId: string | null;
  selectedTableId: string | null;
  /** When editing an order, keep its current table selectable even if booked. */
  allowBookedTableId?: string | null;
  isLoading: boolean;
  /** Table numbers (uppercased) that currently have an active order. */
  occupiedTableNumbers?: Set<string>;
  onSelectSection: (sectionId: string | null) => void;
  onSelectTable: (tableId: string) => void;
  onClose: () => void;
};

function isTableBooked(table: RestaurantTable): boolean {
  return table.bookingStatus === "booked";
}

export function PosSeatingModal({
  sections,
  tables,
  selectedSectionId,
  selectedTableId,
  allowBookedTableId = null,
  isLoading,
  occupiedTableNumbers,
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
  const [viewAllSections, setViewAllSections] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedSection = viewAllSections
    ? null
    : (activeSections.find((s) => s.id === selectedSectionId) ?? null);

  useEffect(() => {
    if (viewAllSections || selectedSection) {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [viewAllSections, selectedSection]);
  const sectionTables = viewAllSections
    ? tables.filter((t) => t.isActive)
    : selectedSectionId
      ? tables.filter((t) => t.sectionId === selectedSectionId && t.isActive)
      : [];

  const sectionNameById = new Map(activeSections.map((s) => [s.id, s.name]));

  function handleTablePick(table: RestaurantTable): void {
    const booked = isTableBooked(table);
    const allowed = allowBookedTableId === table.id || selectedTableId === table.id;
    if (booked && !allowed) return;
    onSelectTable(table.id);
    onClose();
  }

  function backToSectionList(): void {
    setViewAllSections(false);
    onSelectSection(null);
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
              {viewAllSections
                ? "All sections"
                : selectedSection
                  ? selectedSection.name
                  : "Select seating section"}
            </h2>
            <p className="floor-modal-subtitle">
              {viewAllSections || selectedSection
                ? "Choose a free table. Booked tables stay locked until the order is closed or completed."
                : "Pick a section, or view all tables at once."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="floor-modal-close shrink-0" aria-label="Close">
            Close
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <p className="floor-modal-body-text">Loading floor plan…</p>
          ) : activeSections.length === 0 ? (
            <p className="floor-modal-body-text">No seating sections yet. Add them under Tables.</p>
          ) : !selectedSection && !viewAllSections ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setViewAllSections(true)}
                className="floor-modal-section-card border-amber-500/40 bg-amber-500/10"
              >
                <div className="floor-modal-section-title">All sections</div>
                <div className="floor-modal-section-meta">
                  {tables.filter((t) => t.isActive).length} tables total ·{" "}
                  {tables.filter((t) => t.isActive && isTableBooked(t)).length} booked
                </div>
              </button>
              {activeSections.map((section) => {
                const sectionActive = tables.filter((t) => t.sectionId === section.id && t.isActive);
                const count = sectionActive.length;
                const bookedCount = sectionActive.filter(isTableBooked).length;
                const empty = count === 0;
                return (
                  <button
                    key={section.id}
                    type="button"
                    disabled={empty}
                    onClick={() => {
                      setViewAllSections(false);
                      onSelectSection(section.id);
                    }}
                    className={`floor-modal-section-card ${empty ? "is-disabled" : ""}`}
                  >
                    <div className="floor-modal-section-title">{section.name}</div>
                    <div className="floor-modal-section-meta">
                      {empty
                        ? "No tables"
                        : `${count} table${count === 1 ? "" : "s"}${
                            bookedCount > 0 ? ` · ${bookedCount} booked` : ""
                          }`}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <>
              <button type="button" onClick={backToSectionList} className="floor-modal-back">
                ← All sections
              </button>
              {sectionTables.length === 0 ? (
                <p className="floor-modal-body-text">No tables in this section.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {sectionTables.map((t) => {
                    const selected = selectedTableId === t.id;
<<<<<<< Updated upstream
                    const booked = occupiedTableNumbers?.has(t.tableNumber.trim().toUpperCase()) ?? false;
=======
                    const booked = isTableBooked(t);
                    const allowedWhileBooked =
                      allowBookedTableId === t.id || selectedTableId === t.id;
                    const disabled = booked && !allowedWhileBooked;
>>>>>>> Stashed changes
                    return (
                      <button
                        key={t.id}
                        type="button"
<<<<<<< Updated upstream
                        disabled={booked}
                        onClick={() => handleTablePick(t.id)}
                        aria-label={booked ? `${t.tableNumber} — booked, unavailable` : t.tableNumber}
                        className={`floor-modal-table-btn ${selected ? "is-selected" : ""} ${booked ? "is-booked" : ""}`}
=======
                        disabled={disabled}
                        onClick={() => handleTablePick(t)}
                        className={`floor-modal-table-btn ${selected ? "is-selected" : ""} ${
                          booked ? "is-booked" : ""
                        }`}
                        title={
                          booked
                            ? t.bookedOrderRef
                              ? `Booked · ${t.bookedOrderRef}`
                              : "Booked — close or complete the current order first"
                            : undefined
                        }
>>>>>>> Stashed changes
                      >
                        {booked ? <span className="floor-modal-booked-badge">Booked</span> : null}
                        <div className="floor-modal-table-label">{t.tableNumber}</div>
                        <div className="floor-modal-table-meta">
                          {booked
                            ? t.bookedOrderRef
                              ? `Booked · ${t.bookedOrderRef}`
                              : "Booked"
                            : viewAllSections
                              ? (sectionNameById.get(t.sectionId) ?? "")
                              : `${t.seats} seats`}
                        </div>
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
