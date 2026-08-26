#!/usr/bin/env node
/** Returns the live Railway API URL baked into builds. */
import { readLiveApiUrl } from "./live-api-url.mjs";

const LIVE = readLiveApiUrl();

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ url: LIVE }));
} else {
  console.log(LIVE);
}
