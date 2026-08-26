#!/usr/bin/env node
/** Single source of truth for the live Railway API URL (read by builds + scripts). */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE_ENV_PATH = path.join(__dirname, "live-env.json");

export function readLiveApiUrl() {
  const raw = JSON.parse(fs.readFileSync(LIVE_ENV_PATH, "utf8"));
  return String(raw.url ?? "").trim().replace(/\/$/, "");
}

export function readLiveApiMirror() {
  const raw = JSON.parse(fs.readFileSync(LIVE_ENV_PATH, "utf8"));
  const mirror = String(raw.mirror ?? "").trim().replace(/\/$/, "");
  return mirror || null;
}
