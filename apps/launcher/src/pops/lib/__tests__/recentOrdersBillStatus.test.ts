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

  it("hides kitchen-done tickets older than 48h from open Latest", () => {
    const old = {
      id: "55555555-5555-4555-8555-555555555555",
      ticketRef: "KOT-OLD",
      orderRef: "DI-4418",
      status: "done",
      stationLabel: "Dine-in",
      itemsSummary: "Biryani x1",
      lines: [{ label: "Biryani", qty: 1, unitPrice: 500 }],
      createdAt: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
      priority: "normal",
      mins: 0,
      startedAt: null,
      notes: null,
      createdByName: "Baqir",
      updatedByName: null,
      deliveryChargePkr: 0,
      riderId: null,
    } as unknown as KitchenTicket;
    const orders = buildPosRecentOrders([old], []);
    expect(orders).toHaveLength(0);
  });

  it("hides kitchen-done when a completed bill already settled that ORD", () => {
    const ticketAt = Date.now() - 2 * 60 * 60 * 1000;
    const ticket = {
      id: "66666666-6666-4666-8666-666666666666",
      ticketRef: "KOT-2",
      orderRef: "DI-4417",
      status: "done",
      stationLabel: "Dine-in",
      itemsSummary: "Karahi x1",
      lines: [{ label: "Karahi", qty: 1, unitPrice: 1000 }],
      createdAt: new Date(ticketAt).toISOString(),
      priority: "normal",
      mins: 0,
      startedAt: null,
      notes: null,
      createdByName: "Baqir",
      updatedByName: null,
      deliveryChargePkr: 0,
      riderId: null,
    } as unknown as KitchenTicket;
    const paid = bill({
      id: "77777777-7777-4777-8777-777777777777",
      status: "completed",
      orderRef: "DI-4417",
      // Bill after ticket → ticket is settled / hidden from open list.
      createdAt: new Date(ticketAt + 30 * 60 * 1000).toISOString(),
    });
    const orders = buildPosRecentOrders([ticket], [paid]);
    expect(orders.filter((o) => o.kind === "pending")).toHaveLength(0);
    expect(orders.some((o) => o.statusLabel === "Paid")).toBe(true);
  });
});
