import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createStoreSupplier, fetchStoreSuppliers } from "../api/store";
import { formatPkr, useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { StoreField, StoreFormSection, StoreInput } from "../ui/StoreUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { StoreDataTable } from "../ui/StoreUi";
import { noticeSuccessClass } from "../../pops/lib/themeClasses";

export function StoreSuppliersPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const suppliersQuery = useQuery({ queryKey: ["store", "suppliers", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreSuppliers(branch!.code) });

  const createMutation = useMutation({
    mutationFn: () => createStoreSupplier({ branchCode: branch!.code, name, contactPerson, phone }),
    onSuccess: () => { invalidate(); setName(""); setNotice("Supplier added"); },
  });

  return (
    <div className="space-y-5">
      <PageHeader title="Supplier management" subtitle="Profiles, performance KPIs, ledger, and purchase history." />
      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {canManage ? (
        <StoreFormSection title="Add supplier">
          <StoreField label="Name"><StoreInput value={name} onChange={(e) => setName(e.target.value)} /></StoreField>
          <StoreField label="Contact"><StoreInput value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} /></StoreField>
          <StoreField label="Phone"><StoreInput value={phone} onChange={(e) => setPhone(e.target.value)} /></StoreField>
          <div className="col-span-full"><button type="button" onClick={() => createMutation.mutate()} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Add supplier</button></div>
        </StoreFormSection>
      ) : null}
      <StoreDataTable
        columns={["Supplier", "Contact", "Quality", "Delivery (days)", "Total purchases", "Outstanding", "Last order"]}
        rows={(suppliersQuery.data ?? []).map((s) => [
          s.name, s.contactPerson ?? "—", `${s.qualityScore}%`, s.avgDeliveryDays,
          formatPkr(s.totalPurchases), formatPkr(s.outstandingBalance),
          s.lastOrderDate ? new Date(s.lastOrderDate).toLocaleDateString() : "—",
        ])}
      />
    </div>
  );
}
