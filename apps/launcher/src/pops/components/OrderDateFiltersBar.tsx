import type { ReactNode } from "react";

function IconCalendar(): JSX.Element {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function IconClock(): JSX.Element {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconYear(): JSX.Element {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

function IconX(): JSX.Element {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function FilterField({
  label,
  icon,
  active,
  children,
  className = "",
}: {
  label: string;
  icon: ReactNode;
  active?: boolean;
  children: ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <div className={`flex min-w-[9.5rem] flex-col gap-1.5 ${className}`}>
      <span className={`date-filters-label ${active ? "is-active" : ""}`}>{label}</span>
      <div className="relative">
        <span className={`date-filters-icon pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 ${active ? "is-active" : ""}`}>
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}

export type OrderDateFiltersBarProps = {
  filterYear: string;
  filterDate: string;
  filterTimeFrom: string;
  filterTimeTo: string;
  availableYears: string[];
  hasActiveFilters: boolean;
  onYearChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onTimeFromChange: (value: string) => void;
  onTimeToChange: (value: string) => void;
  onClear: () => void;
};

export function OrderDateFiltersBar({
  filterYear,
  filterDate,
  filterTimeFrom,
  filterTimeTo,
  availableYears,
  hasActiveFilters,
  onYearChange,
  onDateChange,
  onTimeFromChange,
  onTimeToChange,
  onClear,
}: OrderDateFiltersBarProps): JSX.Element {
  const yearActive = filterYear !== "all";
  const dateActive = Boolean(filterDate);

  return (
    <div data-ui="date-filters-bar">
      <div className="date-filters-header flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="date-filters-calendar-icon">
            <IconCalendar />
          </span>
          <div>
            <p className="date-filters-title">Filter by date</p>
            <p className="date-filters-subtitle">Pakistan time (Asia/Karachi)</p>
          </div>
        </div>
        {hasActiveFilters ? (
          <span className="date-filters-active-badge">Active</span>
        ) : (
          <span className="date-filters-status">All dates</span>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-x-4 gap-y-4 p-4">
        <FilterField label="Year" icon={<IconYear />} active={yearActive} className="sm:min-w-[8.5rem]">
          <select
            value={filterYear}
            onChange={(e) => onYearChange(e.target.value)}
            className={`date-filters-input appearance-none pr-9 ${yearActive ? "is-active" : ""}`}
          >
            <option value="all">All years</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <span className="date-filters-chevron pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
              <path
                fillRule="evenodd"
                d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
                clipRule="evenodd"
              />
            </svg>
          </span>
        </FilterField>

        <FilterField label="Date" icon={<IconCalendar />} active={dateActive} className="sm:min-w-[10.5rem]">
          <input
            type="date"
            value={filterDate}
            onChange={(e) => onDateChange(e.target.value)}
            className={`date-filters-input ${dateActive ? "is-active" : ""}`}
          />
        </FilterField>

        <div className="date-filters-divider hidden h-10 w-px self-end sm:block" aria-hidden />

        <FilterField label="From" icon={<IconClock />} active={Boolean(filterTimeFrom)} className="sm:min-w-[9rem]">
          <input
            type="time"
            value={filterTimeFrom}
            onChange={(e) => onTimeFromChange(e.target.value)}
            className={`date-filters-input ${filterTimeFrom ? "is-active" : ""}`}
          />
        </FilterField>

        <span className="date-filters-range-dash hidden self-end pb-2.5 sm:inline" aria-hidden>
          —
        </span>

        <FilterField label="To" icon={<IconClock />} active={Boolean(filterTimeTo)} className="sm:min-w-[9rem]">
          <input
            type="time"
            value={filterTimeTo}
            onChange={(e) => onTimeToChange(e.target.value)}
            className={`date-filters-input ${filterTimeTo ? "is-active" : ""}`}
          />
        </FilterField>

        {hasActiveFilters ? (
          <button type="button" className="date-filters-clear ml-auto" onClick={onClear}>
            <IconX />
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
