import {
  loginRequestSchema,
  refreshRequestSchema,
  tokenPairSchema,
  type TokenPair,
} from "@platform/contracts";

export type AuthClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
};

/** Bound fetch for WebView/Tauri — bare `fetch` throws "Failed to fetch" in WebView2. */
export function platformFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return globalThis.fetch(input, init);
}

export function isLikelyNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return true;
  const m = err.message;
  return (
    m === "Load failed" ||
    m === "Failed to fetch" ||
    /network|fetch|ECONNREFUSED|ENOTFOUND|aborted|timed?\s*out/i.test(m)
  );
}

export function wrapNetworkError(baseUrl: string, err: unknown): Error {
  const detail = err instanceof Error ? err.message : String(err);
  return new Error(
    `Cannot reach the API at ${baseUrl}. Check your internet connection and that the server is online. For local dev: run \`pnpm dev:api\`, start Postgres (\`docker compose up -d\`), and apply schema (\`pnpm db:push\`). (${detail})`,
  );
}

export class AuthClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: AuthClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    // Never assign bare `fetch` — calling it unbound breaks WebView (TypeError: Window.fetch).
    this.fetchImpl = opts.fetchImpl ?? platformFetch;
  }

  private async postJson(path: string, jsonBody: unknown): Promise<Response> {
    const url = `${this.baseUrl}${path}`;
    try {
      return await this.fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(jsonBody),
      });
    } catch (err) {
      if (isLikelyNetworkFailure(err)) {
        throw wrapNetworkError(this.baseUrl, err);
      }
      throw err;
    }
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const body = loginRequestSchema.parse({ email, password });
    const res = await this.postJson("/v1/auth/login", body);
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) {
        let message = "Invalid email or password.";
        try {
          const parsed = JSON.parse(text) as { message?: string };
          if (parsed.message) message = parsed.message;
        } catch {
          // keep default
        }
        throw new Error(message);
      }
      throw new Error(`Login failed: ${res.status} ${text}`);
    }
    const json: unknown = await res.json();
    return tokenPairSchema.parse(json);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const body = refreshRequestSchema.parse({ refreshToken });
    const res = await this.postJson("/v1/auth/refresh", body);
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) {
        throw new Error("Session expired. Sign in again.");
      }
      throw new Error(`Refresh failed: ${res.status} ${text}`);
    }
    const json: unknown = await res.json();
    return tokenPairSchema.parse(json);
  }
}
