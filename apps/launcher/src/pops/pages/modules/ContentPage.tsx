import { Button } from "@platform/ui";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePopsStore } from "../../../stores/popsStore";
import { fetchBranchMenuAdmin, uploadMenuImage } from "../../api/menu";
import {
  BUSINESS_PROFILE_CHANGED_EVENT,
  loadBusinessProfile,
  saveBusinessProfile,
  type BusinessProfile,
} from "../../lib/businessProfileSettings";
import {
  loadBillPrintSettings,
  saveBillPrintSettings,
  type BillPrintSettings,
} from "../../lib/billPrintSettings";
import {
  loadPosOrderModeVisibility,
  savePosOrderModeVisibility,
  type PosOrderModeVisibility,
} from "../../lib/posOrderModeVisibility";
import { BillCustomizationPanel } from "../../components/BillCustomizationPanel";
import { fieldInputClass } from "../../lib/themeClasses";
import { MenuImagePicker } from "../../ui/MenuImagePicker";
import { PageHeader } from "../../ui/PageHeader";

export function ContentPage(): JSX.Element {
  const branch = usePopsStore((s) => s.branch);
  const navigate = useNavigate();

  const [profile, setProfile] = useState<BusinessProfile>(() => loadBusinessProfile(branch?.code));
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [billPrintSettings, setBillPrintSettings] = useState<BillPrintSettings>(() =>
    loadBillPrintSettings(branch?.code),
  );
  const [orderModeVisibility, setOrderModeVisibility] = useState<PosOrderModeVisibility>(() =>
    loadPosOrderModeVisibility(branch?.code),
  );

  useEffect(() => {
    setProfile(loadBusinessProfile(branch?.code));
    setBillPrintSettings(loadBillPrintSettings(branch?.code));
    setOrderModeVisibility(loadPosOrderModeVisibility(branch?.code));
    setLogoFile(null);
  }, [branch?.code]);

  const menuQuery = useQuery({
    queryKey: ["content-menu-summary", branch?.code],
    queryFn: () => fetchBranchMenuAdmin(branch!.code),
    enabled: Boolean(branch?.code),
  });

  if (!branch) {
    return <div className="p-6 text-sm text-slate-400">Select a branch to manage content.</div>;
  }

  async function handleLogoSelect(file: File | null): Promise<void> {
    if (!file) return;
    setLogoFile(file);
    setUploading(true);
    setError(null);
    try {
      const imageUrl = await uploadMenuImage(file);
      setProfile((prev) => ({ ...prev, logoUrl: imageUrl }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Logo upload failed");
      setLogoFile(null);
    } finally {
      setUploading(false);
    }
  }

  function handleSaveProfile(): void {
    saveBusinessProfile(branch!.code, profile);
    setNotice("Business profile saved for this branch.");
    window.dispatchEvent(new CustomEvent(BUSINESS_PROFILE_CHANGED_EVENT));
  }

  function persistBillSettings(next: BillPrintSettings): void {
    saveBillPrintSettings(branch!.code, next);
    setBillPrintSettings(next);
  }

  function toggleOrderMode(key: keyof PosOrderModeVisibility, value: boolean): void {
    const next = { ...orderModeVisibility, [key]: value };
    setOrderModeVisibility(next);
    savePosOrderModeVisibility(branch!.code, next);
    setNotice("Order type visibility updated.");
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader
        title="Content Updation"
        subtitle="Manage business profile, receipt content, and menu content for this branch from one place."
      />

      {notice ? (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </p>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Business profile</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Logo, address, phone, and tax ID shown across the app and on printed receipts.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <MenuImagePicker
              label="Business logo"
              value={profile.logoUrl}
              previewFile={logoFile}
              onFileSelect={handleLogoSelect}
              onClear={() => setProfile((prev) => ({ ...prev, logoUrl: null }))}
              disabled={uploading}
            />
          </div>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Phone
            <input
              className={fieldInputClass}
              value={profile.phone}
              onChange={(e) => setProfile((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="e.g. 0300-1234567"
            />
          </label>
          <label className="block text-xs text-slate-500 dark:text-slate-400">
            Tax / NTN number
            <input
              className={fieldInputClass}
              value={profile.taxId}
              onChange={(e) => setProfile((prev) => ({ ...prev, taxId: e.target.value }))}
              placeholder="e.g. NTN-1234567-8"
            />
          </label>
          <label className="block text-xs text-slate-500 dark:text-slate-400 sm:col-span-2">
            Address
            <input
              className={fieldInputClass}
              value={profile.address}
              onChange={(e) => setProfile((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Street, city"
            />
          </label>
        </div>

        <div className="mt-4">
          <Button onClick={handleSaveProfile} disabled={uploading}>
            Save business profile
          </Button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Receipt &amp; print content</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Header, footer, and field visibility shown on printed bills.
        </p>
        <div className="mt-4">
          <BillCustomizationPanel
            branchName={branch.name}
            branchCode={branch.code}
            settings={billPrintSettings}
            onChange={setBillPrintSettings}
            onSave={() => {
              persistBillSettings(billPrintSettings);
              setNotice("Receipt content saved for this branch.");
            }}
          />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">POS order types</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Enable or disable optional order-type tabs on the POS screen. When enabled, they appear in
          their current position alongside Dine-in, Takeaway, and Delivery.
        </p>

        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={orderModeVisibility.onlineEnabled}
              onChange={(e) => toggleOrderMode("onlineEnabled", e.target.checked)}
            />
            Online Orders
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={orderModeVisibility.foodpandaEnabled}
              onChange={(e) => toggleOrderMode("foodpandaEnabled", e.target.checked)}
            />
            Foodpanda Orders
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={orderModeVisibility.staffFoodEnabled}
              onChange={(e) => toggleOrderMode("staffFoodEnabled", e.target.checked)}
            />
            Staff Food
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Menu content</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Categories, items, and pricing shown to staff and printed on tickets.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-white">
              {menuQuery.data ? menuQuery.data.categories.length : "—"}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Categories</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-slate-900 dark:text-white">
              {menuQuery.data ? menuQuery.data.items.length : "—"}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Menu items</div>
          </div>
          <Button variant="ghost" onClick={() => navigate("/pops/menu")}>
            Open Menu
          </Button>
        </div>
      </section>
    </div>
  );
}
