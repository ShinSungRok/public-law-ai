import { TimeoutError } from "./TimeoutError";
import type { TimeoutPolicy } from "./TimeoutPolicy";

export class DefaultTimeoutPolicy implements TimeoutPolicy {
  async execute<T>(operation: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;

    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new TimeoutError(`operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([operation(), timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }
}
