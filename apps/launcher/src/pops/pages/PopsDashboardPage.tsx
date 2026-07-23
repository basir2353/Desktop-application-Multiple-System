import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSessionStore } from "../../stores/sessionStore";
import { usePopsStore } from "../../stores/popsStore";
import { fetchAccountingDashboard } from "../api/accounting";
import { fetchCompletedOrders } from "../api/billing";
import { fetchKitchenTickets } from "../api/kitchen";
import { fetchDashboard, SessionExpiredError, isSessionExpiredError } from "../api/operations";
import { DashboardChartsGrid } from "../components/dashboard/DashboardChartsGrid";
import { summarizePendingOrders } from "../lib/pendingOrdersMetrics";
import {
  loadBusinessDaySettings,
  formatBusinessDayRange,
  BUSINESS_DAY_CHANGED_EVENT,
  type BusinessDaySettings,
} from "../lib/businessDay";
import {
  businessDateKey,
  currentBusinessDateKey,
  karachiTime,
  payableCompletedOrders,
  salesMetricsFromOrders,
  timeToMinutes,
} from "../lib/orderSales";
import { PageHeader } from "../ui/PageHeader";
import { erpEntryPathForRole, sessionCanManageUsers } from "../lib/roleAccess";

function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

function slaLabel(status: "green" | "yellow" | "red"): string {
  if (status === "green") return "SLA green";
  if (status === "yellow") return "SLA yellow";
  return "SLA red";
}

const timeFieldClass = "rounded bg-transparent text-sm text-white outline-none";

/** Splits a "HH:mm" 24h value into 12h parts for AM/PM display. Empty value → nulls. */
function to12Hour(value24: string): { hour: number; minute: number; meridiem: "AM" | "PM" } | null {
  if (!value24) return null;
  const [h, m] = value24.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const meridiem: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { hour, minute: m, meridiem };
}

function from12Hour(hour: number, minute: number, meridiem: "AM" | "PM"): string {
  const h24 = meridiem === "AM" ? (hour === 12 ? 0 : hour) : hour === 12 ? 12 : hour + 12;
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function format12Hour(value24: string): string {
  const parts = to12Hour(value24);
  if (!parts) return "";
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")} ${parts.meridiem}`;
}

function IconClockSmall(): JSX.Element {
  return (
    <svg className="h-3.5 w-3.5 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

type ClockMode = "hour" | "minute";

const CLOCK_SIZE = 176;
const CLOCK_CENTER = CLOCK_SIZE / 2;
const CLOCK_RADIUS = 70;
const CLOCK_NUMBER_RADIUS = CLOCK_RADIUS * 0.78;

/** Angle (deg, 0 = 12 o'clock, clockwise) from clock center to a point. */
function angleFromCenter(x: number, y: number): number {
  const dx = x - CLOCK_CENTER;
  const dy = y - CLOCK_CENTER;
  let deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function angleToHour(deg: number): number {
  const h = Math.round(deg / 30) % 12;
  return h === 0 ? 12 : h;
}

function angleToMinute(deg: number): number {
  return Math.round(deg / 6) % 60;
}

/** Analog clock face — click or drag the hand to set the hour (1-12) or minute (0-59). */
function AnalogClock({
  mode,
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: {
  mode: ClockMode;
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragging, setDragging] = useState(false);

  function selectFromPointer(clientX: number, clientY: number): void {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * CLOCK_SIZE;
    const y = ((clientY - rect.top) / rect.height) * CLOCK_SIZE;
    const deg = angleFromCenter(x, y);
    if (mode === "hour") onHourChange(angleToHour(deg));
    else onMinuteChange(angleToMinute(deg));
  }

  const activeValue = mode === "hour" ? (hour % 12) * 30 : minute * 6;
  const activeRad = (activeValue * Math.PI) / 180;
  const handX = CLOCK_CENTER + CLOCK_NUMBER_RADIUS * Math.sin(activeRad);
  const handY = CLOCK_CENTER - CLOCK_NUMBER_RADIUS * Math.cos(activeRad);

  const hourNumbers = Array.from({ length: 12 }, (_, i) => i + 1);
  const minuteMarks = Array.from({ length: 12 }, (_, i) => i * 5);
  const marks = mode === "hour" ? hourNumbers : minuteMarks;
  const selectedMark = mode === "hour" ? hour : minute;

  return (
    <svg
      ref={svgRef}
      width={CLOCK_SIZE}
      height={CLOCK_SIZE}
      className="cursor-pointer select-none touch-none"
      onMouseDown={(e) => {
        setDragging(true);
        selectFromPointer(e.clientX, e.clientY);
      }}
      onMouseMove={(e) => {
        if (dragging) selectFromPointer(e.clientX, e.clientY);
      }}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
    >
      <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={CLOCK_RADIUS} className="fill-slate-950 stroke-slate-700" />
      <line
        x1={CLOCK_CENTER}
        y1={CLOCK_CENTER}
        x2={handX}
        y2={handY}
        className="stroke-amber-400"
        strokeWidth={2}
        strokeLinecap="round"
      />
      <circle cx={CLOCK_CENTER} cy={CLOCK_CENTER} r={2.5} className="fill-amber-400" />
      <circle cx={handX} cy={handY} r={13} className="fill-amber-500" />
      {marks.map((mark) => {
        const rad = ((mode === "hour" ? mark % 12 : mark / 5) * 30 * Math.PI) / 180;
        const nx = CLOCK_CENTER + CLOCK_NUMBER_RADIUS * Math.sin(rad);
        const ny = CLOCK_CENTER - CLOCK_NUMBER_RADIUS * Math.cos(rad);
        const isSelected = mark === selectedMark;
        return (
          <text
            key={mark}
            x={nx}
            y={ny}
            textAnchor="middle"
            dominantBaseline="central"
            className={`pointer-events-none select-none text-[11px] font-semibold ${
              isSelected ? "fill-slate-950" : "fill-slate-300"
            }`}
          >
            {mode === "hour" ? mark : String(mark).padStart(2, "0")}
          </text>
        );
      })}
    </svg>
  );
}

/** Click-to-open clock-style AM/PM time picker — avoids native <input type="time">/<select> (OS locale + unthemed popup issues). */
function TimeAmPmInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (next: string) => void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ClockMode>("hour");
  const containerRef = useRef<HTMLDivElement>(null);
  const parts = to12Hour(value) ?? { hour: 12, minute: 0, meridiem: "AM" as const };

  useEffect(() => {
    if (!open) return;
    setMode("hour");
    function onClickOutside(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function update(patch: Partial<typeof parts>): void {
    const next = { ...parts, ...patch };
    onChange(from12Hour(next.hour, next.minute, next.meridiem));
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`${timeFieldClass} mt-1 flex items-center gap-1.5 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 hover:border-slate-600`}
      >
        <IconClockSmall />
        <span className="tabular-nums">
          {String(parts.hour).padStart(2, "0")}:{String(parts.minute).padStart(2, "0")}
        </span>
        <span className="font-semibold text-amber-400">{parts.meridiem}</span>
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-20 mt-1 w-[13.5rem] rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl">
          <div className="mb-3 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setMode("hour")}
              className={`rounded px-2 py-1 text-2xl font-semibold tabular-nums transition ${
                mode === "hour" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {String(parts.hour).padStart(2, "0")}
            </button>
            <span className="text-2xl font-semibold text-slate-500">:</span>
            <button
              type="button"
              onClick={() => setMode("minute")}
              className={`rounded px-2 py-1 text-2xl font-semibold tabular-nums transition ${
                mode === "minute" ? "bg-amber-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              {String(parts.minute).padStart(2, "0")}
            </button>
            <div className="ml-1 flex flex-col gap-0.5">
              {(["AM", "PM"] as const).map((meridiem) => (
                <button
                  key={meridiem}
                  type="button"
                  onClick={() => update({ meridiem })}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold transition ${
                    parts.meridiem === meridiem
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:bg-slate-800"
                  }`}
                >
                  {meridiem}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <AnalogClock
              mode={mode}
              hour={parts.hour}
              minute={parts.minute}
              onHourChange={(h) => {
                update({ hour: h });
                setMode("minute");
              }}
              onMinuteChange={(m) => update({ minute: m })}
            />
          </div>

          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded px-3 py-1 text-xs font-semibold text-amber-400 hover:bg-slate-800"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type TopProduct = { label: string; qty: number; revenue: number };

function topProductsAlphabetical(orders: ReturnType<typeof payableCompletedOrders>): TopProduct[] {
  const map = new Map<string, TopProduct>();
  for (const order of orders) {
    for (const line of order.lines) {
      const existing = map.get(line.label) ?? { label: line.label, qty: 0, revenue: 0 };
      existing.qty += line.qty;
      existing.revenue += line.unitPrice * line.qty;
      map.set(line.label, existing);
    }
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

const ZOOM_LEVELS = [0.6, 0.75, 0.85, 1, 1.15, 1.3, 1.5] as const;

export function PopsDashboardPage(): JSX.Element {
  const navigate = useNavigate();
  const claims = useSessionStore((s) => s.claims);
  const accessToken = useSessionStore((s) => s.accessToken);
  const branch = usePopsStore((s) => s.branch);
  const displayRole = usePopsStore((s) => s.displayRole);
  const canViewDashboard = sessionCanManageUsers(claims);

  useEffect(() => {
    if (!canViewDashboard) {
      navigate(erpEntryPathForRole("restaurant", displayRole), { replace: true });
    }
  }, [canViewDashboard, displayRole, navigate]);

  const [businessDay, setBusinessDay] = useState<BusinessDaySettings>(() =>
    loadBusinessDaySettings(branch?.code),
  );
  const todayKey = useMemo(() => currentBusinessDateKey(businessDay), [businessDay]);
  const [fromDate, setFromDate] = useState(todayKey);
  const [toDate, setToDate] = useState(todayKey);
  const [fromTime, setFromTime] = useState("");
  const [toTime, setToTime] = useState("");
  const [zoomIndex, setZoomIndex] = useState(3);

  useEffect(() => {
    setBusinessDay(loadBusinessDaySettings(branch?.code));
    const key = currentBusinessDateKey(loadBusinessDaySettings(branch?.code));
    setFromDate(key);
    setToDate(key);
    setFromTime("");
    setToTime("");
  }, [branch?.code]);

  useEffect(() => {
    function onBusinessDayChanged(event: Event): void {
      const detail = (event as CustomEvent<{ branchCode?: string }>).detail;
      if (!branch?.code || detail?.branchCode === branch.code) {
        setBusinessDay(loadBusinessDaySettings(branch?.code));
      }
    }
    window.addEventListener(BUSINESS_DAY_CHANGED_EVENT, onBusinessDayChanged);
    return () => window.removeEventListener(BUSINESS_DAY_CHANGED_EVENT, onBusinessDayChanged);
  }, [branch?.code]);

  const ordersQuery = useQuery({
    queryKey: ["orders", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 10_000,
    queryFn: () => fetchCompletedOrders(branch!.code),
  });

  const dashboardQuery = useQuery({
    queryKey: ["operations", "dashboard", accessToken, branch?.code],
    enabled: Boolean(accessToken && branch?.code),
    refetchInterval: 30_000,
    queryFn: () => fetchDashboard(branch!.code),
  });

  const pendingQuery = useQuery({
    queryKey: ["kitchen", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 5_000,
    queryFn: () => fetchKitchenTickets(branch!.code),
  });

  const accountingQuery = useQuery({
    queryKey: ["accounting", "dashboard", branch?.code],
    enabled: Boolean(branch?.code),
    refetchInterval: 60_000,
    queryFn: () => fetchAccountingDashboard(branch!.code),
  });

  const completedOrdersForSales = useMemo(
    () => payableCompletedOrders(ordersQuery.data ?? []),
    [ordersQuery.data],
  );

  const dateFilteredOrders = useMemo(() => {
    if (!fromDate && !toDate && !fromTime && !toTime) return completedOrdersForSales;
    return completedOrdersForSales.filter((order) => {
      const key = businessDateKey(order.createdAt, businessDay);
      if (fromDate && key < fromDate) return false;
      if (toDate && key > toDate) return false;
      if (fromTime || toTime) {
        const mins = timeToMinutes(karachiTime(order.createdAt));
        if (fromTime && mins < timeToMinutes(fromTime)) return false;
        if (toTime && mins > timeToMinutes(toTime)) return false;
      }
      return true;
    });
  }, [completedOrdersForSales, fromDate, toDate, fromTime, toTime, businessDay]);

  const topProducts = useMemo(
    () => topProductsAlphabetical(dateFilteredOrders),
    [dateFilteredOrders],
  );

  const pendingSummary = useMemo(
    () => summarizePendingOrders(pendingQuery.data ?? []),
    [pendingQuery.data],
  );

  const orderSales = useMemo(
    () => salesMetricsFromOrders(dateFilteredOrders, businessDay),
    [dateFilteredOrders, businessDay],
  );

  useEffect(() => {
    const expired =
      isSessionExpiredError(dashboardQuery.error) || isSessionExpiredError(ordersQuery.error);
    if (expired) {
      navigate("/role", { replace: true });
      return;
    }
    const message = dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "";
    if (message.startsWith("Branch not found")) {
      usePopsStore.getState().clearBranch();
      navigate("/pops/branches", { replace: true });
    }
  }, [dashboardQuery.error, ordersQuery.error, navigate]);

  const metrics = dashboardQuery.data?.metrics;
  const zoom = ZOOM_LEVELS[zoomIndex];

  const salesHint =
    orderSales.todayAmountPkr > 0
      ? `${orderSales.changePercent >= 0 ? "+" : ""}${orderSales.changePercent}% vs yesterday · ${orderSales.orderCount} orders in range`
      : orderSales.orderCount > 0
        ? `${orderSales.orderCount} orders in selected range`
        : "Pay or complete orders — totals match POS → Orders";

  const statCards = [
    {
      label: fromDate === toDate && fromDate === todayKey ? "Sales (today)" : "Sales (range)",
      value: ordersQuery.isLoading ? "…" : formatPkr(orderSales.allCompletedAmountPkr),
      hint: `${fromDate} → ${toDate} · ${salesHint}`,
    },
    {
      label: "Active orders",
      value: pendingQuery.isLoading ? "…" : String(pendingSummary.total),
      hint: `${pendingSummary.newCount} new · ${pendingSummary.cookingCount} cooking · ${pendingSummary.readyCount} ready`,
    },
    {
      label: "Pending orders",
      value: pendingQuery.isLoading ? "…" : String(pendingSummary.total),
      hint: `${pendingSummary.priorityCount} priority · ${slaLabel(pendingSummary.slaStatus)}`,
    },
    {
      label: "Low stock SKUs",
      value: dashboardQuery.isLoading ? "…" : String(metrics?.lowStock.skuCount ?? 0),
      hint: metrics
        ? `${metrics.lowStock.criticalCount} critical reorder`
        : "Loading inventory…",
    },
  ];

  const showInsights = !ordersQuery.isLoading && !ordersQuery.isError;
  const showPulse = Boolean(branch?.code);

  if (!canViewDashboard) {
    return <p className="text-sm text-slate-400">Redirecting…</p>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Operations dashboard"
        subtitle={`Signed in as ${claims?.sub ?? "—"} · Branch ${branch?.name ?? "—"}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
              disabled={zoomIndex === 0}
            >
              Zoom out
            </button>
            <span className="text-xs text-slate-500">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="rounded-md border border-slate-600 px-2 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_LEVELS.length - 1, i + 1))}
              disabled={zoomIndex === ZOOM_LEVELS.length - 1}
            >
              Zoom in
            </button>
            <Link
              to="/pops/closing"
              className="rounded-md bg-amber-600 px-3 py-2 text-xs font-medium text-slate-950 hover:bg-amber-500"
            >
              End of day
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3">
        <label className="text-xs text-slate-400">
          From date
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <label className="text-xs text-slate-400">
          To date
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mt-1 block rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-white"
          />
        </label>
        <div className="h-10 w-px self-end bg-slate-800" aria-hidden />
        <div className="text-xs text-slate-400">
          From time
          <TimeAmPmInput value={fromTime} onChange={setFromTime} />
        </div>
        <div className="text-xs text-slate-400">
          To time
          <TimeAmPmInput value={toTime} onChange={setToTime} />
        </div>
        <button
          type="button"
          className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
          onClick={() => {
            setFromDate(todayKey);
            setToDate(todayKey);
            setFromTime("");
            setToTime("");
          }}
        >
          Today
        </button>
        {fromTime || toTime ? (
          <button
            type="button"
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
            onClick={() => {
              setFromTime("");
              setToTime("");
            }}
          >
            Clear time
          </button>
        ) : null}
        <span className="text-xs text-slate-500">
          {fromTime || toTime
            ? `${format12Hour(fromTime) || "12:00 AM"} – ${format12Hour(toTime) || "11:59 PM"} (PKT)`
            : formatBusinessDayRange(businessDay)}{" "}
          · {dateFilteredOrders.length} orders in range
        </span>
      </div>

      {dashboardQuery.isError && !isSessionExpiredError(dashboardQuery.error) ? (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {(dashboardQuery.error as Error).message}
        </div>
      ) : null}

      {ordersQuery.isError && !isSessionExpiredError(ordersQuery.error) ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Could not load completed orders for sales: {(ordersQuery.error as Error).message}
        </p>
      ) : null}

      <div style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%` }}>
        {showPulse ? (
          <>
            <section>
              <h2 className="dashboard-section-title">Live pulse</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {statCards.map((c) => (
                  <div key={c.label} data-ui="dashboard-stat-card">
                    <div className="dashboard-stat-label">{c.label}</div>
                    <div className="dashboard-stat-value">{c.value}</div>
                    <div className="dashboard-stat-hint">{c.hint}</div>
                  </div>
                ))}
              </div>
            </section>

            {topProducts.length > 0 ? (
              <section className="mt-6">
                <h2 className="dashboard-section-title">Items sold (A–Z)</h2>
                <div className="mt-3 overflow-x-auto rounded-lg border border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/60 text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Item</th>
                        <th className="px-3 py-2 text-right">Qty</th>
                        <th className="px-3 py-2 text-right">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topProducts.map((p) => (
                        <tr key={p.label} className="border-t border-slate-800/60">
                          <td className="px-3 py-2 text-slate-200">{p.label}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-400">{p.qty}</td>
                          <td className="px-3 py-2 text-right tabular-nums text-slate-300">
                            {formatPkr(p.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            {showInsights && metrics ? (
              <DashboardChartsGrid
                completedOrders={dateFilteredOrders}
                metrics={metrics}
                pendingTickets={pendingQuery.data ?? []}
                businessDay={businessDay}
              />
            ) : null}

            {accountingQuery.data ? (
              <section>
                <div className="flex items-center justify-between">
                  <h2 className="dashboard-section-title">Finance (accounting)</h2>
                  <Link to="/pops/accounting" className="dashboard-finance-link">
                    Open accounting →
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { label: "Monthly revenue", value: formatPkr(accountingQuery.data.monthlyRevenue) },
                    { label: "Month expenses", value: formatPkr(accountingQuery.data.totalExpenses) },
                    { label: "Profit / loss", value: formatPkr(accountingQuery.data.profitLoss) },
                    {
                      label: "Cash + bank",
                      value: formatPkr(accountingQuery.data.cashInHand + accountingQuery.data.bankBalance),
                    },
                  ].map((c) => (
                    <div key={c.label} className="dashboard-finance-card">
                      <div className="dashboard-finance-label">{c.label}</div>
                      <div className="dashboard-stat-value text-xl">{c.value}</div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
