import type { CircuitBreaker } from "./CircuitBreaker";
import type { CircuitBreakerState } from "./CircuitBreakerState";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  resetTimeoutMs: number;
}

const DEFAULT_CLOCK = (): number => Date.now();

export class InMemoryCircuitBreaker implements CircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private failureCount = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly options: CircuitBreakerOptions,
    private readonly clock: () => number = DEFAULT_CLOCK,
  ) {}

  getState(): CircuitBreakerState {
    if (this.state === "open" && this.openedAt !== null) {
      const elapsed = this.clock() - this.openedAt;
      if (elapsed >= this.options.resetTimeoutMs) {
        this.state = "half-open";
      }
    }

    return this.state;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.getState() === "open") {
      throw new Error("circuit breaker is open");
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.openedAt = null;
  }

  private onSuccess(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.openedAt = null;
  }

  private onFailure(): void {
    this.failureCount += 1;

    if (this.state === "half-open" || this.failureCount >= this.options.failureThreshold) {
      this.state = "open";
      this.openedAt = this.clock();
      this.failureCount = 0;
    }
  }
}
