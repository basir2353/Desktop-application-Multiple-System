import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { usePopsAlerts, type PopsToast } from "../hooks/usePopsAlerts";
import type { PopsAlert, PopsAlertTone } from "../lib/popsAlerts";
import { Badge } from "../ui/Badge";

function toneBorder(tone: PopsAlertTone): string {
  if (tone === "danger") return "border-red-500/40 bg-red-500/10";
  if (tone === "warning") return "border-amber-500/40 bg-amber-500/10";
  return "border-sky-500/40 bg-sky-500/10";
}

function toneText(tone: PopsAlertTone): string {
  if (tone === "danger") return "text-red-200";
  if (tone === "warning") return "text-amber-200";
  return "text-sky-200";
}

function BellIcon(): JSX.Element {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function AlertRow({ alert, onNavigate }: { alert: PopsAlert; onNavigate?: () => void }): JSX.Element {
  const content = (
    <div className={`rounded-lg border px-3 py-2 ${toneBorder(alert.tone)}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className={`text-xs font-semibold ${toneText(alert.tone)}`}>{alert.title}</div>
          <p className="mt-0.5 line-clamp-2 text-[11px] text-slate-300">{alert.message}</p>
        </div>
        <Badge tone={alert.tone === "danger" ? "danger" : alert.tone === "warning" ? "warning" : "info"}>
          {alert.kind === "new_order" ? "Order" : alert.kind === "kitchen_slow" ? "Kitchen" : "Stock"}
        </Badge>
      </div>
    </div>
  );

  if (alert.href) {
    return (
      <Link to={alert.href} onClick={onNavigate} className="block transition hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}

function ToastCard({ toast, onDismiss }: { toast: PopsToast; onDismiss: () => void }): JSX.Element {
  const navigate = useNavigate();

  return (
    <div
      role="alert"
      className={`pointer-events-auto w-80 rounded-lg border px-3 py-2.5 shadow-lg shadow-black/30 ${toneBorder(toast.tone)}`}
    >
      <div className="flex items-start justify-between gap-2">
        <button
          type="button"
          className="min-w-0 flex-1 text-left"
          onClick={() => {
            if (toast.href) navigate(toast.href);
            onDismiss();
          }}
        >
          <div className={`text-xs font-semibold ${toneText(toast.tone)}`}>{toast.title}</div>
          <p className="mt-0.5 text-[11px] text-slate-300">{toast.message}</p>
        </button>
        <button
          type="button"
          className="shrink-0 text-slate-500 hover:text-white"
          aria-label="Dismiss"
          onClick={onDismiss}
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function PopsAlertCenter(): JSX.Element {
  const { alerts, toasts, dismissToast, unreadCount, isLoading } = usePopsAlerts();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(event: MouseEvent): void {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <>
      <div className="relative" ref={panelRef}>
        <button
          type="button"
          className="relative inline-flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs text-slate-300 transition hover:border-slate-700 hover:text-white"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} active` : ""}`}
          onClick={() => setOpen((v) => !v)}
        >
          <BellIcon />
          <span className="hidden sm:inline">Alerts</span>
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </button>

        {open ? (
          <div className="absolute right-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
              <span className="text-xs font-semibold text-white">Live alerts</span>
              <span className="text-[10px] text-slate-500">
                {isLoading ? "Updating…" : `${alerts.length} active`}
              </span>
            </div>
            <div className="max-h-80 space-y-2 overflow-y-auto p-2">
              {alerts.length === 0 ? (
                <p className="px-2 py-6 text-center text-xs text-slate-500">
                  No alerts — kitchen and stock look good.
                </p>
              ) : (
                alerts.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} onNavigate={() => setOpen(false)} />
                ))
              )}
            </div>
            <div className="border-t border-slate-800 px-3 py-2 text-[10px] text-slate-500">
              New orders · kitchen delays (15m+) · low stock ·{" "}
              <Link to="/pops/notifications" onClick={() => setOpen(false)} className="text-amber-400/90 hover:text-amber-300">
                Message log
              </Link>
            </div>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <ToastCard key={toast.toastId} toast={toast} onDismiss={() => dismissToast(toast.toastId)} />
        ))}
      </div>
    </>
  );
}
