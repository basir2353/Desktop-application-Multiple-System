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
};

type RawSystemPrinter = {
  name: string;
  system_name: string;
  driver_name: string;
  port_name: string;
  is_default: boolean;
  is_shared: boolean;
  state: string;
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

/** Enumerates printers actually installed on this OS via the native Tauri command. */
export async function listSystemPrinters(): Promise<SystemPrinterInfo[]> {
  const raw = await invoke<RawSystemPrinter[]>("list_system_printers");
  return raw.map((p) => ({
    name: p.name,
    systemName: p.system_name,
    driverName: p.driver_name,
    portName: p.port_name,
    isDefault: p.is_default,
    isShared: p.is_shared,
    state: toSystemPrinterState(p.state),
    connectionType: classifyConnectionType(p.port_name),
  }));
}
