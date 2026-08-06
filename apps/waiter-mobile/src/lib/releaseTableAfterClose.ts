import type { Bill } from "@platform/contracts";
import { fetchKitchenTickets, updateKitchenTicket } from "../api/kitchen";
import { tableNumberFromStation } from "./loadOrder";

/**
 * Free the dine-in table after a bill is closed/paid.
 * Tables stay booked while any kitchen ticket is not `done` (or bill is held).
 */
export async function releaseTableAfterBillClose(
  branchCode: string,
  bill: Bill,
): Promise<number> {
  const tickets = await fetchKitchenTickets(branchCode).catch(() => []);
  const orderRef = (bill.orderRef ?? "").trim().toLowerCase();
  const tableKey = (tableNumberFromStation(bill.tableLabel) ?? "").trim().toUpperCase();
  let released = 0;

  for (const ticket of tickets) {
    if (ticket.status === "done") continue;
    const ticketRef = (ticket.orderRef ?? "").trim().toLowerCase();
    const ticketTable = (tableNumberFromStation(ticket.stationLabel) ?? "")
      .trim()
      .toUpperCase();
    const sameRef = Boolean(orderRef && ticketRef && orderRef === ticketRef);
    const sameTable = Boolean(tableKey && ticketTable && tableKey === ticketTable);
    // Prefer orderRef match; allow same-table only when ticket has no conflicting orderRef.
    const ok =
      sameRef ||
      (sameTable && (!ticketRef || !orderRef || ticketRef === orderRef));
    if (!ok) continue;
    try {
      await updateKitchenTicket(ticket.id, { status: "done" });
      released += 1;
    } catch {
      // best-effort — bill is already completed
    }
  }
  return released;
}
