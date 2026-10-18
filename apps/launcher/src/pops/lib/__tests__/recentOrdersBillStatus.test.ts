import { describe, expect, it } from "vitest";
import type { Bill } from "@platform/contracts";
import type { KitchenTicket } from "@platform/contracts";
import {
  buildPosRecentOrders,
  canEditPosRecentOrder,
  isPaidPosRecentOrder,
} from "../recentOrders";

function bill(partial: Partial<Bill> & Pick<Bill, "id" | "status">): Bill {
  return {
    billRef: `B-${partial.id.slice(0, 8)}`,
    orderRef: `ORD-${partial.id.slice(0, 8)}`,
    tableLabel: "Takeaway",
    waiterId: null,
    waiterName: "Cashier",
    notes: null,
    subtotal: 100,
    discount: 0,
    service: 0,
    tax: 0,
    total: 100,
    servicePct: 0,
    taxPct: 0,
    deliveryChargePkr: 0,
    payments: [],
    lines: [{ label: "Tea", qty: 1, unitPrice: 100 }],
    createdAt: new Date().toISOString(),
    updatedByName: null,
    splitGroupRef: null,
    riderId: null,
    riderName: null,
    ...partial,
  } as Bill;
}

describe("bill list status", () => {
  it("labels held and open as Pending, not Paid", () => {
    const orders = buildPosRecentOrders(
      [],
      [
        bill({ id: "11111111-1111-4111-8111-111111111111", status: "held" }),
        bill({ id: "22222222-2222-4222-8222-222222222222", status: "open" }),
      ],
    );
    expect(orders).toHaveLength(2);
    for (const order of orders) {
      expect(order.statusLabel).toBe("Pending");
      expect(isPaidPosRecentOrder(order)).toBe(false);
      expect(canEditPosRecentOrder(order)).toBe(true);
    }
  });

  it("labels completed as Paid", () => {
    const orders = buildPosRecentOrders(
      [],
      [bill({ id: "33333333-3333-4333-8333-333333333333", status: "completed" })],
    );
    expect(orders[0]?.statusLabel).toBe("Paid");
    expect(isPaidPosRecentOrder(orders[0]!)).toBe(true);
  });

  it("allows edit on kitchen-done unpaid tickets", () => {
    const ticket = {
      id: "44444444-4444-4444-8444-444444444444",
      ticketRef: "KOT-1",
      orderRef: "ORD-99",
      status: "done",
      stationLabel: "Takeaway",
      itemsSummary: "Roti x4",
      lines: [{ label: "Roti", qty: 4, unitPrice: 20 }],
      createdAt: new Date().toISOString(),
      priority: "normal",
      mins: 0,
      startedAt: null,
      notes: null,
      createdByName: "Cashier",
      updatedByName: null,
      deliveryChargePkr: 0,
      riderId: null,
    } as unknown as KitchenTicket;
    const orders = buildPosRecentOrders([ticket], []);
    expect(orders[0]?.statusLabel).toBe("Kitchen done");
    expect(canEditPosRecentOrder(orders[0]!)).toBe(true);
    expect(isPaidPosRecentOrder(orders[0]!)).toBe(false);
  });
});
