import type { RetryOptions } from "./RetryOptions";
import type { RetryPolicy } from "./RetryPolicy";

export type RetryDelay = (delayMs: number) => Promise<void>;

const DEFAULT_DELAY: RetryDelay = (delayMs) =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export class DefaultRetryPolicy implements RetryPolicy {
  constructor(private readonly delay: RetryDelay = DEFAULT_DELAY) {}

  async execute<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
    const { maxAttempts, delayMs, isRetryable } = options;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;

        const canRetry = attempt < maxAttempts && (isRetryable ? isRetryable(error) : true);
        if (!canRetry) {
          throw error;
        }

        await this.delay(delayMs);
      }
    }

    throw lastError;
  }
}
