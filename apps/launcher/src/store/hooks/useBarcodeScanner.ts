import { useEffect, useRef } from "react";

/** USB/BT wedge scanners type rapidly and end with Enter — this hook detects that pattern. */
export function useBarcodeScanner(onScan: (barcode: string) => void, enabled = true): void {
  const bufferRef = useRef("");
  const lastKeyRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    function onKeyDown(e: KeyboardEvent): void {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        const el = e.target as HTMLInputElement;
        if (el.dataset.scanTarget === "true") return;
        if (el.type === "text" && el.placeholder?.toLowerCase().includes("search")) return;
      }

      const now = Date.now();
      if (now - lastKeyRef.current > 80) bufferRef.current = "";
      lastKeyRef.current = now;

      if (e.key === "Enter") {
        const code = bufferRef.current.trim();
        bufferRef.current = "";
        if (code.length >= 3) {
          e.preventDefault();
          onScan(code);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled, onScan]);
}
