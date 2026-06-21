import { PosCheckoutModal } from "./PosCheckoutModal";
import type { Bill, BillPayment } from "@platform/contracts";

type Props = {
  bill: Bill;
  isSubmitting?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    servicePct: number;
    taxPct: number;
    payments: BillPayment[];
  }) => void;
};

export function CompleteHeldBillModal({
  bill,
  isSubmitting = false,
  onClose,
  onConfirm,
}: Props): JSX.Element {
  return (
    <PosCheckoutModal
      mode="pay"
      title={`Complete payment — ${bill.billRef}`}
      subtotal={bill.subtotal}
      discount={bill.discount}
      servicePct={bill.servicePct}
      taxPct={bill.taxPct}
      total={bill.total}
      service={bill.service}
      tax={bill.tax}
      isSubmitting={isSubmitting}
      onClose={onClose}
      onConfirm={({ servicePct, taxPct, payments }) =>
        onConfirm({ servicePct, taxPct, payments })
      }
    />
  );
}
