import { Button } from "@platform/ui";
import {
  formatMenuItemLabel,
  menuItemDisplayPrice,
  type MenuCategory,
  type MenuItem,
} from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useSessionStore } from "../../../stores/sessionStore";
import { usePopsStore } from "../../../stores/popsStore";
import {
  createMenuCategory,
  createMenuItem,
  deleteMenuCategory,
  deleteMenuItem,
  fetchBranchMenuAdmin,
  updateMenuCategory,
  updateMenuItem,
  uploadMenuImage,
} from "../../api/menu";
import { accentValueClass, amberPillActiveClass, linkDangerClass, linkWarningClass, mutedClass, pillInactiveClass } from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import { MenuImagePicker, MenuImageThumb } from "../../ui/MenuImagePicker";
import { PageHeader } from "../../ui/PageHeader";
import { SimpleTable } from "../../ui/SimpleTable";
import {
  DEFAULT_HAPPY_HOUR_SETTINGS,
  formatHappyHourWindow,
  loadHappyHourSettings,
  saveHappyHourSettings,
  type HappyHourSettings,
} from "../../lib/happyHourSettings";
import { isHappyHourActive } from "../../lib/posHappyHour";

type VariantRow = { label: string; price: string; barcode: string };

const VARIANT_PRESETS = ["Full", "Half", "Quarter", "Plate", "Single"] as const;

function emptyVariantRow(): VariantRow {
  return { label: "", price: "", barcode: "" };
}

export function MenuPage(): JSX.Element {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const claims = useSessionStore((s) => s.claims);
  const canManage =
    claims?.permissions.includes("*") ||
    claims?.permissions.includes("pops.menu.manage");

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryImage, setNewCategoryImage] = useState<File | null>(null);
  const [itemForm, setItemForm] = useState({
    name: "",
    featured: false,
    variants: [emptyVariantRow()] as VariantRow[],
  });
  const [newItemImage, setNewItemImage] = useState<File | null>(null);
  const [categoryImageUploading, setCategoryImageUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [happyHourDraft, setHappyHourDraft] = useState<HappyHourSettings>(DEFAULT_HAPPY_HOUR_SETTINGS);
  const [happyHourNotice, setHappyHourNotice] = useState<string | null>(null);

  const menuQuery = useQuery({
    queryKey: ["menu", "admin", branch?.code],
    enabled: Boolean(branch?.code && canManage),
    queryFn: () => fetchBranchMenuAdmin(branch!.code),
  });

  const categories = menuQuery.data?.categories ?? [];
  const items = menuQuery.data?.items ?? [];

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId) ?? categories[0] ?? null,
    [categories, selectedCategoryId],
  );

  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  useEffect(() => {
    setHappyHourDraft(loadHappyHourSettings(branch?.code));
  }, [branch?.code]);

  const bonusItemOptions = useMemo(
    () => items.filter((i) => i.isActive),
    [items],
  );

  const selectedBonusItem = useMemo(
    () => bonusItemOptions.find((i) => i.id === happyHourDraft.bonusMenuItemId) ?? null,
    [bonusItemOptions, happyHourDraft.bonusMenuItemId],
  );

  const categoryItems = useMemo(
    () => items.filter((i) => i.categoryId === selectedCategory?.id),
    [items, selectedCategory?.id],
  );

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["menu"] });
  }

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      let imageUrl: string | undefined;
      if (newCategoryImage) {
        imageUrl = await uploadMenuImage(newCategoryImage);
      }
      return createMenuCategory({
        branchCode: branch!.code,
        name,
        sortOrder: categories.length,
        imageUrl,
      });
    },
    onSuccess: (cat) => {
      invalidate();
      setNewCategoryName("");
      setNewCategoryImage(null);
      setSelectedCategoryId(cat.id);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (id: string) => deleteMenuCategory(id),
    onSuccess: () => {
      invalidate();
      setSelectedCategoryId(null);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const createItemMutation = useMutation({
    mutationFn: async () => {
      const variants = itemForm.variants
        .filter((v) => v.price.trim())
        .map((v) => ({
          label: v.label.trim() || "Standard",
          price: Number(v.price),
          barcode: v.barcode.trim() || undefined,
        }));
      if (variants.length === 0) {
        throw new Error("Add at least one sub-category with a price.");
      }
      let imageUrl: string | undefined;
      if (newItemImage) {
        imageUrl = await uploadMenuImage(newItemImage);
      }
      return createMenuItem({
        branchCode: branch!.code,
        categoryId: selectedCategory!.id,
        name: itemForm.name.trim(),
        sortOrder: categoryItems.length,
        imageUrl,
        featured: itemForm.featured,
        variants,
      });
    },
    onSuccess: () => {
      invalidate();
      setItemForm({ name: "", featured: false, variants: [emptyVariantRow()] });
      setNewItemImage(null);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const toggleItemMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => updateMenuItem(id, { isActive }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => setError(err.message),
  });

  const toggleFeaturedMutation = useMutation({
    mutationFn: ({ id, featured }: { id: string; featured: boolean }) => updateMenuItem(id, { featured }),
    onSuccess: () => invalidate(),
    onError: (err: Error) => setError(err.message),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => deleteMenuItem(id),
    onSuccess: () => invalidate(),
    onError: (err: Error) => setError(err.message),
  });

  async function updateCategoryImage(file: File | null, clearExisting = false): Promise<void> {
    if (!selectedCategory) return;
    setCategoryImageUploading(true);
    setError(null);
    try {
      const imageUrl = file ? await uploadMenuImage(file) : clearExisting ? null : selectedCategory.imageUrl;
      if (file || clearExisting) {
        await updateMenuCategory(selectedCategory.id, { imageUrl: clearExisting && !file ? null : imageUrl });
        invalidate();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update category photo");
    } finally {
      setCategoryImageUploading(false);
    }
  }

  if (!canManage) {
    return (
      <PageHeader
        title="Menu"
        subtitle="You need pops.menu.manage permission to edit the menu. Sign out and sign in again if you were just granted access."
      />
    );
  }

  if (!branch?.code) {
    return <PageHeader title="Menu" subtitle="Select a branch to manage its menu." />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu"
        subtitle={`Categories and items for ${branch.name} (${branch.code}). Changes appear immediately on POS.`}
      />

      {menuQuery.isLoading ? <p className="text-sm text-slate-400">Loading menu…</p> : null}
      {menuQuery.isError ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {(menuQuery.error as Error).message}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-sm font-semibold text-white">Categories</div>
            <form
              className="mt-3 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!newCategoryName.trim()) return;
                createCategoryMutation.mutate(newCategoryName.trim());
              }}
            >
              <div className="flex gap-2">
                <input
                  className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                  placeholder="New category"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                />
                <Button type="submit" className="shrink-0 text-xs" disabled={createCategoryMutation.isPending}>
                  Add
                </Button>
              </div>
              <MenuImagePicker
                label="Category photo (optional)"
                value={null}
                previewFile={newCategoryImage}
                onFileSelect={setNewCategoryImage}
                onClear={() => setNewCategoryImage(null)}
                disabled={createCategoryMutation.isPending}
              />
            </form>
            <ul className="mt-3 space-y-1">
              {categories.map((cat) => (
                <li key={cat.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${
                      selectedCategory?.id === cat.id
                        ? amberPillActiveClass
                        : `${pillInactiveClass} dark:text-slate-300 dark:hover:bg-slate-800/80`
                    }`}
                  >
                    <MenuImageThumb imageUrl={cat.imageUrl} alt={cat.name} />
                    <span className="min-w-0 flex-1 truncate">{cat.name}</span>
                    {!cat.isActive ? <Badge tone="neutral">Off</Badge> : null}
                  </button>
                </li>
              ))}
            </ul>
            {selectedCategory ? (
              <div className="mt-4 space-y-3 border-t border-slate-800 pt-3">
                <MenuImagePicker
                  label="Category photo"
                  value={selectedCategory.imageUrl}
                  onFileSelect={(file) => {
                    if (file) void updateCategoryImage(file);
                  }}
                  onClear={() => void updateCategoryImage(null, true)}
                  disabled={categoryImageUploading}
                />
                <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="text-xs"
                  onClick={() =>
                    updateMenuCategory(selectedCategory.id, {
                      isActive: !selectedCategory.isActive,
                    }).then(invalidate)
                  }
                >
                  {selectedCategory.isActive ? "Disable category" : "Enable category"}
                </Button>
                <Button
                  variant="ghost"
                  className={`text-xs ${linkDangerClass}`}
                  onClick={() => {
                    if (confirm(`Delete category "${selectedCategory.name}" and all its items?`)) {
                      deleteCategoryMutation.mutate(selectedCategory.id);
                    }
                  }}
                >
                  Delete
                </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-4">
          <div className="rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-slate-900/40 p-4 ring-1 ring-amber-500/10">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">Happy hour promotion</div>
                <p className="mt-1 max-w-xl text-xs text-slate-400">
                  When active, customers who buy anything during the happy hour window automatically receive a
                  specific free item on their ticket.
                </p>
              </div>
              {happyHourDraft.enabled && isHappyHourActive(happyHourDraft) ? (
                <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-[10px] font-semibold text-emerald-400 ring-1 ring-emerald-500/25">
                  Active now
                </span>
              ) : happyHourDraft.enabled ? (
                <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[10px] font-medium text-slate-400">
                  Scheduled · {formatHappyHourWindow(happyHourDraft)}
                </span>
              ) : null}
            </div>

            <label className="mt-4 flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                className="accent-amber-500"
                checked={happyHourDraft.enabled}
                onChange={(e) =>
                  setHappyHourDraft((prev) => ({ ...prev, enabled: e.target.checked }))
                }
              />
              Enable happy hour
            </label>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block text-xs text-slate-400">
                Start hour (0–23)
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={happyHourDraft.startHour}
                  onChange={(e) =>
                    setHappyHourDraft((prev) => ({
                      ...prev,
                      startHour: Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-slate-400">
                End hour (0–23)
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={happyHourDraft.endHour}
                  onChange={(e) =>
                    setHappyHourDraft((prev) => ({
                      ...prev,
                      endHour: Number(e.target.value) || 0,
                    }))
                  }
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-slate-400 sm:col-span-2">
                Free gift item
                <select
                  value={happyHourDraft.bonusMenuItemId ?? ""}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    const item = bonusItemOptions.find((i) => i.id === id);
                    const defaultVariant = item?.variants.find((v) => v.isActive)?.id ?? null;
                    setHappyHourDraft((prev) => ({
                      ...prev,
                      bonusMenuItemId: id,
                      bonusVariantId: defaultVariant,
                    }));
                  }}
                  className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="">Select item to give free…</option>
                  {bonusItemOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {selectedBonusItem && selectedBonusItem.variants.filter((v) => v.isActive).length > 1 ? (
              <label className="mt-3 block text-xs text-slate-400">
                Gift size / variant
                <select
                  value={happyHourDraft.bonusVariantId ?? ""}
                  onChange={(e) =>
                    setHappyHourDraft((prev) => ({
                      ...prev,
                      bonusVariantId: e.target.value || null,
                    }))
                  }
                  className="mt-1 w-full max-w-md rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  {selectedBonusItem.variants
                    .filter((v) => v.isActive)
                    .map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                </select>
              </label>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                type="button"
                className="text-xs"
                onClick={() => {
                  if (!branch?.code) return;
                  if (happyHourDraft.enabled && !happyHourDraft.bonusMenuItemId) {
                    setHappyHourNotice("Select a free gift item before enabling happy hour.");
                    return;
                  }
                  saveHappyHourSettings(branch.code, happyHourDraft);
                  setHappyHourNotice("Happy hour settings saved. POS tickets will auto-add the gift item.");
                }}
              >
                Save happy hour
              </Button>
              <span className="text-[10px] text-slate-500">
                Window: {formatHappyHourWindow(happyHourDraft)}
              </span>
            </div>
            {happyHourNotice ? (
              <p className="mt-2 text-xs text-emerald-400">{happyHourNotice}</p>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-sm font-semibold text-white">
              Items {selectedCategory ? `· ${selectedCategory.name}` : ""}
            </div>

            {selectedCategory ? (
              <>
                <form
                  className="mt-4 space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!itemForm.name.trim()) return;
                    createItemMutation.mutate();
                  }}
                >
                  <label className="block text-xs text-slate-400">
                    Dish name
                    <input
                      className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                      value={itemForm.name}
                      onChange={(e) => setItemForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Chicken Karahi"
                      required
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-400">
                    <input
                      type="checkbox"
                      className="accent-amber-500"
                      checked={itemForm.featured}
                      onChange={(e) => setItemForm((f) => ({ ...f, featured: e.target.checked }))}
                    />
                    <span className="inline-flex items-center gap-1">
                      <span aria-hidden className="text-amber-700 dark:text-amber-300">★</span>
                      Feature this dish on POS
                    </span>
                  </label>

                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs font-medium text-slate-300">Sub-categories (sizes)</div>
                      <div className="flex flex-wrap gap-1">
                        {VARIANT_PRESETS.map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400 hover:border-amber-500/40 hover:text-white"
                            onClick={() =>
                              setItemForm((f) => ({
                                ...f,
                                variants: [...f.variants, { ...emptyVariantRow(), label: preset }],
                              }))
                            }
                          >
                            + {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Add Full, Half, Quarter, or custom sizes. POS shows a picker when a dish has more than one.
                    </p>
                    <ul className="mt-2 space-y-2">
                      {itemForm.variants.map((row, index) => (
                        <li
                          key={index}
                          className="grid gap-2 rounded-md border border-slate-800 bg-slate-950/40 p-2 sm:grid-cols-12"
                        >
                          <label className="block text-[10px] text-slate-500 sm:col-span-3">
                            Label
                            <input
                              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                              placeholder="Full"
                              value={row.label}
                              onChange={(e) =>
                                setItemForm((f) => ({
                                  ...f,
                                  variants: f.variants.map((v, i) =>
                                    i === index ? { ...v, label: e.target.value } : v,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label className="block text-[10px] text-slate-500 sm:col-span-2">
                            Price (PKR)
                            <input
                              type="number"
                              min={1}
                              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                              value={row.price}
                              onChange={(e) =>
                                setItemForm((f) => ({
                                  ...f,
                                  variants: f.variants.map((v, i) =>
                                    i === index ? { ...v, price: e.target.value } : v,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <label className="block text-[10px] text-slate-500 sm:col-span-3">
                            Barcode
                            <input
                              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                              value={row.barcode}
                              onChange={(e) =>
                                setItemForm((f) => ({
                                  ...f,
                                  variants: f.variants.map((v, i) =>
                                    i === index ? { ...v, barcode: e.target.value } : v,
                                  ),
                                }))
                              }
                            />
                          </label>
                          <div className="flex items-end justify-end sm:col-span-4">
                            {itemForm.variants.length > 1 ? (
                              <button
                                type="button"
                                className={`pb-1.5 text-[10px] ${linkDangerClass}`}
                                onClick={() =>
                                  setItemForm((f) => ({
                                    ...f,
                                    variants: f.variants.filter((_, i) => i !== index),
                                  }))
                                }
                              >
                                Remove
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className={`mt-2 text-xs ${linkWarningClass}`}
                      onClick={() =>
                        setItemForm((f) => ({ ...f, variants: [...f.variants, emptyVariantRow()] }))
                      }
                    >
                      + Add sub-category
                    </button>
                  </div>

                  <MenuImagePicker
                    label="Dish photo (optional)"
                    value={null}
                    previewFile={newItemImage}
                    onFileSelect={setNewItemImage}
                    onClear={() => setNewItemImage(null)}
                    disabled={createItemMutation.isPending}
                  />
                  <div>
                    <Button type="submit" className="text-xs" disabled={createItemMutation.isPending}>
                      Add menu item
                    </Button>
                  </div>
                </form>

                <div className="mt-6">
                  {categoryItems.length === 0 ? (
                    <p className="text-sm text-slate-500">No items in this category yet.</p>
                  ) : (
                    <SimpleTable
                      rowKey={(r) => r.id}
                      columns={[
                        {
                          key: "image",
                          header: "",
                          id: "image",
                          render: (r: MenuItem) => (
                            <MenuImageThumb imageUrl={r.imageUrl} alt={r.name} />
                          ),
                        },
                        {
                          key: "name",
                          header: "Item",
                          render: (r: MenuItem) => (
                            <div>
                              <div className="flex items-center gap-1.5">
                                {r.featured ? (
                                  <span className="text-amber-700 dark:text-amber-300" title="Featured dish" aria-label="Featured">
                                    ★
                                  </span>
                                ) : null}
                                <span>{r.name}</span>
                              </div>
                              {r.variants.length > 0 ? (
                                <div className="mt-1 flex flex-wrap gap-1">
                                  {r.variants.map((v) => (
                                    <Badge key={v.id} tone="neutral">
                                      {v.label} · Rs {v.price.toLocaleString()}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <div className="mt-0.5 text-xs text-slate-500">{formatMenuItemLabel(r)}</div>
                              )}
                            </div>
                          ),
                        },
                        {
                          key: "price",
                          header: "Price",
                          render: (r) => {
                            if (r.variants.length > 1) {
                              const prices = r.variants.map((v) => v.price);
                              const min = Math.min(...prices);
                              const max = Math.max(...prices);
                              return min === max
                                ? `Rs ${min.toLocaleString()}`
                                : `Rs ${min.toLocaleString()} – ${max.toLocaleString()}`;
                            }
                            return `Rs ${menuItemDisplayPrice(r).toLocaleString()}`;
                          },
                        },
                        {
                          key: "tags",
                          header: "Tags",
                          id: "tags",
                          render: (r: MenuItem) => (
                            <span className="flex flex-wrap gap-1">
                              {r.featured ? <Badge tone="warning">Featured</Badge> : null}
                              {happyHourDraft.bonusMenuItemId === r.id ? (
                                <Badge tone="warning">HH gift</Badge>
                              ) : null}
                              {!r.isActive ? <Badge tone="neutral">Off</Badge> : null}
                            </span>
                          ),
                        },
                        {
                          key: "actions",
                          header: "",
                          id: "actions",
                          render: (r: MenuItem) => (
                            <span className="flex items-center gap-2">
                              <button
                                type="button"
                                title={r.featured ? "Remove from featured" : "Mark as featured"}
                                className={`text-sm leading-none transition ${
                                  r.featured
                                    ? accentValueClass
                                    : `${mutedClass} hover:text-amber-800 dark:hover:text-amber-300`
                                }`}
                                onClick={() =>
                                  toggleFeaturedMutation.mutate({ id: r.id, featured: !r.featured })
                                }
                              >
                                ★
                              </button>
                              <button
                                type="button"
                                className="text-xs font-medium text-slate-700 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                                onClick={() =>
                                  toggleItemMutation.mutate({ id: r.id, isActive: !r.isActive })
                                }
                              >
                                {r.isActive ? "Disable" : "Enable"}
                              </button>
                              <button
                                type="button"
                                className={`text-xs ${linkDangerClass}`}
                                onClick={() => {
                                  if (confirm(`Delete "${r.name}"?`)) deleteItemMutation.mutate(r.id);
                                }}
                              >
                                Delete
                              </button>
                            </span>
                          ),
                        },
                      ]}
                      rows={categoryItems}
                    />
                  )}
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Create a category to start adding menu items.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
