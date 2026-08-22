const fs = require("fs");
const path = require("path");

const base = require("./app.json");

function loadEnvValue(key) {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return undefined;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.trim().match(new RegExp(`^${key}=(.+)$`));
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const variant =
  process.env.EXPO_PUBLIC_APP_VARIANT ||
  process.env.APP_VARIANT ||
  loadEnvValue("EXPO_PUBLIC_APP_VARIANT") ||
  loadEnvValue("APP_VARIANT") ||
  "staff";
const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  loadEnvValue("EXPO_PUBLIC_API_BASE_URL") ||
  "https://backend-desktop-production-600b.up.railway.app";

const variants = {
  /** Combined Waiter + Rider APK — two role tabs, Email | PIN login. */
  staff: {
    name: "POPS Staff",
    slug: "pops-staff",
    scheme: "pops-staff",
    androidPackage: "com.platform.pops.staff",
    iosBundleId: "com.platform.pops.staff",
    defaultRole: "waiter",
    appKind: "staff",
  },
  /** Separate Admin / Incharge APK. */
  admin: {
    name: "POPS Admin",
    slug: "pops-admin",
    scheme: "pops-admin",
    androidPackage: "com.platform.pops.admin",
    iosBundleId: "com.platform.pops.admin",
    defaultRole: "admin",
    appKind: "admin",
  },
  /** Legacy dedicated builds (optional). */
  waiter: {
    name: "POPS Waiter",
    slug: "pops-waiter",
    scheme: "pops-waiter",
    androidPackage: "com.platform.pops.waiter",
    iosBundleId: "com.platform.pops.waiter",
    defaultRole: "waiter",
    appKind: "staff-locked",
  },
  rider: {
    name: "POPS Rider",
    slug: "pops-rider",
    scheme: "pops-rider",
    androidPackage: "com.platform.pops.rider",
    iosBundleId: "com.platform.pops.rider",
    defaultRole: "rider",
    appKind: "staff-locked",
  },
};

const selected = variants[variant] ?? variants.staff;

/** @type {import("expo/config").ExpoConfig} */
module.exports = {
  expo: {
    ...base.expo,
    name: selected.name,
    slug: selected.slug,
    scheme: selected.scheme,
    ios: {
      ...base.expo.ios,
      bundleIdentifier: selected.iosBundleId,
    },
    android: {
      ...base.expo.android,
      package: selected.androidPackage,
      versionCode: Number(base.expo.android?.versionCode ?? 1100),
    },
    extra: {
      ...(base.expo.extra ?? {}),
      appVariant: variant,
      appKind: selected.appKind,
      defaultRole: selected.defaultRole,
      apiBaseUrl,
      appVersion: base.expo.version,
      updateFeedUrl:
        process.env.EXPO_PUBLIC_UPDATE_FEED_URL ||
        `https://github.com/basir2353/pops-mobile-updates/releases/latest/download/latest-${variant === "admin" ? "admin" : "staff"}.json`,
    },
  },
};
