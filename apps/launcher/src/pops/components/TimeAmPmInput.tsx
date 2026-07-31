import { useEffect, useRef, useState } from "react";

type ClockMode = "hour" | "minute";

const CLOCK_SIZE = 176;
const CLOCK_CENTER = CLOCK_SIZE / 2;
const CLOCK_RADIUS = 70;
const CLOCK_NUMBER_RADIUS = CLOCK_RADIUS * 0.78;

const timeFieldClass = "rounded bg-transparent text-sm text-white outline-none";

/** Splits a "HH:mm" 24h value into 12h parts for AM/PM display. */
export function to12Hour(value24: string): { hour: number; minute: number; meridiem: "AM" | "PM" } | null {
  if (!value24) return null;
  const [h, m] = value24.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  const meridiem: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return { hour, minute: m, meridiem };
}

export function from12Hour(hour: number, minute: number, meridiem: "AM" | "PM"): string {
  const h24 = meridiem === "AM" ? (hour === 12 ? 0 : hour) : hour === 12 ? 12 : hour + 12;
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function format12Hour(value24: string): string {
  const parts = to12Hour(value24);
  if (!parts) return "";
  return `${String(parts.hour).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")} ${parts.meridiem}`;
}

function IconClockSmall(): JSX.Element {
  return (
    <svg
      className="h-3.5 w-3.5 shrink-0 text-slate-500"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

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
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (!t) return;
        setDragging(true);
        selectFromPointer(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (!t || !dragging) return;
        selectFromPointer(t.clientX, t.clientY);
      }}
      onTouchEnd={() => setDragging(false)}
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

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** Optional class on the trigger button wrapper. */
  className?: string;
  /** Optional aria label for the trigger. */
  "aria-label"?: string;
};

/**
 * Click-to-open clock-style AM/PM time picker.
 * Stores value as 24h "HH:mm". Matches dashboard / Material-style dial.
 */
export function TimeAmPmInput({ value, onChange, className, "aria-label": ariaLabel }: Props): JSX.Element {
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
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function update(patch: Partial<typeof parts>): void {
    const next = { ...parts, ...patch };
    onChange(from12Hour(next.hour, next.minute, next.meridiem));
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        aria-label={ariaLabel ?? "Select time"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`${timeFieldClass} flex w-full min-w-[7.5rem] items-center gap-1.5 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-left hover:border-slate-600 dark:border-slate-700`}
      >
        <IconClockSmall />
        <span className="tabular-nums text-slate-100">
          {String(parts.hour).padStart(2, "0")}:{String(parts.minute).padStart(2, "0")}
        </span>
        <span className="font-semibold text-amber-400">{parts.meridiem}</span>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-40 mt-1 w-[13.5rem] rounded-lg border border-slate-700 bg-slate-900 p-3 shadow-xl"
          role="dialog"
          aria-label="Time picker"
        >
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
