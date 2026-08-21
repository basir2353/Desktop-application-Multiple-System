#!/usr/bin/env node
/**
 * Resolve Active live Railway API URL (matches Super Admin OLD/NEW switch).
 * Reads local/live-env.json written by the sync agent on /activate.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OLD = "https://backend-desktop-production-5505.up.railway.app";
const NEW = "https://backend-desktop-production-600b.up.railway.app";

const here = dirname(fileURLToPath(import.meta.url));
const envFile = join(here, "live-env.json");

function readActive() {
  try {
    if (!existsSync(envFile)) return "old";
    const parsed = JSON.parse(readFileSync(envFile, "utf8"));
    return parsed.active === "new" ? "new" : "old";
  } catch {
    return "old";
  }
}

const active = readActive();
const url = active === "new" ? NEW : OLD;

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ active, url, old: OLD, new: NEW }));
} else if (process.argv.includes("--active")) {
  console.log(active);
} else {
  console.log(url);
}
