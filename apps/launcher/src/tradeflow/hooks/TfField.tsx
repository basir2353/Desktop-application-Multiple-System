import type { ReactNode } from "react";
import "../tradeflow.css";

export function TfField({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
