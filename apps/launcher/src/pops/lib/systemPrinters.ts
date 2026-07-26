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
  /** PDF / XPS / Fax / OneNote — still assignable for Auto; badge only. */
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
 * Windows virtual / file-target devices (PDF, XPS, Fax, OneNote).
 * Used for UI badges only — these printers are fully allowed for Auto linking and print.
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

/**
 * Common Windows virtual printers available in the OS print dialog from Chrome/Edge.
 * Browser tabs cannot enumerate the spooler, so we expose these so staff can still
 * link PDF/XPS and print via the Windows print dialog.
 */
const BROWSER_WINDOWS_VIRTUAL_PRINTERS: RawSystemPrinter[] = [
  {
    name: "Microsoft Print to PDF",
    system_name: "Microsoft Print to PDF",
    driver_name: "Microsoft Print To PDF",
    port_name: "PORTPROMPT:",
    is_default: false,
    is_shared: false,
    state: "ready",
    is_virtual: true,
  },
  {
    name: "Microsoft XPS Document Writer",
    system_name: "Microsoft XPS Document Writer",
    driver_name: "Microsoft XPS Document Writer v4",
    port_name: "PORTPROMPT:",
    is_default: false,
    is_shared: false,
    state: "ready",
    is_virtual: true,
  },
];

/** True when running inside the Tauri desktop shell (not a normal browser tab). */
export function isDesktopAppRuntime(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as Window & {
    __TAURI_INTERNALS__?: unknown;
    __TAURI__?: unknown;
    isTauri?: boolean;
  };
  return Boolean(w.__TAURI_INTERNALS__ || w.__TAURI__ || w.isTauri);
}

/** True for Fax / PDF / XPS / OneNote and similar non-physical printers (label only). */
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
  /**
   * All printers that can be linked for Auto POS print (physical + PDF/XPS/etc).
   * Same as `printers` — kept for call-site compatibility.
   */
  usable: SystemPrinterInfo[];
  /** PDF/XPS/Fax/OneNote subset — for badges / grouping in the UI. */
  virtual: SystemPrinterInfo[];
  error?: string;
  /** True when the list came from browser fallbacks (not the live Windows spooler). */
  browserMode?: boolean;
};

function isDesktopBridgeUnavailable(message: string): boolean {
  return (
    message.includes("not found") ||
    message.includes("Command") ||
    message.includes("unavailable") ||
    message.includes("webview") ||
    message.includes("IPC") ||
    message.includes("invoke") ||
    message.includes("Tauri") ||
    message.includes("tauri")
  );
}

function browserVirtualPrinterResult(): ListSystemPrintersResult {
  const printers = BROWSER_WINDOWS_VIRTUAL_PRINTERS.map(toSystemPrinterInfo);
  return {
    printers,
    usable: printers,
    virtual: printers,
    browserMode: true,
  };
}

/** Enumerates printers from the OS via Tauri; in browser, exposes Windows PDF/XPS virtual printers. */
export async function listSystemPrintersDetailed(): Promise<ListSystemPrintersResult> {
  if (!isDesktopAppRuntime()) {
    return browserVirtualPrinterResult();
  }

  try {
    const raw = await invoke<RawSystemPrinter[]>("list_system_printers");
    const printers = (raw ?? []).map(toSystemPrinterInfo);
    // Every installed printer is assignable (PDF/XPS included).
    const usable = printers;
    const virtual = printers.filter((p) => p.isVirtual);
    return { printers, usable, virtual, browserMode: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (isDesktopBridgeUnavailable(message)) {
      // Dev / broken bridge — still offer PDF/XPS so browser-like testing works.
      return {
        ...browserVirtualPrinterResult(),
        error:
          "Desktop printer bridge unavailable — showing Windows PDF/XPS. Use the print dialog for all printers.",
      };
    }
    return { printers: [], usable: [], virtual: [], error: message };
  }
}

/** Convenience: all OS printers (physical + PDF/XPS/etc). */
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

/** Send plain text directly to a named OS printer (Tauri). In browser, returns unsupported so dialog opens. */
export async function printToSystemPrinter(opts: {
  printerName: string;
  content: string;
  jobName?: string;
  copies?: number;
  /** Thermal roll width in mm (58 or 80). Used to size GDI/ESC-POS jobs. */
  paperWidthMm?: number;
}): Promise<PrintToPrinterResult> {
  const printerName = opts.printerName.trim();
  if (!printerName) {
    return { ok: false, error: "No OS printer name provided." };
  }

  // Browser tabs cannot talk to the Windows spooler — fall back to the OS print dialog
  // (Microsoft Print to PDF / XPS / physical printers all appear there).
  if (!isDesktopAppRuntime()) {
    return {
      ok: false,
      error: "Browser mode: use the Windows print dialog (includes PDF / XPS).",
      unsupported: true,
    };
  }

  try {
    const jobId = await invoke<number>("print_to_printer", {
      printerName,
      content: opts.content,
      jobName: opts.jobName ?? "POPS Print",
      copies: opts.copies ?? 1,
      paperWidthMm: opts.paperWidthMm ?? 80,
    });
    return { ok: true, jobId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const unsupported = isDesktopBridgeUnavailable(message);
    return { ok: false, error: message, unsupported };
  }
}

/** Print a PNG (styled receipt raster) to a named OS printer — matches on-screen Tax Invoice design. */
export async function printImageToSystemPrinter(opts: {
  printerName: string;
  pngBytes: Uint8Array;
  jobName?: string;
  copies?: number;
  paperWidthMm?: number;
}): Promise<PrintToPrinterResult> {
  const printerName = opts.printerName.trim();
  if (!printerName) {
    return { ok: false, error: "No OS printer name provided." };
  }
  if (!opts.pngBytes.length) {
    return { ok: false, error: "PNG image was empty." };
  }
  if (!isDesktopAppRuntime()) {
    return {
      ok: false,
      error: "Browser mode: use the Windows print dialog.",
      unsupported: true,
    };
  }

  try {
    const jobId = await invoke<number>("print_image_to_printer", {
      printerName,
      pngBytes: Array.from(opts.pngBytes),
      jobName: opts.jobName ?? "POPS Receipt",
      copies: opts.copies ?? 1,
      paperWidthMm: opts.paperWidthMm ?? 80,
    });
    return { ok: true, jobId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const unsupported = isDesktopBridgeUnavailable(message);
    return { ok: false, error: message, unsupported };
  }
}
