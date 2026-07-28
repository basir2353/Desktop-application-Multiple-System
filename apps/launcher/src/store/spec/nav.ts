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
      { path: "store/purchase/orders", label: "Purchasing" },
      { path: "store/purchase/grn", label: "Goods receiving (GRN)" },
      { path: "store/purchase/returns", label: "Purchase returns" },
      { path: "store/suppliers", label: "Suppliers" },
    ],
  },
  {
    type: "group",
    label: "Point of Sale",
    children: [
      { path: "store/pos", label: "Sales Receipt" },
      { path: "store/pos-bookmarks", label: "Quick Pick bookmarks" },
      { path: "store/pay-in-out", label: "Pay In / Pay Out" },
      { path: "store/shifts", label: "Shifts & cash" },
      { path: "store/setup", label: "POS setup" },
      { path: "store/shortcuts", label: "POS shortcuts (F1–F12)" },
    ],
  },
  {
    type: "group",
    label: "Sales",
    children: [
      { path: "store/promotions", label: "Automatic Discounts" },
      { path: "store/price-checker", label: "Price checker" },
      { path: "store/coupons", label: "Coupons" },
      { path: "store/gift-cards", label: "Gift cards" },
      { path: "store/returns", label: "Returns & refunds" },
      { path: "store/sales", label: "Sales orders" },
      { path: "store/customers", label: "Customers" },
    ],
  },
  { type: "link", path: "store/warehouses", label: "Warehouses" },
  {
    type: "group",
    label: "Reports",
    children: [
      { path: "store/reports", label: "Overview" },
      { path: "store/reports/stock", label: "Stock reports" },
      { path: "store/reports/peak-hours", label: "Peak hours" },
      { path: "store/reports/employees", label: "Employee report" },
      { path: "store/reports/wastage", label: "Wastage report" },
      { path: "store/reports/profit-loss", label: "Profit / loss" },
      { path: "store/reports/inventory", label: "Inventory valuation" },
    ],
  },
  {
    type: "group",
    label: "Multi-branch",
    children: [
      { path: "multi-branch", label: "Overview" },
      { path: "multi-branch/transfers", label: "Transfers" },
      { path: "multi-branch/receive", label: "Receive" },
      { path: "multi-branch/pricing", label: "Branch pricing" },
      { path: "multi-branch/reports", label: "Consolidated report" },
    ],
  },
  {
    type: "group",
    label: "Tax & compliance",
    children: [
      { path: "tax", label: "Overview" },
      { path: "tax/fbr", label: "FBR" },
      { path: "tax/pra", label: "PRA" },
      { path: "tax/invoices", label: "Invoice queue" },
    ],
  },
  { type: "link", path: "printer", label: "Printer" },
  { type: "link", path: "closing", label: "Closing" },
  { type: "link", path: "sync", label: "Sync & backup" },
  { type: "link", path: "auth", label: "Users & roles" },
  {
    type: "group",
    label: "Notifications",
    children: [
      { path: "notifications", label: "Overview" },
      { path: "notifications/templates", label: "Templates" },
    ],
  },
  { type: "link", path: "security", label: "Security" },
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
