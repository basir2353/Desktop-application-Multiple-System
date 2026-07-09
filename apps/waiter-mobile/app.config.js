const fs = require("fs");
const path = require("path");

const base = require("./app.json");

function loadEnvApiUrl() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return undefined;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.trim().match(/^EXPO_PUBLIC_API_BASE_URL=(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return undefined;
}

const variant = process.env.EXPO_PUBLIC_APP_VARIANT || process.env.APP_VARIANT || "waiter";
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || loadEnvApiUrl();

const variants = {
  waiter: {
    name: "POPS Waiter",
    slug: "pops-waiter",
    scheme: "pops-waiter",
    androidPackage: "com.platform.pops.waiter",
    iosBundleId: "com.platform.pops.waiter",
    defaultRole: "waiter",
  },
  rider: {
    name: "POPS Rider",
    slug: "pops-rider",
    scheme: "pops-rider",
    androidPackage: "com.platform.pops.rider",
    iosBundleId: "com.platform.pops.rider",
    defaultRole: "rider",
  },
};

const selected = variants[variant] ?? variants.waiter;

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
    },
    extra: {
      ...(base.expo.extra ?? {}),
      appVariant: variant,
      defaultRole: selected.defaultRole,
      apiBaseUrl,
    },
  },
};
