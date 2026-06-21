import { Button } from "@platform/ui";
import type { Bill, DeliveryStatus, KitchenTicket } from "@platform/contracts";
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_VALUES } from "@platform/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { usePopsStore } from "../../../stores/popsStore";
import { fetchCompletedOrders } from "../../api/billing";
import {
  createRider,
  fetchRiders,
  updateDeliveryOrder,
  updateRider,
} from "../../api/delivery";
import { fetchKitchenTickets, updateKitchenTicket } from "../../api/kitchen";
import {
  buildDeliveryOrders,
  deliveryOrderCharge,
  deliveryOrderContact,
  deliveryOrderItemsSummary,
  deliveryOrderRider,
  deliveryOrderStatus,
  deliveryOrderStatusLabel,
  isActiveDeliveryOrder,
} from "../../lib/deliveryOrders";
import {
  DEFAULT_DELIVERY_SETTINGS,
  loadDeliverySettings,
  normalizeDeliverySettings,
  saveDeliverySettings,
  type DeliverySettings,
} from "../../lib/deliverySettings";
import {
  unifiedOrderRef,
  unifiedOrderTotal,
  type UnifiedOrder,
} from "../../lib/orderHistory";
import { printKot, printReceipt, type PrintTicketInput } from "../../lib/printTicket";
import {
  cardClass,
  emptyStateBoxClass,
  fieldInputClass,
  linkActionClass,
  mutedClass,
  noticeWarningClass,
  panelTitleClass,
  subtleClass,
  tableCellAmountClass,
  tableCellPrimaryClass,
  tableOrderRefClass,
} from "../../lib/themeClasses";
import { Badge } from "../../ui/Badge";
import {
  ModuleCountBadge,
  ModuleFilterBar,
  ModuleSearchInput,
  ModuleSegmentedControl,
  ModuleToolbar,
} from "../../ui/ModuleToolbar";
import { SimpleTable } from "../../ui/SimpleTable";

type DeliveryTab = "orders" | "riders" | "charges";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function parseItemsSummary(summary: string): { label: string; qty: number }[] {
  return summary
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^(.+?)\s+x(\d+)$/i);
      return match
        ? { label: match[1].trim(), qty: Number(match[2]) }
        : { label: part, qty: 1 };
    });
}

function ticketToPrint(
  ticket: KitchenTicket,
  branchName: string,
  branchCode: string,
): Omit<PrintTicketInput, "kind"> {
  const items = deliveryOrderItemsSummary({
    source: "kitchen",
    id: ticket.id,
    createdAt: ticket.createdAt,
    ticket,
  });
  const lines = parseItemsSummary(items).map((line) => ({
    label: line.label,
    qty: line.qty,
    unitPrice: 0,
  }));

  return {
    branchName,
    branchCode,
    orderRef: ticket.orderRef ?? ticket.ticketRef,
    modeLabel: "Delivery",
    tableLabel: ticket.stationLabel,
    lines: lines.length > 0 ? lines : [{ label: items || "Items", qty: 1, unitPrice: 0 }],
    subtotal: 0,
    discount: 0,
    service: 0,
    tax: 0,
    deliveryCharge: ticket.deliveryChargePkr,
    total: ticket.deliveryChargePkr,
    servicePct: 0,
    discountPct: 0,
  };
}

function billToPrint(branchName: string, branchCode: string, bill: Bill): Omit<PrintTicketInput, "kind"> {
  return {
    branchName,
    branchCode,
    orderRef: bill.orderRef ?? bill.billRef,
    billRef: bill.billRef,
    modeLabel: "Delivery",
    tableLabel: bill.tableLabel,
    waiterName: bill.waiterName,
    lines: bill.lines.map((line) => ({
      label: line.label,
      qty: line.qty,
      unitPrice: line.unitPrice,
    })),
    subtotal: bill.subtotal,
    discount: bill.discount,
    service: bill.service,
    tax: bill.tax,
    deliveryCharge: bill.deliveryChargePkr,
    total: bill.total,
    servicePct: bill.servicePct,
    taxPct: bill.taxPct,
    discountPct: bill.subtotal > 0 ? Math.round((bill.discount / bill.subtotal) * 100) : 0,
    notes: bill.notes ?? undefined,
  };
}

function deliveryStatusTone(status: DeliveryStatus | null): "warning" | "info" | "success" | "neutral" {
  if (!status) return "neutral";
  if (status === "unassigned") return "warning";
  if (status === "assigned") return "info";
  if (status === "out_for_delivery") return "info";
  return "success";
}

export function DeliveryPage(): JSX.Element {
  const queryClient = useQueryClient();
  const branch = usePopsStore((s) => s.branch);
  const [tab, setTab] = useState<DeliveryTab>("orders");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"all" | "active">("all");
  const [selected, setSelected] = useState<UnifiedOrder | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [riderCnic, setRiderCnic] = useState("");
  const [riderSalary, setRiderSalary] = useState("");
  const [riderFromArea, setRiderFromArea] = useState("");
  const [riderNotes, setRiderNotes] = useState("");

  const [savedCharges, setSavedCharges] = useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS);
  const [draftCharges, setDraftCharges] = useState<DeliverySettings>(DEFAULT_DELIVERY_SETTINGS);

  const [manageRiderId, setManageRiderId] = useState("");
  const [manageCharge, setManageCharge] = useState(0);
  const [manageStatus, setManageStatus] = useState<DeliveryStatus>("unassigned");

  useEffect(() => {
    const loaded = loadDeliverySettings(branch?.code);
    setSavedCharges(loaded);
    setDraftCharges(loaded);
  }, [branch?.code]);

  useEffect(() => {
    if (!selected || selected.source !== "kitchen") return;
    setManageRiderId(selected.ticket.riderId ?? "");
    setManageCharge(selected.ticket.deliveryChargePkr);
    setManageStatus(selected.ticket.deliveryStatus ?? "unassigned");
  }, [selected]);

  const ordersQuery = useQuery({
    queryKey: ["orders", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchCompletedOrders(branch!.code),
    refetchInterval: 5_000,
  });

  const ticketsQuery = useQuery({
    queryKey: ["kitchen", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchKitchenTickets(branch!.code),
    refetchInterval: 5_000,
  });

  const ridersQuery = useQuery({
    queryKey: ["delivery-riders", branch?.code],
    enabled: Boolean(branch?.code),
    queryFn: () => fetchRiders(branch!.code),
  });

  const allOrders = useMemo(
    () => buildDeliveryOrders(ordersQuery.data ?? [], ticketsQuery.data ?? []),
    [ordersQuery.data, ticketsQuery.data],
  );

  const activeCount = useMemo(
    () => allOrders.filter(isActiveDeliveryOrder).length,
    [allOrders],
  );

  const filtered = useMemo(() => {
    let list = view === "active" ? allOrders.filter(isActiveDeliveryOrder) : allOrders;
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((o) => {
      const ref = unifiedOrderRef(o).toLowerCase();
      const { customer, address } = deliveryOrderContact(o);
      const items = deliveryOrderItemsSummary(o).toLowerCase();
      const rider = deliveryOrderRider(o).toLowerCase();
      const extra =
        o.source === "bill"
          ? o.bill.billRef.toLowerCase()
          : o.ticket.ticketRef.toLowerCase();
      return (
        ref.includes(q) ||
        customer.toLowerCase().includes(q) ||
        address.toLowerCase().includes(q) ||
        items.includes(q) ||
        rider.includes(q) ||
        extra.includes(q)
      );
    });
  }, [allOrders, search, view]);

  function invalidate(): void {
    void queryClient.invalidateQueries({ queryKey: ["kitchen"] });
    void queryClient.invalidateQueries({ queryKey: ["orders"] });
    void queryClient.invalidateQueries({ queryKey: ["delivery-riders"] });
    void queryClient.invalidateQueries({ queryKey: ["operations", "dashboard"] });
  }

  const completeMutation = useMutation({
    mutationFn: (id: string) => updateKitchenTicket(id, { status: "done" }),
    onSuccess: async () => {
      invalidate();
      await queryClient.refetchQueries({ queryKey: ["orders", branch?.code] });
      setSelected(null);
      setCompletingId(null);
      setNotice("Delivery order completed and billed.");
    },
    onError: (err: Error) => {
      setCompletingId(null);
      setNotice(err.message);
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: ({ ticketId, riderId, deliveryChargePkr, deliveryStatus }: {
      ticketId: string;
      riderId: string | null;
      deliveryChargePkr: number;
      deliveryStatus: DeliveryStatus;
    }) =>
      updateDeliveryOrder(ticketId, {
        riderId,
        deliveryChargePkr,
        deliveryStatus,
      }),
    onSuccess: (ticket) => {
      invalidate();
      setSelected((prev) =>
        prev?.source === "kitchen" && prev.ticket.id === ticket.id
          ? { ...prev, ticket }
          : prev,
      );
      setNotice("Delivery order updated.");
    },
    onError: (err: Error) => setNotice(err.message),
  });

  function resetRiderForm(): void {
    setRiderName("");
    setRiderPhone("");
    setRiderCnic("");
    setRiderSalary("");
    setRiderFromArea("");
    setRiderNotes("");
  }

  const createRiderMutation = useMutation({
    mutationFn: () =>
      createRider({
        branchCode: branch!.code,
        name: riderName.trim(),
        phone: riderPhone.trim() || undefined,
        cnic: riderCnic.trim() || undefined,
        salaryPkr: riderSalary.trim() ? Number(riderSalary) : undefined,
        fromArea: riderFromArea.trim() || undefined,
        notes: riderNotes.trim() || undefined,
      }),
    onSuccess: () => {
      resetRiderForm();
      invalidate();
      setNotice("Rider added.");
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const toggleRiderMutation = useMutation({
    mutationFn: ({ riderId, active }: { riderId: string; active: boolean }) =>
      updateRider(riderId, { active }),
    onSuccess: () => {
      invalidate();
      setNotice("Rider updated.");
    },
    onError: (err: Error) => setNotice(err.message),
  });

  const isLoading = ordersQuery.isLoading || ticketsQuery.isLoading;
  const isError = ordersQuery.isError || ticketsQuery.isError;
  const errorMessage = (ordersQuery.error ?? ticketsQuery.error) as Error | null;
  const riders = ridersQuery.data ?? [];

  if (!branch?.code) {
    return <p className="text-sm text-slate-500">Select a branch to view delivery orders.</p>;
  }

  return (
    <div className="space-y-3">
      <ModuleToolbar
        title="Delivery"
        trailing={
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2.5 text-xs"
            onClick={() => {
              void ordersQuery.refetch();
              void ticketsQuery.refetch();
              void ridersQuery.refetch();
            }}
          >
            Refresh
          </Button>
        }
      />

      <ModuleFilterBar>
        <ModuleSegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { id: "orders", label: "Orders" },
            { id: "riders", label: `Riders (${riders.length})` },
            { id: "charges", label: "Charges" },
          ]}
        />
      </ModuleFilterBar>

      {notice ? (
        <p className={noticeWarningClass}>
          {notice}
        </p>
      ) : null}

      {tab === "charges" ? (
        <div className={`max-w-md ${cardClass} p-4`}>
          <div className={panelTitleClass}>Default delivery charge</div>
          <p className={`mt-1 text-xs ${mutedClass}`}>
            Applied when creating delivery orders from POS. Current: Rs {savedCharges.defaultChargePkr.toLocaleString()}.
          </p>
          <label className={`mt-4 block text-xs ${mutedClass}`}>
            Charge (PKR)
            <input
              type="number"
              min={0}
              max={50000}
              value={draftCharges.defaultChargePkr}
              onChange={(e) =>
                setDraftCharges((prev) => ({
                  ...prev,
                  defaultChargePkr: Math.max(0, Number(e.target.value) || 0),
                }))
              }
              className={`mt-1.5 w-full ${fieldInputClass}`}
            />
          </label>
          <div className="mt-4 flex gap-2">
            <Button
              type="button"
              className="h-8 text-xs"
              onClick={() => {
                const next = normalizeDeliverySettings(draftCharges);
                saveDeliverySettings(branch.code, next);
                setSavedCharges(next);
                setDraftCharges(next);
                setNotice("Default delivery charge saved.");
              }}
            >
              Save
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-8 text-xs"
              onClick={() => setDraftCharges(DEFAULT_DELIVERY_SETTINGS)}
            >
              Reset to default
            </Button>
          </div>
        </div>
      ) : null}

      {tab === "riders" ? (
        <div className="space-y-4">
          <div className={`max-w-2xl ${cardClass} p-4`}>
            <div className={panelTitleClass}>Add rider</div>
            <p className={`mt-1 text-xs ${mutedClass}`}>Name is required. Other fields help with payroll and records.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <input
                placeholder="Name *"
                value={riderName}
                onChange={(e) => setRiderName(e.target.value)}
                className={fieldInputClass}
              />
              <input
                placeholder="Phone"
                value={riderPhone}
                onChange={(e) => setRiderPhone(e.target.value)}
                className={fieldInputClass}
              />
              <input
                placeholder="CNIC (e.g. 35202-1234567-1)"
                value={riderCnic}
                onChange={(e) => setRiderCnic(e.target.value)}
                className={fieldInputClass}
              />
              <input
                type="number"
                min={0}
                placeholder="Salary (Rs / month)"
                value={riderSalary}
                onChange={(e) => setRiderSalary(e.target.value)}
                className={fieldInputClass}
              />
              <input
                placeholder="From (area / city)"
                value={riderFromArea}
                onChange={(e) => setRiderFromArea(e.target.value)}
                className={fieldInputClass}
              />
              <input
                placeholder="Notes (vehicle, shift, etc.)"
                value={riderNotes}
                onChange={(e) => setRiderNotes(e.target.value)}
                className={fieldInputClass}
              />
            </div>
            <Button
              type="button"
              className="mt-3 h-8 text-xs"
              disabled={!riderName.trim() || createRiderMutation.isPending}
              onClick={() => createRiderMutation.mutate()}
            >
              {createRiderMutation.isPending ? "…" : "Add rider"}
            </Button>
          </div>

          {ridersQuery.isLoading ? (
            <p className="text-xs text-slate-500">Loading riders…</p>
          ) : riders.length === 0 ? (
            <p className={emptyStateBoxClass}>No riders yet. Add riders to assign delivery orders.</p>
          ) : (
            <SimpleTable
              rowKey={(r) => r.id}
              rows={riders}
              columns={[
                { key: "name", header: "Name", render: (r) => <span className={tableCellPrimaryClass}>{r.name}</span> },
                { key: "phone", header: "Phone", render: (r) => <span className={mutedClass}>{r.phone ?? "—"}</span> },
                { key: "cnic", header: "CNIC", render: (r) => <span className={mutedClass}>{r.cnic ?? "—"}</span> },
                {
                  key: "salaryPkr",
                  header: "Salary",
                  render: (r) => (
                    <span className={mutedClass}>
                      {r.salaryPkr != null ? `Rs ${r.salaryPkr.toLocaleString()}` : "—"}
                    </span>
                  ),
                },
                { key: "fromArea", header: "From", render: (r) => <span className={mutedClass}>{r.fromArea ?? "—"}</span> },
                {
                  key: "notes",
                  header: "Notes",
                  render: (r) => (
                    <span className="max-w-[10rem] truncate text-slate-500" title={r.notes ?? undefined}>
                      {r.notes ?? "—"}
                    </span>
                  ),
                },
                {
                  key: "active",
                  header: "Status",
                  render: (r) => (
                    <Badge tone={r.active ? "success" : "neutral"}>{r.active ? "Active" : "Inactive"}</Badge>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  id: "actions",
                  render: (r) => (
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-7 px-2 text-[11px]"
                      disabled={toggleRiderMutation.isPending}
                      onClick={() =>
                        toggleRiderMutation.mutate({ riderId: r.id, active: !r.active })
                      }
                    >
                      {r.active ? "Deactivate" : "Activate"}
                    </Button>
                  ),
                },
              ]}
            />
          )}
        </div>
      ) : null}

      {tab === "orders" ? (
        <>
          <ModuleFilterBar>
            <ModuleSegmentedControl
              value={view}
              onChange={setView}
              options={[
                { id: "all", label: "All" },
                { id: "active", label: `Active (${activeCount})`, accent: true },
              ]}
            />
            <ModuleSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search order, customer, rider…"
            />
            <ModuleCountBadge shown={filtered.length} total={allOrders.length} />
          </ModuleFilterBar>

          {isLoading ? <p className="text-xs text-slate-500">Loading…</p> : null}
          {isError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {errorMessage?.message ?? "Could not load delivery orders."}
            </p>
          ) : null}

          {filtered.length === 0 && !isLoading ? (
            <p className={emptyStateBoxClass}>
              {allOrders.length === 0
                ? "No delivery orders yet. Create one from POS with Delivery mode."
                : "No orders match your filters."}
            </p>
          ) : (
            <SimpleTable
              rowKey={(r) => r.id}
              rows={filtered}
              columns={[
                {
                  key: "ref",
                  header: "Order",
                  render: (r) => (
                    <span className={tableOrderRefClass}>{unifiedOrderRef(r)}</span>
                  ),
                },
                {
                  key: "customer",
                  header: "Customer",
                  render: (r) => (
                    <span className={tableCellPrimaryClass}>{deliveryOrderContact(r).customer}</span>
                  ),
                },
                {
                  key: "rider",
                  header: "Rider",
                  render: (r) => <span className={mutedClass}>{deliveryOrderRider(r)}</span>,
                },
                {
                  key: "charge",
                  header: "Delivery",
                  render: (r) => {
                    const charge = deliveryOrderCharge(r);
                    return charge > 0 ? (
                      <span className={`tabular-nums ${subtleClass}`}>Rs {charge.toLocaleString()}</span>
                    ) : (
                      "—"
                    );
                  },
                },
                {
                  key: "total",
                  header: "Total",
                  render: (r) => {
                    const total = unifiedOrderTotal(r);
                    return total != null ? (
                      <span className={tableCellAmountClass}>Rs {total.toLocaleString()}</span>
                    ) : (
                      "—"
                    );
                  },
                },
                {
                  key: "status",
                  header: "Status",
                  render: (r) => (
                    <Badge tone={deliveryStatusTone(deliveryOrderStatus(r))}>
                      {deliveryOrderStatusLabel(r)}
                    </Badge>
                  ),
                },
                {
                  key: "when",
                  header: "When",
                  render: (r) => <span className={mutedClass}>{formatWhen(r.createdAt)}</span>,
                },
                {
                  key: "actions",
                  header: "",
                  id: "actions",
                  render: (r) => (
                    <span className="flex items-center gap-2">
                      {r.source === "kitchen" && r.ticket.status !== "done" ? (
                        <Button
                          type="button"
                          className="h-7 border-0 bg-emerald-600 px-2 text-[11px] font-semibold text-white hover:bg-emerald-500"
                          disabled={completeMutation.isPending}
                          onClick={() => {
                            setCompletingId(r.ticket.id);
                            completeMutation.mutate(r.ticket.id);
                          }}
                        >
                          {completeMutation.isPending && completingId === r.ticket.id ? "…" : "Complete"}
                        </Button>
                      ) : null}
                      <button
                        type="button"
                        className={`text-[11px] ${linkActionClass}`}
                        onClick={() => setSelected(selected?.id === r.id ? null : r)}
                      >
                        {selected?.id === r.id ? "Hide" : "Manage"}
                      </button>
                    </span>
                  ),
                },
              ]}
            />
          )}

          {selected ? (
            <div className={`${cardClass} p-4`}>
              {(() => {
                const { customer, address } = deliveryOrderContact(selected);
                const items = deliveryOrderItemsSummary(selected);
                const total = unifiedOrderTotal(selected);
                const charge = deliveryOrderCharge(selected);

                return (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className={tableOrderRefClass}>
                          {unifiedOrderRef(selected)}
                        </div>
                        <p className={`mt-0.5 text-xs ${mutedClass}`}>
                          {customer} · {address} · {formatWhen(selected.createdAt)}
                        </p>
                      </div>
                      {selected.source === "bill" ? (
                        <Button
                          type="button"
                          className="h-7 text-xs"
                          onClick={() => printReceipt(billToPrint(branch.name, branch.code, selected.bill))}
                        >
                          Reprint
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          className="h-7 text-xs"
                          onClick={() =>
                            printKot(ticketToPrint(selected.ticket, branch.name, branch.code))
                          }
                        >
                          Print KOT
                        </Button>
                      )}
                    </div>
                    <p className={`mt-3 text-sm ${subtleClass}`}>{items}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <Badge tone={deliveryStatusTone(deliveryOrderStatus(selected))}>
                        {deliveryOrderStatusLabel(selected)}
                      </Badge>
                      {charge > 0 ? (
                        <span className={`text-sm ${mutedClass}`}>
                          Delivery Rs {charge.toLocaleString()}
                        </span>
                      ) : null}
                      {total != null ? (
                        <span className={`text-sm ${tableCellAmountClass}`}>
                          Rs {total.toLocaleString()}
                        </span>
                      ) : null}
                    </div>

                    {selected.source === "kitchen" && selected.ticket.status !== "done" ? (
                      <div className="mt-4 grid gap-3 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-3">
                        <label className={`block text-xs ${mutedClass}`}>
                          Assign rider
                          <select
                            value={manageRiderId}
                            onChange={(e) => setManageRiderId(e.target.value)}
                            className={`mt-1 w-full ${fieldInputClass}`}
                          >
                            <option value="">Unassigned</option>
                            {riders
                              .filter((r) => r.active)
                              .map((rider) => (
                                <option key={rider.id} value={rider.id}>
                                  {rider.name}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label className={`block text-xs ${mutedClass}`}>
                          Delivery charge
                          <input
                            type="number"
                            min={0}
                            max={50000}
                            value={manageCharge}
                            onChange={(e) => setManageCharge(Math.max(0, Number(e.target.value) || 0))}
                            className={`mt-1 w-full ${fieldInputClass}`}
                          />
                        </label>
                        <label className={`block text-xs ${mutedClass}`}>
                          Delivery status
                          <select
                            value={manageStatus}
                            onChange={(e) => setManageStatus(e.target.value as DeliveryStatus)}
                            className={`mt-1 w-full ${fieldInputClass}`}
                          >
                            {DELIVERY_STATUS_VALUES.map((status) => (
                              <option key={status} value={status}>
                                {DELIVERY_STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="sm:col-span-3">
                          <Button
                            type="button"
                            className="h-8 text-xs"
                            disabled={updateOrderMutation.isPending}
                            onClick={() =>
                              updateOrderMutation.mutate({
                                ticketId: selected.ticket.id,
                                riderId: manageRiderId || null,
                                deliveryChargePkr: manageCharge,
                                deliveryStatus: manageStatus,
                              })
                            }
                          >
                            {updateOrderMutation.isPending ? "Saving…" : "Save changes"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </>
                );
              })()}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
