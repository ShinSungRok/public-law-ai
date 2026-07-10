import type { CircuitBreaker } from "./CircuitBreaker";
import type { ErrorClassifier } from "./ErrorClassifier";
import type { RetryPolicy } from "./RetryPolicy";
import type { TimeoutPolicy } from "./TimeoutPolicy";
import type { InputValidator } from "../security/InputValidator";
import type { RateLimiter } from "../security/RateLimiter";

export interface SecurityReliabilityService {
  retryPolicy: RetryPolicy;
  timeoutPolicy: TimeoutPolicy;
  circuitBreaker: CircuitBreaker;
  rateLimiter: RateLimiter;
  inputValidator: InputValidator;
  errorClassifier: ErrorClassifier;
}
