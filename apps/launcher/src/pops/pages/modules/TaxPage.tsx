import { Button } from "@platform/ui";
import { taxQueue } from "../../data/fixtures";
import { Badge } from "../../ui/Badge";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";

export function TaxPage(): JSX.Element {
  return (
    <div className="space-y-4">
      <PageHeader
        title="PRA / FBR digital invoicing"
        subtitle="Submit, verify, QR on receipt, queue when offline."
        actions={
          <>
            <Button variant="ghost" className="text-xs">
              Compliance log
            </Button>
            <Button className="text-xs">Retry failed</Button>
          </>
        }
      />

      <SimpleTable
        rowKey={(r) => String(r.inv)}
        columns={[
          { key: "inv", header: "Invoice" },
          { key: "amount", header: "Taxable (Rs)", render: (r) => Number(r.amount).toLocaleString() },
          { key: "tax", header: "Tax (Rs)", render: (r) => Number(r.tax).toLocaleString() },
          {
            key: "status",
            header: "PRA/FBR",
            id: "st",
            render: (r) => (
              <Badge
                tone={r.status === "Verified" ? "success" : r.status === "Queued" ? "warning" : "danger"}
              >
                {String(r.status)}
              </Badge>
            ),
          },
          { key: "praRef", header: "Reference / QR" },
          {
            id: "qr",
            key: "inv",
            header: "",
            render: () => (
              <span className="inline-block h-8 w-8 rounded border border-slate-600 bg-slate-800" title="QR placeholder" />
            ),
          },
        ]}
        rows={taxQueue as unknown as Record<string, unknown>[]}
      />
    </div>
  );
}
