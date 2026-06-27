import type { PopsNavItem } from "../../pops/spec/modules";

export const storeNavItems: PopsNavItem[] = [
  { type: "link", path: "store/dashboard", label: "Dashboard" },
  {
    type: "group",
    label: "Products",
    children: [
      { path: "store/products", label: "Product master" },
      { path: "store/categories", label: "Categories & brands" },
      { path: "store/batches", label: "Batch & expiry" },
      { path: "store/barcode", label: "Barcode & QR" },
    ],
  },
  {
    type: "group",
    label: "Inventory",
    children: [
      { path: "store/inventory", label: "Stock overview" },
      { path: "store/stock-movement", label: "Stock in / out" },
      { path: "store/transfers", label: "Transfers" },
      { path: "store/adjustments", label: "Adjustments" },
      { path: "store/audits", label: "Stock audit" },
    ],
  },
  {
    type: "group",
    label: "Purchase",
    children: [
      { path: "store/purchase/requisitions", label: "Requisitions" },
      { path: "store/purchase/orders", label: "Purchase orders" },
      { path: "store/purchase/grn", label: "Goods receiving (GRN)" },
      { path: "store/suppliers", label: "Suppliers" },
    ],
  },
  {
    type: "group",
    label: "Sales",
    children: [
      { path: "store/pos", label: "Point of sale" },
      { path: "store/sales", label: "Sales orders" },
      { path: "store/customers", label: "Customers" },
    ],
  },
  { type: "link", path: "store/warehouses", label: "Warehouses" },
  {
    type: "group",
    label: "Reports",
    children: [
      { path: "store/reports/stock", label: "Stock reports" },
      { path: "store/reports/profit-loss", label: "Profit / loss" },
      { path: "store/reports/inventory", label: "Inventory valuation" },
      { path: "store/reports", label: "Reports hub" },
    ],
  },
  { type: "link", path: "auth", label: "Users & roles" },
  { type: "link", path: "notifications", label: "Notifications" },
  { type: "link", path: "settings", label: "Settings" },
];

export const STORE_ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin — full access",
  inventory_manager: "Inventory Manager — stock & products",
  warehouse_manager: "Warehouse Manager — warehouses & transfers",
  purchase_officer: "Purchase Officer — PO & GRN",
  sales_manager: "Sales Manager — orders & customers",
  accountant: "Accountant — reports & finance",
  staff: "Staff — POS & basic access",
};
