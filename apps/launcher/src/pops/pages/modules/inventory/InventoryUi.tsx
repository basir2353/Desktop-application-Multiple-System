import type { ReactNode } from "react";
import { mutedClass, noticeErrorClass, panelClass, panelTitleClass } from "../../../lib/themeClasses";

export function InventoryLoading({ label = "Loading inventory…" }: { label?: string }): JSX.Element {
  return <div className={`text-sm ${mutedClass}`}>{label}</div>;
}

export function InventoryError({ message }: { message: string }): JSX.Element {
  return <div className={noticeErrorClass}>{message}</div>;
}

export function InventoryFormPanel({
  title,
  children,
  onSubmit,
  submitLabel,
  disabled,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
}): JSX.Element {
  return (
    <form
      className={panelClass + " p-4"}
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className={panelTitleClass}>{title}</div>
      <div className="mt-3 space-y-2">{children}</div>
      <button
        type="submit"
        disabled={disabled}
        className="mt-3 inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </form>
  );
}
