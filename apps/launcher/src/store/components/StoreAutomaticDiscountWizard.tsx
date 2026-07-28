import type { StoreCategory, StoreProduct, StoreSupplier } from "@platform/contracts";
import { useMemo, useState } from "react";
import { StoreField, StoreInput, StoreSelect } from "../ui/StoreUi";

export type PromoWizardRuleType = "percent_off" | "amount_off" | "mix_match" | "buy_x_percent_off";

export type PromoWizardDraft = {
  name: string;
  type: PromoWizardRuleType;
  percent: number;
  amount: number;
  buyQty: number;
  fixedPrice: number;
  scheduleEnabled: boolean;
  startsAt: string;
  endsAt: string;
  priceLevels: Array<"regular" | "sale" | "employee" | "wholesale" | "custom">;
  scope: "all" | "department" | "vendor" | "named" | "custom";
  categoryId: string;
  supplierId: string;
  nameContains: string;
  productIds: string[];
};

const PRICE_LEVEL_OPTIONS: Array<{ id: PromoWizardDraft["priceLevels"][number]; label: string }> = [
  { id: "regular", label: "Regular Price" },
  { id: "sale", label: "Sale" },
  { id: "employee", label: "Employee" },
  { id: "wholesale", label: "Wholesale" },
  { id: "custom", label: "Custom price" },
];

function defaultLocalDateTime(endOfDay = false): string {
  const d = new Date();
  if (endOfDay) {
    d.setHours(23, 59, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function emptyPromoWizardDraft(): PromoWizardDraft {
  return {
    name: "",
    type: "percent_off",
    percent: 0,
    amount: 0,
    buyQty: 3,
    fixedPrice: 0,
    scheduleEnabled: false,
    startsAt: defaultLocalDateTime(false),
    endsAt: defaultLocalDateTime(true),
    priceLevels: ["regular"],
    scope: "all",
    categoryId: "",
    supplierId: "",
    nameContains: "",
    productIds: [],
  };
}

export function buildPromotionPayload(branchCode: string, draft: PromoWizardDraft) {
  const type =
    draft.type === "mix_match"
      ? "mix_match"
      : draft.type === "buy_x_percent_off"
        ? "buy_x_percent_off"
        : draft.type === "amount_off"
          ? "amount_off"
          : "percent_off";

  const config: Record<string, unknown> = {
    scope: draft.scope,
    priceLevels: draft.priceLevels,
  };

  if (draft.type === "percent_off") config.percent = draft.percent;
  if (draft.type === "amount_off") config.amount = draft.amount;
  if (draft.type === "mix_match") {
    config.anyQty = draft.buyQty;
    config.buyQty = draft.buyQty;
    config.fixedPrice = draft.fixedPrice;
  }
  if (draft.type === "buy_x_percent_off") {
    config.buyQty = draft.buyQty;
    config.percent = draft.percent;
  }
  if (draft.scope === "department") config.categoryId = draft.categoryId;
  if (draft.scope === "vendor") config.supplierId = draft.supplierId;
  if (draft.scope === "named") config.nameContains = draft.nameContains.trim();

  const autoName =
    draft.name.trim() ||
    (draft.type === "percent_off"
      ? `${draft.percent}% off`
      : draft.type === "amount_off"
        ? `Rs ${draft.amount} off`
        : draft.type === "mix_match"
          ? `Buy ${draft.buyQty} for Rs ${draft.fixedPrice}`
          : `Buy ${draft.buyQty} get ${draft.percent}% off`);

  return {
    branchCode,
    name: autoName,
    type,
    productIds: draft.scope === "custom" ? draft.productIds : [],
    config,
    startsAt: draft.scheduleEnabled && draft.startsAt ? new Date(draft.startsAt).toISOString() : undefined,
    endsAt: draft.scheduleEnabled && draft.endsAt ? new Date(draft.endsAt).toISOString() : undefined,
  };
}

function wizardBtnClass(primary?: boolean, disabled?: boolean): string {
  if (disabled) return "rounded-md border border-slate-200 bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800";
  if (primary) return "rounded-md bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500";
  return "rounded-md border border-sky-600 bg-sky-600/10 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-600/20 dark:text-sky-300";
}

export function StoreAutomaticDiscountWizard({
  products,
  categories,
  suppliers,
  saving,
  onCancel,
  onSave,
}: {
  products: StoreProduct[];
  categories: StoreCategory[];
  suppliers: StoreSupplier[];
  saving?: boolean;
  onCancel: () => void;
  onSave: (draft: PromoWizardDraft) => void;
}): JSX.Element {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PromoWizardDraft>(emptyPromoWizardDraft);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const departments = useMemo(() => categories.filter((c) => !c.parentId), [categories]);

  const filteredProducts = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    return products.filter((p) => {
      if (filterDept && p.categoryId !== filterDept) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.barcodes ?? []).some((b) => b.toLowerCase().includes(q))
      );
    });
  }, [products, filterText, filterDept]);

  const steps =
    draft.scope === "custom"
      ? (["rules", "levels", "scope", "items"] as const)
      : (["rules", "levels", "scope"] as const);

  function patch(partial: Partial<PromoWizardDraft>) {
    setDraft((d) => ({ ...d, ...partial }));
    setError(null);
  }

  function validateStep(): boolean {
    if (steps[step] === "rules") {
      if (draft.type === "percent_off" && !(draft.percent > 0 && draft.percent <= 100)) {
        setError("Enter a percent off between 1 and 100.");
        return false;
      }
      if (draft.type === "amount_off" && !(draft.amount > 0)) {
        setError("Enter a discount amount greater than 0.");
        return false;
      }
      if (draft.type === "mix_match" && (!(draft.buyQty > 0) || !(draft.fixedPrice > 0))) {
        setError("Enter Buy X quantity and $Y price.");
        return false;
      }
      if (draft.type === "buy_x_percent_off" && (!(draft.buyQty > 0) || !(draft.percent > 0))) {
        setError("Enter Buy X quantity and percent off.");
        return false;
      }
      if (draft.scheduleEnabled && draft.endsAt && draft.startsAt && new Date(draft.endsAt) < new Date(draft.startsAt)) {
        setError("End date must be after start date.");
        return false;
      }
    }
    if (steps[step] === "levels" && draft.priceLevels.length === 0) {
      setError("A minimum of one price level must be selected.");
      return false;
    }
    if (steps[step] === "scope") {
      if (draft.scope === "department" && !draft.categoryId) {
        setError("Select a department.");
        return false;
      }
      if (draft.scope === "vendor" && !draft.supplierId) {
        setError("Select a vendor.");
        return false;
      }
      if (draft.scope === "named" && !draft.nameContains.trim()) {
        setError("Enter part of the item name.");
        return false;
      }
    }
    if (steps[step] === "items" && draft.productIds.length === 0) {
      setError("Select at least one item.");
      return false;
    }
    setError(null);
    return true;
  }

  function goNext() {
    if (!validateStep()) return;
    if (step >= steps.length - 1) {
      onSave(draft);
      return;
    }
    setStep((s) => s + 1);
  }

  function toggleLevel(id: PromoWizardDraft["priceLevels"][number]) {
    patch({
      priceLevels: draft.priceLevels.includes(id)
        ? draft.priceLevels.filter((x) => x !== id)
        : [...draft.priceLevels, id],
    });
  }

  function toggleProduct(id: string) {
    setHighlightedId(id);
    patch({
      productIds: draft.productIds.includes(id)
        ? draft.productIds.filter((x) => x !== id)
        : [...draft.productIds, id],
    });
  }

  const footer = (
    <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
      <span className="mr-auto text-xs text-red-600">* Required fields</span>
      <button type="button" className={wizardBtnClass()} onClick={() => window.alert("Automatic discounts apply at POS when matching items are added to a receipt.")}>
        Help
      </button>
      <button type="button" className={wizardBtnClass(false, step === 0)} disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
        Previous
      </button>
      <button type="button" className={wizardBtnClass(true)} disabled={saving} onClick={goNext}>
        {step >= steps.length - 1 ? (saving ? "Saving…" : "Finish") : "Next"}
      </button>
      <button type="button" className={wizardBtnClass()} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">New Discount</p>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {steps[step] === "rules"
              ? "Choose discount rules"
              : steps[step] === "levels"
                ? "Discount"
                : steps[step] === "scope"
                  ? "Choose which items the discount affects"
                  : "Select items"}
          </h3>
          <p className="mt-0.5 text-sm text-slate-500">
            {steps[step] === "rules"
              ? "Select how the discount is applied and optionally when."
              : steps[step] === "levels"
                ? "Select the price level to which this discount applies when adding items to a receipt or customer order. If the selected price levels are not used on sale, the discount will not be applied."
                : steps[step] === "scope"
                  ? "Choose whether the discount applies to all items, a department, a vendor, a name match, or a custom list."
                  : "Select the inventory items this automatic discount should apply to."}
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          Step {step + 1} / {steps.length}
        </span>
      </div>

      {error ? <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">{error}</div> : null}

      {steps[step] === "rules" ? (
        <div className="space-y-4">
          <StoreField label="Discount name (optional)">
            <StoreInput value={draft.name} onChange={(e) => patch({ name: e.target.value })} placeholder="Auto-named from rule if blank" />
          </StoreField>
          <StoreField label="Discount" required>
            <StoreSelect
              value={draft.type}
              onChange={(e) => patch({ type: e.target.value as PromoWizardRuleType })}
            >
              <option value="percent_off">% off</option>
              <option value="amount_off">$ off</option>
              <option value="mix_match">Buy X for $Y</option>
              <option value="buy_x_percent_off">Buy X and get Y% off</option>
            </StoreSelect>
          </StoreField>

          {draft.type === "percent_off" ? (
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="text-red-600">*</span>
              <span>Take</span>
              <StoreInput
                type="number"
                min={1}
                max={100}
                className="w-24"
                value={draft.percent || ""}
                onChange={(e) => patch({ percent: Number(e.target.value) || 0 })}
              />
              <span>percent off</span>
            </label>
          ) : null}

          {draft.type === "amount_off" ? (
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="text-red-600">*</span>
              <span>Take</span>
              <StoreInput
                type="number"
                min={1}
                className="w-28"
                value={draft.amount || ""}
                onChange={(e) => patch({ amount: Number(e.target.value) || 0 })}
              />
              <span>off (per unit)</span>
            </label>
          ) : null}

          {draft.type === "mix_match" ? (
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="text-red-600">*</span>
              <span>Buy</span>
              <StoreInput type="number" min={1} className="w-20" value={draft.buyQty || ""} onChange={(e) => patch({ buyQty: Number(e.target.value) || 0 })} />
              <span>for</span>
              <StoreInput type="number" min={1} className="w-28" value={draft.fixedPrice || ""} onChange={(e) => patch({ fixedPrice: Number(e.target.value) || 0 })} />
            </label>
          ) : null}

          {draft.type === "buy_x_percent_off" ? (
            <label className="flex flex-wrap items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
              <span className="text-red-600">*</span>
              <span>Buy</span>
              <StoreInput type="number" min={1} className="w-20" value={draft.buyQty || ""} onChange={(e) => patch({ buyQty: Number(e.target.value) || 0 })} />
              <span>and get</span>
              <StoreInput type="number" min={1} max={100} className="w-20" value={draft.percent || ""} onChange={(e) => patch({ percent: Number(e.target.value) || 0 })} />
              <span>% off</span>
            </label>
          ) : null}

          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              className="mt-1"
              checked={draft.scheduleEnabled}
              onChange={(e) => patch({ scheduleEnabled: e.target.checked })}
            />
            <span>Discount is only available during the specified time period</span>
          </label>

          <div className={`grid gap-3 sm:grid-cols-2 ${draft.scheduleEnabled ? "" : "opacity-50"}`}>
            <StoreField label="Starts">
              <StoreInput
                type="datetime-local"
                disabled={!draft.scheduleEnabled}
                value={draft.startsAt}
                onChange={(e) => patch({ startsAt: e.target.value })}
              />
            </StoreField>
            <StoreField label="Ends">
              <StoreInput
                type="datetime-local"
                disabled={!draft.scheduleEnabled}
                value={draft.endsAt}
                onChange={(e) => patch({ endsAt: e.target.value })}
              />
            </StoreField>
          </div>
        </div>
      ) : null}

      {steps[step] === "levels" ? (
        <div>
          <div className="grid max-w-xl gap-3 sm:grid-cols-2">
            {PRICE_LEVEL_OPTIONS.map((opt) => (
              <label key={opt.id} className="flex items-center gap-2 text-sm text-slate-800 dark:text-slate-200">
                <input type="checkbox" checked={draft.priceLevels.includes(opt.id)} onChange={() => toggleLevel(opt.id)} />
                {opt.label}
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">A minimum of one price level must be selected.</p>
        </div>
      ) : null}

      {steps[step] === "scope" ? (
        <div className="space-y-3">
          {(
            [
              { id: "all", label: "All items" },
              { id: "department", label: "All items in department" },
              { id: "vendor", label: "All items from vendor" },
              { id: "named", label: "All items named" },
              { id: "custom", label: "Custom" },
            ] as const
          ).map((opt) => (
            <label key={opt.id} className="flex flex-wrap items-center gap-3 text-sm text-slate-800 dark:text-slate-200">
              <input
                type="radio"
                name="promo-scope"
                checked={draft.scope === opt.id}
                onChange={() => patch({ scope: opt.id })}
              />
              <span className="min-w-[11rem] font-medium">{opt.label}</span>
              {opt.id === "department" ? (
                <StoreSelect
                  className="max-w-xs flex-1"
                  disabled={draft.scope !== "department"}
                  value={draft.categoryId}
                  onChange={(e) => patch({ categoryId: e.target.value, scope: "department" })}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </StoreSelect>
              ) : null}
              {opt.id === "vendor" ? (
                <StoreSelect
                  className="max-w-xs flex-1"
                  disabled={draft.scope !== "vendor"}
                  value={draft.supplierId}
                  onChange={(e) => patch({ supplierId: e.target.value, scope: "vendor" })}
                >
                  <option value="">Select vendor</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </StoreSelect>
              ) : null}
              {opt.id === "named" ? (
                <StoreInput
                  className="max-w-xs flex-1"
                  disabled={draft.scope !== "named"}
                  placeholder="Item name contains…"
                  value={draft.nameContains}
                  onChange={(e) => patch({ nameContains: e.target.value, scope: "named" })}
                />
              ) : null}
            </label>
          ))}
        </div>
      ) : null}

      {steps[step] === "items" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium dark:border-slate-600 dark:bg-slate-800" onClick={() => setFilterOpen((v) => !v)}>
              {filterOpen ? "Hide filter" : "Apply filter"}
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-300 bg-slate-50 px-3 py-1.5 text-sm font-medium dark:border-slate-600 dark:bg-slate-800"
              onClick={() => { setFilterText(""); setFilterDept(""); }}
            >
              Clear filter
            </button>
          </div>
          {filterOpen ? (
            <div className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
              <StoreField label="Search">
                <StoreInput value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Name, SKU, barcode" />
              </StoreField>
              <StoreField label="Department">
                <StoreSelect value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
                  <option value="">All</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </StoreSelect>
              </StoreField>
            </div>
          ) : null}

          <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="min-w-full text-left text-sm">
              <thead className="sticky top-0 bg-emerald-50 text-xs font-semibold uppercase text-slate-600 dark:bg-emerald-950/40 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2">Item #</th>
                  <th className="px-3 py-2">Item Name</th>
                  <th className="px-3 py-2">Department</th>
                  <th className="px-3 py-2">UPC</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => {
                  const selected = draft.productIds.includes(p.id);
                  return (
                    <tr
                      key={p.id}
                      className={`cursor-pointer border-t border-slate-100 dark:border-slate-800 ${highlightedId === p.id ? "bg-sky-50 dark:bg-sky-950/30" : selected ? "bg-emerald-50/60 dark:bg-emerald-950/20" : ""}`}
                      onClick={() => toggleProduct(p.id)}
                    >
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={selected} readOnly />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{p.sku}</td>
                      <td className="px-3 py-2 font-medium">{p.name}</td>
                      <td className="px-3 py-2 text-slate-500">{p.categoryName ?? "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.barcode ?? p.barcodes?.[0] ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={() => highlightedId && !draft.productIds.includes(highlightedId) && toggleProduct(highlightedId)}>
              Select item
            </button>
            <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={() => highlightedId && draft.productIds.includes(highlightedId) && toggleProduct(highlightedId)}>
              Deselect item
            </button>
            <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={() => patch({ productIds: filteredProducts.map((p) => p.id) })}>
              Select all
            </button>
            <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm dark:border-slate-600" onClick={() => patch({ productIds: [] })}>
              Deselect all
            </button>
          </div>
          <p className="text-xs text-slate-500">{draft.productIds.length} item(s) selected</p>
        </div>
      ) : null}

      {footer}
    </div>
  );
}
