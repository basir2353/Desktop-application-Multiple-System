import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { createStoreBrand, createStoreCategory, createStoreUnit, fetchStoreBrands, fetchStoreCategories, fetchStoreUnits } from "../api/store";
import { useInvalidateStore, useStoreAccess } from "../hooks/useStore";
import { StoreField, StoreFormSection, StoreInput } from "../ui/StoreUi";
import { PageHeader } from "../../pops/ui/PageHeader";
import { StoreDataTable } from "../ui/StoreUi";
import { noticeErrorClass, noticeSuccessClass } from "../../pops/lib/themeClasses";

export function StoreCategoriesPage(): JSX.Element {
  const { branch, canManage } = useStoreAccess();
  const invalidate = useInvalidateStore();
  const [catName, setCatName] = useState("");
  const [subName, setSubName] = useState("");
  const [parentId, setParentId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categoriesQuery = useQuery({ queryKey: ["store", "categories", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreCategories(branch!.code) });
  const brandsQuery = useQuery({ queryKey: ["store", "brands", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreBrands(branch!.code) });
  const unitsQuery = useQuery({ queryKey: ["store", "units", branch?.code], enabled: Boolean(branch?.code), queryFn: () => fetchStoreUnits(branch!.code) });

  const parentCategories = (categoriesQuery.data ?? []).filter((c) => !c.parentId);
  const subcategories = (categoriesQuery.data ?? []).filter((c) => c.parentId);

  async function handleCreate(fn: () => Promise<unknown>): Promise<void> {
    try {
      await fn();
      invalidate();
      setNotice("Saved successfully");
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Categories, brands & units" subtitle="Organize products with categories, subcategories, brands, and units of measure." />

      {notice ? <div className={noticeSuccessClass}>{notice}</div> : null}
      {error ? <div className={noticeErrorClass}>{error}</div> : null}

      {canManage ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <StoreFormSection title="Add category">
            <StoreField label="Category name"><StoreInput value={catName} onChange={(e) => setCatName(e.target.value)} /></StoreField>
            <div className="col-span-full">
              <button type="button" onClick={() => handleCreate(() => createStoreCategory({ branchCode: branch!.code, name: catName }).then(() => setCatName("")))} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Add category</button>
            </div>
          </StoreFormSection>
          <StoreFormSection title="Add subcategory">
            <StoreField label="Parent category">
              <select className="w-full rounded-lg border px-3 py-2 text-sm" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                <option value="">Select parent</option>
                {parentCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </StoreField>
            <StoreField label="Subcategory name"><StoreInput value={subName} onChange={(e) => setSubName(e.target.value)} /></StoreField>
            <div className="col-span-full">
              <button type="button" onClick={() => handleCreate(() => createStoreCategory({ branchCode: branch!.code, name: subName, parentId }).then(() => setSubName("")))} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Add subcategory</button>
            </div>
          </StoreFormSection>
          <StoreFormSection title="Add brand">
            <StoreField label="Brand name"><StoreInput value={brandName} onChange={(e) => setBrandName(e.target.value)} /></StoreField>
            <div className="col-span-full">
              <button type="button" onClick={() => handleCreate(() => createStoreBrand({ branchCode: branch!.code, name: brandName }).then(() => setBrandName("")))} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Add brand</button>
            </div>
          </StoreFormSection>
          <StoreFormSection title="Add unit">
            <StoreField label="Unit name"><StoreInput value={unitName} onChange={(e) => setUnitName(e.target.value)} /></StoreField>
            <div className="col-span-full">
              <button type="button" onClick={() => handleCreate(() => createStoreUnit({ branchCode: branch!.code, name: unitName }).then(() => setUnitName("")))} className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-semibold text-white">Add unit</button>
            </div>
          </StoreFormSection>
        </div>
      ) : null}

      <StoreDataTable columns={["Category", "Parent", "Products"]} rows={parentCategories.map((c) => [c.name, "—", c.productCount])} />
      <StoreDataTable columns={["Subcategory", "Parent", "Products"]} rows={subcategories.map((c) => [c.name, c.parentName ?? "—", c.productCount])} />
      <StoreDataTable columns={["Brand", "Products"]} rows={(brandsQuery.data ?? []).map((b) => [b.name, b.productCount])} />
      <StoreDataTable columns={["Unit", "Abbreviation"]} rows={(unitsQuery.data ?? []).map((u) => [u.name, u.abbreviation])} />
    </div>
  );
}
