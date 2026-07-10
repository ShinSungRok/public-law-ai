export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  isRetryable?: (error: unknown) => boolean;
}
