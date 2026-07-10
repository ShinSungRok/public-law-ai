import type { RateLimiter } from "./RateLimiter";
import type { RateLimitResult } from "./RateLimitResult";

export interface RateLimiterOptions {
  maxRequests: number;
  windowMs: number;
}

interface WindowState {
  windowStart: number;
  count: number;
}

const DEFAULT_CLOCK = (): number => Date.now();

export class InMemoryRateLimiter implements RateLimiter {
  private readonly windows = new Map<string, WindowState>();

  constructor(
    private readonly options: RateLimiterOptions,
    private readonly clock: () => number = DEFAULT_CLOCK,
  ) {}

  consume(key: string): RateLimitResult {
    const now = this.clock();
    let state = this.windows.get(key);

    if (!state || now - state.windowStart >= this.options.windowMs) {
      state = { windowStart: now, count: 0 };
      this.windows.set(key, state);
    }

    if (state.count >= this.options.maxRequests) {
      return { allowed: false, remaining: 0 };
    }

    state.count += 1;
    return { allowed: true, remaining: this.options.maxRequests - state.count };
  }
}
