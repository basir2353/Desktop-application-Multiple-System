import type { InventoryReport } from "@platform/contracts";
import { formatPkr } from "../../../hooks/useInventory";
import { Badge } from "../../../ui/Badge";
import { SimpleTable } from "../../../ui/SimpleTable";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cell(value: unknown): string {
  if (value == null || value === "") return "—";
  if (typeof value === "number") return value.toLocaleString();
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function formatPkrCell(value: unknown): string {
  if (typeof value !== "number") return cell(value);
  return formatPkr(value);
}

export function InventoryReportView({
  report,
}: {
  report: InventoryReport;
}): JSX.Element {
  const rows = Array.isArray(report.data) ? report.data : [];

  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">No data for this report.</p>;
  }

  switch (report.id) {
    case "current-stock":
      return (
        <SimpleTable
          rowKey={(r) => `${cell(r.sku)}-${cell(r.name)}`}
          columns={[
            { key: "sku", header: "SKU", render: (r) => cell(r.sku) },
            { key: "name", header: "Ingredient", render: (r) => cell(r.name) },
            { key: "stock", header: "On hand", render: (r) => cell(r.stock) },
            { key: "value", header: "Value (Rs)", render: (r) => formatPkrCell(r.value) },
          ]}
          rows={rows.filter(isRecord)}
        />
      );

    case "low-stock":
      return (
        <SimpleTable
          rowKey={(r) => cell(r.id)}
          columns={[
            { key: "sku", header: "SKU", render: (r) => cell(r.sku) },
            { key: "name", header: "Ingredient", render: (r) => cell(r.name) },
            { key: "currentStock", header: "Stock", render: (r) => `${cell(r.currentStock)} ${cell(r.unit)}` },
            { key: "reorderLevel", header: "Reorder at", render: (r) => cell(r.reorderLevel) },
            {
              id: "status",
              key: "id",
              header: "Status",
              render: (r) =>
                Number(r.currentStock) === 0 ? (
                  <Badge tone="danger">Out of stock</Badge>
                ) : (
                  <Badge tone="warning">Low stock</Badge>
                ),
            },
          ]}
          rows={rows.filter(isRecord)}
        />
      );

    case "expiry":
      return (
        <SimpleTable
          rowKey={(r) => cell(r.id)}
          columns={[
            { key: "sku", header: "SKU", render: (r) => cell(r.sku) },
            { key: "name", header: "Ingredient", render: (r) => cell(r.name) },
            { key: "qty", header: "Qty", render: (r) => `${cell(r.qty)} ${cell(r.unit)}` },
            { key: "batch", header: "Batch", render: (r) => cell(r.batch) },
            { key: "expiry", header: "Expiry", render: (r) => cell(r.expiry) },
            { key: "location", header: "Location", render: (r) => cell(r.location) },
          ]}
          rows={rows.filter(isRecord)}
        />
      );

    case "valuation":
      return (
        <SimpleTable
          rowKey={(r) => cell(r.category)}
          columns={[
            { key: "category", header: "Category", render: (r) => cell(r.category) },
            { key: "items", header: "Items", render: (r) => cell(r.items) },
            { key: "value", header: "Value (Rs)", render: (r) => formatPkrCell(r.value) },
          ]}
          rows={rows.filter(isRecord)}
        />
      );

    case "consumption":
      return (
        <SimpleTable
          rowKey={(r) => cell(r.id)}
          columns={[
            { key: "date", header: "Date", render: (r) => cell(r.date) },
            { key: "ingredient", header: "Ingredient", render: (r) => cell(r.ingredient) },
            { key: "qty", header: "Qty", render: (r) => `${cell(r.qty)} ${cell(r.unit)}` },
            { key: "reason", header: "Reason", render: (r) => cell(r.reason) },
            { key: "status", header: "Status", render: (r) => cell(r.status) },
          ]}
          rows={rows.filter(isRecord)}
        />
      );

    case "recipe-cost":
      return (
        <div className="space-y-3">
          {rows.filter(isRecord).map((recipe) => (
            <div key={cell(recipe.id)} className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-medium text-white">{cell(recipe.name)}</span>
                  {recipe.menuItem ? (
                    <span className="ml-2 text-xs text-slate-500">· {cell(recipe.menuItem)}</span>
                  ) : null}
                </div>
                <span className="text-sm text-amber-200">{formatPkrCell(recipe.totalCost)} / portion</span>
              </div>
              {Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-400">
                  {(recipe.ingredients as Record<string, unknown>[]).map((line) => (
                    <li key={cell(line.id)}>
                      {cell(line.ingredient)} — {cell(line.qty)} {cell(line.unit)}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      );

    case "waste":
      return (
        <SimpleTable
          rowKey={(r) => cell(r.id)}
          columns={[
            { key: "date", header: "Date", render: (r) => cell(r.date) },
            { key: "ingredient", header: "Item", render: (r) => cell(r.ingredient) },
            { key: "qty", header: "Qty", render: (r) => `${cell(r.qty)} ${cell(r.unit)}` },
            { key: "wasteType", header: "Type", render: (r) => cell(r.wasteType) },
            { key: "costImpact", header: "Cost impact", render: (r) => <span className="text-red-300">{formatPkrCell(r.costImpact)}</span> },
            { key: "status", header: "Status", render: (r) => cell(r.status) },
          ]}
          rows={rows.filter(isRecord)}
        />
      );

    case "purchases":
      return (
        <SimpleTable
          rowKey={(r) => cell(r.id)}
          columns={[
            { key: "poNumber", header: "PO #", render: (r) => cell(r.poNumber) },
            { key: "supplierName", header: "Supplier", render: (r) => cell(r.supplierName) },
            { key: "status", header: "Status", render: (r) => cell(r.status) },
            { key: "items", header: "Items", render: (r) => cell(r.items) },
            { key: "totalAmount", header: "Amount (Rs)", render: (r) => formatPkrCell(r.totalAmount) },
            { key: "expectedDate", header: "Expected", render: (r) => cell(r.expectedDate) },
          ]}
          rows={rows.filter(isRecord)}
        />
      );

    case "suppliers":
      return (
        <SimpleTable
          rowKey={(r) => cell(r.id)}
          columns={[
            { key: "name", header: "Supplier", render: (r) => cell(r.name) },
            { key: "phone", header: "Contact", render: (r) => cell(r.phone) },
            { key: "paymentTerms", header: "Terms", render: (r) => cell(r.paymentTerms) },
            {
              key: "active",
              header: "Status",
              render: (r) => (
                <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</Badge>
              ),
            },
            { key: "totalPurchases", header: "Total purchases", render: (r) => formatPkrCell(r.totalPurchases) },
            { key: "lastOrder", header: "Last order", render: (r) => cell(r.lastOrder) },
          ]}
          rows={rows.filter(isRecord)}
        />
      );

    default: {
      const typedRows = rows.filter(isRecord);
      const keys = Object.keys(typedRows[0] ?? {}).slice(0, 6);
      return (
        <SimpleTable
          rowKey={(r) => cell(r.id) !== "—" ? cell(r.id) : `${cell(r.sku)}-${cell(r.name)}`}
          columns={keys.map((key) => ({
            key,
            header: key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase()),
            render: (r: Record<string, unknown>) => cell(r[key]),
          }))}
          rows={typedRows}
        />
      );
    }
  }
}
