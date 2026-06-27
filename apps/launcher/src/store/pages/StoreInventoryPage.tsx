import { useQuery } from "@tanstack/react-query";
import { fetchStoreProducts, fetchStoreTransactions } from "../api/store";
import { formatPkr, useStoreAccess } from "../hooks/useStore";
import { StoreStatCard } from "../ui/StoreUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { StoreDataTable } from "../ui/StoreUi";
import { Badge } from "../../pops/ui/Badge";

export function StoreInventoryPage(): JSX.Element {
  const { branch } = useStoreAccess();
  const productsQuery = useQuery({ queryKey: ["store", "products", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreProducts(branch!.code) });
  const txQuery = useQuery({ queryKey: ["store", "transactions", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreTransactions(branch!.code) });

  const products = productsQuery.data ?? [];
  const totalValue = products.reduce((s, p) => s + p.inventoryValue, 0);
  const available = products.reduce((s, p) => s + p.availableStock, 0);
  const reserved = products.reduce((s, p) => s + p.reservedStock, 0);
  const damaged = products.reduce((s, p) => s + p.damagedStock, 0);
  const expired = products.reduce((s, p) => s + p.expiredStock, 0);
  const inTransit = products.reduce((s, p) => s + p.inTransitStock, 0);

  return (
    <div className="space-y-5">
      <PageHeader title="Inventory overview" subtitle="Track available, reserved, damaged, expired, and in-transit stock." />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StoreStatCard label="Available" value={available.toLocaleString()} tone="success" />
        <StoreStatCard label="Reserved" value={reserved.toLocaleString()} />
        <StoreStatCard label="Damaged" value={damaged.toLocaleString()} tone="warning" />
        <StoreStatCard label="Expired" value={expired.toLocaleString()} tone="danger" />
        <StoreStatCard label="In transit" value={inTransit.toLocaleString()} />
      </div>

      <StoreStatCard label="Total inventory value" value={formatPkr(totalValue)} />

      <StoreDataTable
        columns={["SKU", "Product", "Available", "Reserved", "Damaged", "Expired", "In transit", "Value", "Status"]}
        rows={products.map((p) => [
          p.sku, p.name, p.availableStock, p.reservedStock, p.damagedStock, p.expiredStock, p.inTransitStock,
          formatPkr(p.inventoryValue),
          p.availableStock === 0 ? <Badge tone="danger">Out</Badge> : p.availableStock <= p.reorderLevel ? <Badge tone="warning">Low</Badge> : <Badge tone="success">OK</Badge>,
        ])}
      />

      <h3 className="text-sm font-semibold">Recent inventory transactions</h3>
      <StoreDataTable
        columns={["Product", "Type", "Qty", "Reference", "Date"]}
        rows={(txQuery.data ?? []).slice(0, 20).map((t) => [
          t.productName, t.type.replace(/_/g, " "), t.qty, t.reference ?? "—", new Date(t.createdAt).toLocaleString(),
        ])}
      />
    </div>
  );
}
