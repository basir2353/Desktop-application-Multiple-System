import { Link } from "react-router-dom";
import { PageHeader } from "../../pops/ui/PageHeader";

const adminLinks = [
  { to: "/pops/pharmacy/dashboard", label: "Dashboard", desc: "Sales, stock, and alerts overview" },
  { to: "/pops/pharmacy/medicines", label: "Medicines & generic names", desc: "Add medicines and opening stock" },
  { to: "/pops/pharmacy/inventory", label: "Medicine inventory", desc: "Stock levels and alerts" },
  { to: "/pops/pharmacy/expiry", label: "Batch & expiry", desc: "Batch-level stock tracking" },
  { to: "/pops/pharmacy/suppliers", label: "Manage suppliers", desc: "Supplier contacts and terms" },
  { to: "/pops/pharmacy/purchase-statement", label: "Purchase statement", desc: "All purchase orders" },
  { to: "/pops/pharmacy/supplier-payments", label: "Supplier payments", desc: "Balances and amounts due" },
  { to: "/pops/pharmacy/pos", label: "Quick billing", desc: "Counter sales and invoices" },
  { to: "/pops/pharmacy/prescriptions", label: "Prescriptions", desc: "Verify and dispense to patients" },
  { to: "/pops/pharmacy/customers", label: "Customers", desc: "Patient profiles and loyalty" },
  { to: "/pops/pharmacy/doctors", label: "Doctors", desc: "Prescribing doctors database" },
  { to: "/pops/pharmacy/sales", label: "Sales history", desc: "Invoices and reprints" },
  { to: "/pops/pharmacy/sales-month", label: "Sales of the month", desc: "Filtered monthly sales" },
  { to: "/pops/pharmacy/profit-loss", label: "Profit / loss report", desc: "Revenue vs costs" },
  { to: "/pops/pharmacy/expired", label: "Expired products", desc: "Expired and near-expiry batches" },
  { to: "/pops/pharmacy/finance", label: "Finance summary", desc: "Revenue and transactions" },
  { to: "/pops/pharmacy/reports", label: "Reports hub", desc: "Combined analytics" },
  { to: "/pops/pharmacy/staff", label: "Staff management", desc: "Employees and payroll" },
  { to: "/pops/auth", label: "Users & permissions", desc: "System access control" },
];

export function PharmacyAdminPanelPage(): JSX.Element {
  return (
    <div className="space-y-6">
      <PageHeader title="Admin panel" subtitle="Full pharmacy control — all modules linked from one place." />
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
