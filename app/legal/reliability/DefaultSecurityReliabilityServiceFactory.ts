import { DefaultErrorClassifier } from "./DefaultErrorClassifier";
import { DefaultRetryPolicy } from "./DefaultRetryPolicy";
import { DefaultTimeoutPolicy } from "./DefaultTimeoutPolicy";
import { InMemoryCircuitBreaker } from "./InMemoryCircuitBreaker";
import type { SecurityReliabilityService } from "./SecurityReliabilityService";
import { DefaultInputValidator } from "../security/DefaultInputValidator";
import { InMemoryRateLimiter } from "../security/InMemoryRateLimiter";

const DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD = 5;
const DEFAULT_CIRCUIT_BREAKER_RESET_TIMEOUT_MS = 30_000;
const DEFAULT_RATE_LIMITER_MAX_REQUESTS = 100;
const DEFAULT_RATE_LIMITER_WINDOW_MS = 60_000;

export interface SecurityReliabilityServiceFactory {
  create(): SecurityReliabilityService;
}

export class DefaultSecurityReliabilityServiceFactory
  implements SecurityReliabilityServiceFactory
{
  create(): SecurityReliabilityService {
    return {
      retryPolicy: new DefaultRetryPolicy(),
      timeoutPolicy: new DefaultTimeoutPolicy(),
      circuitBreaker: new InMemoryCircuitBreaker({
        failureThreshold: DEFAULT_CIRCUIT_BREAKER_FAILURE_THRESHOLD,
        resetTimeoutMs: DEFAULT_CIRCUIT_BREAKER_RESET_TIMEOUT_MS,
      }),
      rateLimiter: new InMemoryRateLimiter({
        maxRequests: DEFAULT_RATE_LIMITER_MAX_REQUESTS,
        windowMs: DEFAULT_RATE_LIMITER_WINDOW_MS,
      }),
      inputValidator: new DefaultInputValidator(),
      errorClassifier: new DefaultErrorClassifier(),
    };
  }
}
