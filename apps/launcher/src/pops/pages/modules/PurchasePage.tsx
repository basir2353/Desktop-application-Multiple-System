import { Button } from "@platform/ui";
import { purchaseOrders } from "../../data/fixtures";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";

export function PurchasePage(): JSX.Element {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Purchase & suppliers"
        subtitle="Purchase orders, GRN, supplier ledger, payables, and returns."
        actions={
          <>
            <Button variant="ghost" className="text-xs">
              New PO
            </Button>
            <Button className="text-xs">Record GRN</Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4 lg:col-span-2">
          <div className="text-sm font-medium text-white">Open purchase orders</div>
          <SimpleTable
            rowKey={(r) => String(r.po)}
            columns={[
              { key: "po", header: "PO #" },
              { key: "supplier", header: "Supplier" },
              {
                key: "status",
                header: "Status",
                id: "st",
                render: (r) => (
                  <Badge tone={r.status === "Open" ? "warning" : r.status === "Partial" ? "info" : "success"}>
                    {String(r.status)}
                  </Badge>
                ),
              },
              { key: "due", header: "Due" },
              { key: "amount", header: "Amount (Rs)", render: (r) => Number(r.amount).toLocaleString() },
            ]}
            rows={purchaseOrders as unknown as Record<string, unknown>[]}
          />
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
          <div className="text-sm font-medium text-white">Supplier snapshot</div>
          <ul className="mt-3 space-y-2 text-sm text-slate-300">
            <li className="flex justify-between">
              <span>Payables</span>
              <span className="text-amber-200">Rs 173,200</span>
            </li>
            <li className="flex justify-between">
              <span>Overdue</span>
              <span className="text-red-300">Rs 12,400</span>
            </li>
            <li className="flex justify-between">
              <span>Last payment</span>
              <span className="text-slate-400">May 09</span>
            </li>
          </ul>
          <Button variant="ghost" className="mt-4 w-full text-xs">
            Supplier payments
          </Button>
        </div>
      </div>
    </div>
  );
}
