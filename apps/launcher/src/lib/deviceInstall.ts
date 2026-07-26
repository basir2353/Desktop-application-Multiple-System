import { businessSystemIdFromSystemType, type BusinessSystemId } from "./businessSystems";
import { getLockedSystemId } from "./edition";

const INSTALL_KEY = "platform-installed-system-v1";

/**
 * The business system provisioned on this machine.
 *
 * Written the first time a tenant user signs in: the Super Admin assigns the
 * system when creating the business, and the first successful login installs
 * that system on the admin's device. It survives logout, so the app always
 * returns to the same system's login screen instead of the picker or the
 * Super Admin console.
 */
export type DeviceInstall = {
  systemId: BusinessSystemId;
  systemType: string | null;
  installedAt: string;
};

export function readDeviceInstall(): DeviceInstall | null {
  try {
    const raw = localStorage.getItem(INSTALL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DeviceInstall>;
    const systemId = parsed.systemId;
    if (!systemId) return null;
    if (systemId !== "restaurant" && systemId !== "pharmacy" && systemId !== "general-store") {
      return null;
    }
    return {
      systemId,
      systemType: parsed.systemType ?? null,
      installedAt: parsed.installedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function getInstalledSystemId(): BusinessSystemId | null {
  return readDeviceInstall()?.systemId ?? null;
}

/** Binds this device to the system assigned to the signed-in account. */
export function recordDeviceInstall(systemType: string | null | undefined): DeviceInstall | null {
  const systemId = businessSystemIdFromSystemType(systemType);
  if (!systemId) return null;

  const existing = readDeviceInstall();
  if (existing?.systemId === systemId) return existing;

  const install: DeviceInstall = {
    systemId,
    systemType: systemType ?? null,
    installedAt: new Date().toISOString(),
  };
  try {
    localStorage.setItem(INSTALL_KEY, JSON.stringify(install));
  } catch {
    // storage unavailable — lock falls back to the JWT for this session only
  }
  return install;
}

/** Support/re-provisioning escape hatch (`/?reset-install=1`). */
export function clearDeviceInstall(): void {
  try {
    localStorage.removeItem(INSTALL_KEY);
  } catch {
    // ignore storage errors
  }
}

/**
 * The system this client is pinned to: the installer edition first, then the
 * system installed on this device. `null` means the picker is still allowed.
 */
export function getEffectiveSystemLock(): BusinessSystemId | null {
  return getLockedSystemId() ?? getInstalledSystemId();
}

export function isDeviceLockedToSystem(): boolean {
  return getEffectiveSystemLock() !== null;
}
