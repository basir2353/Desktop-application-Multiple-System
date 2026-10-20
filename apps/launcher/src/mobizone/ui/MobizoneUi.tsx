import type { ChangeEvent, ReactNode } from "react";
import "../mobizone.css";

export function MzPage({ children }: { children: ReactNode }): JSX.Element {
  return <div className="mz-app space-y-5 md:space-y-6">{children}</div>;
}

export function MzStat({ label, value }: { label: string; value: string | number }): JSX.Element {
  return (
    <div className="mz-card p-3 sm:p-4">
      <p className="mz-muted text-[10px] uppercase tracking-wide sm:text-xs">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--mz-text)] sm:text-xl">
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
    <section className="mz-card space-y-3 p-3 sm:p-4">
      <h2 className="mz-section-title">{title}</h2>
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
      <span className="mz-muted text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

export function MzInput(props: React.InputHTMLAttributes<HTMLInputElement>): JSX.Element {
  return (
    <input
      {...props}
      className={`mz-input mz-touch ${props.className ?? ""}`}
    />
  );
}

export function MzSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>): JSX.Element {
  return (
    <select
      {...props}
      className={`mz-input mz-touch ${props.className ?? ""}`}
    />
  );
}

export function MzTextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element {
  return (
    <textarea
      {...props}
      className={`mz-input min-h-[88px] ${props.className ?? ""}`}
    />
  );
}

export function MzPrimaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode },
): JSX.Element {
  const { children, className, ...rest } = props;
  return (
    <button type="button" {...rest} className={`mz-btn-primary mz-touch ${className ?? ""}`}>
      {children}
    </button>
  );
}

export function MzSecondaryButton(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode },
): JSX.Element {
  const { children, className, ...rest } = props;
  return (
    <button type="button" {...rest} className={`mz-btn-secondary mz-touch ${className ?? ""}`}>
      {children}
    </button>
  );
}

export function MzStickyActions({ children }: { children: ReactNode }): JSX.Element {
  return (
    <div className="mz-sticky-actions flex flex-col gap-2 sm:flex-row sm:items-center">
      {children}
    </div>
  );
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
      <p className="mz-muted text-xs font-medium">{label}</p>
      <div className="flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-16 w-16 rounded-lg object-cover ring-1 ring-[var(--mz-border)]"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-[var(--mz-border)] text-[10px] text-[var(--mz-muted)]">
            No photo
          </div>
        )}
        <div className="flex flex-col gap-1">
          <label className="mz-btn-secondary cursor-pointer px-3 py-2 text-sm">
            Gallery
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
          <label className="mz-btn-secondary cursor-pointer px-3 py-2 text-sm">
            Camera (optional)
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
          </label>
          {value ? (
            <button
              type="button"
              className="text-left text-xs text-[var(--mz-rose)]"
              onClick={() => onChange(null)}
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
