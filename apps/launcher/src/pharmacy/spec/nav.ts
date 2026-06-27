import type { PopsNavItem } from "../../pops/spec/modules";

/** Pharmacy management navigation — all required business features. */
export const pharmacyNavItems: PopsNavItem[] = [
  { type: "link", path: "pharmacy/dashboard", label: "Dashboard" },
  { type: "link", path: "pharmacy/staff-panel", label: "Staff panel" },
  { type: "link", path: "pharmacy/admin-panel", label: "Admin panel" },
  {
    type: "group",
    label: "Medicines",
    children: [
      { path: "pharmacy/medicines", label: "Presentation & generic" },
      { path: "pharmacy/inventory", label: "Medicine inventory" },
      { path: "pharmacy/expiry", label: "Batch & expiry" },
      { path: "pharmacy/suppliers", label: "Manage suppliers" },
    ],
  },
  {
    type: "group",
    label: "Purchase",
    children: [
      { path: "pharmacy/purchase-statement", label: "Purchase statement" },
      { path: "pharmacy/supplier-payments", label: "Supplier payments" },
      { path: "pharmacy/medicines", label: "Add / receive stock" },
    ],
  },
  {
    type: "group",
    label: "Sales",
    children: [
      { path: "pharmacy/pos", label: "Quick billing" },
      { path: "pharmacy/sales", label: "Sales history" },
      { path: "pharmacy/sales-statement", label: "Sales statement" },
      { path: "pharmacy/sales-month", label: "Sales of the month" },
    ],
  },
  {
    type: "group",
    label: "Reports",
    children: [
      { path: "pharmacy/profit-loss", label: "Profit / loss report" },
      { path: "pharmacy/expired", label: "Expired products" },
      { path: "pharmacy/finance", label: "Finance summary" },
      { path: "pharmacy/reports", label: "Reports hub" },
    ],
  },
  { type: "link", path: "pharmacy/prescriptions", label: "Prescriptions" },
  { type: "link", path: "pharmacy/customers", label: "Customers" },
  { type: "link", path: "pharmacy/doctors", label: "Doctors" },
  { type: "link", path: "pharmacy/staff", label: "Staff management" },
  { type: "link", path: "auth", label: "Users & roles" },
  { type: "link", path: "notifications", label: "Notifications" },
  { type: "link", path: "settings", label: "Settings" },
];

export const PHARMACY_ROLE_LABELS: Record<string, string> = {
  admin: "Admin — full access",
  pharmacist: "Pharmacist — prescriptions & dispensing",
  cashier: "Cashier — billing & payments",
  inventory_manager: "Inventory manager — stock & purchases",
  manager: "Store owner / manager — analytics",
};
