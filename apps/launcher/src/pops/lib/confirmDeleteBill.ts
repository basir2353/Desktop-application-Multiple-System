import type { Bill } from "@platform/contracts";

export function confirmDeleteBill(bill: Bill): boolean {
  const label = bill.orderRef ?? bill.billRef;
  return confirm(
    `Permanently delete order ${label}?\n\nBill ${bill.billRef} will be removed from the system. This action cannot be undone.`,
  );
}
