import { connect as netConnect } from "node:net";

export type RedisPingResult = {
  configured: boolean;
  ok: boolean;
  latencyMs: number | null;
  error?: string;
};

/**
 * Lightweight Redis PING without adding ioredis/bullmq deps.
 * Supports redis:// and rediss:// (TLS not fully verified — Railway internal Redis is usually redis://).
 */
export async function pingRedis(
  redisUrl = process.env.REDIS_URL?.trim(),
  timeoutMs = 2_500,
): Promise<RedisPingResult> {
  if (!redisUrl) {
    return { configured: false, ok: false, latencyMs: null };
  }

  let hostname = "127.0.0.1";
  let port = 6379;
  try {
    const u = new URL(redisUrl);
    hostname = u.hostname || hostname;
    port = Number(u.port || (u.protocol === "rediss:" ? 6380 : 6379));
  } catch {
    return {
      configured: true,
      ok: false,
      latencyMs: null,
      error: "REDIS_URL unparseable",
    };
  }

  const started = Date.now();
  return new Promise((resolve) => {
    const socket = netConnect({ host: hostname, port });
    let settled = false;

    const finish = (result: RedisPingResult) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        /* ignore */
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        configured: true,
        ok: false,
        latencyMs: Date.now() - started,
        error: "timeout",
      });
    }, timeoutMs);

    socket.on("connect", () => {
      socket.write("*1\r\n$4\r\nPING\r\n");
    });

    socket.on("data", (buf) => {
      clearTimeout(timer);
      const text = buf.toString("utf8");
      const ok = text.includes("PONG");
      finish({
        configured: true,
        ok,
        latencyMs: Date.now() - started,
        error: ok ? undefined : `unexpected: ${text.slice(0, 80)}`,
      });
    });

    socket.on("error", (err) => {
      clearTimeout(timer);
      finish({
        configured: true,
        ok: false,
        latencyMs: Date.now() - started,
        error: err.message,
      });
    });
  });
}
