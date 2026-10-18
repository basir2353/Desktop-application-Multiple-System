import { useMemo, useState } from "react";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { formatPkr } from "../lib/mobizoneStore";
import { MzField, MzInput } from "../ui/MobizoneUi";

export function MobizoneCustomersPage(): JSX.Element {
  const { db } = useMobizoneDb();
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return db.customers;
    return db.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (c.cnic ?? "").toLowerCase().includes(needle) ||
        (c.phone ?? "").includes(needle),
    );
  }, [db.customers, q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        subtitle="Buyers and sellers with CNIC, photos, phone, and pending balances."
      />
      <MzField label="Search">
        <MzInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, CNIC, phone…" className="max-w-md" />
      </MzField>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.length === 0 ? (
          <p className={`text-sm ${mutedClass}`}>No customers yet — they appear when you buy or sell.</p>
        ) : (
          rows.map((c) => (
            <article key={c.id} className={`${cardClass} flex gap-3 p-4`}>
              {c.photoDataUrl ? (
                <img src={c.photoDataUrl} alt="" className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-violet-500/15 text-sm font-semibold text-violet-600 dark:text-violet-300">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold text-slate-900 dark:text-white">{c.name}</h3>
                <p className={`text-xs ${mutedClass}`}>{c.phone || "No phone"} · {c.cnic || "No CNIC"}</p>
                {c.address ? <p className={`mt-1 truncate text-xs ${mutedClass}`}>{c.address}</p> : null}
                {(c.pendingPkr || 0) > 0 ? (
                  <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    Pending {formatPkr(c.pendingPkr)}
                  </p>
                ) : null}
                <div className="mt-2 flex gap-2">
                  {c.cnicFrontDataUrl ? (
                    <img src={c.cnicFrontDataUrl} alt="CNIC front" className="h-10 w-16 rounded object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
                  ) : null}
                  {c.cnicBackDataUrl ? (
                    <img src={c.cnicBackDataUrl} alt="CNIC back" className="h-10 w-16 rounded object-cover ring-1 ring-slate-200 dark:ring-slate-700" />
                  ) : null}
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
