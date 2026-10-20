import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { normalizeImeiScan } from "../lib/mobizoneStore";
import { MzSecondaryButton } from "../ui/MobizoneUi";

type Props = {
  onDetected: (code: string) => void;
  label?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

/** Prefer a 15-digit IMEI if the barcode embeds extra text / *stars*. */
function normalizeScannedCode(raw: string): string {
  return normalizeImeiScan(raw);
}

/**
 * Live camera IMEI/barcode scan for desktop/web (ZXing + optional BarcodeDetector).
 * Typing + USB/Bluetooth wedge scanners remain available without camera.
 */
export function MzOptionalCameraImeiScan({
  onDetected,
  label = "Camera scan (optional)",
}: Props): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onDetectedRef = useRef(onDetected);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const timerRef = useRef<number>(0);
  const handledRef = useRef(false);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    handledRef.current = false;

    function emit(raw: string): void {
      if (cancelled || handledRef.current) return;
      const value = normalizeScannedCode(raw);
      if (!value) return;
      handledRef.current = true;
      onDetectedRef.current(value);
      setOpen(false);
    }

    function stopAll(): void {
      window.clearTimeout(timerRef.current);
      try {
        controlsRef.current?.stop();
      } catch {
        // ignore
      }
      controlsRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      const video = videoRef.current;
      if (video) video.srcObject = null;
    }

    async function openCamera(): Promise<MediaStream> {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera API not available — type IMEI or use USB scanner.");
      }
      try {
        return await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        return navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      }
    }

    async function startWithBarcodeDetector(stream: MediaStream): Promise<boolean> {
      const Detector = (
        window as unknown as {
          BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
        }
      ).BarcodeDetector;
      if (!Detector) return false;
      const detector = new Detector({
        formats: ["code_128", "code_39", "ean_13", "ean_8", "qr_code", "upc_a", "upc_e", "itf", "codabar"],
      });
      setStatus("Live scan on — show barcode / IMEI sticker…");
      const tick = async () => {
        if (cancelled || !videoRef.current || handledRef.current) return;
        try {
          const codes = await detector.detect(videoRef.current);
          const value = codes[0]?.rawValue?.trim();
          if (value) {
            emit(value);
            return;
          }
        } catch {
          // keep scanning
        }
        timerRef.current = window.setTimeout(() => void tick(), 280) as unknown as number;
      };
      void tick();
      return true;
    }

    async function startWithZxing(stream: MediaStream): Promise<void> {
      const video = videoRef.current;
      if (!video) throw new Error("Camera view missing.");
      setStatus("Live scan on — show barcode / IMEI sticker…");
      const reader = new BrowserMultiFormatReader(undefined, {
        delayBetweenScanAttempts: 250,
        delayBetweenScanSuccess: 800,
      });
      controlsRef.current = await reader.decodeFromStream(stream, video, (result) => {
        if (result) emit(result.getText());
      });
    }

    async function start(): Promise<void> {
      setErr(null);
      setStatus("Camera open ho rahi hai…");
      try {
        const stream = await openCamera();
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play().catch(() => undefined);
        }

        const usedNative = await startWithBarcodeDetector(stream);
        if (cancelled) return;
        if (!usedNative) {
          await startWithZxing(stream);
        }
      } catch (e) {
        if (cancelled) return;
        setStatus(null);
        setErr(
          e instanceof Error
            ? e.message
            : "Camera permission denied — type IMEI or use a hardware scanner.",
        );
        stopAll();
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopAll();
    };
  }, [open]);

  return (
    <div className="space-y-2">
      <MzSecondaryButton onClick={() => setOpen((v) => !v)} className="text-sm">
        {open ? "Close camera" : label}
      </MzSecondaryButton>
      {open ? (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <video
            ref={videoRef}
            className="max-h-56 w-full bg-black object-cover"
            muted
            playsInline
            autoPlay
          />
          {status && !err ? (
            <p className="px-2 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">{status}</p>
          ) : null}
          {err ? <p className="px-2 py-1.5 text-xs text-amber-700 dark:text-amber-300">{err}</p> : null}
          <p className="px-2 py-1 text-[11px] text-slate-500">
            Live camera decode — or type the IMEI / use a USB-Bluetooth scanner.
          </p>
        </div>
      ) : null}
    </div>
  );
}
