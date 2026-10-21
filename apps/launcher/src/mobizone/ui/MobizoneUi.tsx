import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { maybeUploadToGoogleDrive } from "../lib/googleDriveApi";
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
  // Use div (not <label>) so date pickers / nested buttons keep working.
  return (
    <div className="block space-y-1.5">
      <span className="mz-muted text-xs font-medium">{label}</span>
      {children}
    </div>
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

/** Text input with saved/history suggestions (browser datalist). */
export function MzSuggestInput({
  suggestions,
  listId,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  suggestions: string[];
  listId: string;
}): JSX.Element {
  return (
    <>
      <input
        {...props}
        list={listId}
        autoComplete="off"
        className={`mz-input mz-touch ${props.className ?? ""}`}
      />
      <datalist id={listId}>
        {suggestions.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>
    </>
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

/** Shared From → To date filter used on reports and history lists. */
export function MzDateRangeFilter({
  fromDate,
  toDate,
  onChange,
  hint = "Change dates anytime. Lists and totals update with the range.",
}: {
  fromDate: string;
  toDate: string;
  onChange: (from: string, to: string) => void;
  hint?: string;
}): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-3">
        <MzField label="From date">
          <MzInput
            type="date"
            value={fromDate}
            onChange={(e) => onChange(e.target.value, toDate)}
            className="mz-date-input"
          />
        </MzField>
        <MzField label="To date">
          <MzInput
            type="date"
            value={toDate}
            onChange={(e) => onChange(fromDate, e.target.value)}
            className="mz-date-input"
          />
        </MzField>
        <MzSecondaryButton
          onClick={() => {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            onChange(`${y}-${m}-${day}`, `${y}-${m}-${day}`);
          }}
        >
          Today
        </MzSecondaryButton>
        <MzSecondaryButton
          onClick={() => {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            onChange(`${y}-${m}-01`, `${y}-${m}-${day}`);
          }}
        >
          This month
        </MzSecondaryButton>
        <MzSecondaryButton
          onClick={() => {
            const d = new Date();
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            onChange(`${y}-01-01`, `${y}-${m}-${day}`);
          }}
        >
          This year
        </MzSecondaryButton>
        <MzSecondaryButton onClick={() => onChange("", "")}>All time</MzSecondaryButton>
      </div>
      {hint ? <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p> : null}
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

function compressVideoFrame(video: HTMLVideoElement, maxSide = 720): string {
  const scale = Math.min(1, maxSide / Math.max(video.videoWidth || 1, video.videoHeight || 1));
  const w = Math.max(1, Math.round((video.videoWidth || 1) * scale));
  const h = Math.max(1, Math.round((video.videoHeight || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not capture photo");
  ctx.drawImage(video, 0, 0, w, h);
  return canvas.toDataURL("image/jpeg", 0.72);
}

/**
 * Gallery + live webcam capture (desktop Electron / browser).
 * File `capture=` alone often does nothing on Windows desktop — use getUserMedia.
 */
export function MzPhotoUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | null;
  onChange: (dataUrl: string | null) => void;
}): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);

  useEffect(() => {
    if (!cameraOpen) return;
    let cancelled = false;

    async function start(): Promise<void> {
      setCamErr(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamErr("Camera API not available — choose a photo from Gallery.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
        }
      } catch {
        setCamErr("Could not open camera — allow permission, or use Gallery.");
      }
    }

    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cameraOpen]);

  async function onFile(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await readImageAsDataUrl(file);
      const stored = await maybeUploadToGoogleDrive(dataUrl, file.name);
      onChange(stored);
      setCameraOpen(false);
    } catch {
      onChange(null);
    }
  }

  function captureFrame(): void {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setCamErr("Camera not ready — wait a moment.");
      return;
    }
    try {
      const dataUrl = compressVideoFrame(video);
      void maybeUploadToGoogleDrive(dataUrl, `camera-${Date.now()}.jpg`).then((stored) => {
        onChange(stored);
        setCameraOpen(false);
        setCamErr(null);
      });
    } catch {
      setCamErr("Capture failed — try Gallery.");
    }
  }

  return (
    <div className="mz-photo-upload min-w-0">
      <p className="mz-muted truncate text-xs font-medium">{label}</p>
      <div className="mz-photo-upload-body">
        {value ? (
          <img src={value} alt={label} className="mz-photo-thumb" />
        ) : (
          <div className="mz-photo-thumb mz-photo-thumb--empty">No photo</div>
        )}
        <div className="mz-photo-actions">
          <label className="mz-photo-btn">
            Gallery
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
          <button type="button" className="mz-photo-btn" onClick={() => setCameraOpen((v) => !v)}>
            {cameraOpen ? "Close" : "Camera"}
          </button>
          {value ? (
            <button type="button" className="mz-photo-remove" onClick={() => onChange(null)}>
              Remove
            </button>
          ) : null}
        </div>
      </div>
      {cameraOpen ? (
        <div className="mz-photo-camera">
          <video ref={videoRef} className="max-h-44 w-full bg-black object-cover" muted playsInline />
          <div className="flex flex-wrap gap-2 p-2">
            <button type="button" className="mz-btn-primary px-3 py-2 text-sm" onClick={captureFrame}>
              Capture
            </button>
            <button type="button" className="mz-photo-btn" onClick={() => setCameraOpen(false)}>
              Cancel
            </button>
          </div>
          {camErr ? <p className="px-2 pb-2 text-xs text-amber-700 dark:text-amber-300">{camErr}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

export type MzDocumentFile = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  dataUrl: string;
  uploadedAt: string;
};

const MAX_DOC_BYTES = 4 * 1024 * 1024; // 4 MB per file (local storage)
const MAX_DOCS = 8;

function newDocId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Read any file (PDF, Word, PPT, image, etc.) as a data URL. */
export function readDocumentAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") resolve(result);
      else reject(new Error("Could not read file."));
    };
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function openDocumentAttachment(doc: MzDocumentFile): void {
  const a = document.createElement("a");
  a.href = doc.dataUrl;
  if (!doc.dataUrl.startsWith("http")) {
    a.download = doc.fileName;
  }
  a.rel = "noopener";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Upload reference documents of any type — PDF, Word, PowerPoint, Excel, images, etc.
 */
export function MzDocumentUpload({
  label = "Reference documents",
  value,
  onChange,
  maxFiles = MAX_DOCS,
}: {
  label?: string;
  value: MzDocumentFile[];
  onChange: (files: MzDocumentFile[]) => void;
  maxFiles?: number;
}): JSX.Element {
  const [err, setErr] = useState<string | null>(null);

  async function onFiles(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (picked.length === 0) return;
    setErr(null);
    const room = Math.max(0, maxFiles - value.length);
    if (room === 0) {
      setErr(`Maximum ${maxFiles} files per voucher.`);
      return;
    }
    const next = [...value];
    for (const file of picked.slice(0, room)) {
      if (file.size > MAX_DOC_BYTES) {
        setErr(`"${file.name}" is too large (max ${formatFileSize(MAX_DOC_BYTES)}).`);
        continue;
      }
      try {
        const dataUrl = await readDocumentAsDataUrl(file);
        const stored = await maybeUploadToGoogleDrive(dataUrl, file.name);
        next.push({
          id: newDocId(),
          fileName: file.name,
          mimeType: file.type || null,
          sizeBytes: file.size,
          dataUrl: stored,
          uploadedAt: new Date().toISOString(),
        });
      } catch {
        setErr(`Could not read "${file.name}".`);
      }
    }
    onChange(next);
  }

  return (
    <div className="space-y-2">
      <span className="mz-muted text-xs font-medium">{label}</span>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Any file type — PDF, Word, PowerPoint, Excel, images, and more (max {formatFileSize(MAX_DOC_BYTES)} each).
      </p>
      <label className="mz-photo-btn inline-flex cursor-pointer">
        Upload documents
        <input type="file" multiple className="hidden" onChange={(e) => void onFiles(e)} />
      </label>
      {err ? <p className="text-xs text-red-600">{err}</p> : null}
      {value.length > 0 ? (
        <ul className="space-y-1.5 text-sm">
          {value.map((doc) => (
            <li
              key={doc.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-800"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-900 dark:text-white">{doc.fileName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatFileSize(doc.sizeBytes)}
                  {doc.mimeType ? ` · ${doc.mimeType}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="text-sm font-medium text-teal-700 dark:text-teal-400"
                  onClick={() => openDocumentAttachment(doc)}
                >
                  Open
                </button>
                <button
                  type="button"
                  className="text-sm text-rose-600"
                  onClick={() => onChange(value.filter((d) => d.id !== doc.id))}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Compact list of saved attachments (history rows). */
export function MzDocumentLinks({
  files,
}: {
  files: MzDocumentFile[] | null | undefined;
}): JSX.Element | null {
  if (!files || files.length === 0) return null;
  return (
    <ul className="mt-1 flex flex-wrap gap-2 text-xs">
      {files.map((doc) => (
        <li key={doc.id}>
          <button
            type="button"
            className="font-medium text-teal-700 underline dark:text-teal-400"
            onClick={() => openDocumentAttachment(doc)}
            title={`${doc.fileName} (${formatFileSize(doc.sizeBytes)})`}
          >
            {doc.fileName}
          </button>
        </li>
      ))}
    </ul>
  );
}
