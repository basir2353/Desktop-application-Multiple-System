import type { Bill, KitchenTicket } from "@platform/contracts";

export function formatPkr(amount: number): string {
  return `Rs ${amount.toLocaleString("en-PK")}`;
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function formatTimeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return formatWhen(iso);
}

export function orderRefFromTicket(ticket: Pick<KitchenTicket, "orderRef" | "ticketRef">): string {
  return ticket.orderRef ?? ticket.ticketRef;
}

export function orderRefFromBill(bill: Bill): string {
  return bill.orderRef ?? bill.billRef;
}

export function kitchenStatusLabel(status: KitchenTicket["status"]): string {
  if (status === "new") return "New";
  if (status === "cooking") return "Cooking";
  if (status === "ready") return "Ready";
  return "Done";
}

export function billStatusLabel(status: Bill["status"]): string {
  if (status === "completed") return "Paid";
  if (status === "held") return "On hold";
  if (status === "void") return "Void";
  return status;
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function greetingForHour(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function waiterDisplayName(email: string | null | undefined): string {
  if (!email?.trim()) return "Waiter";
  const local = email.trim().split("@")[0] ?? "";
  if (!local) return "Waiter";
  return local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function kitchenStatusAccent(status: string): string {
  if (status === "ready") return "#22c55e";
  if (status === "cooking") return "#38bdf8";
  if (status === "new") return "#f59e0b";
  return "#94a3b8";
}
