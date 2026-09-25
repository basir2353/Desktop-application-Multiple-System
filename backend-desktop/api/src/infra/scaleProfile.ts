/**
 * Production scale profiles for multi-replica Railway / Postgres / Redis.
 * Set SCALE_PROFILE=high (or enterprise) on the live API service.
 */
export type ScaleProfile = "default" | "high" | "enterprise";

export type ScaleDefaults = {
  profile: ScaleProfile;
  databasePoolMax: number;
  apiMaxConcurrent: number;
  apiQueueMax: number;
  requireRedis: boolean;
  recommendedReplicas: number;
  notes: string[];
};

export function resolveScaleProfile(raw?: string | null): ScaleProfile {
  const v = (raw ?? process.env.SCALE_PROFILE ?? "default").trim().toLowerCase();
  if (v === "high" || v === "b" || v === "10k") return "high";
  if (v === "enterprise" || v === "c" || v === "100k") return "enterprise";
  return "default";
}

export function scaleDefaults(profile = resolveScaleProfile()): ScaleDefaults {
  if (profile === "enterprise") {
    return {
      profile,
      databasePoolMax: 12,
      apiMaxConcurrent: 250,
      apiQueueMax: 1200,
      requireRedis: true,
      recommendedReplicas: 12,
      notes: [
        "Use PgBouncer in front of Postgres (transaction mode).",
        "Run 8–20 API replicas behind Railway load balancer.",
        "Dedicated Redis + worker services required.",
        "Reports/tax/print must be async workers — not on request path.",
      ],
    };
  }
  if (profile === "high") {
    return {
      profile,
      databasePoolMax: 15,
      apiMaxConcurrent: 200,
      apiQueueMax: 800,
      requireRedis: true,
      recommendedReplicas: 6,
      notes: [
        "Target ~2k–10k concurrent terminals with 4–8 API replicas + Redis + larger Postgres.",
        "Keep DATABASE_POOL_MAX × replicas under Postgres max_connections (via PgBouncer).",
        "Set REDIS_URL on every API replica.",
      ],
    };
  }
  return {
    profile: "default",
    databasePoolMax: 8,
    apiMaxConcurrent: 60,
    apiQueueMax: 150,
    requireRedis: false,
    recommendedReplicas: 1,
    notes: ["Suitable for low hundreds of concurrent POS sessions."],
  };
}

/** Env overrides win; otherwise profile defaults apply. */
export function resolvePoolMax(): number {
  const fromEnv = Number(process.env.DATABASE_POOL_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return scaleDefaults().databasePoolMax;
}

export function resolveApiMaxConcurrent(): number {
  const fromEnv = Number(process.env.API_MAX_CONCURRENT);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return scaleDefaults().apiMaxConcurrent;
}

export function resolveApiQueueMax(): number {
  const fromEnv = Number(process.env.API_QUEUE_MAX);
  if (Number.isFinite(fromEnv) && fromEnv > 0) return Math.floor(fromEnv);
  return scaleDefaults().apiQueueMax;
}
