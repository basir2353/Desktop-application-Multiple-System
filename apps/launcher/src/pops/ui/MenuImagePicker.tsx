import { useEffect, useRef, useState } from "react";
import { resolveMenuImageUrl } from "../lib/menuImageUrl";

type MenuImagePickerProps = {
  label?: string;
  value: string | null;
  previewFile?: File | null;
  onFileSelect: (file: File | null) => void;
  onClear?: () => void;
  compact?: boolean;
  disabled?: boolean;
};

export function MenuImagePicker({
  label = "Photo",
  value,
  previewFile,
  onFileSelect,
  onClear,
  compact = false,
  disabled = false,
}: MenuImagePickerProps): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!previewFile) {
      setObjectUrl(null);
      return;
    }
    const url = URL.createObjectURL(previewFile);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  const previewSrc = objectUrl ?? resolveMenuImageUrl(value);
  const sizeClass = compact ? "h-10 w-10" : "h-20 w-20";

  return (
    <div className={compact ? "flex items-center gap-2" : "block"}>
      {!compact ? <div className="text-xs text-slate-400">{label}</div> : null}
      <div className={`mt-1 flex items-center gap-3 ${compact ? "mt-0" : ""}`}>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={`${sizeClass} shrink-0 overflow-hidden rounded-md border border-dashed border-slate-600 bg-slate-950 transition hover:border-amber-500/50 disabled:opacity-50`}
          title={previewSrc ? "Change photo" : "Add photo"}
        >
          {previewSrc ? (
            <img src={previewSrc} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[10px] text-slate-500">
              {compact ? "+" : "Add photo"}
            </span>
          )}
        </button>
        <div className="min-w-0">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            disabled={disabled}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              onFileSelect(file);
              e.target.value = "";
            }}
          />
          {!compact ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={disabled}
                onClick={() => inputRef.current?.click()}
                className="text-xs text-amber-300 hover:text-amber-200 disabled:opacity-50"
              >
                {previewSrc ? "Change photo" : "Upload photo"}
              </button>
              {previewSrc && onClear ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onClear}
                  className="text-xs text-slate-400 hover:text-white disabled:opacity-50"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ) : null}
          {!compact ? (
            <p className="mt-1 text-[10px] text-slate-500">JPEG, PNG, WebP, or GIF · max 5 MB</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type MenuImageThumbProps = {
  imageUrl: string | null;
  alt: string;
};

export function MenuImageThumb({ imageUrl, alt }: MenuImageThumbProps): JSX.Element {
  const src = resolveMenuImageUrl(imageUrl);
  if (!src) {
    return (
      <span
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-800 text-[10px] text-slate-500"
        aria-hidden
      >
        —
      </span>
    );
  }
  return <img src={src} alt={alt} className="h-9 w-9 shrink-0 rounded-md object-cover" />;
}
