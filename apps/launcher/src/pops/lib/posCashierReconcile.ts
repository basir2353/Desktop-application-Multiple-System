import type { Bill } from "@platform/contracts";

export type CashierPaymentItem = {
  ref: string;
  amount: number;
  at: string;
};

export type CashierPaymentGroup = {
  count: number;
  total: number;
  items: CashierPaymentItem[];
};

export type CashierPaymentGroups = {
  creditCard: CashierPaymentGroup;
  terminalCredit: CashierPaymentGroup;
  check: CashierPaymentGroup;
  houseAccount: CashierPaymentGroup;
};

function emptyGroup(): CashierPaymentGroup {
  return { count: 0, total: 0, items: [] };
}

function pushItem(group: CashierPaymentGroup, item: CashierPaymentItem): void {
  group.items.push(item);
  group.count += 1;
  group.total += item.amount;
}

/** Group completed bill payments since the cash session opened. */
export function buildSessionPaymentGroups(orders: Bill[], openedAt: string): CashierPaymentGroups {
  const since = new Date(openedAt).getTime();
  const groups: CashierPaymentGroups = {
    creditCard: emptyGroup(),
    terminalCredit: emptyGroup(),
    check: emptyGroup(),
    houseAccount: emptyGroup(),
  };

  for (const order of orders) {
    if (order.status !== "completed") continue;
    if (new Date(order.createdAt).getTime() < since) continue;

    for (const payment of order.payments) {
      if (payment.amount <= 0) continue;
      const item: CashierPaymentItem = {
        ref: order.billRef,
        amount: payment.amount,
        at: order.createdAt,
      };
      if (payment.method === "card") pushItem(groups.creditCard, item);
      else if (payment.method === "wallet") pushItem(groups.terminalCredit, item);
      else if (payment.method === "bank") pushItem(groups.check, item);
    }
  }

  return groups;
}
