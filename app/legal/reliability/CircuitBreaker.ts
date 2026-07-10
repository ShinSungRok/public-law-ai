import type { CircuitBreakerState } from "./CircuitBreakerState";

export interface CircuitBreaker {
  getState(): CircuitBreakerState;
  execute<T>(operation: () => Promise<T>): Promise<T>;
}
