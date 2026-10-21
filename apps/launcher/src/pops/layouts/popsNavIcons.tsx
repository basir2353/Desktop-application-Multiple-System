import type { ReactNode } from "react";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: ReactNode }): JSX.Element {
  return (
    <svg
      className={className ?? "h-4 w-4 shrink-0"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {children}
    </svg>
  );
}

const icons: Record<string, (props: IconProps) => JSX.Element> = {
  Dashboard: (p) => (
    <Svg {...p}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </Svg>
  ),
  "Users & access": (p) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M17 11h4M19 9v4" />
    </Svg>
  ),
  Menu: (p) => (
    <Svg {...p}>
      <path d="M4 6h16M4 12h16M4 18h10" />
    </Svg>
  ),
  "Staff food": (p) => (
    <Svg {...p}>
      <path d="M4 14h16M6 10h12M8 6h8" />
      <path d="M12 14v4M9 18h6" />
    </Svg>
  ),
  POS: (p) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M7 8h4M7 12h10" />
    </Svg>
  ),
  Inventory: (p) => (
    <Svg {...p}>
      <path d="M4 7l8-4 8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4M4 17l8 4 8-4" />
    </Svg>
  ),
  Purchase: (p) => (
    <Svg {...p}>
      <path d="M6 6h15l-1.5 9H7.5L6 6z" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </Svg>
  ),
  Accounting: (p) => (
    <Svg {...p}>
      <path d="M4 19V5a2 2 0 012-2h12a2 2 0 012 2v14" />
      <path d="M8 17V9M12 17V7M16 17v-5" />
    </Svg>
  ),
  "HR & payroll": (p) => (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </Svg>
  ),
  "PRA / FBR": (p) => (
    <Svg {...p}>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6M9 13h6M9 17h4" />
    </Svg>
  ),
  "FBR / PRA": (p) => (
    <Svg {...p}>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6M9 13h6M9 17h4" />
    </Svg>
  ),
  "Tax & compliance": (p) => (
    <Svg {...p}>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6M9 13h6M9 17h4" />
    </Svg>
  ),
  FBR: (p) => (
    <Svg {...p}>
      <path d="M4 4h16v4H4zM4 10h10v10H4zM16 10h4v10h-4z" />
    </Svg>
  ),
  PRA: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v8M9 12h6" />
    </Svg>
  ),
  "Multi-branch": (p) => (
    <Svg {...p}>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <circle cx="12" cy="18" r="2.5" />
      <path d="M8 7.5l3 8M16 7.5l-3 8" />
    </Svg>
  ),
  "Sync & backup": (p) => (
    <Svg {...p}>
      <path d="M4 12a8 8 0 0113.5-5.7M20 12a8 8 0 01-13.5 5.7" />
      <path d="M17 4v4h-4M7 20v-4h4" />
    </Svg>
  ),
  Reports: (p) => (
    <Svg {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  ),
  Notifications: (p) => (
    <Svg {...p}>
      <path d="M18 16H6l-1-2V9a7 7 0 0114 0v5l-1 2z" />
      <path d="M10 20a2 2 0 004 0" />
    </Svg>
  ),
  Production: (p) => (
    <Svg {...p}>
      <path d="M2 20h20M5 20V10l4-3v13M11 20V6l4-3v17M17 20V12l4-2v10" />
    </Svg>
  ),
  Security: (p) => (
    <Svg {...p}>
      <path d="M12 3l8 4v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
    </Svg>
  ),
  Settings: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Svg>
  ),
  Closing: (p) => (
    <Svg {...p}>
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </Svg>
  ),
  Printer: (p) => (
    <Svg {...p}>
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" />
      <path d="M6 17h12v4H6z" />
    </Svg>
  ),
  Products: (p) => (
    <Svg {...p}>
      <path d="M4 7l8-4 8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4M4 17l8 4 8-4" />
    </Svg>
  ),
  Sales: (p) => (
    <Svg {...p}>
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <path d="M7 8h4M7 12h10" />
    </Svg>
  ),
  Parties: (p) => (
    <Svg {...p}>
      <circle cx="8" cy="8" r="3" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M3 20c0-2.8 2.2-5 5-5s5 2.2 5 5M14 20c0-2 1.6-3.6 3.6-4" />
    </Svg>
  ),
  Purchases: (p) => (
    <Svg {...p}>
      <path d="M6 6h15l-1.5 9H7.5L6 6z" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </Svg>
  ),
  Communications: (p) => (
    <Svg {...p}>
      <path d="M5 5h10a3 3 0 013 3v5a3 3 0 01-3 3H11l-4 3v-3H5a3 3 0 01-3-3V8a3 3 0 013-3z" />
    </Svg>
  ),
  WhatsApp: (p) => (
    <Svg {...p}>
      <path d="M20 11.5A8.5 8.5 0 1111 4a8.5 8.5 0 019 7.5z" />
      <path d="M8.5 17.5L6 20l.8-3.4" />
      <path d="M9 10.2c.2 1.6 2.1 3.4 3.7 3.8M15 9.5c-.4-.4-1-.7-1.6-.7" />
    </Svg>
  ),
  Operations: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M4.2 6.2l1.4 1.4M18.4 16.4l1.4 1.4M3 12h2M19 12h2M4.2 17.8l1.4-1.4M18.4 7.6l1.4-1.4" />
    </Svg>
  ),
  "Point of Sale": (p) => (
    <Svg {...p}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8h10M7 12h6M7 16h8" />
    </Svg>
  ),
  Warehouses: (p) => (
    <Svg {...p}>
      <path d="M3 10l9-6 9 6v10H3V10z" />
      <path d="M9 20v-6h6v6" />
    </Svg>
  ),
  "Users & roles": (p) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M17 11h4M19 9v4" />
    </Svg>
  ),
  // —— MobiZone ——
  "Universal Search": (p) => (
    <Svg {...p}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </Svg>
  ),
  "Legal record": (p) => (
    <Svg {...p}>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6M9 13h6M9 17h4" />
    </Svg>
  ),
  Trade: (p) => (
    <Svg {...p}>
      <path d="M7 7h11l-1.5 8H8.5L7 7z" />
      <circle cx="10" cy="19" r="1.4" />
      <circle cx="16" cy="19" r="1.4" />
      <path d="M3 5h4" />
    </Svg>
  ),
  "Sell phone": (p) => (
    <Svg {...p}>
      <rect x="8" y="2" width="8" height="20" rx="2" />
      <path d="M11 18h2" />
    </Svg>
  ),
  "Buy phone": (p) => (
    <Svg {...p}>
      <rect x="8" y="2" width="8" height="20" rx="2" />
      <path d="M12 8v4M10 10h4" />
    </Svg>
  ),
  "Sale return": (p) => (
    <Svg {...p}>
      <path d="M9 14l-4-4 4-4" />
      <path d="M5 10h11a4 4 0 010 8h-3" />
    </Svg>
  ),
  "Purchase return": (p) => (
    <Svg {...p}>
      <path d="M15 10l4 4-4 4" />
      <path d="M19 14H8a4 4 0 010-8h3" />
    </Svg>
  ),
  "Sales history": (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </Svg>
  ),
  "Purchase history": (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l-3 2" />
    </Svg>
  ),
  Stock: (p) => (
    <Svg {...p}>
      <path d="M4 7l8-4 8 4-8 4-8-4z" />
      <path d="M4 12l8 4 8-4M4 17l8 4 8-4" />
    </Svg>
  ),
  "Phone stock": (p) => (
    <Svg {...p}>
      <rect x="7" y="3" width="10" height="18" rx="2" />
      <path d="M10 17h4M4 8h3M4 12h3M17 8h3M17 12h3" />
    </Svg>
  ),
  "IMEI / barcode": (p) => (
    <Svg {...p}>
      <path d="M4 7V5h3M17 5h3v2M20 17v2h-3M7 19H4v-2M7 8v8M10 8v8M12 8v8M15 8v8M17 8v8" />
    </Svg>
  ),
  "People & ledgers": (p) => (
    <Svg {...p}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c0-2.8 2.2-5 5-5h2c2.8 0 5 2.2 5 5" />
      <path d="M16 11h5M18.5 8.5v5" />
    </Svg>
  ),
  Customers: (p) => (
    <Svg {...p}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" />
    </Svg>
  ),
  Shopkeepers: (p) => (
    <Svg {...p}>
      <path d="M3 10l2-5h14l2 5" />
      <path d="M4 10h16v9H4z" />
      <path d="M9 19v-5h6v5" />
    </Svg>
  ),
  "Credit & ledger": (p) => (
    <Svg {...p}>
      <path d="M4 5h16v14H4z" />
      <path d="M8 9h8M8 13h5" />
    </Svg>
  ),
  "Pending payments": (p) => (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4l2.5 1.5" />
    </Svg>
  ),
  Money: (p) => (
    <Svg {...p}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </Svg>
  ),
  "Cash Ledger": (p) => (
    <Svg {...p}>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 12h2M15 12h2M12 9v6" />
    </Svg>
  ),
  "Bank accounts": (p) => (
    <Svg {...p}>
      <path d="M3 10l9-5 9 5" />
      <path d="M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18" />
    </Svg>
  ),
  "Create Expense": (p) => (
    <Svg {...p}>
      <path d="M12 5v14M5 12h14" />
      <circle cx="12" cy="12" r="9" />
    </Svg>
  ),
  "Account Expense": (p) => (
    <Svg {...p}>
      <path d="M4 19V5a2 2 0 012-2h12a2 2 0 012 2v14" />
      <path d="M8 15l2-3 2 2 3-4" />
    </Svg>
  ),
  "Contra Voucher": (p) => (
    <Svg {...p}>
      <path d="M7 7h10M7 12h10M7 17h6" />
      <path d="M17 15l3 3-3 3" />
    </Svg>
  ),
  "General Voucher": (p) => (
    <Svg {...p}>
      <path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9z" />
      <path d="M14 3v6h6M8 13h8M8 17h5" />
    </Svg>
  ),
  "Business report": (p) => (
    <Svg {...p}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </Svg>
  ),
  "Sale & purchase": (p) => (
    <Svg {...p}>
      <path d="M3 12h6l2-3 3 6 2-3h5" />
    </Svg>
  ),
  "Profit / loss": (p) => (
    <Svg {...p}>
      <path d="M4 16l5-5 3 3 7-7" />
      <path d="M14 7h5v5" />
    </Svg>
  ),
  "Bill print settings": (p) => (
    <Svg {...p}>
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" />
      <path d="M6 17h12v4H6zM9 13h6" />
    </Svg>
  ),
  "Receipt printer": (p) => (
    <Svg {...p}>
      <path d="M6 9V3h12v6" />
      <rect x="4" y="9" width="16" height="8" rx="1.5" />
      <path d="M6 17h12v4H6z" />
    </Svg>
  ),
  "Google Drive": (p) => (
    <Svg {...p}>
      <path d="M8 4l4 7H4l4-7z" />
      <path d="M12 11l4 7H8l4-7z" />
      <path d="M16 4l4 7h-8l4-7z" />
    </Svg>
  ),
};

export function PopsNavIcon({ label, className }: { label: string; className?: string }): JSX.Element {
  const Icon = icons[label];
  if (!Icon) {
    return (
      <Svg className={className}>
        <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      </Svg>
    );
  }
  return <Icon className={className} />;
}
