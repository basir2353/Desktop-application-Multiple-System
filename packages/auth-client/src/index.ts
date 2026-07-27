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

type ZodLikeIssue = { path?: unknown[]; code?: string; message?: string };
type ZodLikeError = { name?: string; issues?: ZodLikeIssue[] };

function asZodIssues(err: unknown): ZodLikeIssue[] | null {
  if (!err || typeof err !== "object") return null;
  const maybe = err as ZodLikeError;
  if (Array.isArray(maybe.issues) && maybe.issues.length > 0) return maybe.issues;
  return null;
}

/** Turn Zod / Nest validation payloads into a short message for the login UI. */
export function formatAuthError(err: unknown): string {
  const zodIssues = asZodIssues(err);
  if (zodIssues) {
    const issue = zodIssues[0]!;
    const field = issue.path?.[0];
    if (field === "email") return "Enter a valid email address.";
    if (field === "password") {
      if (issue.code === "too_small") return "Password must be at least 8 characters.";
      return "Enter a valid password.";
    }
    if (field === "refreshToken") return "Session expired. Sign in again.";
    return issue.message || "Please check your details and try again.";
  }

  if (!(err instanceof Error)) return "Login failed. Please try again.";

  const raw = err.message.trim();
  if (!raw) return "Login failed. Please try again.";

  // Nest sometimes returns message as a JSON array string of Zod issues.
  if (raw.startsWith("[") || raw.startsWith("{")) {
    try {
      const parsed: unknown = JSON.parse(raw);
      const issues = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === "object" && "message" in parsed
          ? (parsed as { message: unknown }).message
          : null;
      if (Array.isArray(issues) && issues[0] && typeof issues[0] === "object") {
        const first = issues[0] as ZodLikeIssue;
        const field = first.path?.[0];
        if (field === "email") return "Enter a valid email address.";
        if (field === "password" && first.code === "too_small") {
          return "Password must be at least 8 characters.";
        }
        if (typeof first.message === "string" && first.message && !first.message.startsWith("[")) {
          return first.message;
        }
      }
      if (typeof issues === "string") return issues;
    } catch {
      // fall through
    }
  }

  if (raw.includes("too_small") && raw.includes("password")) {
    return "Password must be at least 8 characters.";
  }
  if (/invalid email/i.test(raw) || (/email/i.test(raw) && /invalid/i.test(raw))) {
    return "Enter a valid email address.";
  }

  return raw;
}

function readApiErrorMessage(text: string, fallback: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: string | string[] };
    if (typeof parsed.message === "string") return formatAuthError(new Error(parsed.message));
    if (Array.isArray(parsed.message)) {
      const joined = parsed.message.filter((m) => typeof m === "string").join(" ");
      return formatAuthError(new Error(joined || text));
    }
  } catch {
    // keep fallback
  }
  return fallback;
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
    let body: { email: string; password: string };
    try {
      body = loginRequestSchema.parse({ email, password });
    } catch (err) {
      throw new Error(formatAuthError(err));
    }

    const res = await this.postJson("/v1/auth/login", body);
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) {
        throw new Error(readApiErrorMessage(text, "Invalid email or password."));
      }
      if (res.status === 400) {
        throw new Error(readApiErrorMessage(text, "Please check your email and password."));
      }
      throw new Error(readApiErrorMessage(text, `Login failed (${res.status}). Please try again.`));
    }
    const json: unknown = await res.json();
    return tokenPairSchema.parse(json);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let body: { refreshToken: string };
    try {
      body = refreshRequestSchema.parse({ refreshToken });
    } catch (err) {
      throw new Error(formatAuthError(err));
    }

    const res = await this.postJson("/v1/auth/refresh", body);
    if (!res.ok) {
      const text = await res.text();
      if (res.status === 401) {
        throw new Error("Session expired. Sign in again.");
      }
      throw new Error(readApiErrorMessage(text, `Refresh failed (${res.status}). Sign in again.`));
    }
    const json: unknown = await res.json();
    return tokenPairSchema.parse(json);
  }
}
