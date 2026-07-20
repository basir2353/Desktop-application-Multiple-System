import { invoke } from "@tauri-apps/api/core";

export type SystemPrinterState = "ready" | "offline" | "paused" | "printing" | "unknown";

export type SystemPrinterConnectionType = "USB" | "Network" | "Bluetooth" | "Other";

export type SystemPrinterInfo = {
  name: string;
  systemName: string;
  driverName: string;
  portName: string;
  isDefault: boolean;
  isShared: boolean;
  state: SystemPrinterState;
  connectionType: SystemPrinterConnectionType;
  /** Fax / PDF / OneNote — do not assign for KOT/receipt. */
  isVirtual: boolean;
};

type RawSystemPrinter = {
  name: string;
  system_name: string;
  driver_name: string;
  port_name: string;
  is_default: boolean;
  is_shared: boolean;
  state: string;
  is_virtual?: boolean;
};

/** Heuristic connection-type classification from the spooler port name — Windows doesn't
 * expose a clean USB/Network/Bluetooth enum, so this reads the port name pattern. */
function classifyConnectionType(portName: string): SystemPrinterConnectionType {
  const p = portName.toUpperCase();
  if (p.includes("BT") || p.includes("BLUETOOTH")) return "Bluetooth";
  if (p.startsWith("\\\\") || p.includes("IP_") || p.includes("WSD") || /^\d+\.\d+\.\d+\.\d+/.test(p)) {
    return "Network";
  }
  if (p.startsWith("USB") || p.startsWith("LPT") || p.startsWith("COM")) return "USB";
  return "Other";
}

function toSystemPrinterState(state: string): SystemPrinterState {
  if (state === "ready" || state === "offline" || state === "paused" || state === "printing") return state;
  return "unknown";
}

/**
 * Windows virtual / non-ticket devices that must never receive KOT/receipt jobs.
 * "Fax" is the usual culprit when Windows sets it as the default printer.
 */
const VIRTUAL_PRINTER_PATTERNS = [
  /^fax$/i,
  /microsoft\s*print\s*to\s*pdf/i,
  /microsoft\s*xps/i,
  /onenote/i,
  /send\s*to\s*onenote/i,
  /adobe\s*pdf/i,
  /foxit\s*pdf/i,
  /nitro\s*pdf/i,
  /cutepdf/i,
  /bullzip/i,
  /doPDF/i,
  /pdf\s*creator/i,
  /pdf24/i,
  /print\s*to\s*file/i,
  /anydesk/i,
  /remote\s*desktop/i,
];

const VIRTUAL_PORT_PATTERNS = [/^nul:?$/i, /^portprompt:?$/i, /^file:?$/i, /^fax/i];

/** True for Fax / PDF / XPS / OneNote and similar non-physical printers. */
export function isVirtualSystemPrinter(
  name: string | undefined | null,
  extras?: { driverName?: string; portName?: string },
): boolean {
  const label = (name ?? "").trim();
  if (!label) return false;
  if (VIRTUAL_PRINTER_PATTERNS.some((re) => re.test(label))) return true;
  const driver = extras?.driverName ?? "";
  const port = extras?.portName ?? "";
  if (driver && VIRTUAL_PRINTER_PATTERNS.some((re) => re.test(driver))) return true;
  if (port && VIRTUAL_PORT_PATTERNS.some((re) => re.test(port))) return true;
  return false;
}

function toSystemPrinterInfo(p: RawSystemPrinter): SystemPrinterInfo {
  const isVirtual =
    p.is_virtual ??
    isVirtualSystemPrinter(p.name, { driverName: p.driver_name, portName: p.port_name });
  return {
    name: p.name,
    systemName: p.system_name,
    driverName: p.driver_name,
    portName: p.port_name,
    isDefault: p.is_default,
    isShared: p.is_shared,
    state: toSystemPrinterState(p.state),
    connectionType: classifyConnectionType(p.port_name),
    isVirtual,
  };
}

export type ListSystemPrintersResult = {
  printers: SystemPrinterInfo[];
  /** Usable (non-virtual) printers for POS. */
  usable: SystemPrinterInfo[];
  /** Fax/PDF/OneNote — shown for clarity, not assignable. */
  virtual: SystemPrinterInfo[];
  error?: string;
};

function isDesktopBridgeUnavailable(message: string): boolean {
  return (
    message.includes("not found") ||
    message.includes("Command") ||
    message.includes("unavailable") ||
    message.includes("webview") ||
    message.includes("IPC") ||
    message.includes("invoke")
  );
}

/** Enumerates printers from the OS via Tauri (with PowerShell fallback on Windows). */
export async function listSystemPrintersDetailed(): Promise<ListSystemPrintersResult> {
  try {
    const raw = await invoke<RawSystemPrinter[]>("list_system_printers");
    const printers = (raw ?? []).map(toSystemPrinterInfo);
    const usable = printers.filter((p) => !p.isVirtual);
    const virtual = printers.filter((p) => p.isVirtual);
    return { printers, usable, virtual };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const hint = isDesktopBridgeUnavailable(message)
      ? "Open the POPS desktop app window (not a browser tab), then click Refresh."
      : message;
    return { printers: [], usable: [], virtual: [], error: hint };
  }
}

/** Convenience: usable printers only (legacy call sites). */
export async function listSystemPrinters(): Promise<SystemPrinterInfo[]> {
  const result = await listSystemPrintersDetailed();
  if (result.error && result.printers.length === 0) {
    throw new Error(result.error);
  }
  return result.usable;
}

export type PrintToPrinterResult =
  | { ok: true; jobId: number }
  | { ok: false; error: string; unsupported?: boolean };

/** Send plain text directly to a named OS printer (Tauri). Falls back gracefully in web-only. */
export async function printToSystemPrinter(opts: {
  printerName: string;
  content: string;
  jobName?: string;
  copies?: number;
}): Promise<PrintToPrinterResult> {
  const printerName = opts.printerName.trim();
  if (!printerName) {
    return { ok: false, error: "No OS printer name provided." };
  }
  if (isVirtualSystemPrinter(printerName)) {
    return {
      ok: false,
      error: `"${printerName}" is a virtual Windows printer (Fax/PDF). Link a real Kitchen/Bar/Receipt printer in Printer → Sections.`,
    };
  }

  try {
    const jobId = await invoke<number>("print_to_printer", {
      printerName,
      content: opts.content,
      jobName: opts.jobName ?? "POPS Print",
      copies: opts.copies ?? 1,
    });
    return { ok: true, jobId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const unsupported = isDesktopBridgeUnavailable(message);
    const faxHint =
      /fax/i.test(printerName) || /StartDocPrinterW/i.test(message)
        ? " Open Printer → Sections and pick a real printer — not Fax / PDF."
        : "";
    return { ok: false, error: `${message}${faxHint}`, unsupported };
  }
}
