import { describe, expect, it } from "vitest";
import {
  filterPosRecentOrdersWithinDays,
  sumPosRecentOrdersItemQty,
  type PosRecentOrder,
} from "../recentOrders";

function order(
  partial: Partial<PosRecentOrder> & {
    id: string;
    createdAt: string;
    lines?: { label: string; qty: number; unitPrice: number }[];
  },
): PosRecentOrder {
  const lines = partial.lines ?? [
    { label: "A", qty: 2, unitPrice: 100 },
    { label: "B", qty: 3, unitPrice: 50 },
  ];
  const { lines: _drop, ...rest } = partial;
  return {
    ref: partial.ref ?? partial.id,
    stationLabel: "Takeaway",
    summary: "test",
    orderMode: "Takeaway",
    statusLabel: "Paid",
    kind: "paid",
    statusTone: "success",
    total: null,
    orderTakerName: null,
    updatedByName: null,
    detail: {
      kind: "paid",
      billRef: partial.id,
      orderRef: null,
      waiterName: "",
      notes: null,
      subtotal: 0,
      discount: 0,
      service: 0,
      tax: 0,
      total: 0,
      status: "completed",
      lines,
    },
    ...rest,
  } as PosRecentOrder;
}

describe("paid tab helpers", () => {
  it("filters to last 2 days", () => {
    const now = Date.now();
    const rows = [
      order({ id: "1", createdAt: new Date(now - 1 * 86_400_000).toISOString() }),
      order({ id: "2", createdAt: new Date(now - 3 * 86_400_000).toISOString() }),
    ];
    const filtered = filterPosRecentOrdersWithinDays(rows, 2);
    expect(filtered.map((r) => r.id)).toEqual(["1"]);
  });

  it("sums item quantities not order count", () => {
    const rows = [
      order({
        id: "1",
        createdAt: new Date().toISOString(),
        lines: [
          { label: "A", qty: 2, unitPrice: 1 },
          { label: "B", qty: 5, unitPrice: 1 },
        ],
      }),
      order({
        id: "2",
        createdAt: new Date().toISOString(),
        lines: [{ label: "C", qty: 1, unitPrice: 1 }],
      }),
    ];
    expect(sumPosRecentOrdersItemQty(rows)).toBe(8);
  });
});
