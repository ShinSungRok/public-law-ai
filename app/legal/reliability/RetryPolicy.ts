import type { RetryOptions } from "./RetryOptions";

export interface RetryPolicy {
  execute<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T>;
}
