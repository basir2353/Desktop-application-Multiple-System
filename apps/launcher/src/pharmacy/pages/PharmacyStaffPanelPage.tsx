import { Link } from "react-router-dom";
import { usePopsStore } from "../../stores/popsStore";
import { PageHeader } from "../../pops/ui/PageHeader";

const staffLinks = [
  { to: "/pops/pharmacy/dashboard", label: "Dashboard", desc: "Today's sales and alerts" },
  { to: "/pops/pharmacy/pos", label: "Sales screen", desc: "Scan, batch select, checkout" },
  { to: "/pops/pharmacy/khata", label: "Khata payments", desc: "Record partial customer payments" },
  { to: "/pops/pharmacy/shifts", label: "My shift", desc: "Open/close shift and cash count" },
  { to: "/pops/pharmacy/prescriptions", label: "Prescriptions", desc: "Verify and dispense medicines" },
  { to: "/pops/pharmacy/controlled-drugs", label: "Controlled drugs", desc: "Approval and compliance log" },
  { to: "/pops/pharmacy/inventory", label: "Stock check", desc: "Levels, rack locations, low stock" },
  { to: "/pops/pharmacy/expired", label: "Expiry alerts", desc: "Near-expiry batches to prioritize" },
  { to: "/pops/pharmacy/refill-reminders", label: "Refill reminders", desc: "Chronic patient follow-ups" },
  { to: "/pops/pharmacy/customers", label: "Patients", desc: "Profiles, allergies, history" },
];

export function PharmacyStaffPanelPage(): JSX.Element {
  const displayRole = usePopsStore((s) => s.displayRole);
  const branch = usePopsStore((s) => s.branch);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff panel"
        subtitle={`Quick access for pharmacists, cashiers, and floor staff · Role: ${displayRole} · ${branch?.name ?? "—"}`}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {staffLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-500/40 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/40"
          >
            <div className="font-semibold text-slate-900 dark:text-white">{link.label}</div>
            <p className="mt-1 text-sm text-slate-500">{link.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
