import type { PopsNavItem } from "../../pops/spec/modules";

/** Pharmacy management navigation — full ERP feature set. */
export const pharmacyNavItems: PopsNavItem[] = [
  { type: "link", path: "pharmacy/dashboard", label: "Dashboard" },
  { type: "link", path: "pharmacy/staff-panel", label: "Staff panel" },
  { type: "link", path: "pharmacy/admin-panel", label: "Admin panel" },
  {
    type: "group",
    label: "Billing & checkout",
    children: [
      { path: "pharmacy/pos", label: "Sales screen (POS)" },
      { path: "pharmacy/khata", label: "Khata & partial payments" },
      { path: "pharmacy/shifts", label: "Shift & cash reconciliation" },
    ],
  },
  {
    type: "group",
    label: "Pharmacy features",
    children: [
      { path: "pharmacy/prescriptions", label: "Prescriptions" },
      { path: "pharmacy/controlled-drugs", label: "Controlled substances" },
      { path: "pharmacy/refill-reminders", label: "Refill reminders" },
    ],
  },
  {
    type: "group",
    label: "Inventory & stock",
    children: [
      { path: "pharmacy/medicines", label: "Medicines & generic names" },
      { path: "pharmacy/rack-map", label: "Rack / shelf map" },
      { path: "pharmacy/inventory", label: "Stock levels & alerts" },
      { path: "pharmacy/expiry", label: "Batch & expiry tracking" },
      { path: "pharmacy/suppliers", label: "Suppliers & vendors" },
    ],
  },
  {
    type: "group",
    label: "Purchase",
    children: [
      { path: "pharmacy/purchase-statement", label: "Purchase orders" },
      { path: "pharmacy/supplier-payments", label: "Supplier payments" },
    ],
  },
  {
    type: "group",
    label: "Sales & CRM",
    children: [
      { path: "pharmacy/sales", label: "Sales history" },
      { path: "pharmacy/customers", label: "Patients & customers" },
      { path: "pharmacy/doctors", label: "Doctors" },
    ],
  },
  {
    type: "group",
    label: "Reports & analytics",
    children: [
      { path: "pharmacy/sales-month", label: "Daily & monthly sales" },
      { path: "pharmacy/profit-loss", label: "Profit / loss" },
      { path: "pharmacy/expired", label: "Expiry reports" },
      { path: "pharmacy/tax-compliance", label: "Tax & compliance" },
      { path: "pharmacy/finance", label: "Finance summary" },
      { path: "pharmacy/reports", label: "Reports hub" },
    ],
  },
  { type: "link", path: "pharmacy/staff", label: "Staff management" },
  { type: "link", path: "auth", label: "Users & roles" },
  { type: "link", path: "notifications", label: "Notifications" },
  { type: "link", path: "settings", label: "Settings" },
];

export const PHARMACY_ROLE_LABELS: Record<string, string> = {
  admin: "Admin — full access, users, reports, inventory",
  pharmacist: "Pharmacist — prescriptions, dispensing, controlled drugs",
  cashier: "Cashier — billing, payments, Khata, limited inventory",
  inventory_manager: "Inventory manager — stock, purchases, expiry",
  manager: "Manager — analytics, finance, shift oversight",
};
