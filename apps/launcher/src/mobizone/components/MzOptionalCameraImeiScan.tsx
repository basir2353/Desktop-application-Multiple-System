import { useEffect, useRef, useState } from "react";
import { MzSecondaryButton } from "../ui/MobizoneUi";

type Props = {
  onDetected: (code: string) => void;
  label?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

/**
 * Optional camera IMEI/barcode scan for desktop/web.
 * Typing + USB/Bluetooth wedge scanners remain the default (no camera required).
 */
export function MzOptionalCameraImeiScan({
  onDetected,
  label = "Camera scan (optional)",
}: Props): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function start(): Promise<void> {
      setErr(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setErr("Camera API not available — type or use a USB barcode scanner.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
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

        const Detector = (
          window as unknown as { BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike }
        ).BarcodeDetector;
        if (!Detector) {
          setErr("Live barcode decode not supported here — point a USB scanner at the IMEI field, or type it.");
          return;
        }
        const detector = new Detector({
          formats: ["code_128", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e"],
        });

        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value) {
              onDetected(value);
              setOpen(false);
              return;
            }
          } catch {
            // keep scanning
          }
          rafRef.current = window.setTimeout(() => void tick(), 350) as unknown as number;
        };
        void tick();
      } catch {
        setErr("Camera permission denied — type IMEI or use a hardware scanner (camera not required).");
      }
    }

    void start();
    return () => {
      cancelled = true;
      window.clearTimeout(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, onDetected]);

  return (
    <div className="space-y-2">
      <MzSecondaryButton onClick={() => setOpen((v) => !v)} className="text-sm">
        {open ? "Close camera" : label}
      </MzSecondaryButton>
      {open ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <video ref={videoRef} className="max-h-48 w-full bg-black object-cover" muted playsInline />
          {err ? <p className="px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">{err}</p> : null}
          <p className="px-2 py-1 text-[11px] text-slate-500">
            Optional — typing or USB/Bluetooth scanner works without camera permission.
          </p>
        </div>
      ) : null}
    </div>
  );
}
