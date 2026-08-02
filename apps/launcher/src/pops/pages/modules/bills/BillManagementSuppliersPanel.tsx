import { SuppliersPanel } from "../inventory/SuppliersPage";

/** Bill Management → Suppliers tab (same search / edit / activate as Inventory). */
export function BillManagementSuppliersPanel(): JSX.Element {
  return <SuppliersPanel showHeader={false} />;
}
