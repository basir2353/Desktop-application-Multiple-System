import type { ChangeEvent, ReactNode } from "react";
import { cardClass, fieldInputClass, mutedClass } from "../../pops/lib/themeClasses";
import "../mobizone.css";

export function MzPage({ children }: { children: ReactNode }): JSX.Element {
  return <div className="mz-app space-y-5 md:space-y-6">{children}</div>;
}

export function MzStat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className={`${cardClass} p-3 sm:p-4`}>
      <p className={`text-[10px] uppercase tracking-wide sm:text-xs ${mutedClass}`}>{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-slate-900 sm:text-xl dark:text-white">
        {value}
      </p>
    </div>
  );
}

export function MzSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <section className={`${cardClass} space-y-3 p-3 sm:p-4`}>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-violet-600 sm:text-sm dark:text-violet-400">
        {title}
      </h2>
      {children}
    </section>
  );
}

export function MzField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}): JSX.Element {
  return (
    <label className="block space-y-1.5">
      <span className={`text-xs font-medium ${mutedClass}`}>{label}</span>
      {children}
    </label>
  );
}

export function MzInput(props: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      {...props}
      className={`${fieldInputClass} mz-touch w-full text-base sm:text-sm ${props.className ?? ""}`}
    />
  );
}

export function MzSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select
      {...props}
      className={`${fieldInputClass} mz-touch w-full text-base sm:text-sm ${props.className ?? ""}`}
    />
  );
}

export function MzTextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return (
    <textarea
      {...props}
      className={`${fieldInputClass} w-full min-h-[88px] text-base sm:text-sm ${props.className ?? ""}`}
    />
  );
}

export function MzPrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode },
): JSX.Element {
  const { children, className, ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`mz-touch inline-flex w-full items-center justify-center rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 sm:w-auto ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function MzSecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode },
): JSX.Element {
  const { children, className, ...rest } = props;
  return (
    <button
      type="button"
      {...rest}
      className={`mz-touch inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800 ${className ?? ""}`}
    >
      {children}
    </button>
  );
}

export function MzStickyActions({ children }: { children: ReactNode }): JSX.Element {
  return <div className="mz-sticky-actions flex flex-col gap-2 sm:flex-row sm:items-center">{children}</div>;
}

/** Read an image file as a compressed data URL for local storage. */
export async function readImageAsDataUrl(file: File, maxSide = 720): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not process image");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.72);
}

export function MzPhotoUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}): JSX.Element {
  async function onFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      onChange(dataUrl);
    } catch {
      onChange(null);
    }
  }
  return (
    <div className="space-y-2">
      <p className={`text-xs font-medium ${mutedClass}`}>{label}</p>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-16 w-16 rounded-lg object-cover ring-1 ring-slate-200 dark:ring-slate-700"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-500 dark:border-slate-700">
            No photo
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="cursor-pointer rounded-lg bg-violet-600/10 px-3 py-2 text-sm font-medium text-violet-700 dark:text-violet-300">
            Camera / gallery
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
          </label>
          {value ? (
            <button type="button" className="text-left text-xs text-red-600" onClick={() => onChange(null)}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
