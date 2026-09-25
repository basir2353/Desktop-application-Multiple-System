import type { NextFunction, Request, Response } from "express";
import {
  resolveApiMaxConcurrent,
  resolveApiQueueMax,
} from "../infra/scaleProfile";

type Waiter = {
  resolve: () => void;
};

export type RequestLoadStats = {
  active: number;
  queued: number;
  maxConcurrent: number;
  maxQueue: number;
  rejectedTotal: number;
  acceptedTotal: number;
};

let sharedStats: RequestLoadStats = {
  active: 0,
  queued: 0,
  maxConcurrent: 60,
  maxQueue: 150,
  rejectedTotal: 0,
  acceptedTotal: 0,
};

export function getRequestLoadStats(): RequestLoadStats {
  return { ...sharedStats, queued: sharedStats.queued };
}

/**
 * Soft load-shed: cap concurrent request handlers; queue overflow briefly;
 * reject with 503 when the wait queue is full. Health checks bypass the queue.
 */
export function createRequestConcurrencyMiddleware(opts?: {
  maxConcurrent?: number;
  maxQueue?: number;
}) {
  const maxConcurrent = Math.max(
    1,
    opts?.maxConcurrent ?? resolveApiMaxConcurrent(),
  );
  const maxQueue = Math.max(0, opts?.maxQueue ?? resolveApiQueueMax());

  let active = 0;
  const waiters: Waiter[] = [];
  let rejectedTotal = 0;
  let acceptedTotal = 0;

  const syncStats = () => {
    sharedStats = {
      active,
      queued: waiters.length,
      maxConcurrent,
      maxQueue,
      rejectedTotal,
      acceptedTotal,
    };
  };
  syncStats();

  function release(): void {
    active = Math.max(0, active - 1);
    const next = waiters.shift();
    if (next) {
      active += 1;
      next.resolve();
    }
    syncStats();
  }

  function acquire(): Promise<"ok" | "full"> {
    if (active < maxConcurrent) {
      active += 1;
      acceptedTotal += 1;
      syncStats();
      return Promise.resolve("ok");
    }
    if (waiters.length >= maxQueue) {
      rejectedTotal += 1;
      syncStats();
      return Promise.resolve("full");
    }
    return new Promise((resolve) => {
      waiters.push({
        resolve: () => {
          acceptedTotal += 1;
          resolve("ok");
          syncStats();
        },
      });
      syncStats();
    });
  }

  return function requestConcurrencyMiddleware(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const path = req.path || "";
    if (path === "/health" || path === "/health/db" || path.startsWith("/health/")) {
      next();
      return;
    }

    void acquire().then((status) => {
      if (status === "full") {
        res.setHeader("Retry-After", "1");
        res.status(503).json({
          statusCode: 503,
          message: "Server busy. Retry shortly.",
        });
        return;
      }

      let released = false;
      const done = () => {
        if (released) return;
        released = true;
        release();
      };

      res.on("finish", done);
      res.on("close", done);
      next();
    });
  };
}
