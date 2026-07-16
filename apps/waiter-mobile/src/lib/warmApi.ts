import { getApiBaseUrl } from "./apiBase";
import { isLikelyNetworkFailure, mobileFetch } from "./mobileFetch";
import { markOnline, markOffline } from "../stores/connectivityStore";

let warmInFlight: Promise<boolean> | null = null;

/** Wake Railway / verify connectivity before login (cold starts can take 10–15s). */
export async function warmApiConnection(): Promise<boolean> {
  if (warmInFlight) return warmInFlight;

  warmInFlight = (async () => {
    const base = getApiBaseUrl();
    try {
      const res = await mobileFetch(`${base}/health`);
      if (res.ok) {
        markOnline();
        return true;
      }
      markOffline();
      return false;
    } catch (err) {
      if (!isLikelyNetworkFailure(err)) markOffline();
      else markOffline();
      return false;
    } finally {
      warmInFlight = null;
    }
  })();

  return warmInFlight;
}
