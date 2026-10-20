import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { MobizoneCustomer } from "@platform/contracts";
import { PageHeader } from "../../pops/ui/PageHeader";
import { cardClass, mutedClass } from "../../pops/lib/themeClasses";
import { useMobizoneDb } from "../hooks/useMobizone";
import { downloadDataUrlFile, formatPkr, updateCustomerProfile } from "../lib/mobizoneStore";
import {
  MzField,
  MzInput,
  MzPage,
  MzPrimaryButton,
  MzSecondaryButton,
} from "../ui/MobizoneUi";

function safeFileBase(name: string): string {
  return name.trim().replace(/[^\w\-]+/g, "_").slice(0, 40) || "customer";
}

function PhotoThumb({
  src,
  label,
  fileName,
}: {
  src: string;
  label: string;
  fileName: string;
}): JSX.Element {
  return (
    <div className="flex flex-col items-start gap-1">
      <img
        src={src}
        alt={label}
        className="h-12 w-16 rounded object-cover ring-1 ring-slate-200 dark:ring-slate-700"
      />
      <button
        type="button"
        className="text-[11px] font-semibold text-[var(--mz-accent)] underline-offset-2 hover:underline"
        onClick={() => downloadDataUrlFile(src, fileName)}
      >
        Download
      </button>
    </div>
  );
}

function EditModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center">
      <div className={`${cardClass} max-h-[92vh] w-full max-w-lg overflow-y-auto p-4 shadow-xl`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <MzSecondaryButton onClick={onClose}>Close</MzSecondaryButton>
        </div>
        {children}
      </div>
    </div>
  );
}

export function MobizoneCustomersPage(): JSX.Element {
  const { branchCode, db, refresh } = useMobizoneDb();
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<MobizoneCustomer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [address, setAddress] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return db.customers;
    return db.customers.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        (c.cnic ?? "").toLowerCase().includes(needle) ||
        (c.phone ?? "").includes(needle) ||
        (c.address ?? "").toLowerCase().includes(needle),
    );
  }, [db.customers, q]);

  function openEdit(c: MobizoneCustomer): void {
    setEditing(c);
    setName(c.name);
    setPhone(c.phone ?? "");
    setCnic(c.cnic ?? "");
    setAddress(c.address ?? "");
    setErr(null);
  }

  function saveEdit(): void {
    if (!branchCode || !editing) return;
    setErr(null);
    try {
      updateCustomerProfile(branchCode, editing.id, {
        name,
        phone,
        cnic,
        address,
      });
      setEditing(null);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save customer.");
    }
  }

  return (
    <MzPage>
      <PageHeader
        title="Customers"
        subtitle="Buyers and sellers — edit details; photos are locked and can be downloaded."
      />
      <div className="flex flex-wrap items-end gap-3">
        <MzField label="Search">
          <MzInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, CNIC, phone…"
            className="max-w-md"
          />
        </MzField>
        <Link
          to={
            q.trim()
              ? `/pops/mobizone/search?q=${encodeURIComponent(q.trim())}&focus=customer`
              : "/pops/mobizone/search?focus=customer"
          }
        >
          <MzSecondaryButton>Universal Search</MzSecondaryButton>
        </Link>
      </div>

      {editing ? (
        <EditModal title="Edit customer" onClose={() => setEditing(null)}>
          <div className="space-y-3">
            {err ? <p className="text-sm text-red-600">{err}</p> : null}
            <p className={`text-xs ${mutedClass}`}>
              Photos cannot be changed here — download only. Name / phone / CNIC / address can be edited.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <MzField label="Full name *">
                <MzInput value={name} onChange={(e) => setName(e.target.value)} />
              </MzField>
              <MzField label="Mobile">
                <MzInput value={phone} onChange={(e) => setPhone(e.target.value)} />
              </MzField>
              <MzField label="CNIC / ID">
                <MzInput value={cnic} onChange={(e) => setCnic(e.target.value)} />
              </MzField>
              <MzField label="Address">
                <MzInput value={address} onChange={(e) => setAddress(e.target.value)} />
              </MzField>
            </div>
            <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-3 dark:border-slate-800">
              {editing.photoDataUrl ? (
                <PhotoThumb
                  src={editing.photoDataUrl}
                  label="Photo"
                  fileName={`${safeFileBase(editing.name)}_photo.jpg`}
                />
              ) : null}
              {editing.cnicFrontDataUrl ? (
                <PhotoThumb
                  src={editing.cnicFrontDataUrl}
                  label="CNIC front"
                  fileName={`${safeFileBase(editing.name)}_cnic_front.jpg`}
                />
              ) : null}
              {editing.cnicBackDataUrl ? (
                <PhotoThumb
                  src={editing.cnicBackDataUrl}
                  label="CNIC back"
                  fileName={`${safeFileBase(editing.name)}_cnic_back.jpg`}
                />
              ) : null}
              {!editing.photoDataUrl && !editing.cnicFrontDataUrl && !editing.cnicBackDataUrl ? (
                <p className={`text-xs ${mutedClass}`}>No photos on this customer.</p>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              <MzPrimaryButton onClick={saveEdit}>Save changes</MzPrimaryButton>
              <MzSecondaryButton onClick={() => setEditing(null)}>Cancel</MzSecondaryButton>
            </div>
          </div>
        </EditModal>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {rows.length === 0 ? (
          <p className={`text-sm ${mutedClass}`}>No customers yet — they appear when you buy or sell.</p>
        ) : (
          rows.map((c) => {
            const base = safeFileBase(c.name);
            return (
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
                  <p className={`text-xs ${mutedClass}`}>
                    {c.phone || "No phone"} · {c.cnic || "No CNIC"}
                  </p>
                  {c.address ? <p className={`mt-1 truncate text-xs ${mutedClass}`}>{c.address}</p> : null}
                  {(c.pendingPkr || 0) > 0 ? (
                    <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                      Pending {formatPkr(c.pendingPkr)}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-3">
                    {c.photoDataUrl ? (
                      <PhotoThumb src={c.photoDataUrl} label="Photo" fileName={`${base}_photo.jpg`} />
                    ) : null}
                    {c.cnicFrontDataUrl ? (
                      <PhotoThumb
                        src={c.cnicFrontDataUrl}
                        label="CNIC front"
                        fileName={`${base}_cnic_front.jpg`}
                      />
                    ) : null}
                    {c.cnicBackDataUrl ? (
                      <PhotoThumb
                        src={c.cnicBackDataUrl}
                        label="CNIC back"
                        fileName={`${base}_cnic_back.jpg`}
                      />
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <MzSecondaryButton onClick={() => openEdit(c)}>Edit</MzSecondaryButton>
                    <Link
                      to={`/pops/mobizone/search?q=${encodeURIComponent(c.cnic || c.name)}&focus=customer&customerId=${c.id}`}
                    >
                      <MzSecondaryButton>Full history</MzSecondaryButton>
                    </Link>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </MzPage>
  );
}
