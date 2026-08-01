import { useEffect, useMemo, useRef, useState } from "react";
import { fieldInputClass } from "../lib/themeClasses";

export type SearchableSelectOption = {
  value: string;
  label: string;
  /** Extra text matched by search (sku, category, …). */
  searchText?: string;
};

type Props = {
  options: SearchableSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  /** Allow clearing selection (empty value). Default true when placeholder is set. */
  allowEmpty?: boolean;
  emptyLabel?: string;
  id?: string;
  "aria-label"?: string;
};

/**
 * Dropdown with type-to-filter search — use for long ingredient / supplier lists.
 */
export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select…",
  searchPlaceholder = "Search…",
  className = "",
  disabled = false,
  required = false,
  allowEmpty,
  emptyLabel,
  id,
  "aria-label": ariaLabel,
}: Props): JSX.Element {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const canClear = allowEmpty ?? Boolean(placeholder);

  const selected = useMemo(
    () => options.find((o) => o.value === value) ?? null,
    [options, value],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.searchText ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = window.setTimeout(() => searchRef.current?.focus(), 0);
    function onDoc(e: MouseEvent): void {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function pick(next: string): void {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? placeholder}
        aria-required={required || undefined}
        onClick={() => {
          if (!disabled) setOpen((o) => !o);
        }}
        className={`${fieldInputClass} flex w-full items-center justify-between gap-2 text-left ${
          !selected ? "text-slate-500 dark:text-slate-400" : ""
        } ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? emptyLabel ?? placeholder}</span>
        <span className="shrink-0 text-[10px] text-slate-400" aria-hidden>
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
          role="listbox"
        >
          <div className="relative border-b border-slate-200 p-1.5 dark:border-slate-700">
            <span
              className="pointer-events-none absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-slate-400"
              aria-hidden
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
            </span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className={`${fieldInputClass} w-full py-1.5 pl-8 text-xs`}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  const first = filtered[0];
                  if (first) pick(first.value);
                }
              }}
            />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {canClear ? (
              <li>
                <button
                  type="button"
                  role="option"
                  aria-selected={!value}
                  className={`flex w-full px-2.5 py-1.5 text-left text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 ${
                    !value ? "bg-amber-50 dark:bg-amber-500/10" : ""
                  }`}
                  onClick={() => pick("")}
                >
                  {emptyLabel ?? placeholder}
                </button>
              </li>
            ) : null}
            {filtered.length === 0 ? (
              <li className="px-2.5 py-2 text-xs text-slate-500">No matches</li>
            ) : (
              filtered.map((o) => (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={o.value === value}
                    className={`flex w-full px-2.5 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 ${
                      o.value === value ? "bg-amber-50 font-medium dark:bg-amber-500/15" : ""
                    }`}
                    onClick={() => pick(o.value)}
                  >
                    {o.label}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
