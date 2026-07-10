import type { RateLimitResult } from "./RateLimitResult";

export interface RateLimiter {
  consume(key: string): RateLimitResult;
}
