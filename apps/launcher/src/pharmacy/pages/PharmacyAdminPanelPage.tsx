import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";

const adminLinks = [
  { to: "/pops/pharmacy/dashboard", label: "Dashboard", desc: "Sales, stock, expiry alerts, and KPIs" },
  { to: "/pops/pharmacy/pos", label: "Sales screen (POS)", desc: "Barcode billing, batches, mixed payments" },
  { to: "/pops/pharmacy/khata", label: "Khata & credit", desc: "Partial payments and customer statements" },
  { to: "/pops/pharmacy/shifts", label: "Shift management", desc: "Cash reconciliation and cashier reports" },
  { to: "/pops/pharmacy/prescriptions", label: "Prescriptions", desc: "Upload, verify, and dispense" },
  { to: "/pops/pharmacy/controlled-drugs", label: "Controlled substances", desc: "Regulatory compliance logs" },
  { to: "/pops/pharmacy/refill-reminders", label: "Refill reminders", desc: "SMS, email, WhatsApp for chronic patients" },
  { to: "/pops/pharmacy/medicines", label: "Medicines catalog", desc: "Generic names, rack/shelf, warnings" },
  { to: "/pops/pharmacy/inventory", label: "Inventory", desc: "Low stock and reorder alerts" },
  { to: "/pops/pharmacy/expiry", label: "Batch & expiry", desc: "1/2/3 month expiry tracking" },
  { to: "/pops/pharmacy/suppliers", label: "Suppliers", desc: "Vendor records and purchase history" },
  { to: "/pops/pharmacy/customers", label: "Patients & CRM", desc: "Allergies, conditions, purchase history" },
  { to: "/pops/pharmacy/sales-month", label: "Sales reports", desc: "Daily and monthly analytics" },
  { to: "/pops/pharmacy/profit-loss", label: "Profit / loss", desc: "Revenue, COGS, net profit" },
  { to: "/pops/pharmacy/expired", label: "Expiry reports", desc: "Expired and near-expiry stock" },
  { to: "/pops/pharmacy/tax-compliance", label: "Tax & compliance", desc: "FBR invoicing and GST summaries" },
  { to: "/pops/pharmacy/staff", label: "Staff management", desc: "Employees and payroll" },
  { to: "/pops/auth", label: "Users & permissions", desc: "Admin, pharmacist, cashier roles" },
];

export function PharmacyAdminPanelPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title="Admin panel" subtitle="Full pharmacy ERP — billing, inventory, CRM, compliance, and reports." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {adminLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 transition hover:border-emerald-500/50 hover:shadow-md dark:bg-emerald-950/20"
          >
            <div className="font-semibold text-slate-900 dark:text-white">{link.label}</div>
            <p className="mt-1 text-sm text-slate-500">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
