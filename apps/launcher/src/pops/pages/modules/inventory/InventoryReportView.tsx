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
  cookingUnitLabel = null,
}: {
  report: InventoryReport;
  cookingUnitLabel?: string | null;
}): JSX.Element {
  const rows = Array.isArray(report.data) ? report.data : [];

  if (rows.length === 0) {
    return <p className="mt-3 text-sm text-slate-500">No data for this report.</p>;
  }

  switch (report.id) {
    case "current-stock": {
      const stockRows = rows.filter(isRecord);
      const totalValue = stockRows.reduce(
        (sum, r) => sum + (typeof r.value === "number" ? r.value : Number(r.value) || 0),
        0,
      );
      return (
        <div className="space-y-2">
          <SimpleTable
            rowKey={(r) => `${cell(r.sku)}-${cell(r.name)}`}
            columns={[
              { key: "sku", header: "SKU", render: (r) => cell(r.sku) },
              { key: "name", header: "Ingredient", render: (r) => cell(r.name) },
              { key: "stock", header: "On hand", render: (r) => cell(r.stock) },
              { key: "kitchen", header: "Kitchen", render: (r) => cell(r.kitchen) },
              { key: "store", header: "Store", render: (r) => cell(r.store) },
              { key: "value", header: "Value (Rs)", render: (r) => formatPkrCell(r.value) },
            ]}
            rows={stockRows}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
                Total stock value
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Aap ke paas is amount ka stock maujood hai (on-hand × unit cost).
              </p>
            </div>
            <div className="text-lg font-bold tabular-nums text-amber-200">{formatPkr(totalValue)}</div>
          </div>
        </div>
      );
    }

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

    case "valuation": {
      const valuationRows = rows.filter(isRecord);
      const totalValue = valuationRows.reduce(
        (sum, r) => sum + (typeof r.value === "number" ? r.value : Number(r.value) || 0),
        0,
      );
      return (
        <div className="space-y-2">
          <SimpleTable
            rowKey={(r) => cell(r.category)}
            columns={[
              { key: "category", header: "Category", render: (r) => cell(r.category) },
              { key: "items", header: "Items", render: (r) => cell(r.items) },
              { key: "value", header: "Value (Rs)", render: (r) => formatPkrCell(r.value) },
            ]}
            rows={valuationRows}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
                Total stock value
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Saari categories milakar total inventory value.
              </p>
            </div>
            <div className="text-lg font-bold tabular-nums text-amber-200">{formatPkr(totalValue)}</div>
          </div>
        </div>
      );
    }

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

    case "stock-transfers": {
      const transferRows = rows.filter(isRecord);
      const totalValue = transferRows.reduce(
        (sum, r) => sum + (typeof r.value === "number" ? r.value : Number(r.value) || 0),
        0,
      );
      return (
        <div className="space-y-2">
          <SimpleTable
            rowKey={(r) => cell(r.id)}
            columns={[
              { key: "kitchenSection", header: "Cooking unit", render: (r) => cell(r.kitchenSection) },
              { key: "date", header: "Date", render: (r) => cell(r.date) },
              { key: "reference", header: "Voucher", render: (r) => cell(r.reference) },
              { key: "fromWarehouse", header: "From", render: (r) => cell(r.fromWarehouse) },
              { key: "toWarehouse", header: "To", render: (r) => cell(r.toWarehouse) },
              { key: "productName", header: "Product", render: (r) => cell(r.productName) },
              { key: "qty", header: "Qty", render: (r) => `${cell(r.qty)} ${cell(r.unit)}` },
              { key: "value", header: "Value (Rs)", render: (r) => formatPkrCell(r.value) },
            ]}
            rows={transferRows}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
                {cookingUnitLabel
                  ? `${cookingUnitLabel} — transfer value`
                  : "Total transfer value"}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {cookingUnitLabel
                  ? `${cookingUnitLabel} section mein is amount ka stock transfer hua hai.`
                  : "Saari lines ka total (qty × unit cost)."}
              </p>
            </div>
            <div className="text-lg font-bold tabular-nums text-amber-200">{formatPkr(totalValue)}</div>
          </div>
        </div>
      );
    }

    case "stock-transfers-by-section": {
      const sectionRows = rows.filter(isRecord);
      const totalValue = sectionRows.reduce(
        (sum, r) =>
          sum +
          (typeof r.valueIn === "number"
            ? r.valueIn
            : typeof r.totalValue === "number"
              ? r.totalValue
              : Number(r.valueIn ?? r.totalValue) || 0),
        0,
      );
      return (
        <div className="space-y-2">
          <SimpleTable
            rowKey={(r) => cell(r.id)}
            columns={[
              { key: "kitchenSection", header: "Cooking unit", render: (r) => cell(r.kitchenSection) },
              { key: "transferCount", header: "Vouchers", render: (r) => cell(r.transferCount) },
              { key: "lineCount", header: "Lines", render: (r) => cell(r.lineCount) },
              { key: "qtyIn", header: "Qty in", render: (r) => cell(r.qtyIn ?? r.totalQty) },
              { key: "qtyOut", header: "Qty out", render: (r) => cell(r.qtyOut ?? 0) },
              { key: "totalQty", header: "Net qty", render: (r) => cell(r.totalQty) },
              { key: "valueIn", header: "Value in (Rs)", render: (r) => formatPkrCell(r.valueIn) },
              { key: "valueOut", header: "Value out (Rs)", render: (r) => formatPkrCell(r.valueOut) },
              { key: "totalValue", header: "Net value (Rs)", render: (r) => formatPkrCell(r.totalValue) },
              { key: "products", header: "Products", render: (r) => cell(r.products) },
            ]}
            rows={sectionRows}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-200/80">
                {cookingUnitLabel
                  ? `${cookingUnitLabel} section — total transfer value`
                  : "Total transfer value (all units)"}
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {cookingUnitLabel
                  ? `${cookingUnitLabel} mein is amount ka stock transfer hua hai (value in).`
                  : "Har cooking unit ko kitni Rs value ka stock gaya — neeche grand total."}
              </p>
            </div>
            <div className="text-lg font-bold tabular-nums text-amber-200">{formatPkr(totalValue)}</div>
          </div>
        </div>
      );
    }

    case "cooking-unit-stock":
      return (
        <SimpleTable
          rowKey={(r) => cell(r.id)}
            columns={[
              { key: "kitchenSection", header: "Cooking unit", render: (r) => cell(r.kitchenSection) },
              { key: "productCategory", header: "Product category", render: (r) => cell(r.productCategory) },
              { key: "sku", header: "SKU", render: (r) => cell(r.sku) },
              { key: "productName", header: "Product", render: (r) => cell(r.productName) },
              { key: "quantity", header: "Qty in hand", render: (r) => `${cell(r.quantity)} ${cell(r.unit)}` },
              { key: "stockValue", header: "Value (Rs)", render: (r) => formatPkrCell(r.stockValue) },
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
