/** Client-side HTTP concurrency queue with slow-RTT throttling + GET dedupe. */

export const REQUEST_QUEUE_FAST_CONCURRENCY = 6;
export const REQUEST_QUEUE_SLOW_CONCURRENCY = 2;
const SLOW_RTT_MS = 1200;
const RTT_WINDOW = 8;
const SLOW_ENTER_COUNT = 3;
const FAST_RECOVER_COUNT = 4;

type QueueTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
  priority: number;
};

function isMutationMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

export class HttpRequestQueue {
  private active = 0;
  private readonly high: QueueTask<unknown>[] = [];
  private readonly normal: QueueTask<unknown>[] = [];
  private readonly inflightGets = new Map<string, Promise<unknown>>();
  private readonly rtts: number[] = [];
  private slow = false;
  private consecutiveSlow = 0;
  private consecutiveFast = 0;
  private readonly listeners = new Set<(slow: boolean) => void>();

  isSlow(): boolean {
    return this.slow;
  }

  subscribeSlow(listener: (slow: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.slow);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private setSlow(next: boolean): void {
    if (this.slow === next) return;
    this.slow = next;
    for (const listener of this.listeners) listener(next);
  }

  private maxConcurrency(): number {
    return this.slow ? REQUEST_QUEUE_SLOW_CONCURRENCY : REQUEST_QUEUE_FAST_CONCURRENCY;
  }

  recordSample(durationMs: number, failed: boolean): void {
    if (failed || durationMs >= SLOW_RTT_MS) {
      this.consecutiveSlow += 1;
      this.consecutiveFast = 0;
      if (durationMs > 0) {
        this.rtts.push(durationMs);
        if (this.rtts.length > RTT_WINDOW) this.rtts.shift();
      }
      if (this.consecutiveSlow >= SLOW_ENTER_COUNT || median(this.rtts) >= SLOW_RTT_MS) {
        this.setSlow(true);
      }
      return;
    }

    this.rtts.push(durationMs);
    if (this.rtts.length > RTT_WINDOW) this.rtts.shift();
    this.consecutiveFast += 1;
    this.consecutiveSlow = 0;
    if (this.slow && this.consecutiveFast >= FAST_RECOVER_COUNT && median(this.rtts) < SLOW_RTT_MS) {
      this.setSlow(false);
    }
  }

  enqueue<T>(
    run: () => Promise<T>,
    opts?: { method?: string; key?: string },
  ): Promise<T> {
    const method = (opts?.method ?? "GET").toUpperCase();
    const key = opts?.key;

    if (!isMutationMethod(method) && key) {
      const existing = this.inflightGets.get(key);
      if (existing) return existing as Promise<T>;
    }

    const promise = new Promise<T>((resolve, reject) => {
      const task: QueueTask<T> = {
        run,
        resolve,
        reject,
        priority: isMutationMethod(method) ? 1 : 0,
      };
      if (task.priority > 0) this.high.push(task as QueueTask<unknown>);
      else this.normal.push(task as QueueTask<unknown>);
      this.pump();
    });

    if (!isMutationMethod(method) && key) {
      this.inflightGets.set(key, promise);
      void promise.finally(() => {
        if (this.inflightGets.get(key) === promise) this.inflightGets.delete(key);
      });
    }

    return promise;
  }

  private pump(): void {
    while (this.active < this.maxConcurrency()) {
      const task = this.high.shift() ?? this.normal.shift();
      if (!task) return;
      this.active += 1;
      const started = Date.now();
      void task
        .run()
        .then((value) => {
          this.recordSample(Date.now() - started, false);
          task.resolve(value);
        })
        .catch((err) => {
          this.recordSample(Date.now() - started, true);
          task.reject(err);
        })
        .finally(() => {
          this.active -= 1;
          this.pump();
        });
    }
  }
}

/** Shared queue for desktop + mobile API traffic. */
export const globalHttpRequestQueue = new HttpRequestQueue();

export function isRequestQueueSlow(): boolean {
  return globalHttpRequestQueue.isSlow();
}

export function subscribeRequestQueueSlow(listener: (slow: boolean) => void): () => void {
  return globalHttpRequestQueue.subscribeSlow(listener);
}

export function enqueueHttpRequest<T>(
  run: () => Promise<T>,
  opts?: { method?: string; key?: string },
): Promise<T> {
  return globalHttpRequestQueue.enqueue(run, opts);
}
