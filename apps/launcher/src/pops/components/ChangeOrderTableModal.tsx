import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { KitchenTicket } from "@platform/contracts";
import { fetchBranchFloor } from "../api/tables";
import { updateKitchenTicket } from "../api/kitchen";
import { tableStationLabel } from "../lib/orderHistory";
import { modalBackdropRaisedClass } from "../lib/themeClasses";

export type ChangeTableTicket = Pick<
  KitchenTicket,
  "id" | "stationLabel" | "orderRef" | "ticketRef" | "createdAt"
>;

type Props = {
  ticket: ChangeTableTicket;
  branchCode: string;
  onClose: () => void;
  onSuccess?: (message: string) => void;
};

export function ChangeOrderTableModal({
  ticket,
  branchCode,
  onClose,
  onSuccess,
}: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const floorQuery = useQuery({
    queryKey: ["tables", branchCode],
    queryFn: () => fetchBranchFloor(branchCode),
  });

  const sections = useMemo(
    () => (floorQuery.data?.sections ?? []).filter((s) => s.isActive),
    [floorQuery.data?.sections],
  );
  const tables = useMemo(
    () => (floorQuery.data?.tables ?? []).filter((t) => t.isActive),
    [floorQuery.data?.tables],
  );

  const selectedSection = sections.find((s) => s.id === selectedSectionId) ?? null;
  const sectionTables = selectedSectionId
    ? tables.filter((t) => t.sectionId === selectedSectionId)
    : [];

  useEffect(() => {
    if (selectedSection) {
      scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [selectedSection]);

  const currentTableNumber = useMemo(() => {
    const prefix = "table ";
    const label = ticket.stationLabel.trim();
    if (label.toLowerCase().startsWith(prefix)) {
      return label.slice(prefix.length).trim();
    }
    return null;
  }, [ticket.stationLabel]);

  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const changeMutation = useMutation({
    mutationFn: (tableNumber: string) =>
      updateKitchenTicket(ticket.id, { stationLabel: tableStationLabel(tableNumber) }),
    onSuccess: async (_ticket, tableNumber) => {
      await queryClient.invalidateQueries({ queryKey: ["kitchen"] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      const ref = ticket.orderRef ?? ticket.ticketRef;
      onSuccess?.(`Moved ${ref} to ${tableStationLabel(tableNumber)}.`);
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message ?? "Could not change table.");
    },
  });

  function handleTablePick(tableNumber: string): void {
    const nextLabel = tableStationLabel(tableNumber);
    if (nextLabel === ticket.stationLabel.trim()) {
      onClose();
      return;
    }
    setError(null);
    changeMutation.mutate(tableNumber);
  }

  const orderRef = ticket.orderRef ?? ticket.ticketRef;

  return (
    <div className={modalBackdropRaisedClass} onClick={onClose} role="presentation">
      <div
        data-ui="floor-modal"
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="change-table-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="floor-modal-header flex items-start justify-between gap-3 px-4 py-3">
          <div>
            <h2 id="change-table-title" className="floor-modal-title">
              Change table
            </h2>
            <p className="floor-modal-subtitle">
              {orderRef} · currently at <span className="font-medium">{ticket.stationLabel}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={changeMutation.isPending}
            className="floor-modal-close shrink-0"
            aria-label="Close"
          >
            Close
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
          {floorQuery.isLoading ? (
            <p className="floor-modal-body-text">Loading floor plan…</p>
          ) : floorQuery.isError ? (
            <p className="floor-modal-error">Could not load tables.</p>
          ) : sections.length === 0 ? (
            <p className="floor-modal-body-text">No seating sections yet. Add them under Tables.</p>
          ) : !selectedSection ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {sections.map((section) => {
                const count = tables.filter((t) => t.sectionId === section.id).length;
                const empty = count === 0;
                const disabled = empty || changeMutation.isPending;
                return (
                  <button
                    key={section.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedSectionId(section.id)}
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
              <button
                type="button"
                onClick={() => setSelectedSectionId(null)}
                disabled={changeMutation.isPending}
                className="floor-modal-back"
              >
                ← All sections
              </button>
              {sectionTables.length === 0 ? (
                <p className="floor-modal-body-text">No tables in this section.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {sectionTables.map((t) => {
                    const isCurrent = currentTableNumber != null && t.tableNumber === currentTableNumber;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        disabled={changeMutation.isPending}
                        onClick={() => handleTablePick(t.tableNumber)}
                        className={`floor-modal-table-btn ${isCurrent ? "is-selected" : ""}`}
                      >
                        <div className="floor-modal-table-label">{t.tableNumber}</div>
                        <div className="floor-modal-table-meta">
                          {isCurrent ? "Current" : `${t.seats} seats`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {changeMutation.isPending ? (
            <p className="floor-modal-body-text mt-3 text-xs">Updating table…</p>
          ) : null}
          {error ? <p className="floor-modal-error">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
