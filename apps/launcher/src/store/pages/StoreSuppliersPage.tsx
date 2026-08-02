import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { createStoreSupplier, fetchStoreSuppliers } from "../api/store";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { StoreField, StoreFormSection, StoreInput } from "../ui/StoreUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { StoreDataTable } from "../ui/StoreUi";
import { linkActionClass, mutedClass, noticeSuccessClass } from "../../pops/lib/themeClasses";
import { ModuleCountBadge, ModuleFilterBar } from "../../pops/ui/ModuleToolbar";

export function StoreSuppliersPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const suppliersQuery = useQuery({
    queryKey: ["store", "suppliers", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchStoreSuppliers(branch!.code),
  });

  const createMutation = useMutation({
    mutationFn: () => createStoreSupplier({ branchCode: branch!.code, name, contactPerson, phone }),
    onSuccess: () => {
      invalidate();
      setName("");
      setContactPerson("");
      setPhone("");
      setNotice("Supplier added");
    },
  });

  const suppliers = suppliersQuery.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.contactPerson ?? "").toLowerCase().includes(q) ||
        (s.phone ?? "").toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Supplier management"
        subtitle="Profiles, performance KPIs, ledger, and purchase history."
      />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {canManage ? (
        <StoreFormSection title="Add supplier">
          <StoreField label="Name">
            <StoreInput value={name} onChange={(e) => setName(e.target.value)} />
          </StoreField>
          <StoreField label="Contact">
            <StoreInput value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
          </StoreField>
          <StoreField label="Phone">
            <StoreInput value={phone} onChange={(e) => setPhone(e.target.value)} />
          </StoreField>
          <div className="col-span-full">
            <button
              type="button"
              onClick={() => createMutation.mutate()}
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white"
            >
              Add supplier
            </button>
          </div>
        </StoreFormSection>
      ) : null}

      <ModuleFilterBar>
        <input
          className="min-w-[12rem] flex-1 rounded-md border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white sm:max-w-xs"
          placeholder="Search supplier, contact, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search ? (
          <button type="button" className={`text-xs ${linkActionClass}`} onClick={() => setSearch("")}>
            Clear
          </button>
        ) : null}
        <ModuleCountBadge shown={filtered.length} total={suppliers.length} />
      </ModuleFilterBar>

      <StoreDataTable
        columns={[
          "Supplier",
          "Contact",
          "Quality",
          "Delivery (days)",
          "Total purchases",
          "Outstanding",
          "Last order",
        ]}
        rows={filtered.map((s) => [
          s.name,
          s.contactPerson ?? "—",
          `${s.qualityScore}%`,
          s.avgDeliveryDays,
          formatPkr(s.totalPurchases),
          formatPkr(s.outstandingBalance),
          s.lastOrderDate ? new Date(s.lastOrderDate).toLocaleDateString() : "—",
        ])}
      />
      {filtered.length === 0 ? (
        <p className={`text-sm ${mutedClass}`}>
          {search ? "No suppliers match your search." : "No suppliers yet."}
        </p>
      ) : null}
    </div>
  );
}
