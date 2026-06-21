/** Static reference records for module workspaces until wired to the control plane API. */

export const menuCategories = ["Mains", "Grill", "Beverages", "Sides", "Combos"] as const;

export type MenuItem = {
  id: string;
  name: string;
  category: (typeof menuCategories)[number];
  price: number;
  barcode?: string;
  happyHour?: boolean;
};

export const menuItems: MenuItem[] = [
  { id: "m1", name: "Chicken Karahi (Full)", category: "Mains", price: 2890, barcode: "8901123001" },
  { id: "m2", name: "Mutton Handi (Half)", category: "Mains", price: 3200 },
  { id: "m3", name: "Chicken Biryani", category: "Mains", price: 450, happyHour: true },
  { id: "g1", name: "Seekh Kabab (6pc)", category: "Grill", price: 980, barcode: "8901123002" },
  { id: "g2", name: "Malai Boti", category: "Grill", price: 1100 },
  { id: "b1", name: "Mint Margarita", category: "Beverages", price: 280 },
  { id: "b2", name: "Soft drink", category: "Beverages", price: 120 },
  { id: "s1", name: "Raita", category: "Sides", price: 80 },
  { id: "c1", name: "Family Combo 4", category: "Combos", price: 4999 },
];

export const tables = [
  { id: "T1", seats: 4, status: "occupied" as const, order: "ORD-1042" },
  { id: "T2", seats: 2, status: "free" as const },
  { id: "T3", seats: 6, status: "occupied" as const, order: "ORD-1045" },
  { id: "T4", seats: 4, status: "billing" as const, order: "ORD-1038" },
  { id: "T5", seats: 4, status: "free" as const },
  { id: "T6", seats: 8, status: "occupied" as const, order: "ORD-1046" },
];

export const kitchenTickets = [
  { id: "KOT-901", table: "T1", items: "Karahi x1, Raita x2", status: "new" as const, mins: 0 },
  { id: "KOT-902", table: "TW-12", items: "Biryani x3, Drink x3", status: "cooking" as const, mins: 8 },
  { id: "KOT-903", table: "DL-04", items: "Handi x1, Kabab x1", status: "ready" as const, mins: 14 },
  { id: "KOT-904", table: "T6", items: "Combo x1", status: "cooking" as const, mins: 3 },
];

export type InventoryRow = {
  sku: string;
  name: string;
  wh: string;
  qty: number;
  min: number;
  batch: string;
  expiry: string;
};

export const inventoryRows: InventoryRow[] = [
  { sku: "RM-001", name: "Chicken (kg)", wh: "Cold store", qty: 42, min: 30, batch: "B-2405", expiry: "2026-05-18" },
  { sku: "RM-014", name: "Cooking oil (L)", wh: "Dry", qty: 8, min: 20, batch: "B-2399", expiry: "2026-08-01" },
  { sku: "RM-022", name: "Basmati rice (bag)", wh: "Dry", qty: 15, min: 10, batch: "B-2410", expiry: "2027-01-10" },
  { sku: "FG-003", name: "Spice mix (house)", wh: "Prep", qty: 3, min: 5, batch: "B-2412", expiry: "2026-06-01" },
];

export const purchaseOrders = [
  { po: "PO-7781", supplier: "Fresh Poultry Ltd", status: "Partial", due: "2026-05-14", amount: 125000 },
  { po: "PO-7782", supplier: "Metro Cash", status: "Open", due: "2026-05-12", amount: 48200 },
  { po: "PO-7779", supplier: "National Foods", status: "Closed", due: "2026-05-01", amount: 22100 },
];

export const journalLines = [
  { ref: "JV-44021", date: "2026-05-11", account: "Sales — dine-in", debit: 0, credit: 84200, memo: "Day partial" },
  { ref: "JV-44020", date: "2026-05-11", account: "GST output", debit: 0, credit: 12630, memo: "Tax on sales" },
  { ref: "JV-44019", date: "2026-05-11", account: "Cash on hand", debit: 96830, credit: 0, memo: "Shift collection" },
];

export const employees = [
  { id: "E102", name: "Ayesha Khan", role: "Cashier", shift: "2pm–10pm", attendance: "Present" },
  { id: "E088", name: "Bilal Ahmed", role: "Kitchen", shift: "12pm–8pm", attendance: "Present" },
  { id: "E091", name: "Sara Malik", role: "Waiter", shift: "5pm–1am", attendance: "Late" },
];

export const deliveries = [
  { id: "DL-2201", customer: "H. Raza", zone: "F-7", rider: "Usman", status: "Out for delivery", cod: 3450 },
  { id: "DL-2202", customer: "A. Ali", zone: "G-10", rider: "—", status: "Ready for pickup", cod: 2100 },
  { id: "DL-2198", customer: "K. Studio", zone: "Blue Area", rider: "Imran", status: "Delivered", cod: 0 },
];

export const customers = [
  { id: "C-5001", name: "Walk-in VIP", phone: "0300-***", points: 1240, balance: 0, segment: "High value" },
  { id: "C-4882", name: "Corporate — Acme", phone: "051-***", points: 520, balance: -15000, segment: "Credit" },
];

export const taxQueue = [
  { inv: "INV-99201", amount: 8420, tax: 1263, status: "Verified", praRef: "PRA-CHK-8821" },
  { inv: "INV-99202", amount: 1200, tax: 180, status: "Queued", praRef: "—" },
  { inv: "INV-99188", amount: 45000, tax: 6750, status: "Failed", praRef: "Retry" },
];

export const branchesOverview = [
  { code: "ISB-GT", sales: 184320, sync: "Live", invAlert: 2 },
  { code: "LHR-DHA", sales: 421900, sync: "2m ago", invAlert: 5 },
  { code: "KHI-CLF", sales: 298100, sync: "Live", invAlert: 1 },
];

export const syncEvents = [
  { time: "11:52:01", event: "Push sales_day", result: "OK", rows: 128 },
  { time: "11:48:33", event: "Pull price_list", result: "OK", rows: 44 },
  { time: "11:40:12", event: "Push inventory_move", result: "Deferred", rows: 0 },
];

export const auditRows = [
  { time: "2026-05-11 11:40", user: "admin@platform.local", action: "Void line", detail: "INV-99102 · Line 3" },
  { time: "2026-05-11 10:02", user: "cashier1", action: "Discount override", detail: "10% · Manager PIN" },
  { time: "2026-05-11 09:15", user: "system", action: "Backup completed", detail: "incremental" },
];

export const notificationsLog = [
  { time: "11:50", channel: "SMS", to: "Customer DL-2201", template: "Rider assigned" },
  { time: "11:22", channel: "WhatsApp", to: "C-5001", template: "Birthday offer" },
  { time: "10:58", channel: "App", to: "Kitchen", template: "Printer offline — counter 2" },
];

