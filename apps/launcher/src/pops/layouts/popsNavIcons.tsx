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
