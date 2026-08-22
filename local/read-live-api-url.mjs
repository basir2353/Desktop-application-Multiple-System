#!/usr/bin/env node
/** Returns the live Railway API URL baked into builds. */
const LIVE = "https://backend-desktop-production-600b.up.railway.app";

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ url: LIVE }));
} else {
  console.log(LIVE);
}
